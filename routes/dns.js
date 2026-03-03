const express = require('express');
const db = require('../lib/database');
const { authenticate } = require('../middleware/auth');
const { getCF } = require('../lib/helpers');

const router = express.Router();

// 所有 DNS 路由都需要登录
router.use(authenticate);


// 验证域名是否在启用列表中
function isEnabledDomain(req, domain) {
    const domains = req.config.domains || [];
    if (domains.length === 0) return domain === req.config.site.domain;
    return domains.some(d => d.domain === domain && d.enabled);
}

// 检查子域名是否可用（同时检查本地数据库和 Cloudflare）
router.get('/check/:subdomain', async (req, res) => {
    try {
        const { subdomain } = req.params;
        const domain = req.query.domain || req.config.site.domain;

        if (!isEnabledDomain(req, domain)) {
            return res.status(400).json({ error: '该域名不可用', available: false });
        }

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
        const existing = db.getDomainBySubdomain(subdomain, domain);
        if (existing) {
            return res.json({ available: false, subdomain, source: 'local' });
        }

        // 2. 检查 Cloudflare 是否已有该记录（管理员在 CF 后台手动添加的记录不允许被占用）
        const cf = getCF(req, domain);
        const fullDomain = `${subdomain}.${domain}`;
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
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
        const offset = (page - 1) * pageSize;
        const total = db.countDomainsByUser(req.user.id);
        const records = db.getDomainsByUserPaginated(req.user.id, pageSize, offset);
        const userQuota = db.getUserDomainQuota(req.user.id);
        const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
        const quota = userQuota !== null ? userQuota : defaultQuota;
        const quotaUsed = db.countUserDomains(req.user.id);
        res.json({ records, quota, total, quotaUsed, page, pageSize });
    } catch (err) {
        console.error('获取域名记录失败:', err);
        res.status(500).json({ error: '获取记录失败' });
    }
});

// 创建域名记录
router.post('/records', async (req, res) => {
    try {
        const { subdomain, recordType, recordValue, proxied, remark } = req.body;
        const domain = req.body.domain || req.config.site.domain;

        if (!isEnabledDomain(req, domain)) {
            return res.status(400).json({ error: '该域名不可用' });
        }

        // 验证参数
        if (!subdomain || !recordType || !recordValue) {
            return res.status(400).json({ error: '请填写完整信息' });
        }

        // 验证子域名格式和长度
        if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(subdomain) || subdomain.length > 63) {
            return res.status(400).json({ error: '子域名格式不正确，仅允许字母、数字和连字符，且不超过63个字符' });
        }

        // 禁止的子域名（包含 DNS 验证子域）
        const reserved = ['www', 'mail', 'ftp', 'ns1', 'ns2', 'admin', 'api', 'mx', 'smtp', 'pop', 'imap', '@',
            'alidnscheck', '_dnsauth', '_dnspodcheck', '_huaweidns-challenge'];
        if (reserved.includes(subdomain.toLowerCase())) {
            return res.status(400).json({ error: '该子域名为保留域名' });
        }

        // 验证记录类型
        const allowedTypes = req.config.limits.allowedRecordTypes;
        if (!allowedTypes.includes(recordType)) {
            return res.status(400).json({ error: `不支持的记录类型，允许: ${allowedTypes.join(', ')}` });
        }

        // 验证记录值
        if (recordType === 'A') {
            const parts = recordValue.split('.');
            if (parts.length !== 4 || !parts.every(p => /^\d+$/.test(p) && parseInt(p) <= 255)) {
                return res.status(400).json({ error: 'A 记录值必须是有效的 IPv4 地址' });
            }
        }
        if (recordType === 'AAAA') {
            // 使用 URL API 验证 IPv6 地址
            try { new URL(`http://[${recordValue}]`); } catch {
                return res.status(400).json({ error: 'AAAA 记录值必须是有效的 IPv6 地址' });
            }
        }
        if (recordType === 'CNAME') {
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/.test(recordValue) || recordValue.length > 253) {
                return res.status(400).json({ error: 'CNAME 记录值必须是有效的域名' });
            }
        }
        if (recordType === 'MX') {
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/.test(recordValue) || recordValue.length > 253) {
                return res.status(400).json({ error: 'MX 记录值必须是有效的域名' });
            }
        }
        if (recordType === 'TXT') {
            if (recordValue.length > 255) {
                return res.status(400).json({ error: 'TXT 记录值不能超过 255 个字符' });
            }
        }
        if (recordType === 'NS') {
            if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-\.]*[a-zA-Z0-9])?$/.test(recordValue) || recordValue.length > 253) {
                return res.status(400).json({ error: 'NS 记录值必须是有效的域名' });
            }
        }

        // 检查额度 - 优先使用用户个人配额，否则使用默认配额
        const count = db.countUserDomains(req.user.id);
        const userQuota = db.getUserDomainQuota(req.user.id);
        const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
        const maxDomains = userQuota !== null ? userQuota : defaultQuota;
        if (count >= maxDomains) {
            return res.status(400).json({ error: `已达到域名数量上限 (${maxDomains})` });
        }

        // 允许同一子域名添加多条记录的类型（NS/TXT/MX），但必须是同一用户
        const multiRecordTypes = ['NS', 'TXT', 'MX'];
        const isMultiType = multiRecordTypes.includes(recordType);

        // 检查子域名是否已存在（本地数据库）
        // 数据库与 Cloudflare 交叉比对
        const existing = db.getDomainBySubdomain(subdomain, domain);
        const cf = getCF(req, domain);
        const fullDomain = `${subdomain}.${domain}`;
        let cfRecords = [];
        try {
            cfRecords = await cf.listRecords({ name: fullDomain }) || [];
        } catch (e) {
            console.warn('Cloudflare 预检查失败:', e.message);
        }

        if (existing) {
            // 本地数据库已有该子域名的记录
            if (!isMultiType) {
                // 单记录类型（A/AAAA/CNAME）：同一子域名只能有一条
                return res.status(400).json({ error: '该子域名已被占用' });
            }
            // 多记录类型：必须是同一用户才能继续添加
            if (existing.user_id !== req.user.id) {
                return res.status(400).json({ error: '该子域名已被其他用户占用' });
            }
            // 检查本地数据库是否有完全相同的记录
            const exactDup = db.getDomainBySubdomainTypeValue(subdomain, domain, recordType, recordValue);
            if (exactDup) {
                return res.status(400).json({ error: '该记录已存在（相同类型和值）' });
            }
            // 检查 CF 是否有完全相同 type+value 的记录（防止 CF 侧重复）
            const cfDup = cfRecords.find(r => r.type === recordType && r.content === recordValue);
            if (cfDup) {
                return res.status(400).json({ error: '该记录已在 Cloudflare 中存在（相同类型和值）' });
            }
            // 同一用户 + 多记录类型 + 不重复 → 允许添加
        } else {
            // 本地数据库无记录：如果 CF 有记录，说明是管理员手动添加的，不允许占用
            if (cfRecords.length > 0) {
                return res.status(400).json({ error: '该子域名已在 DNS 中存在（Cloudflare 已有记录）' });
            }
        }

        // 调用 Cloudflare API 创建记录（cf 和 fullDomain 已在上面声明）
        const shouldProxy = ['A', 'AAAA', 'CNAME'].includes(recordType) ? (proxied || false) : false;

        const cfRecord = await cf.createRecord(recordType, fullDomain, recordValue, shouldProxy, 1);

        // 保存到数据库
        const id = db.createDomain(
            req.user.id, subdomain, domain, recordType, recordValue,
            cfRecord.id, shouldProxy, 1, remark
        );

        res.json({
            message: '域名创建成功',
            record: {
                id,
                subdomain,
                domain,
                fullDomain,
                recordType,
                recordValue,
                proxied: shouldProxy,
                remark
            }
        });
        console.log(`[DNS 创建] 用户=${req.user.username}(${req.user.id}) ${fullDomain} ${recordType}=${recordValue}`);
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
        const cf = getCF(req, domain.domain);
        await cf.updateRecord(domain.cf_record_id, {
            content: recordValue,
            proxied: ['A', 'AAAA', 'CNAME'].includes(domain.record_type) ? (proxied || false) : false
        });

        // 更新数据库
        db.updateDomain(id, recordValue, proxied, domain.ttl, remark);
        console.log(`[DNS 修改] 用户=${req.user.username}(${req.user.id}) id=${id} 新值=${recordValue}`);
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

        // 从数据库删除
        db.deleteDomain(id);
        console.log(`[DNS 删除] 用户=${req.user.username}(${req.user.id}) ${domain.subdomain}.${domain.domain} id=${id}`);
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

// DNS 验证子域名与平台的映射
const DNS_VERIFY_PROVIDERS = {
    aliyun: { name: '阿里云 (Alidns)', verifyPrefix: 'alidnscheck' },
    tencent: { name: '腾讯云 (DNSPod)', verifyPrefix: '_dnsauth' },
    huawei: { name: '华为云 DNS', verifyPrefix: '_huaweidns-challenge' },
};
const VERIFY_DURATION_MS = 5 * 60 * 1000; // 5 分钟

// 申请 DNS 托管验证
router.post('/verify', async (req, res) => {
    try {
        const { subdomain, domain, provider, txtValue } = req.body;
        if (!subdomain || !domain || !provider || !txtValue) {
            return res.status(400).json({ error: '请填写完整信息' });
        }

        const providerInfo = DNS_VERIFY_PROVIDERS[provider];
        if (!providerInfo) {
            return res.status(400).json({ error: '不支持的 DNS 平台' });
        }

        // 检查用户是否拥有该子域名
        const userDomain = db.getDomainBySubdomain(subdomain, domain);
        if (!userDomain || userDomain.user_id !== req.user.id) {
            return res.status(403).json({ error: '你没有该子域名的权限' });
        }

        // 构造验证子域名：如 alidnscheck 验证主域名
        const verifySubdomain = providerInfo.verifyPrefix;
        const fullVerifyDomain = `${verifySubdomain}.${domain}`;

        // 检查是否已有进行中的验证（先到先得）
        const activeVerify = db.getActiveVerification(verifySubdomain, domain);
        if (activeVerify) {
            if (activeVerify.user_id === req.user.id) {
                return res.status(400).json({ error: '你已有一个进行中的验证请求，请等待到期后再试' });
            }
            return res.status(409).json({ error: '该子域名正在被其他用户验证中，请稍后再试（5分钟内）' });
        }

        // 在 Cloudflare 创建 TXT 记录
        const cf = getCF(req, domain);
        const cfRecord = await cf.createRecord('TXT', fullVerifyDomain, txtValue, false, 1);

        // 保存到数据库
        const expiresAt = new Date(Date.now() + VERIFY_DURATION_MS).toISOString();
        const result = db.createVerification(req.user.id, subdomain, domain, provider, verifySubdomain, txtValue, cfRecord.id, expiresAt);
        const verifyId = result.lastInsertRowid;

        console.log(`[DNS 验证] 用户=${req.user.username}(${req.user.id}) ${fullVerifyDomain} TXT=${txtValue} 平台=${provider}`);

        // 5 分钟后自动删除
        setTimeout(async () => {
            // 先检查是否已经被用户手动删除了
            const existing = db.getVerificationById(verifyId);
            if (!existing) {
                console.log(`[DNS 验证过期] 记录 ${fullVerifyDomain} 早已由用户手动删除，跳过自动清理`);
                return;
            }

            try {
                await cf.deleteRecord(cfRecord.id);
                console.log(`[DNS 验证过期] 已自动删除 CF 记录 ${fullVerifyDomain}`);
            } catch (e) {
                console.warn(`[DNS 验证过期] CF 删除失败: ${e.message}`);
                // 尝试反查删除
                try {
                    const records = await cf.listRecords({ name: fullVerifyDomain });
                    const match = records && records.find(r => r.type === 'TXT' && r.content === txtValue);
                    if (match) await cf.deleteRecord(match.id);
                } catch (e2) { console.warn('[DNS 验证过期] 反查删除也失败:', e2.message); }
            }
            db.deleteVerification(verifyId);
        }, VERIFY_DURATION_MS);

        res.json({
            message: '验证 TXT 记录已创建，请在 5 分钟内完成验证',
            verification: {
                id: verifyId,
                verifyDomain: fullVerifyDomain,
                txtValue,
                provider: providerInfo.name,
                expiresAt
            }
        });
    } catch (err) {
        console.error('创建DNS验证失败:', err);
        res.status(500).json({ error: err.message || '创建验证失败' });
    }
});

// 查询验证状态
router.get('/verify/status', (req, res) => {
    try {
        const verifications = db.getUserVerifications(req.user.id);
        res.json({ verifications });
    } catch (err) {
        res.status(500).json({ error: '查询失败' });
    }
});

// 手动完成验证并删除TXT记录
router.delete('/verify/:id', async (req, res) => {
    try {
        const verifyId = req.params.id;
        const verification = db.getVerificationById(verifyId);

        if (!verification || verification.user_id !== req.user.id) {
            return res.status(404).json({ error: '找不到该验证记录或无权操作' });
        }

        const cf = getCF(req, verification.domain);

        // 尝试从 CF 删除记录
        try {
            await cf.deleteRecord(verification.cf_record_id);
            console.log(`[DNS 验证手动完成] 用户=${req.user.username}(${req.user.id}) 已删除 CF 记录 ${verification.verify_subdomain}.${verification.domain}`);
        } catch (e) {
            console.warn(`[DNS 验证手动完成] CF 删除失败: ${e.message}`);
            // 尝试反查删除
            try {
                const fullVerifyDomain = `${verification.verify_subdomain}.${verification.domain}`;
                const records = await cf.listRecords({ name: fullVerifyDomain });
                const match = records && records.find(r => r.type === 'TXT' && r.content === verification.txt_value);
                if (match) await cf.deleteRecord(match.id);
            } catch (e2) { console.warn('[DNS 验证手动完成] 反查删除也失败:', e2.message); }
        }

        // 从数据库删除
        db.deleteVerification(verifyId);

        res.json({ success: true, message: '验证记录已删除' });
    } catch (err) {
        console.error('删除验证记录失败:', err);
        res.status(500).json({ error: err.message || '删除记录失败' });
    }
});

module.exports = router;

