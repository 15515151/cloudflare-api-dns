const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../lib/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 检查是否允许注册
        const allowRegister = db.getSystemConfig('allow_register');
        if (allowRegister !== 'true') {
            return res.status(403).json({ error: '当前暂不开放注册' });
        }

        if (!username || !email || !password) {
            return res.status(400).json({ error: '请填写完整信息' });
        }
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度需要 3-20 个字符' });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: '用户名只能包含字母、数字和下划线' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }
        if (password.length < 8 || password.length > 64 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({ error: '密码长度需要 8-64 个字符，且必须包含字母和数字' });
        }

        // 检查用户名是否已存在
        if (db.getUserByUsername(username)) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        // 检查邮箱是否已存在
        if (db.getUserByEmail(email)) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        const userId = db.createUser(username, email, password);
        const token = jwt.sign({ id: userId }, req.config.site.jwtSecret, { expiresIn: '7d' });
        const user = db.getUserById(userId);

        res.json({ token, user });
    } catch (err) {
        console.error('注册失败:', err);
        res.status(500).json({ error: '注册失败，请重试' });
    }
});

// 登录
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '请填写用户名和密码' });
        }

        const user = db.getUserByUsername(username);
        if (!user) {
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: '账号已被禁用' });
        }

        const token = jwt.sign({ id: user.id }, req.config.site.jwtSecret, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
        console.log(`[登录] 用户=${user.username}(${user.id}) IP=${req.ip}`);
    } catch (err) {
        console.error('登录失败:', err);
        res.status(500).json({ error: '登录失败，请重试' });
    }
});

// 获取当前用户信息
router.get('/me', authenticate, (req, res) => {
    res.json({ user: req.user });
});

// 修改密码（用户自己修改）
router.put('/password', authenticate, (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '请填写完整信息' });
        }
        if (newPassword.length < 8 || newPassword.length > 64 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({ error: '新密码长度需要 8-64 个字符，且必须包含字母和数字' });
        }

        // 验证旧密码
        const bcrypt = require('bcryptjs');
        const userWithPwd = db.getUserWithPasswordById(req.user.id);
        if (!bcrypt.compareSync(oldPassword, userWithPwd.password)) {
            return res.status(400).json({ error: '原密码错误' });
        }

        // 更新密码
        db.updateUserPassword(req.user.id, newPassword);

        res.json({ message: '密码修改成功' });
    } catch (err) {
        console.error('修改密码失败:', err);
        res.status(500).json({ error: '修改密码失败' });
    }
});

module.exports = router;
