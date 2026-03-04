# cloudflare-api-dns (域名分发站)

[English Version](README_EN.md)

基于 Cloudflare API 的开源轻量级二级域名自助申请与管理平台，允许你的用户自助申请并管理你的主域名下挂载的二级（子）域名。

## 功能特性

- **现代安全体验**：支持邮箱/密码基础注册，以及 GitHub OAuth2 和 Linux.Do OAuth2 一键登录。
- **丰富的记录支持**：用户可以自助申请子域名，并实时管理其 A、AAAA、CNAME、TXT、MX DNS 记录。
- **底层双擎驱动**：默认使用 Cloudflare API 通信，确保生效极速秒级解析，更可自由开启/关闭 Cloudflare 代理（小黄云）防御。同时现已**全新支持国内腾讯云 DNSPod**，可直接在同一站内混合管理两大平台域名。
- **完善的管理后台**：内建管理员控制台，可管理全站用户、挂起恶意域名、调整每个用户的独立配额，或调整站点系统设置。
- **多主域名支持**：单实例即可为多个主域名分配子域名！
- **商业化准备 （积分功能）**：高度集成 Linux.Do Credit 积分系统，支持用户自动兑换域名购买配额。

## 🌐 演示站点

欢迎体验本项目的在线演示站（支持 GitHub / Linux.Do 一键极速登录）：
👉 **[https://yu.9e.nz/](https://yu.9e.nz/)**

> **🎉 公益福利**：演示站完全免费对外开放使用，每个注册用户默认享有 **2 个免费的二级域名配额**，欢迎所有人来注册白嫖！

---

## 快速开始

### 前置要求

1. 一台拥有公网 IP 的服务器，安装了 **Node.js (18 及以上)** 或 **Docker**。
2. 一个 **Cloudflare 账号** 并在其中托管了至少一个域名。
3. 获取 Cloudflare API Token（需赋予包含目标域名的 `Zone.DNS` 编辑权限）。

### 获取 Cloudflare 配置信息

1. **获取 API Token**：前往 [Cloudflare API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens) -> 创建令牌 -> 使用模板 "Edit zone DNS" -> 在 "Zone Resources" 中选择 "Include - Specific Zone - 你想共享的域名" -> 继续以生成 Token。
2. **获取 Zone ID**：在 Cloudflare 仪表盘，点击进入你打算共享的域名，在右侧面板的 "API" 卡片区域找到 **"Zone ID (区域 ID)"**。

## 详细部署指南

### 第一步：准备配置文件

无论你使用传统方式还是 Docker 方式部署，首先需要准备一份 `config.yaml` 配置文件：

```bash
git clone https://github.com/15515151/cloudflare-api-dns.git
cd cloudflare-api-dns
cp config.example.yaml config.yaml
```

**编辑 `config.yaml`。里面最重要的配置项说明如下：**

```yaml
# Cloudflare API 核心配置
cloudflare:
  apiToken: "你的-cloudflare-api-token" # 刚刚创建的带有编辑权限的 Token 
  zoneId: "你的-主域名-zoneId"          # 兜底的主域名 Zone ID

# 【全新】腾讯云 DNSPod API 配置（如不需要可留空）
dnspod:
  secretId: "你的-dnspod-secret-id"
  secretKey: "你的-dnspod-secret-key"

# 你的站点域名设置！这一栏千万不能马虎
site:
  port: 3000                        # 服务运行端口，如果你使用了反向代理可以不动
  domain: "example.com"             # 你的主域名（即提供给别人白嫖的主域，如 nyf.name）
  jwtSecret: "在此随意输入一段极长的随机无序英文字符串作为密码种子" # 【必填】生成用户令牌加密时的钥匙
  siteName: "我的域名分发站"          # 展现在前端和网页标题的名字 

# 可选的多主域名阵列：支持混合使用 Cloudflare 与 DNSPod 域名
domains:
  - domain: "example.com"      # 主力共享域名 1 (未指定 provider 默认使用 Cloudflare)
    zoneId: "11111111111..."   
    enabled: true              
  - domain: "qqun.top"         # 新增加的 DNSPod 域名 
    provider: "dnspod"         # 显式指定服务商为 dnspod
    enabled: true   

# 管理员安全
admin:
  username: "admin"
  password: "初次随机强密码"      # 仅在第一次启动并创建超管账户时生效，之后修改配置文件的该项将不再读取，如需进一步修改超管密码需要在管理员面板页修改。
```

> 💡 关于 OAuth2 登录的回调地址填写：
> 如果你的分发站运行域名是 `https://sub.my.com`
> - Linux.Do 回调应填：`https://sub.my.com/api/oauth/callback`
> - GitHub 回调应填：`https://sub.my.com/api/github/callback`

---

### 第二步：运行项目

**选项 A：Node.js 本地运行（PM2 守护推荐）**

```bash
# 获取依赖
npm install

# 可选：如果你有安装 PM2 来持久化运行
# npm install -g pm2
# pm2 start server.js --name cloudflare-dns

# 没有 pm2 时普通运行（关掉控制台会断开）
node server.js
```

**选项 B：Docker 快速启动**

你可以通过映射已编辑好的 `config.yaml` 以及一个空的 SQLite 数据文件给它：

```bash
# 生成空的 SQLite 作为挂载点，防止重启丢失数据 
touch data.db 

# 推荐运行：后台静默执行。注意映射 3000 到宿主机的端口 3000
docker run -d \
  --name cf-api-dns \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/data.db:/app/data.db \
  -v $(pwd)/public:/app/public \
  15515151/cloudflare-api-dns:latest
```
*(如果还没将镜像推送到仓库，你也可以先 `docker build -t cloudflare-api-dns .` 然后进行运行)*

此时，访问你的公网 IP `http://服务器IP:3000` 即可看到首页！你应当使用 Nginx/Caddy 等进行域名的反向代理，并为其配置 HTTPS 证书。

---

## 项目体系与架构结构

- **前端层响应**：原生 HTML/CSS/JS 轻量重构，包含暗黑明亮主题及全局中英双语！主要在 `public/` 下的几个 html。无需繁重的 Vue/React 端渲染编译，直接热改生效。
- **内部核心路由 (routes)**：
  - `auth.js` / `oauth` / `github-oauth.js`：掌管本地安全令牌 / 三方联邦身份对接授权。
  - `dns.js`：用户的常规鉴权校验、Cloudflare 接口分发响应与限额扣除机制。
  - `admin.js`：属于最高权级人员的巡逻接口，具备最高控制权限以强制清理域名并驱逐用户。
- **SQLite 数据库 (lib/database.js)**：用于单文件超高强度性能读写的内嵌轻量级数据库模型组件。
- **网关执行 (lib/cloudflare.js)**：唯一真正跟 Cloudflare 公司打交道的后端驱动心脏。

## 贡献与 License

开源且不收取费用，欢迎通过 Issue/PR 指出缺陷或增加您想要的奇妙 Feature。
项目遵循 MIT 协议。
