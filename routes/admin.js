const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getCF } = require('../lib/helpers');

const router = express.Router();

// 管理员路由都需要登录 + 管理员权限
router.use(authenticate);
router.use(requireAdmin);

// 获取所有域名记录
router.get('/records', (req, res) => {
    try {
        const { keyword } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 50));
        const offset = (page - 1) * pageSize;

        let records, total;
        if (keyword) {
            total = db.countSearchDomains(keyword);
            records = db.searchDomains(keyword, pageSize, offset);
        } else {
            total = db.countAllDomains();
            records = db.getAllDomains(pageSize, offset);
        }
        res.json({ records, total, page, pageSize });
    } catch (err) {
        console.error('获取记录失败:', err);
        res.status(500).json({ error: '获取记录失败' });
    }
});

// 获取所有用户
router.get('/members', (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
        const offset = (page - 1) * pageSize;
        const total = db.countAllUsers();
        const users = db.getAllUsersPaginated(pageSize, offset);
        const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
        // 统计每个用户的域名数量和配额
        const usersWithCount = users.map(u => ({
            ...u,
            domainCount: db.countUserDomains(u.id),
            domainQuota: u.domain_quota !== null ? u.domain_quota : defaultQuota
        }));
        res.json({ users: usersWithCount, total, page, pageSize });
    } catch (err) {
        console.error('获取用户失败:', err);
        res.status(500).json({ error: '获取用户失败' });
    }
});

// 管理员编辑记录
router.put('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { recordValue, proxied, remark } = req.body;

        const domain = db.getDomainById(id);
        if (!domain) {
            return res.status(404).json({ error: '记录不存在' });
        }

        if (!recordValue) {
            return res.status(400).json({ error: '请填写记录值' });
        }

        // 更新 Cloudflare
        const cf = getCF(req, domain.domain);
        const shouldProxy = ['A', 'AAAA', 'CNAME'].includes(domain.record_type) ? (proxied || false) : false;
        await cf.updateRecord(domain.cf_record_id, {
            content: recordValue,
            proxied: shouldProxy
        });

        // 更新数据库
        db.updateDomain(id, recordValue, shouldProxy, domain.ttl, remark);

        res.json({ message: '修改成功' });
    } catch (err) {
        console.error('管理员编辑记录失败:', err);
        res.status(500).json({ error: err.message || '修改失败' });
    }
});

// 管理员删除记录
router.delete('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const domain = db.getDomainById(id);
        if (!domain) {
            return res.status(404).json({ error: '记录不存在' });
        }

        // 从 Cloudflare 删除（带反查补偿）
        const cf = getCF(req, domain.domain);
        const fullDomain = `${domain.subdomain}.${domain.domain}`;
        try {
            await cf.deleteRecord(domain.cf_record_id);
        } catch (e) {
            console.warn('Cloudflare 按 ID 删除失败，尝试按域名反查:', e.message);
            try {
                const cfRecords = await cf.listRecords({ name: fullDomain });
                const match = cfRecords && cfRecords.find(r => r.type === domain.record_type && r.content === domain.record_value);
                if (match) {
                    await cf.deleteRecord(match.id);
                    console.log(`Cloudflare 反查删除成功: ${match.id}`);
                } else {
                    console.warn('Cloudflare 未找到匹配记录，可能已被手动删除');
                }
            } catch (e2) {
                console.warn('Cloudflare 反查删除也失败:', e2.message);
            }
        }

        db.deleteDomain(id);
        db.createNotification(domain.user_id, `⚠️ 您的域名解析记录 ${domain.subdomain} (${domain.record_type}) 已被管理员删除。请确保您的使用符合服务条款，违规行为可能导致账号被封禁。`);
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除记录失败:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 修改用户状态
router.put('/members/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['active', 'disabled'].includes(status)) {
            return res.status(400).json({ error: '无效的状态值' });
        }

        const user = db.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        if (user.role === 'admin') {
            return res.status(400).json({ error: '不能修改管理员状态' });
        }

        db.updateUserStatus(id, status);

        if (status === 'disabled') {
            // 禁用：从 CF 删除解析但保留 DB 记录（suspended）
            const domains = db.getDomainsByUser(id);
            for (const d of domains) {
                try { await getCF(req, d.domain).deleteRecord(d.cf_record_id); } catch (e) { }
            }
            db.suspendUserDomains(id);
            db.createNotification(id, '⚠️ 您的账号已被管理员禁用，所有域名解析已停止。如有疑问请联系管理员。');
        } else if (status === 'active') {
            // 恢复：重新创建 CF 解析
            const suspended = db.getSuspendedDomainsByUser(id);
            const updates = [];
            for (const d of suspended) {
                try {
                    const fullName = `${d.subdomain}.${d.domain}`;
                    const record = await getCF(req, d.domain).createRecord(d.record_type, fullName, d.record_value, d.proxied === 1, d.ttl);
                    updates.push({ id: d.id, cfRecordId: record.id });
                } catch (e) { console.warn('恢复解析失败:', e.message); }
            }
            if (updates.length) db.restoreUserDomains(id, updates);
            db.createNotification(id, '✅ 您的账号已恢复正常，域名解析已重新生效。');
        }

        res.json({ message: `用户已${status === 'active' ? '启用' : '禁用'}` });
    } catch (err) {
        console.error('修改用户状态失败:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 删除用户
router.delete('/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = db.getUserById(id);
        if (!user) return res.status(404).json({ error: '用户不存在' });
        if (user.role === 'admin') return res.status(400).json({ error: '不能删除管理员' });

        const domains = db.getDomainsByUser(id);
        for (const d of domains) {
            try { await getCF(req, d.domain).deleteRecord(d.cf_record_id); } catch (e) { }
        }

        db.deleteUser(id);
        res.json({ message: '用户已删除' });
    } catch (err) {
        console.error('删除用户失败:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 修改用户密码（管理员）
router.put('/members/:id/password', (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6 || password.length > 64) {
            return res.status(400).json({ error: '密码长度需要 6-64 个字符' });
        }

        const user = db.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        db.updateUserPassword(id, password);
        res.json({ message: '密码修改成功' });
    } catch (err) {
        console.error('修改密码失败:', err);
        res.status(500).json({ error: '操作失败' });
    }
});

// 统计数据
router.get('/stats', (req, res) => {
    try {
        const totalUsers = db.countAllUsers();
        const totalRecords = db.countAllDomains();
        const activeRecords = db.countActiveDomains();
        res.json({ totalUsers, totalRecords, activeRecords });
    } catch (err) {
        console.error('获取统计失败:', err);
        res.status(500).json({ error: '获取统计失败' });
    }
});

// 修改用户域名配额
router.put('/members/:id/quota', (req, res) => {
    try {
        const { id } = req.params;
        const { quota } = req.body;

        const user = db.getUserById(id);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        if (user.role === 'admin') {
            return res.status(400).json({ error: '不能修改管理员配额' });
        }

        // quota 为 null 表示使用默认配额
        const newQuota = quota === null || quota === '' ? null : parseInt(quota);
        if (newQuota !== null && (isNaN(newQuota) || newQuota < 0)) {
            return res.status(400).json({ error: '配额必须是有效的数字' });
        }

        db.updateUserDomainQuota(id, newQuota);
        res.json({ message: '配额修改成功' });
    } catch (err) {
        console.error('修改配额失败:', err);
        res.status(500).json({ error: '修改配额失败' });
    }
});

// 获取系统设置
router.get('/settings', (req, res) => {
    try {
        const config = db.getAllSystemConfig();
        res.json({ settings: config });
    } catch (err) {
        console.error('获取系统设置失败:', err);
        res.status(500).json({ error: '获取系统设置失败' });
    }
});

// 更新系统设置
router.put('/settings', (req, res) => {
    try {
        const { allowRegister, allowOauthRegister, allowGithubRegister, defaultDomainQuota } = req.body;

        if (allowRegister !== undefined) {
            db.updateSystemConfig('allow_register', allowRegister ? 'true' : 'false');
        }

        if (allowOauthRegister !== undefined) {
            db.updateSystemConfig('allow_oauth_register', allowOauthRegister ? 'true' : 'false');
        }

        if (allowGithubRegister !== undefined) {
            db.updateSystemConfig('allow_github_register', allowGithubRegister ? 'true' : 'false');
        }

        if (defaultDomainQuota !== undefined) {
            const quota = parseInt(defaultDomainQuota);
            if (isNaN(quota) || quota < 0) {
                return res.status(400).json({ error: '默认配额必须是有效的正整数' });
            }
            db.updateSystemConfig('default_domain_quota', String(quota));
        }

        res.json({ message: '设置保存成功' });
    } catch (err) {
        console.error('更新系统设置失败:', err);
        res.status(500).json({ error: '更新系统设置失败' });
    }
});

// 管理员修改自己的密码
router.put('/admin/password', (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '请填写完整信息' });
        }
        if (newPassword.length < 6 || newPassword.length > 64) {
            return res.status(400).json({ error: '新密码长度需要 6-64 个字符' });
        }

        // 验证旧密码
        const bcrypt = require('bcryptjs');
        const currentUser = db.getUserWithPasswordById(req.user.id);
        if (!bcrypt.compareSync(oldPassword, currentUser.password)) {
            return res.status(400).json({ error: '原密码错误' });
        }

        db.updateUserPassword(req.user.id, newPassword);

        res.json({ message: '密码修改成功' });
    } catch (err) {
        console.error('修改密码失败:', err);
        res.status(500).json({ error: '修改密码失败' });
    }
});

// 管理员禁用/恢复单个域名记录
router.put('/records/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['admin_suspended', 'active'].includes(status)) {
            return res.status(400).json({ error: '无效的状态值' });
        }
        const domain = db.getDomainById(id);
        if (!domain) return res.status(404).json({ error: '记录不存在' });

        const cf = getCF(req, domain.domain);
        if (status === 'admin_suspended') {
            try { await cf.deleteRecord(domain.cf_record_id); } catch (e) { }
            db.adminSuspendDomain(id);
            db.createNotification(domain.user_id, `⚠️ 您的域名 ${domain.subdomain} (${domain.record_type}) 已被管理员暂停解析。`);
        } else {
            const fullName = `${domain.subdomain}.${domain.domain}`;
            const record = await cf.createRecord(domain.record_type, fullName, domain.record_value, domain.proxied === 1, domain.ttl);
            db.adminRestoreDomain(id, record.id);
            db.createNotification(domain.user_id, `✅ 您的域名 ${domain.subdomain} (${domain.record_type}) 已被管理员恢复解析。`);
        }
        res.json({ message: status === 'admin_suspended' ? '域名已暂停' : '域名已恢复' });
    } catch (err) {
        console.error('修改域名状态失败:', err);
        res.status(500).json({ error: err.message || '操作失败' });
    }
});

// 发送全站通知
router.post('/notify-all', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: '通知内容不能为空' });
        }

        const users = db.getAllUsers();
        let count = 0;
        for (const user of users) {
            db.createNotification(user.id, message);
            count++;
        }

        res.json({ message: `成功发送全站通知，覆盖 ${count} 名用户` });
    } catch (err) {
        console.error('发送全站通知失败:', err);
        res.status(500).json({ error: '发送系统通知失败' });
    }
});

module.exports = router;
