const DB = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const dbPath = path.join(__dirname, '../data.db');
const db = new DB(dbPath);

const configPath = path.join(__dirname, '../config.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
const defaultDomain = config.site.domain;

const records = db.prepare('SELECT * FROM domains').all();
let fixedCount = 0;

for (const row of records) {
    if (['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'].includes(row.domain)) {
        // This row is corrupted
        const correctDomain = row.updated_at; // The domain ended up at the very end
        const correctType = row.domain;
        const correctValue = row.record_type;
        const correctCfId = row.record_value;
        const correctProxied = parseInt(row.cf_record_id) || 0;
        const correctTtl = parseInt(row.proxied) || 1;
        const correctStatus = row.ttl;
        const correctRemark = row.status || '';
        const correctCreatedAt = row.remark;

        // We cannot reliably recover updated_at, so we'll just set it to correctCreatedAt or now
        const correctUpdatedAt = correctCreatedAt;

        db.prepare(`
            UPDATE domains 
            SET domain = ?, record_type = ?, record_value = ?, cf_record_id = ?, 
                proxied = ?, ttl = ?, status = ?, remark = ?, created_at = ?, updated_at = ?
            WHERE id = ?
        `).run(
            correctDomain, correctType, correctValue, correctCfId,
            correctProxied, correctTtl, correctStatus, correctRemark,
            correctCreatedAt, correctUpdatedAt, row.id
        );
        fixedCount++;
        console.log(`Fixed record ID ${row.id}: ${row.subdomain}.${correctDomain} [${correctType}] -> ${correctValue}`);
    }
}
console.log(`Repair complete. Fixed ${fixedCount} corrupted records.`);
