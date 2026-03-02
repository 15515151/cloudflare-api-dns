const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../lib/database');

const router = express.Router();

// OAuth2 配置从 req.config 获取
function getOAuthConfig(req) {
    return req.config.oauth || {};
}

// 重定向到 Linux.Do 授权页
router.get('/login', (req, res) => {
    const oauth = getOAuthConfig(req);
    if (!oauth.clientId) {
        return res.status(400).json({ error: 'OAuth2 未配置' });
    }

    const params = new URLSearchParams({
        client_id: oauth.clientId,
        redirect_uri: oauth.redirectUri,
        response_type: 'code',
        scope: 'user'
    });

    res.redirect(`${oauth.authUrl}?${params.toString()}`);
});

// OAuth2 回调处理
router.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.redirect('/login.html?error=no_code');
    }

    const oauth = getOAuthConfig(req);

    try {
        // 1. 用 code 换取 access_token
        const tokenBody = new URLSearchParams({
            client_id: oauth.clientId,
            client_secret: oauth.clientSecret,
            code: code,
            redirect_uri: oauth.redirectUri,
            grant_type: 'authorization_code'
        });

        const tokenRes = await fetch(oauth.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: tokenBody.toString()
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error('OAuth2 获取 token 失败:', tokenData);
            return res.redirect('/login.html?error=token_failed');
        }

        // 2. 用 access_token 获取用户信息
        const userRes = await fetch(oauth.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        const userInfo = await userRes.json();

        if (!userInfo.username) {
            console.error('OAuth2 获取用户信息失败:', userInfo);
            return res.redirect('/login.html?error=user_info_failed');
        }

        // 3. 查找或创建本地用户
        const email = userInfo.email || `${userInfo.username}@linux.do`;
        const existingUser = db.getUserByEmail(email);

        // 新用户注册时检查 OAuth 注册开关
        if (!existingUser) {
            const allowOauthRegister = db.getSystemConfig('allow_oauth_register');
            if (allowOauthRegister !== 'true') {
                return res.redirect('/login.html?error=registration_closed');
            }
        }

        const localUser = db.createOrGetOAuthUser(userInfo.username, email);

        if (localUser.status !== 'active') {
            return res.redirect('/login.html?error=account_disabled');
        }

        // 4. 签发 JWT
        const token = jwt.sign({ id: localUser.id }, req.config.site.jwtSecret, { expiresIn: '7d' });

        // 5. 返回到前端，让前端存储 token
        const userData = {
            id: localUser.id,
            username: localUser.username,
            email: localUser.email,
            role: localUser.role,
            status: localUser.status
        };

        // 通过页面内嵌脚本把 token 存入 localStorage，再跳转首页
        res.send(`<!DOCTYPE html>
<html><head><title>登录中...</title></head>
<body>
<script>
  localStorage.setItem('token', '${token}');
  localStorage.setItem('user', '${JSON.stringify(userData).replace(/'/g, "\\'")}');
  window.location.href = '/panel.html';
</script>
</body></html>`);

    } catch (err) {
        console.error('OAuth2 回调处理失败:', err);
        res.redirect('/login.html?error=oauth_failed');
    }
});

module.exports = router;
