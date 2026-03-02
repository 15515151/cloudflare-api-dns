const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const db = require('./lib/database');

// 加载配置
const configPath = path.join(__dirname, 'config.yaml');
if (!fs.existsSync(configPath)) {
  console.error('❌ 配置文件 config.yaml 不存在，请复制 config.example.yaml 并修改');
  process.exit(1);
}
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

// 初始化数据库
db.init(config);

const app = express();

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 将 config 注入到 req 中
app.use((req, res, next) => {
  req.config = config;
  next();
});

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dns', require('./routes/dns'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/oauth', require('./routes/oauth'));
app.use('/api/github', require('./routes/github-oauth'));
app.use('/api/credit', require('./routes/credit'));

// 获取站点配置（公开）
app.get('/api/config', (req, res) => {
  const allowRegister = db.getSystemConfig('allow_register') === 'true';
  const allowOauthRegister = db.getSystemConfig('allow_oauth_register') === 'true';
  const defaultQuota = parseInt(db.getSystemConfig('default_domain_quota') || '10');
  const enabledDomains = (config.domains || [])
    .filter(d => d.enabled)
    .map(d => d.domain);
  // 兼容旧配置：若没有 domains 列表则用 site.domain
  if (enabledDomains.length === 0) enabledDomains.push(config.site.domain);

  res.json({
    domain: config.site.domain,
    domains: enabledDomains,
    siteName: config.site.siteName,
    allowedRecordTypes: config.limits.allowedRecordTypes,
    maxDomainsPerUser: defaultQuota,
    allowRegister,
    allowOauthRegister,
    oauthEnabled: !!(config.oauth && config.oauth.clientId),
    githubEnabled: !!(config.github && config.github.clientId)
  });
});

// SPA 回退
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API 路由未找到' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = config.site.port || 3000;
app.listen(PORT, () => {
  console.log(`🚀 域名分发站已启动: http://localhost:${PORT}`);
  console.log(`📌 主域名: ${config.site.domain}`);
});
