const db = require('../lib/database');
const { getCF } = require('../lib/helpers');

async function cleanVerificationsOnStartup(config) {
    try {
        console.log('[启动检查] 正在检查遗留的 DNS 验证记录...');

        // 1. 获取所有验证记录（不管是过期还是没过期）
        const verifications = db.getAllVerifications();

        if (verifications.length === 0) {
            console.log('[启动检查] 没有发现遗留的验证记录');
            return;
        }

        const now = Date.now();
        let cleanedCount = 0;
        let scheduledCount = 0;

        for (const v of verifications) {
            const expiresAt = new Date(v.expires_at).getTime();
            const fullVerifyDomain = `${v.verify_subdomain}.${v.domain}`;

            // 构造 req 模拟对象以便 getCF 使用 (它只需要 req.config)
            const reqMock = { config };
            const cf = getCF(reqMock, v.domain);

            if (now >= expiresAt) {
                // 已经过期，立即清理
                try {
                    await cf.deleteRecord(v.cf_record_id);
                    console.log(`[启动清理] 已删除过期的 CF 记录 ${fullVerifyDomain}`);
                } catch (e) {
                    // 反查清理
                    try {
                        const records = await cf.listRecords({ name: fullVerifyDomain });
                        const match = records && records.find(r => r.type === 'TXT' && r.content === v.txt_value);
                        if (match) await cf.deleteRecord(match.id);
                    } catch (e2) { }
                }
                db.deleteVerification(v.id);
                cleanedCount++;
            } else {
                // 还没过期，重新挂载定时器
                const timeLeft = expiresAt - now;
                setTimeout(async () => {
                    const existing = db.getVerificationById(v.id);
                    if (!existing) return; // 被手动删除了

                    try {
                        await cf.deleteRecord(v.cf_record_id);
                        console.log(`[延迟清理] 已自动删除 CF 记录 ${fullVerifyDomain}`);
                    } catch (e) {
                        try {
                            const records = await cf.listRecords({ name: fullVerifyDomain });
                            const match = records && records.find(r => r.type === 'TXT' && r.content === v.txt_value);
                            if (match) await cf.deleteRecord(match.id);
                        } catch (e2) { }
                    }
                    db.deleteVerification(v.id);
                }, timeLeft);
                scheduledCount++;
            }
        }

        console.log(`[启动检查] 完毕。立即清理了 ${cleanedCount} 条过期记录，并重新调度了 ${scheduledCount} 条存活记录。`);
    } catch (err) {
        console.error('[启动检查] 清理遗留验证记录失败:', err);
    }
}

module.exports = cleanVerificationsOnStartup;
