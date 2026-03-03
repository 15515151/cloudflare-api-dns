const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

let db;

function init(config) {
    db = new Database(process.env.DB_PATH || path.join(__dirname, '..', 'data.db'));
    db.pragma('journal_mode = WAL');

    // 创建用户表
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      domain_quota INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 创建系统配置表
    db.exec(`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 初始化默认系统配置
    const settings = db.prepare('SELECT COUNT(*) as count FROM system_config').get();
    if (settings.count === 0) {
        db.prepare('INSERT INTO system_config (key, value) VALUES (?, ?)').run('allow_register', 'true');
        db.prepare('INSERT INTO system_config (key, value) VALUES (?, ?)').run('allow_oauth_register', 'true');
        db.prepare('INSERT INTO system_config (key, value) VALUES (?, ?)').run('allow_github_register', 'true');
        db.prepare('INSERT INTO system_config (key, value) VALUES (?, ?)').run('default_domain_quota', String(config.limits?.maxDomainsPerUser || 10));
    }

    // 创建域名记录表
    db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subdomain TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT '',
      record_type TEXT NOT NULL,
      record_value TEXT NOT NULL,
      cf_record_id TEXT,
      proxied INTEGER DEFAULT 0,
      ttl INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(subdomain, domain, record_type)
    )
  `);

    // 迁移：旧数据库可能没有 domain 字段
    try {
        db.exec(`ALTER TABLE domains ADD COLUMN domain TEXT NOT NULL DEFAULT ''`);
    } catch (e) { /* 字段已存在，忽略 */ }

    // 创建通知表
    db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 创建积分订单表
    db.exec(`
    CREATE TABLE IF NOT EXISTS credit_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      out_trade_no TEXT UNIQUE NOT NULL,
      money TEXT NOT NULL,
      status INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 创建默认管理员
    const admin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
    if (!admin && config.admin) {
        const hash = bcrypt.hashSync(config.admin.password, 10);
        db.prepare(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)'
        ).run(config.admin.username, `${config.admin.username}@local`, hash, 'admin');
        console.log('✅ 已创建默认管理员账号');
    }
}

// 用户操作
function createUser(username, email, password) {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)'
    ).run(username, email, hash);
    return result.lastInsertRowid;
}

function getUserByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function getUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function getUserById(id) {
    return db.prepare('SELECT id, username, email, role, status, created_at FROM users WHERE id = ?').get(id);
}

function getUserWithPasswordById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getAllUsers() {
    return db.prepare('SELECT id, username, email, role, status, domain_quota, created_at FROM users ORDER BY created_at DESC').all();
}

function getAllUsersPaginated(limit, offset) {
    return db.prepare('SELECT id, username, email, role, status, domain_quota, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset || 0);
}

function countAllUsers() {
    return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
}

function updateUserStatus(id, status) {
    return db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
}

function updateUserPassword(id, newPassword) {
    const hash = bcrypt.hashSync(newPassword, 10);
    return db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, id);
}

// OAuth 用户：根据 email 查找或创建（事务防竞态）
function createOrGetOAuthUser(username, email) {
    return db.transaction(() => {
        let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (user) return user;
        let finalName = username;
        if (db.prepare('SELECT id FROM users WHERE username = ?').get(finalName)) {
            finalName = username + '_' + Math.random().toString(36).slice(2, 6);
        }
        const hash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
        db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(finalName, email, hash);
        return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    })();
}

// 域名操作
function createDomain(userId, subdomain, domain, recordType, recordValue, cfRecordId, proxied, ttl, remark) {
    const result = db.prepare(
        `INSERT INTO domains (user_id, subdomain, domain, record_type, record_value, cf_record_id, proxied, ttl, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, subdomain, domain || '', recordType, recordValue, cfRecordId, proxied ? 1 : 0, ttl, remark || '');
    return result.lastInsertRowid;
}

function getDomainsByUser(userId) {
    return db.prepare('SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function getDomainsByUserPaginated(userId, limit, offset) {
    return db.prepare('SELECT * FROM domains WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(userId, limit, offset || 0);
}

function countDomainsByUser(userId) {
    return db.prepare('SELECT COUNT(*) as count FROM domains WHERE user_id = ?').get(userId).count;
}

function getDomainById(id) {
    return db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
}

function getDomainBySubdomain(subdomain, domain) {
    if (domain) {
        return db.prepare('SELECT * FROM domains WHERE subdomain = ? AND domain = ?').get(subdomain, domain);
    }
    return db.prepare('SELECT * FROM domains WHERE subdomain = ?').get(subdomain);
}

function getAllDomains(limit, offset) {
    if (limit !== undefined) {
        return db.prepare(`
        SELECT d.*, u.username FROM domains d
        LEFT JOIN users u ON d.user_id = u.id
        ORDER BY d.created_at DESC LIMIT ? OFFSET ?
        `).all(limit, offset || 0);
    }
    return db.prepare(`
    SELECT d.*, u.username
    FROM domains d
    LEFT JOIN users u ON d.user_id = u.id
    ORDER BY d.created_at DESC
  `).all();
}

function countAllDomains() {
    return db.prepare('SELECT COUNT(*) as count FROM domains').get().count;
}

function countActiveDomains() {
    return db.prepare("SELECT COUNT(*) as count FROM domains WHERE status = 'active'").get().count;
}

function updateDomain(id, recordValue, proxied, ttl, remark) {
    return db.prepare(
        `UPDATE domains SET record_value = ?, proxied = ?, ttl = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(recordValue, proxied ? 1 : 0, ttl, remark || '', id);
}

function deleteDomain(id) {
    return db.prepare('DELETE FROM domains WHERE id = ?').run(id);
}

function suspendUserDomains(userId) {
    return db.prepare("UPDATE domains SET status = 'suspended', cf_record_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND status != 'admin_suspended'").run(userId);
}

function getActiveDomainsByUser(userId) {
    return db.prepare("SELECT * FROM domains WHERE user_id = ? AND status != 'suspended'").all(userId);
}

function getSuspendedDomainsByUser(userId) {
    return db.prepare("SELECT * FROM domains WHERE user_id = ? AND status = 'suspended'").all(userId);
}

function restoreUserDomains(userId, updates) {
    const stmt = db.prepare("UPDATE domains SET status = 'active', cf_record_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    for (const { id, cfRecordId } of updates) {
        stmt.run(cfRecordId, id);
    }
}

// 管理员禁用/恢复单个域名
function adminSuspendDomain(id) {
    return db.prepare("UPDATE domains SET status = 'admin_suspended', cf_record_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
}

function adminRestoreDomain(id, cfRecordId) {
    return db.prepare("UPDATE domains SET status = 'active', cf_record_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(cfRecordId, id);
}

function deleteUser(id) {
    return db.transaction(() => {
        db.prepare('DELETE FROM domains WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
    })();
}

function countUserDomains(userId) {
    const row = db.prepare("SELECT COUNT(*) as count FROM domains WHERE user_id = ? AND status != 'suspended'").get(userId);
    return row.count;
}

function countSearchDomains(keyword) {
    const like = `%${keyword}%`;
    return db.prepare(`
    SELECT COUNT(*) as count FROM domains d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.subdomain LIKE ? OR d.record_value LIKE ? OR u.username LIKE ?
  `).get(like, like, like).count;
}

function searchDomains(keyword, limit, offset) {
    const like = `%${keyword}%`;
    if (limit !== undefined) {
        return db.prepare(`
        SELECT d.*, u.username FROM domains d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.subdomain LIKE ? OR d.record_value LIKE ? OR u.username LIKE ?
        ORDER BY d.created_at DESC LIMIT ? OFFSET ?
      `).all(like, like, like, limit, offset || 0);
    }
    return db.prepare(`
    SELECT d.*, u.username FROM domains d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.subdomain LIKE ? OR d.record_value LIKE ? OR u.username LIKE ?
    ORDER BY d.created_at DESC
  `).all(like, like, like);
}

// 用户配额管理
function updateUserDomainQuota(userId, quota) {
    if (quota === null || quota === '') {
        return db.prepare('UPDATE users SET domain_quota = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    }
    return db.prepare('UPDATE users SET domain_quota = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quota, userId);
}

function getUserDomainQuota(userId) {
    const user = db.prepare('SELECT domain_quota FROM users WHERE id = ?').get(userId);
    return user ? user.domain_quota : null;
}

// 系统配置管理
function getSystemConfig(key) {
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
    return row ? row.value : null;
}

function getAllSystemConfig() {
    const rows = db.prepare('SELECT key, value FROM system_config').all();
    const config = {};
    rows.forEach(row => {
        config[row.key] = row.value;
    });
    return config;
}

function updateSystemConfig(key, value) {
    return db.prepare(`
        INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);
}

// 通知
function createNotification(userId, message) {
    return db.prepare('INSERT INTO notifications (user_id, message) VALUES (?, ?)').run(userId, message);
}

function getUnreadNotifications(userId) {
    return db.prepare('SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC').all(userId);
}

function markNotificationsRead(userId) {
    return db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}

// 积分订单
function createCreditOrder(userId, outTradeNo, money) {
    return db.prepare('INSERT INTO credit_orders (user_id, out_trade_no, money) VALUES (?, ?, ?)').run(userId, outTradeNo, money);
}

function getCreditOrder(outTradeNo) {
    return db.prepare('SELECT * FROM credit_orders WHERE out_trade_no = ?').get(outTradeNo);
}

function completeCreditOrder(outTradeNo) {
    return db.prepare('UPDATE credit_orders SET status = 1 WHERE out_trade_no = ? AND status = 0').run(outTradeNo);
}

module.exports = {
    init,
    createUser,
    getUserByUsername,
    getUserByEmail,
    getUserById,
    getAllUsers,
    getAllUsersPaginated,
    countAllUsers,
    updateUserStatus,
    updateUserPassword,
    createOrGetOAuthUser,
    getUserWithPasswordById,
    createDomain,
    getDomainsByUser,
    getDomainsByUserPaginated,
    countDomainsByUser,
    getDomainById,
    getDomainBySubdomain,
    getAllDomains,
    countAllDomains,
    countActiveDomains,
    countSearchDomains,
    updateDomain,
    deleteDomain,
    deleteUser,
    countUserDomains,
    searchDomains,
    updateUserDomainQuota,
    getSystemConfig,
    getAllSystemConfig,
    updateSystemConfig,
    getUserDomainQuota,
    createNotification,
    getUnreadNotifications,
    markNotificationsRead,
    suspendUserDomains,
    getActiveDomainsByUser,
    getSuspendedDomainsByUser,
    restoreUserDomains,
    adminSuspendDomain,
    adminRestoreDomain,
    createCreditOrder,
    getCreditOrder,
    completeCreditOrder
};
