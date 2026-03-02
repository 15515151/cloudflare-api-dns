# cloudflare-api-dns

基于 Cloudflare API 的子域名分发平台，允许用户自助申请和管理主域名下的子域名。

## 功能特性

- 用户注册/登录，支持 GitHub OAuth2 和 Linux.Do OAuth2
- 自助申请子域名，支持 A、AAAA、CNAME、TXT、MX 记录类型
- 通过 Cloudflare API 自动创建/更新/删除 DNS 记录
- 管理员面板：管理用户、域名、系统配置
- 每用户域名配额限制，支持积分兑换配额（Linux.Do Credit）
- SQLite 数据库，Docker 一键部署

## 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账号，API Token 需要 `Zone.DNS` 编辑权限

### 配置

复制配置文件并填写：

```bash
cp config.example.yaml config.yaml
```

必填项：

```yaml
cloudflare:
  apiToken: "your-cloudflare-api-token"  # Cloudflare API Token
  zoneId: "your-zone-id"                 # 主域名 Zone ID

site:
  domain: "example.com"                  # 你的主域名
  jwtSecret: "change-this-to-random"     # JWT 密钥，请修改

admin:
  username: "admin"
  password: "your-admin-password"
```

### 本地运行

```bash
npm install
node server.js
```

访问 `http://localhost:3000`

### Docker 部署

```bash
docker build -t cloudflare-api-dns .
docker run -d -p 3000:3000 -v $(pwd)/config.yaml:/app/config.yaml -v $(pwd)/data.db:/app/data.db cloudflare-api-dns
```

## OAuth2 配置（可选）

### GitHub OAuth

在 [GitHub Developer Settings](https://github.com/settings/developers) 创建 OAuth App，回调地址设为 `https://你的域名/api/github/callback`，填入 `config.yaml`：

```yaml
github:
  clientId: "your-github-client-id"
  clientSecret: "your-github-client-secret"
  redirectUri: "https://你的域名/api/github/callback"
```

### Linux.Do OAuth

```yaml
oauth:
  clientId: "your-linuxdo-client-id"
  clientSecret: "your-linuxdo-client-secret"
  redirectUri: "https://你的域名/api/oauth/callback"
```

## 项目结构

```
├── server.js          # 入口文件
├── config.yaml        # 配置文件
├── lib/
│   ├── cloudflare.js  # Cloudflare API 封装
│   └── database.js    # SQLite 数据库层
├── middleware/
│   └── auth.js        # JWT 认证中间件
├── routes/
│   ├── auth.js        # 注册/登录
│   ├── dns.js         # DNS 记录管理
│   ├── admin.js       # 管理员接口
│   ├── oauth.js       # Linux.Do OAuth
│   ├── github-oauth.js# GitHub OAuth
│   └── credit.js      # 积分系统
└── public/            # 前端静态文件
    ├── index.html     # 首页
    ├── login.html     # 登录/注册页
    ├── panel.html     # 用户控制面板
    └── admin.html     # 管理后台
```

## License

MIT
