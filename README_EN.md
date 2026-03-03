# cloudflare-api-dns (Domain Hub)

[中文版](README.md)

An open-source, lightweight subdomain self-service platform powered by the Cloudflare API. It allows your users to independently register and manage secondary (sub) domains attached to your primary domains.

## Features

- **Modern & Secure Login**: Supports basic Email/Password registration as well as one-click GitHub OAuth2 and Linux.Do OAuth2 logins.
- **Rich DNS Record Management**: Users can independently register subdomains and manage their A, AAAA, CNAME, TXT, and MX DNS records in real-time.
- **Cloudflare Powered**: Communicates via the Cloudflare API, ensuring extremely fast TTFB and resolution in seconds. Freely toggle the Cloudflare proxy (the "orange cloud") for DDoS protection.
- **Comprehensive Admin Panel**: A built-in dashboard for the admin to oversee all users, suspend malicious/abusive domains, customize independent domain quotas per user, and adjust global platform settings.
- **Multi-domain Subdomain Pooling**: You can offer multiple primary domains simultaneously from a single platform instance!
- **Commercialization-Ready (Credits)**: Highly integrated with the Linux.Do Credit system, allowing users to automatically exchange points for extra domain capacity/quotas.

## 🌐 Live Demo

Welcome to try out our live demonstration site (Supports rapid one-click login via GitHub and Linux.Do):
👉 **[https://yu.9e.nz/](https://yu.9e.nz/)**

> **🎉 Free Public Welfare**: The demo site is completely free and open to the public. Every registered user receives a default quota of **2 free secondary domains**! Everyone is welcome to join and start building!

---

## Quick Start

### Prerequisites

1. A server with a public IP, running **Node.js (18+)** or **Docker**.
2. A **Cloudflare account** hosting at least one primary domain you intend to give out subdomains for.
3. A Cloudflare API Token (must possess `Zone.DNS` edit permissions for the target domain).

### Extracting Cloudflare Configuration Values

1. **Get an API Token**: Go to the [Cloudflare API Tokens page](https://dash.cloudflare.com/profile/api-tokens) -> Create Token -> Use the "Edit zone DNS" template -> Under "Zone Resources", select "Include - Specific Zone - [Your Domain]" -> Continue to generate the Token.
2. **Get the Zone ID**: In the Cloudflare dashboard, click into the domain you plan to share. In the right-hand panel under the "API" section, locate your **"Zone ID"**.

## Detailed Deployment Guide

### Step 1: Prepare the Configuration File

Whether you're deploying natively via Node.js or via Docker, you must set up the `config.yaml` configuration file first:

```bash
git clone https://github.com/15515151/cloudflare-api-dns.git
cd cloudflare-api-dns
cp config.example.yaml config.yaml
```

**Edit `config.yaml`. The most critical fields are explained below:**

```yaml
# Core Cloudflare API Config
cloudflare:
  apiToken: "your-cloudflare-api-token" # The Token you just created with DNS edit permissions
  zoneId: "your-main-zone-id"           # Fallback Primary Domain Zone ID

# Basic Site Settings! Do not gloss over this section
site:
  port: 3000                        # Service running port (ideal behind a reverse proxy)
  domain: "example.com"             # The primary domain you are offering (e.g., mydomain.com)
  jwtSecret: "some-extremely-long-random-string-goes-here" # [REQUIRED] Used as the encryption seed for JWT tokens
  siteName: "My Domain Hub"         # The title shown on the frontend and browser tabs

# Optional Multi-Domain Array: If you have multiple primary domains you want to share, list them here
domains:
  - domain: "example.com"      # Primary shared domain 1
    zoneId: "11111111111..."   # Its Zone ID retrieved from CF
    enabled: true              # Must be 'true' for users to see and select it
  - domain: "example.net"      # Shared domain 2
    zoneId: "22222222222..."
    enabled: true   

# Administrator Security
admin:
  username: "admin"
  password: "your_random_initial_password"  # Only applies upon first boot to create the superadmin. Subsequent changes to this file handle won't update the password; if you need to change the admin password later, use the Admin Panel UI.
```

> 💡 Note on OAuth2 Callback URIs:
> If your platform is hosted at `https://sub.my.com`
> - The Linux.Do callback should be: `https://sub.my.com/api/oauth/callback`
> - The GitHub callback should be: `https://sub.my.com/api/github/callback`

---

### Step 2: Run the Project

**Option A: Run Locally/Natively via Node.js (PM2 Recommended)**

```bash
# Install dependencies
npm install

# Optional: If you use PM2 to keep it alive in the background
# npm install -g pm2
# pm2 start server.js --name cloudflare-dns

# Normal start without PM2 (disconnects when terminal closes)
node server.js
```

**Option B: Quick Start via Docker**

You can run the container by mapping your configured `config.yaml` file and an empty SQLite database file:

```bash
# Initialize an empty SQLite file to persist data across container restarts
touch data.db 

# Recommended: Run silently in background. Map port 3000 to the host.
docker run -d \
  --name cf-api-dns \
  -p 3000:3000 \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/data.db:/app/data.db \
  -v $(pwd)/public:/app/public \
  15515151/cloudflare-api-dns:latest
```
*(If the image hasn't been pushed to the docker registry yet, build it first with `docker build -t cloudflare-api-dns .` and then run the command).*

You can now visit your server's IP address `http://SERVER_IP:3000` to see the homepage! For production use, you should configure a reverse proxy such as Nginx or Caddy with valid HTTPS certificates.

---

## Architecture & Structure

- **Frontend Tier**: Lightweight, native HTML/CSS/JS with absolutely no heavy build processes (no Vue/React). Fully bilingual (English/Chinese) and supports dark/light themes out of the box in the `public/` directory. Hot-reloads on browser refresh.
- **Core Routers (`routes/`)**:
  - `auth.js` / `oauth` / `github-oauth.js`: Manages local JWT safety protocols and handles 3rd-party federated identity authorization constraints.
  - `dns.js`: Processes standard user request validations, dispatches duties to the Cloudflare endpoints, and enforces quota limits.
  - `admin.js`: Executive-level security APIs. Bypasses standard locks to forcibly scrub domains or banishing accounts.
- **SQLite Database (`lib/database.js`)**: Highly-performant lightweight embedded zero-configuration database handling persistent states perfectly designed for rapid prototyping or small to medium-scale usages.
- **Gateway Driver (`lib/cloudflare.js`)**: The only module that initiates actual outbound HTTPS contacts to the Cloudflare API backbone to alter authentic records.

## Contributing & License

This software is 100% free and open-source. Feel free to open Issues or Pull Requests proposing bug fixes or new marvelous features.
Licensed under the MIT License.
