const jwt = require('jsonwebtoken');
const db = require('../lib/database');

/**
 * JWT 验证中间件
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未登录，请先登录' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, req.config.site.jwtSecret);
        const user = db.getUserById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: '用户不存在' });
        }
        if (user.status !== 'active') {
            return res.status(403).json({ error: '账号已被禁用' });
        }
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token 无效或已过期' });
    }
}

/**
 * 管理员权限验证中间件
 */
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
}

module.exports = { authenticate, requireAdmin };
