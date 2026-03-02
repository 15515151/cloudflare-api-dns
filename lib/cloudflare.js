/**
 * Cloudflare API 封装
 * 使用 API Token 认证，管理 DNS 记录
 */

class CloudflareAPI {
    constructor(apiToken, zoneId) {
        this.apiToken = apiToken;
        this.zoneId = zoneId;
        this.baseUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`;
    }

    async request(method, endpoint = '', body = null) {
        const url = endpoint ? `${this.baseUrl}/${endpoint}` : this.baseUrl;
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!data.success) {
            const errors = data.errors?.map(e => e.message).join(', ') || 'Unknown error';
            throw new Error(`Cloudflare API 错误: ${errors}`);
        }
        return data;
    }

    /**
     * 获取所有 DNS 记录
     */
    async listRecords(params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${this.baseUrl}?${query}` : this.baseUrl;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(`Cloudflare API 错误: ${data.errors?.[0]?.message}`);
        }
        return data.result;
    }

    /**
     * 创建 DNS 记录
     * @param {string} type - 记录类型 (A, AAAA, CNAME, TXT, MX)
     * @param {string} name - 完整域名 (如 sub.example.com)
     * @param {string} content - 记录值
     * @param {boolean} proxied - 是否开启 Cloudflare 代理
     * @param {number} ttl - TTL (1 = auto)
     */
    async createRecord(type, name, content, proxied = false, ttl = 1) {
        const body = { type, name, content, proxied, ttl };
        // MX 和 TXT 不支持代理
        if (['MX', 'TXT'].includes(type)) {
            body.proxied = false;
        }
        const data = await this.request('POST', '', body);
        return data.result;
    }

    /**
     * 更新 DNS 记录
     * @param {string} recordId - Cloudflare 记录 ID
     * @param {object} fields - 要更新的字段
     */
    async updateRecord(recordId, fields) {
        const data = await this.request('PATCH', recordId, fields);
        return data.result;
    }

    /**
     * 删除 DNS 记录
     * @param {string} recordId - Cloudflare 记录 ID
     */
    async deleteRecord(recordId) {
        const data = await this.request('DELETE', recordId);
        return data.result;
    }
}

module.exports = CloudflareAPI;
