const express = require('express');
const crypto = require('crypto');
const db = require('../lib/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function getCredit(req) {
    return req.config.credit || {};
}

function makeSign(params, key) {
    const sorted = Object.keys(params)
        .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== undefined)
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('&');
    return crypto.createHash('md5').update(sorted + key).digest('hex');
}

// 创建订单，跳转到 Linux.Do Credit 支付页
router.post('/create', authenticate, (req, res) => {
    const credit = getCredit(req);
    if (!credit.pid) return res.status(400).json({ error: 'Credit 未配置' });

    const outTradeNo = `DNS${Date.now()}${req.user.id}`;
    const money = String(credit.creditsPerQuota || 50);

    db.createCreditOrder(req.user.id, outTradeNo, money);

    const params = {
        pid: credit.pid,
        type: 'epay',
        out_trade_no: outTradeNo,
        name: '域名配额兑换',
        money,
        notify_url: credit.notifyUrl,
        return_url: credit.returnUrl
    };
    params.sign = makeSign(params, credit.key);
    params.sign_type = 'MD5';

    const form = new URLSearchParams(params).toString();
    res.json({ payUrl: `https://credit.linux.do/epay/pay/submit.php`, params });
});

// 异步回调（GET）
router.get('/notify', async (req, res) => {
    const credit = getCredit(req);
    const query = req.query;

    if (query.trade_status !== 'TRADE_SUCCESS') return res.send('fail');

    // 验签
    const sign = makeSign(query, credit.key);
    if (sign !== query.sign) return res.send('fail');

    const order = db.getCreditOrder(query.out_trade_no);
    if (!order || order.status === 1) return res.send('success');

    const result = db.completeCreditOrder(query.out_trade_no);
    if (result.changes > 0) {
        // 增加用户配额
        const user = db.getUserById(order.user_id);
        const currentQuota = db.getUserDomainQuota(order.user_id);
        const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
        const base = currentQuota !== null ? currentQuota : defaultQuota;
        db.updateUserDomainQuota(order.user_id, base + 1);
        db.createNotification(order.user_id, `✅ 积分兑换成功！您的域名配额已增加 1 个。`);
    }

    res.send('success');
});

// 查询配置（前端用）
router.get('/config', authenticate, (req, res) => {
    const credit = getCredit(req);
    res.json({ enabled: !!credit.pid, creditsPerQuota: credit.creditsPerQuota || 50 });
});

module.exports = router;
