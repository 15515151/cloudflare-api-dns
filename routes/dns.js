const express = require('express');
const db = require('../lib/database');
const CloudflareAPI = require('../lib/cloudflare');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 所有 DNS 路由都需要登录
router.use(authenticate);

// 获取 Cloudflare API 实例
function getCF(req) {
    return new CloudflareAPI(req.config.cloudflare.apiToken, req.config.cloudflare.zoneId);
}

// 检查子域名是否可用（同时检查本地数据库和 Cloudflare）
router.get('/check/:subdomain', async (req, res) => {
    try {
        const { subdomain } = req.params;

        // 验证子域名格式
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(subdomain)) {
            return res.status(400).json({ error: '子域名格式不正确', available: false });
        }

        // 禁止的子域名
        const reserved = ['www', 'mail', 'ftp', 'ns1', 'ns2', 'admin', 'api', 'mx', 'smtp', 'pop', 'imap', '@'];
        if (reserved.includes(subdomain.toLowerCase())) {
            return res.status(400).json({ error: '该子域名为保留域名', available: false });
        }

        // 1. 检查本地数据库
        const existing = db.getDomainBySubdomain(subdomain);
        if (existing) {
            return res.json({ available: false, subdomain, source: 'local' });
        }

        // 2. 检查 Cloudflare 是否已有该记录（防止在 CF 后台手动添加的记录被覆盖）
        const cf = getCF(req);
        const fullDomain = `${subdomain}.${req.config.site.domain}`;
        try {
            const cfRecords = await cf.listRecords({ name: fullDomain });
            if (cfRecords && cfRecords.length > 0) {
                return res.json({ available: false, subdomain, source: 'cloudflare' });
            }
        } catch (e) {
            console.warn('Cloudflare 检查失败，仅使用本地数据库结果:', e.message);
        }

        res.json({ available: true, subdomain });
    } catch (err) {
        console.error('检查子域名失败:', err);
        res.status(500).json({ error: '检查失败' });
    }
});

// 获取当前用户的域名记录
router.get('/records', (req, res) => {
    try {
        const records = db.getDomainsByUser(req.user.id);
        const userQuota = db.getUserDomainQuota(req.user.id);
        const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
        const quota = userQuota !== null ? userQuota : defaultQuota;
        res.json({ records, quota });
    } catch (err) {
        console.error('获取域名记录失败:', err);
        res.status(500).json({ error: '获取记录失败' });
    }
});

// 创建域名记录
router.post('/records', async (req, res) => {
    try {
        const { subdomain, recordType, recordValue, proxied, remark } = req.body;

        // 验证参数
        if (!subdomain || !recordType || !recordValue) {
            return res.status(400).json({ error: '请填写完整信息' });
        }

        // 验证子域名格式
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(subdomain)) {
            return res.status(400).json({ error: '子域名格式不正确，仅允许字母、数字和连字符' });
        }

        // 验证记录类型
        const allowedTypes = req.config.limits.allowedRecordTypes;
        if (!allowedTypes.includes(recordType)) {
            return res.status(400).json({ error: `不支持的记录类型，允许: ${allowedTypes.join(', ')}` });
        }

        // 验证记录值
        if (recordType === 'A' && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(recordValue)) {
            return res.status(400).json({ error: 'A 记录值必须是有效的 IPv4 地址' });
        }
        if (recordType === 'AAAA' && !/^[0-9a-fA-F:]+$/.test(recordValue)) {
            return res.status(400).json({ error: 'AAAA 记录值必须是有效的 IPv6 地址' });
        }

        // 检查额度 - 优先使用用户个人配额，否则使用默认配额
        const count = db.countUserDomains(req.user.id);
        const userQuota = db.getUserDomainQuota(req.user.id);
        const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
        const maxDomains = userQuota !== null ? userQuota : defaultQuota;
        if (count >= maxDomains) {
            return res.status(400).json({ error: `已达到域名数量上限 (${maxDomains})` });
        }

        // 检查子域名是否已存在（本地数据库）
        const existing = db.getDomainBySubdomain(subdomain);
        if (existing) {
            return res.status(400).json({ error: '该子域名已被占用' });
        }

        // 检查子域名是否已存在（Cloudflare）
        const cf = getCF(req);
        const fullDomain = `${subdomain}.${req.config.site.domain}`;
        try {
            const cfRecords = await cf.listRecords({ name: fullDomain });
            if (cfRecords && cfRecords.length > 0) {
                return res.status(400).json({ error: '该子域名已在 DNS 中存在（Cloudflare 已有记录）' });
            }
        } catch (e) {
            console.warn('Cloudflare 预检查失败:', e.message);
        }

        // 禁止的子域名
        const reserved = ['www', 'mail', 'ftp', 'ns1', 'ns2', 'admin', 'api', 'mx', 'smtp', 'pop', 'imap', '@'];
        if (reserved.includes(subdomain.toLowerCase())) {
            return res.status(400).json({ error: '该子域名为保留域名' });
        }

        // 调用 Cloudflare API 创建记录（cf 和 fullDomain 已在上面声明）
        const shouldProxy = ['A', 'AAAA', 'CNAME'].includes(recordType) ? (proxied || false) : false;

        const cfRecord = await cf.createRecord(recordType, fullDomain, recordValue, shouldProxy, 1);

        // 保存到数据库
        const id = db.createDomain(
            req.user.id, subdomain, recordType, recordValue,
            cfRecord.id, shouldProxy, 1, remark
        );

        res.json({
            message: '域名创建成功',
            record: {
                id,
                subdomain,
                fullDomain,
                recordType,
                recordValue,
                proxied: shouldProxy,
                remark
            }
        });
    } catch (err) {
        console.error('创建域名记录失败:', err);
        res.status(500).json({ error: err.message || '创建失败，请重试' });
    }
});

// 修改域名记录
router.put('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { recordValue, proxied, remark } = req.body;

        const domain = db.getDomainById(id);
        if (!domain) {
            return res.status(404).json({ error: '记录不存在' });
        }
        if (domain.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权操作此记录' });
        }
        if (domain.status === 'admin_suspended') {
            return res.status(403).json({ error: '该域名已被管理员禁用，无法修改' });
        }

        if (!recordValue) {
            return res.status(400).json({ error: '请填写记录值' });
        }

        // 更新 Cloudflare
        const cf = getCF(req);
        await cf.updateRecord(domain.cf_record_id, {
            content: recordValue,
            proxied: ['A', 'AAAA', 'CNAME'].includes(domain.record_type) ? (proxied || false) : false
        });

        // 更新数据库
        db.updateDomain(id, recordValue, proxied, domain.ttl, remark);

        res.json({ message: '修改成功' });
    } catch (err) {
        console.error('修改域名记录失败:', err);
        res.status(500).json({ error: err.message || '修改失败，请重试' });
    }
});

// 删除域名记录
router.delete('/records/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const domain = db.getDomainById(id);
        if (!domain) {
            return res.status(404).json({ error: '记录不存在' });
        }
        if (domain.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权操作此记录' });
        }
        if (domain.status === 'admin_suspended') {
            return res.status(403).json({ error: '该域名已被管理员禁用，无法删除' });
        }

        // 从 Cloudflare 删除
        const cf = getCF(req);
        try {
            await cf.deleteRecord(domain.cf_record_id);
        } catch (e) {
            console.warn('Cloudflare 删除可能已不存在:', e.message);
        }

        // 从数据库删除
        db.deleteDomain(id);

        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除域名记录失败:', err);
        res.status(500).json({ error: err.message || '删除失败，请重试' });
    }
});

// 获取未读通知
router.get('/notifications', (req, res) => {
    try {
        const notifications = db.getUnreadNotifications(req.user.id);
        res.json({ notifications });
    } catch (err) {
        res.status(500).json({ error: '获取通知失败' });
    }
});

// 标记通知已读
router.post('/notifications/read', (req, res) => {
    try {
        db.markNotificationsRead(req.user.id);
        res.json({ message: 'ok' });
    } catch (err) {
        res.status(500).json({ error: '操作失败' });
    }
});

module.exports = router;

