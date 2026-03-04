const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const readline = require('readline');
const DNSPodAPI = require('../lib/dnspod');

// Read args
const args = process.argv.slice(2);
const filename = args[0] || path.join(__dirname, '../9e.nz.txt');
const domainConfig = args[1] || '9e.nz';

// Read config.yaml for DNSPod credentials
const configPath = path.join(__dirname, '../config.yaml');
if (!fs.existsSync(configPath)) {
    console.error('[-] Error: config.yaml not found.');
    process.exit(1);
}
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

if (!config.dnspod || !config.dnspod.secretId || !config.dnspod.secretKey) {
    console.error('[-] Error: dnspod credentials (secretId, secretKey) not configured in config.yaml.');
    process.exit(1);
}

const SECRET_ID = config.dnspod.secretId;
const SECRET_KEY = config.dnspod.secretKey;

console.log(`[+] Initializing DNSPod API importing...`);
console.log(`[+] Targets: file=${filename}, domain=${domainConfig}`);

const api = new DNSPodAPI(SECRET_ID, SECRET_KEY, domainConfig);

// Helper to delay execution (Rate limiting: DNSPod API generally limits to 5 requests per second for CreateRecord)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function processLineByLine() {
    if (!fs.existsSync(filename)) {
        console.error(`[-] Error: The file ${filename} does not exist.`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(filename);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let importedCount = 0;
    let failedCount = 0;

    // DNSPod free tier only allows 200 records normally, this script will stop or errors will accrue if it exceeds
    // Cloudflare limits usually don't matter much.

    for await (const line of rl) {
        // Skip comments and empty lines
        if (!line || line.startsWith(';') || line.trim() === '') continue;

        // Parse BIND zone line (rudimentary splitting)
        // e.g. 09.9e.nz.	1	IN	A	123.123.123.123 ; cf_tags=cf-proxied:true

        let normalizedLine = line.split(';')[0].trim(); // Remove comments at the end
        if (!normalizedLine) continue;

        // Split by tabs or spaces
        const parts = normalizedLine.split(/\s+/);
        if (parts.length < 4) continue;

        const rawName = parts[0];
        let rrPos = parts.indexOf('IN');
        if (rrPos === -1) rrPos = 1; // Sometimes IN is omitted, usually it's [name, ttl, type, content...] or [name, ttl, IN, type, content...]
        const type = parts[rrPos + 1];
        let contentArgs = parts.slice(rrPos + 2).join(' ');

        // Clean up name (remove trailing dot)
        let cleanName = rawName.endsWith('.') ? rawName.slice(0, -1) : rawName;

        // Strip the main domain if it is a subdomain
        let subdomain = '@';
        if (cleanName !== domainConfig) {
            if (cleanName.endsWith(`.${domainConfig}`)) {
                subdomain = cleanName.slice(0, -(domainConfig.length + 1));
            } else {
                subdomain = cleanName; // Unlikely but safe fallback
            }
        }

        // Handle quoted TXT records
        let cleanContent = contentArgs;
        if (type === 'TXT') {
            if (cleanContent.startsWith('"') && cleanContent.endsWith('"')) {
                cleanContent = cleanContent.slice(1, -1);
            }
        }

        // Handle MX records: DNSPod API V3 expects Priority in 'MX' param but CreateRecord in our dnspod.js currently doesn't support the 'MX' param directly.
        // If your dnspod wrapper doesn't pass MX priority properly, it might be an issue. But for basic transfer, we get the target.
        if (type === 'MX') {
            const mxParts = contentArgs.split(/\s+/);
            // parts[rrPos + 2] = 10, parts[rrPos + 3] = mail.example.com.
            cleanContent = mxParts[1] || mxParts[0];
        }

        // Clean up content tracking dots for CNAME/NS/MX
        if (['CNAME', 'NS', 'MX'].includes(type) && cleanContent.endsWith('.')) {
            cleanContent = cleanContent.slice(0, -1);
        }

        // We only support these standard types
        if (!['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS'].includes(type)) {
            console.log(`[-] Skipping unsupported record type: ${type} for ${subdomain}`);
            continue;
        }

        try {
            console.log(`[*] Importing: [${type}] ${subdomain} -> ${cleanContent}`);
            await api.createRecord(type, cleanName, cleanContent, false, 600);
            importedCount++;

            // To ensure we don't hit the 5 qps rate limit of DNSPod V3
            await delay(300); // Wait 300ms between requests (approx 3.3 requests per second)

        } catch (error) {
            console.error(`[X] Failed to import: [${type}] ${subdomain} -> ${cleanContent} | Error: ${error.message}`);
            failedCount++;

            // Wait slightly longer on failure just to give the API breathing room
            await delay(1000);
        }
    }

    console.log('\n==================================');
    console.log(`Import finished!`);
    console.log(`[+] Successfully imported: ${importedCount} records.`);
    console.log(`[-] Failed to import: ${failedCount} records.`);
    console.log('==================================');
}

processLineByLine();
