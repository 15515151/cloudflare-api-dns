const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../lib/database');

const router = express.Router();

router.get('/login', (req, res) => {
    const gh = req.config.github;
    if (!gh || !gh.clientId) return res.status(400).json({ error: 'GitHub OAuth 未配置' });
    const params = new URLSearchParams({
        client_id: gh.clientId,
        redirect_uri: gh.redirectUri,
        scope: 'user:email'
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/login.html?error=no_code');

    const gh = req.config.github;
    try {
        // 换取 access_token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ client_id: gh.clientId, client_secret: gh.clientSecret, code, redirect_uri: gh.redirectUri })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return res.redirect('/login.html?error=token_failed');

        // 获取用户信息
        const userRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' }
        });
        const userInfo = await userRes.json();
        if (!userInfo.login) return res.redirect('/login.html?error=user_info_failed');

        // 获取邮箱
        let email = userInfo.email;
        if (!email) {
            const emailRes = await fetch('https://api.github.com/user/emails', {
                headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' }
            });
            const emails = await emailRes.json();
            const primary = emails.find(e => e.primary && e.verified);
            email = primary ? primary.email : `${userInfo.login}@github.com`;
        }

        // 检查注册开关
        const existingUser = db.getUserByEmail(email);
        if (!existingUser) {
            const allowGithubRegister = db.getSystemConfig('allow_github_register');
            if (allowGithubRegister === 'false') return res.redirect('/login.html?error=registration_closed');
        }

        const localUser = db.createOrGetOAuthUser(userInfo.login, email);
        if (localUser.status !== 'active') return res.redirect('/login.html?error=account_disabled');

        const token = jwt.sign({ id: localUser.id }, req.config.site.jwtSecret, { expiresIn: '7d' });
        const userData = { id: localUser.id, username: localUser.username, email: localUser.email, role: localUser.role, status: localUser.status };

        res.send(`<!DOCTYPE html><html><head><title>登录中...</title></head><body><script>
  localStorage.setItem('token', '${token}');
  localStorage.setItem('user', '${JSON.stringify(userData).replace(/'/g, "\\'")}');
  window.location.href = '/panel.html';
</script></body></html>`);
    } catch (err) {
        console.error('GitHub OAuth 回调失败:', err);
        res.redirect('/login.html?error=oauth_failed');
    }
});

module.exports = router;
