const crypto = require('crypto');
const CloudflareAPI = require('./cloudflare');
const DNSPodAPI = require('./dnspod');

function generateState(secret) {
    const val = crypto.randomBytes(16).toString('hex');
    const sig = crypto.createHmac('sha256', secret).update(val).digest('hex');
    return `${val}.${sig}`;
}

function verifyState(state, secret) {
    if (!state) return false;
    const [val, sig] = state.split('.');
    if (!val || !sig) return false;
    const expected = crypto.createHmac('sha256', secret).update(val).digest('hex');
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function getCF(req, domain) {
    const domainConfig = (req.config.domains || []).find(d => d.domain === domain) || {};
    const provider = domainConfig.provider || 'cloudflare';

    if (provider === 'dnspod') {
        return new DNSPodAPI(
            req.config.dnspod.secretId,
            req.config.dnspod.secretKey,
            domain
        );
    } else {
        const zoneId = domainConfig.zoneId || req.config.cloudflare.zoneId;
        return new CloudflareAPI(req.config.cloudflare.apiToken, zoneId);
    }
}

// 安全地将 token/userData 注入 HTML，避免 XSS
function oauthRedirectHtml(token, userData) {
    // 转义 < > 防止 </script> 注入导致 XSS
    const safeToken = JSON.stringify(String(token)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const safeUser = JSON.stringify(JSON.stringify(userData)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    return `<!DOCTYPE html><html><head><title>登录中...</title></head><body><script>
  localStorage.setItem('token', ${safeToken});
  localStorage.setItem('user', ${safeUser});
  window.location.href = '/panel.html';
<\/script></body></html>`;
}

module.exports = { generateState, verifyState, getCF, oauthRedirectHtml };
