/**
 * DNSPod API (API 3.0) 封装
 * 使用 腾讯云 Node.js SDK
 */
const tencentcloud = require('tencentcloud-sdk-nodejs-dnspod');

class DNSPodAPI {
    constructor(secretId, secretKey, domain) {
        // According to Tencent Cloud SDK docs, DnspodClient takes credentials and region.
        // The region is irrelevant for DNSPod, but 'ap-guangzhou' is usually a safe default if required.
        const DnspodClient = tencentcloud.dnspod.v20210323.Client;
        const clientConfig = {
            credential: {
                secretId: secretId,
                secretKey: secretKey,
            },
            region: "ap-guangzhou",
            profile: {
                httpProfile: {
                    endpoint: "dnspod.tencentcloudapi.com",
                },
            },
        };
        this.client = new DnspodClient(clientConfig);
        this.domain = domain;
    }

    /**
     * 获取所有 DNS 记录
     * 注意：DNSPod V3 的参数与 CF 不同，尽量去适配或在此层面统一
     */
    async listRecords(params = {}) {
        // params.name corresponds to the full domain we want to search.
        // we can filter using the 'Subdomain' parameter for DNSPod.
        let subdomain = '';
        if (params.name) {
            if (params.name === this.domain) {
                subdomain = '@';
            } else if (params.name.endsWith(`.${this.domain}`)) {
                subdomain = params.name.slice(0, -(this.domain.length + 1));
            } else {
                throw new Error("域名不匹配 DNSPod 实例的 Domain");
            }
        }

        try {
            const req = {
                Domain: this.domain,
                Subdomain: subdomain || undefined
            };
            const response = await this.client.DescribeRecordList(req);

            // Map DNSPod record format to CF-like format for compatibility
            const records = response.RecordList || [];
            return records.map(r => ({
                id: r.RecordId.toString(),
                type: r.Type,
                name: r.Name === '@' ? this.domain : `${r.Name}.${this.domain}`,
                content: r.Value,
                proxied: false, // DNSPod doesn't support this
                ttl: r.TTL
            }));
        } catch (error) {
            throw new Error(`DNSPod API 错误: ${error.message}`);
        }
    }

    /**
     * 创建 DNS 记录
     * @param {string} type - 记录类型 (A, AAAA, CNAME, TXT, MX)
     * @param {string} name - 完整域名 (如 sub.example.com)
     * @param {string} content - 记录值
     * @param {boolean} proxied - 忽略 (此处保留签名为了CF兼容)
     * @param {number} ttl - TTL
     */
    async createRecord(type, name, content, proxied = false, ttl = 600) {
        let subdomain = '@';
        if (name !== this.domain) {
            subdomain = name.replace(`.${this.domain}`, '');
        }

        if (ttl === 1) ttl = 600; // CF '1' means auto. DNSPod doesn't have 1. Defaulting to 600.

        try {
            const req = {
                Domain: this.domain,
                SubDomain: subdomain,
                RecordType: type,
                RecordLine: "默认",
                Value: content,
                TTL: ttl
            };
            const response = await this.client.CreateRecord(req);

            return {
                id: response.RecordId.toString(),
                type: type,
                name: name,
                content: content,
                proxied: false,
                ttl: ttl
            };
        } catch (error) {
            throw new Error(`DNSPod API 错误: ${error.message}`);
        }
    }

    /**
     * 更新 DNS 记录
     * @param {string} recordId - DNSPod 记录 ID
     * @param {object} fields - 要更新的字段 { content, proxied } 等
     */
    async updateRecord(recordId, fields) {
        // DNSPod ModifyRecord requires RecordType, RecordLine, Value, SubDomain. 
        // We will need to fetch the existing record first to get the missing parameters, 
        // OR the caller needs to provide them. 
        // In the existing CF usage (routes/dns.js PUT /records/:id), we only have:
        // `fields.content` and `fields.proxied`. The type and subdomain are not in `fields`.

        // CF's format allows patching. DNSPod requires full replacement.
        // In `routes/dns.js`, we can see:
        // await cf.updateRecord(domain.cf_record_id, {
        //     content: recordValue,
        //     proxied: ...
        // });
        // Wait, DNSPod API needs the Type and RecordLine. We should pass it from outside, 
        // but for now let's just use `DescribeRecordList` to fetch the record first if we don't have enough info.
        throw new Error("DNSPodAPI.updateRecord requires full record info. Please use updateDnsPodRecord instead, or adapt the method signature.");
    }

    // We modify updateRecord to take more context, we will adjust `routes/dns.js` to pass it, 
    // or just fetch it here. Let's fetch it here so the interface is similar.
    async updateRecord(recordId, fields) {
        let existingRecord = null;
        try {
            const listReq = {
                Domain: this.domain
            };
            const listResp = await this.client.DescribeRecordList(listReq);
            existingRecord = (listResp.RecordList || []).find(r => r.RecordId.toString() === recordId.toString());
        } catch (e) {
            throw new Error(`DNSPod 获取记录失败以进行更新: ${e.message}`);
        }

        if (!existingRecord) {
            throw new Error(`DNSPod 记录未找到: ${recordId}`);
        }

        let ttl = existingRecord.TTL;
        let content = fields.content !== undefined ? fields.content : existingRecord.Value;

        try {
            const req = {
                Domain: this.domain,
                RecordType: existingRecord.Type,
                RecordLine: existingRecord.Line,
                Value: content,
                RecordId: parseInt(recordId),
                SubDomain: existingRecord.Name,
                TTL: ttl
            };

            const response = await this.client.ModifyRecord(req);
            return {
                id: response.RecordId.toString(),
                content: content
            };
        } catch (error) {
            throw new Error(`DNSPod API 错误: ${error.message}`);
        }
    }

    /**
     * 删除 DNS 记录
     * @param {string} recordId - DNSPod 记录 ID
     */
    async deleteRecord(recordId) {
        try {
            const req = {
                Domain: this.domain,
                RecordId: parseInt(recordId)
            };
            const response = await this.client.DeleteRecord(req);
            return { success: true };
        } catch (error) {
            throw new Error(`DNSPod API 错误: ${error.message}`);
        }
    }
}

module.exports = DNSPodAPI;
