/**
 * 轻量级 i18n 国际化引擎
 * 支持 data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-html 属性
 */
const I18N = {
    _lang: localStorage.getItem('lang') || (navigator.language.startsWith('zh') ? 'zh' : 'en'),

    dict: {
        zh: {
            // ===== 通用 =====
            'cancel': '取消',
            'save': '保存',
            'delete': '删除',
            'edit': '编辑',
            'confirm': '确认',
            'loading': '加载中...',
            'success': '成功',
            'error': '错误',
            'or': '或',
            'total': '共',
            'items': '积分',
            'powered': 'Powered by Cloudflare DNS API',

            // ===== 导航 =====
            'nav.siteName': '域名分发站',
            'nav.login': '登录',
            'nav.register': '注册',
            'nav.panel': '控制面板',
            'nav.admin': '管理后台',
            'nav.logout': '退出',
            'nav.changePassword': '修改密码',
            'nav.home': '首页',

            // ===== 首页 =====
            'index.title': '域名分发站 - 免费二级域名申请',
            'index.hero': '免费二级域名',
            'index.subtitle': '输入你想要的子域名，立即获取属于你的专属二级域名',
            'index.inputPlaceholder': '输入子域名',
            'index.apply': '🚀 立即申请',
            'index.feat1.title': '即时生效',
            'index.feat1.desc': '基于 Cloudflare DNS，域名解析秒级生效，全球 Anycast 网络加速',
            'index.feat2.title': '安全可靠',
            'index.feat2.desc': '支持 Cloudflare 代理，提供 DDoS 防护和 SSL 证书',
            'index.feat3.title': '自由管理',
            'index.feat3.desc': '支持 A、AAAA、CNAME、TXT、MX 多种记录类型，随时修改',
            'index.feat4.title': '简单易用',
            'index.feat4.desc': '注册账号即可开始使用，无需繁琐的审核流程',
            'index.warning': '⚠️ <strong>使用须知：</strong>本平台仅供合法用途，严禁用于以下行为：<br>🚫 传播色情、赌博、毒品等违法违规内容 &nbsp;|&nbsp; 🚫 散布谣言、诈骗、钓鱼等恶意信息 &nbsp;|&nbsp; 🚫 侵犯他人版权、隐私及合法权益<br>违规域名将被立即删除，情节严重者封禁账号并上报相关部门。<br>📧 如发现滥用行为，请发送邮件至 <a href="mailto:qfyyz3369@gmail.com" style="color:var(--warning);font-weight:600">qfyyz3369@gmail.com</a> 进行举报。',
            'index.available': '✓ {domain} 可以注册',
            'index.unavailable': '✕ {domain} 已被占用',
            'index.loginFirst': '请先登录或注册账号',
            'index.enterSubdomain': '请输入子域名',
            'index.applySuccess': '域名申请成功！',

            // ===== 申请弹窗 =====
            'apply.title': '申请域名',
            'apply.subdomain': '子域名',
            'apply.recordType': '记录类型',
            'apply.recordValue': '记录值',
            'apply.recordValuePlaceholder': '如: 1.2.3.4',
            'apply.remark': '备注（可选）',
            'apply.remarkPlaceholder': '用途说明',
            'apply.proxy': '开启 Cloudflare 代理（小黄云）（仅 A/AAAA/CNAME）',
            'apply.confirm': '确认申请',
            'apply.enterValue': '请填写记录值',

            // ===== 登录页 =====
            'login.title': '登录 / 注册',
            'login.username': '用户名',
            'login.password': '密码',
            'login.email': '邮箱',
            'login.usernamePlaceholder': '请输入用户名',
            'login.passwordPlaceholder': '请输入密码',
            'login.regUsernamePlaceholder': '3-20个字符，字母数字下划线',
            'login.emailPlaceholder': 'your@email.com',
            'login.regPasswordPlaceholder': '至少6个字符',
            'login.submit': '登 录',
            'login.regSubmit': '注 册',
            'login.oauth.linuxdo': '🔗 使用 Linux.Do 登录',
            'login.oauth.github': '🐙 使用 GitHub 登录',
            'login.fillAll': '请填写完整信息',
            'login.regSuccess': '注册成功',
            'login.regClosed': '管理员暂时关闭了注册',

            // ===== 控制面板 =====
            'panel.title': '控制面板 - 域名分发站',
            'panel.heading': '控制面板',
            'panel.desc': '管理你的二级域名记录',
            'panel.usedDomains': '已使用域名',
            'panel.quota': '域名配额',
            'panel.records': '📋 域名记录',
            'panel.credit': '💎 积分兑换配额',
            'panel.addDomain': '+ 添加域名',
            'panel.emptyRecords': '还没有域名记录',
            'panel.loadFailed': '加载失败',

            // ===== 表格通用 =====
            'table.domain': '域名',
            'table.type': '类型',
            'table.value': '记录值',
            'table.proxy': '代理',
            'table.remark': '备注',
            'table.createdAt': '创建时间',
            'table.actions': '操作',
            'table.id': 'ID',
            'table.user': '用户',
            'table.username': '用户名',
            'table.email': '邮箱',
            'table.role': '角色',
            'table.status': '状态',
            'table.domainCount': '域名数',
            'table.registeredAt': '注册时间',

            // ===== 状态/徽章 =====
            'badge.enabled': '已开启',
            'badge.disabled': '关闭',
            'badge.on': '开启',
            'badge.admin': '管理员',
            'badge.userRole': '用户',
            'badge.active': '正常',
            'badge.banned': '已禁用',
            'badge.unlimited': '不限',
            'badge.adminSuspended': '⛔ 已被管理员禁用',

            // ===== 操作按钮 =====
            'action.modify': '修改',
            'action.delete': '删除',
            'action.suspend': '禁用',
            'action.restore': '恢复',
            'action.enable': '启用',
            'action.resetPassword': '重置密码',
            'action.quotaBtn': '配额',

            // ===== 添加域名弹窗 =====
            'add.title': '添加域名',
            'add.subdomain': '子域名',
            'add.subdomainPlaceholder': '输入子域名',
            'add.recordType': '记录类型',
            'add.recordValue': '记录值',
            'add.recordValuePlaceholder': '如: 1.2.3.4',
            'add.remark': '备注（可选）',
            'add.remarkPlaceholder': '用途说明',
            'add.proxy': '开启 Cloudflare 代理（小黄云）',
            'add.confirm': '确认添加',
            'add.success': '添加成功！',
            'add.fillAll': '请填写完整信息',
            'add.available': '✓ {domain} 可用',
            'add.unavailable': '✕ {domain} 已被占用',

            // ===== 修改弹窗 =====
            'edit.title': '修改记录',
            'edit.domain': '域名',
            'edit.recordType': '记录类型',
            'edit.recordValue': '记录值',
            'edit.recordValuePlaceholder': '新的记录值',
            'edit.remark': '备注',
            'edit.save': '保存修改',
            'edit.success': '修改成功！',
            'edit.enterValue': '请填写记录值',

            // ===== 密码弹窗 =====
            'pwd.title': '修改密码',
            'pwd.oldPassword': '原密码',
            'pwd.oldPasswordPlaceholder': '请输入原密码',
            'pwd.newPassword': '新密码',
            'pwd.newPasswordPlaceholder': '至少6个字符',
            'pwd.confirmPassword': '确认新密码',
            'pwd.confirmPasswordPlaceholder': '再次输入新密码',
            'pwd.submit': '确认修改',
            'pwd.fillAll': '请填写完整信息',
            'pwd.tooShort': '新密码长度至少 6 个字符',
            'pwd.mismatch': '两次输入的密码不一致',
            'pwd.success': '密码修改成功！',

            // ===== 通知弹窗 =====
            'notification.title': '📢 系统通知',
            'notification.dismiss': '我已知晓',

            // ===== 积分弹窗 =====
            'credit.title': '💎 积分兑换域名配额',
            'credit.quantity': '购买数量（1-30）',
            'credit.desc': '每个域名配额消耗 {n} 积分。',
            'credit.total': '共消耗 {total} 积分，兑换 {qty} 个域名配额。',
            'credit.note': '点击确认后将跳转到 Linux.Do Credit 完成积分支付，支付成功后配额自动增加。',
            'credit.submit': '前往支付',

            // ===== 删除确认 =====
            'confirm.deleteRecord': '确定删除此域名记录？此操作不可恢复',
            'confirm.deleteDomain': '确定删除此记录？',
            'confirm.suspendDomain': '确定禁用此域名解析？禁用后用户无法自行恢复。',
            'confirm.restoreDomain': '确定恢复此域名解析？',
            'confirm.deleteUser': '确定删除用户 "{name}"？\n此操作不可恢复，将同时删除其所有 DNS 解析记录。',
            'confirm.disableUser': '确定禁用此用户？\n禁用后将删除其所有 DNS 解析记录。',
            'confirm.enableUser': '确定启用此用户？',

            // ===== 管理后台 =====
            'admin.title': '管理后台 - 域名分发站',
            'admin.heading': '管理后台',
            'admin.desc': '管理所有用户和域名记录',
            'admin.statUsers': '注册用户',
            'admin.statRecords': '域名记录',
            'admin.statActive': '活跃记录',
            'admin.tabRecords': '📋 域名记录',
            'admin.tabUsers': '👥 用户管理',
            'admin.tabSettings': '⚙️ 系统设置',
            'admin.recordList': '记录列表',
            'admin.userList': '用户列表',
            'admin.searchPlaceholder': '搜索域名、记录值、用户名...',
            'admin.noRecords': '暂无记录',
            'admin.noUsers': '暂无用户',
            'admin.domainSuspended': '域名已禁用',
            'admin.domainRestored': '域名已恢复',
            'admin.deleteSuccess': '删除成功',
            'admin.editSuccess': '修改成功！',
            'admin.userEnabled': '用户已启用',
            'admin.userDisabled': '用户已禁用',
            'admin.userDeleted': '用户已删除',

            // ===== 管理员编辑弹窗 =====
            'adminEdit.title': '编辑记录',
            'adminEdit.domain': '域名',
            'adminEdit.type': '记录类型',
            'adminEdit.user': '所属用户',
            'adminEdit.value': '记录值',
            'adminEdit.valuePlaceholder': '新的记录值',
            'adminEdit.remark': '备注',
            'adminEdit.proxy': '开启 Cloudflare 代理（小黄云）',
            'adminEdit.save': '保存修改',
            'adminEdit.enterValue': '请填写记录值',

            // ===== 管理员重置密码 =====
            'adminPwd.title': '重置密码',
            'adminPwd.user': '用户',
            'adminPwd.newPassword': '新密码',
            'adminPwd.newPasswordPlaceholder': '至少 6 个字符',
            'adminPwd.confirmPassword': '确认密码',
            'adminPwd.confirmPlaceholder': '再次输入新密码',
            'adminPwd.submit': '确认重置',
            'adminPwd.tooShort': '密码长度至少 6 个字符',
            'adminPwd.mismatch': '两次输入的密码不一致',
            'adminPwd.success': '密码重置成功！',

            // ===== 管理员配额弹窗 =====
            'adminQuota.title': '修改域名配额',
            'adminQuota.user': '用户',
            'adminQuota.label': '域名配额',
            'adminQuota.placeholder': '留空使用默认配额',
            'adminQuota.hint': '0 表示不限制，留空使用系统默认配额',
            'adminQuota.success': '配额修改成功！',

            // ===== 管理员修改密码 =====
            'adminSelfPwd.title': '修改管理员密码',
            'adminSelfPwd.oldPassword': '原密码',
            'adminSelfPwd.oldPasswordPlaceholder': '请输入原密码',
            'adminSelfPwd.newPassword': '新密码',
            'adminSelfPwd.newPasswordPlaceholder': '至少6个字符',
            'adminSelfPwd.confirmPassword': '确认新密码',
            'adminSelfPwd.confirmPlaceholder': '再次输入新密码',
            'adminSelfPwd.submit': '确认修改',
            'adminSelfPwd.fillAll': '请填写完整信息',
            'adminSelfPwd.tooShort': '新密码长度至少 6 个字符',
            'adminSelfPwd.mismatch': '两次输入的密码不一致',
            'adminSelfPwd.success': '密码修改成功！',

            // ===== 系统设置 =====
            'settings.title': '系统设置',
            'settings.allowRegister': '允许账号密码注册',
            'settings.allowRegisterHint': '关闭后，用户将无法通过账号密码注册',
            'settings.allowOauth': '允许 Linux.Do OAuth 注册',
            'settings.allowOauthHint': '关闭后，新用户将无法通过 Linux.Do 登录注册，已有账号不受影响',
            'settings.allowGithub': '允许 GitHub OAuth 注册',
            'settings.allowGithubHint': '关闭后，新用户将无法通过 GitHub 登录注册，已有账号不受影响',
            'settings.defaultQuota': '新用户默认域名配额',
            'settings.defaultQuotaHint': '新注册用户的默认域名数量限制，0 表示无限制',
            'settings.save': '保存设置',
            'settings.success': '设置保存成功！',
            'settings.loadFailed': '加载设置失败',

            // ===== DNS 托管验证 =====
            'verify.title': '🔑 子域托管验证',
            'verify.btn': '🔑 域名托管验证',
            'verify.subdomain': '子域名',
            'verify.provider': 'DNS 平台',
            'verify.txtValue': '验证 TXT 值',
            'verify.txtValuePlaceholder': '粘贴平台提供的验证码',
            'verify.submit': '创建验证记录',
            'verify.fillAll': '请填写完整信息',
            'verify.success': '验证 TXT 记录已创建，请在 5 分钟内完成验证',
            'verify.noRecords': '你还没有域名记录，请先添加域名',
            'verify.statusTitle': '📝 进行中的验证',
            'verify.domain': '验证域名',
            'verify.platform': '平台',
            'verify.value': 'TXT 值',
            'verify.expires': '剩余时间',
            'verify.expired': '已过期',
            'verify.providerAliyun': '阿里云 (Alidns)',
            'verify.providerTencent': '腾讯云 (DNSPod)',
            'verify.providerHuawei': '华为云 DNS',
            'verify.hint': '此功能用于将子域名托管到第三方 DNS 平台时的所有权验证。验证记录将在 5 分钟后自动删除。',
            'verify.finish': '删除记录',
        },

        en: {
            // ===== Common =====
            'cancel': 'Cancel',
            'save': 'Save',
            'delete': 'Delete',
            'edit': 'Edit',
            'confirm': 'Confirm',
            'loading': 'Loading...',
            'success': 'Success',
            'error': 'Error',
            'or': 'or',
            'total': 'Total',
            'items': 'items',
            'powered': 'Powered by Cloudflare DNS API',

            // ===== Navigation =====
            'nav.siteName': 'Domain Hub',
            'nav.login': 'Login',
            'nav.register': 'Register',
            'nav.panel': 'Dashboard',
            'nav.admin': 'Admin',
            'nav.logout': 'Logout',
            'nav.changePassword': 'Password',
            'nav.home': 'Home',

            // ===== Index =====
            'index.title': 'Domain Hub - Free Subdomain',
            'index.hero': 'Free Subdomains',
            'index.subtitle': 'Enter your desired subdomain and get your own domain instantly',
            'index.inputPlaceholder': 'Enter subdomain',
            'index.apply': '🚀 Apply Now',
            'index.feat1.title': 'Instant Effect',
            'index.feat1.desc': 'Powered by Cloudflare DNS, domain resolution takes effect in seconds with global Anycast network',
            'index.feat2.title': 'Secure & Reliable',
            'index.feat2.desc': 'Supports Cloudflare proxy with DDoS protection and SSL certificates',
            'index.feat3.title': 'Full Control',
            'index.feat3.desc': 'Supports A, AAAA, CNAME, TXT, MX record types, modify anytime',
            'index.feat4.title': 'Easy to Use',
            'index.feat4.desc': 'Register and start using immediately, no complex approval process',
            'index.warning': '⚠️ <strong>Terms of Use:</strong> This platform is for lawful purposes only. The following are strictly prohibited:<br>🚫 Distributing pornographic, gambling, or drug-related content &nbsp;|&nbsp; 🚫 Spreading misinformation, scams, or phishing &nbsp;|&nbsp; 🚫 Infringing on copyrights, privacy, or legal rights<br>Violating domains will be deleted immediately; serious offenders will be banned and reported.<br>📧 To report abuse, email <a href="mailto:qfyyz3369@gmail.com" style="color:var(--warning);font-weight:600">qfyyz3369@gmail.com</a>.',
            'index.available': '✓ {domain} is available',
            'index.unavailable': '✕ {domain} is taken',
            'index.loginFirst': 'Please login or register first',
            'index.enterSubdomain': 'Please enter a subdomain',
            'index.applySuccess': 'Domain applied successfully!',

            // ===== Apply Modal =====
            'apply.title': 'Apply for Domain',
            'apply.subdomain': 'Subdomain',
            'apply.recordType': 'Record Type',
            'apply.recordValue': 'Record Value',
            'apply.recordValuePlaceholder': 'e.g. 1.2.3.4',
            'apply.remark': 'Remark (optional)',
            'apply.remarkPlaceholder': 'Usage description',
            'apply.proxy': 'Enable Cloudflare Proxy (A/AAAA/CNAME only)',
            'apply.confirm': 'Confirm',
            'apply.enterValue': 'Please enter record value',

            // ===== Login =====
            'login.title': 'Login / Register',
            'login.username': 'Username',
            'login.password': 'Password',
            'login.email': 'Email',
            'login.usernamePlaceholder': 'Enter username',
            'login.passwordPlaceholder': 'Enter password',
            'login.regUsernamePlaceholder': '3-20 chars, letters/numbers/underscore',
            'login.emailPlaceholder': 'your@email.com',
            'login.regPasswordPlaceholder': 'At least 6 characters',
            'login.submit': 'Login',
            'login.regSubmit': 'Register',
            'login.oauth.linuxdo': '🔗 Login with Linux.Do',
            'login.oauth.github': '🐙 Login with GitHub',
            'login.fillAll': 'Please fill in all fields',
            'login.regSuccess': 'Registration successful',
            'login.regClosed': 'Registration is currently disabled',

            // ===== Panel =====
            'panel.title': 'Dashboard - Domain Hub',
            'panel.heading': 'Dashboard',
            'panel.desc': 'Manage your subdomain records',
            'panel.usedDomains': 'Domains Used',
            'panel.quota': 'Domain Quota',
            'panel.records': '📋 Domain Records',
            'panel.credit': '💎 Credits for Quota',
            'panel.addDomain': '+ Add Domain',
            'panel.emptyRecords': 'No domain records yet',
            'panel.loadFailed': 'Failed to load',

            // ===== Table Common =====
            'table.domain': 'Domain',
            'table.type': 'Type',
            'table.value': 'Value',
            'table.proxy': 'Proxy',
            'table.remark': 'Remark',
            'table.createdAt': 'Created',
            'table.actions': 'Actions',
            'table.id': 'ID',
            'table.user': 'User',
            'table.username': 'Username',
            'table.email': 'Email',
            'table.role': 'Role',
            'table.status': 'Status',
            'table.domainCount': 'Domains',
            'table.registeredAt': 'Registered',
            'table.quotaCol': 'Quota',

            // ===== Badges =====
            'badge.enabled': 'On',
            'badge.disabled': 'Off',
            'badge.on': 'On',
            'badge.admin': 'Admin',
            'badge.userRole': 'User',
            'badge.active': 'Active',
            'badge.banned': 'Banned',
            'badge.unlimited': 'Unlimited',
            'badge.adminSuspended': '⛔ Suspended by Admin',

            // ===== Action Buttons =====
            'action.modify': 'Edit',
            'action.delete': 'Delete',
            'action.suspend': 'Suspend',
            'action.restore': 'Restore',
            'action.enable': 'Enable',
            'action.resetPassword': 'Reset Pwd',
            'action.quotaBtn': 'Quota',

            // ===== Add Modal =====
            'add.title': 'Add Domain',
            'add.subdomain': 'Subdomain',
            'add.subdomainPlaceholder': 'Enter subdomain',
            'add.recordType': 'Record Type',
            'add.recordValue': 'Record Value',
            'add.recordValuePlaceholder': 'e.g. 1.2.3.4',
            'add.remark': 'Remark (optional)',
            'add.remarkPlaceholder': 'Usage description',
            'add.proxy': 'Enable Cloudflare Proxy',
            'add.confirm': 'Add',
            'add.success': 'Added successfully!',
            'add.fillAll': 'Please fill in all fields',
            'add.available': '✓ {domain} is available',
            'add.unavailable': '✕ {domain} is taken',

            // ===== Edit Modal =====
            'edit.title': 'Edit Record',
            'edit.domain': 'Domain',
            'edit.recordType': 'Record Type',
            'edit.recordValue': 'Record Value',
            'edit.recordValuePlaceholder': 'New record value',
            'edit.remark': 'Remark',
            'edit.save': 'Save',
            'edit.success': 'Saved successfully!',
            'edit.enterValue': 'Please enter record value',

            // ===== Password Modal =====
            'pwd.title': 'Change Password',
            'pwd.oldPassword': 'Current Password',
            'pwd.oldPasswordPlaceholder': 'Enter current password',
            'pwd.newPassword': 'New Password',
            'pwd.newPasswordPlaceholder': 'At least 6 characters',
            'pwd.confirmPassword': 'Confirm Password',
            'pwd.confirmPasswordPlaceholder': 'Re-enter new password',
            'pwd.submit': 'Confirm',
            'pwd.fillAll': 'Please fill in all fields',
            'pwd.tooShort': 'New password must be at least 6 characters',
            'pwd.mismatch': 'Passwords do not match',
            'pwd.success': 'Password changed successfully!',

            // ===== Notifications =====
            'notification.title': '📢 Notifications',
            'notification.dismiss': 'Dismiss',

            // ===== Credits =====
            'credit.title': '💎 Exchange Credits for Quota',
            'credit.quantity': 'Quantity (1-30)',
            'credit.desc': '{n} credits per domain quota.',
            'credit.total': 'Total: {total} credits for {qty} domain quota(s).',
            'credit.note': 'You will be redirected to Linux.Do Credit to complete the payment. Quota will be added automatically.',
            'credit.submit': 'Pay Now',

            // ===== Confirmations =====
            'confirm.deleteRecord': 'Delete this domain record? This cannot be undone.',
            'confirm.deleteDomain': 'Delete this record?',
            'confirm.suspendDomain': 'Suspend this domain? Users cannot restore it themselves.',
            'confirm.restoreDomain': 'Restore this domain?',
            'confirm.deleteUser': 'Delete user "{name}"?\nThis cannot be undone. All DNS records will be deleted.',
            'confirm.disableUser': 'Disable this user?\nAll DNS records will be removed.',
            'confirm.enableUser': 'Enable this user?',

            // ===== Admin =====
            'admin.title': 'Admin - Domain Hub',
            'admin.heading': 'Admin Panel',
            'admin.desc': 'Manage all users and domain records',
            'admin.statUsers': 'Users',
            'admin.statRecords': 'Records',
            'admin.statActive': 'Active',
            'admin.tabRecords': '📋 Records',
            'admin.tabUsers': '👥 Users',
            'admin.tabSettings': '⚙️ Settings',
            'admin.recordList': 'Records',
            'admin.userList': 'Users',
            'admin.searchPlaceholder': 'Search domains, values, users...',
            'admin.noRecords': 'No records',
            'admin.noUsers': 'No users',
            'admin.domainSuspended': 'Domain suspended',
            'admin.domainRestored': 'Domain restored',
            'admin.deleteSuccess': 'Deleted successfully',
            'admin.editSuccess': 'Saved successfully!',
            'admin.userEnabled': 'User enabled',
            'admin.userDisabled': 'User disabled',
            'admin.userDeleted': 'User deleted',

            // ===== Admin Edit Modal =====
            'adminEdit.title': 'Edit Record',
            'adminEdit.domain': 'Domain',
            'adminEdit.type': 'Record Type',
            'adminEdit.user': 'Owner',
            'adminEdit.value': 'Record Value',
            'adminEdit.valuePlaceholder': 'New record value',
            'adminEdit.remark': 'Remark',
            'adminEdit.proxy': 'Enable Cloudflare Proxy',
            'adminEdit.save': 'Save',
            'adminEdit.enterValue': 'Please enter record value',

            // ===== Admin Password Reset =====
            'adminPwd.title': 'Reset Password',
            'adminPwd.user': 'User',
            'adminPwd.newPassword': 'New Password',
            'adminPwd.newPasswordPlaceholder': 'At least 6 characters',
            'adminPwd.confirmPassword': 'Confirm Password',
            'adminPwd.confirmPlaceholder': 'Re-enter new password',
            'adminPwd.submit': 'Reset',
            'adminPwd.tooShort': 'Password must be at least 6 characters',
            'adminPwd.mismatch': 'Passwords do not match',
            'adminPwd.success': 'Password reset successfully!',

            // ===== Admin Quota =====
            'adminQuota.title': 'Edit Domain Quota',
            'adminQuota.user': 'User',
            'adminQuota.label': 'Domain Quota',
            'adminQuota.placeholder': 'Leave empty for default',
            'adminQuota.hint': '0 = unlimited, empty = system default',
            'adminQuota.success': 'Quota updated successfully!',

            // ===== Admin Self Password =====
            'adminSelfPwd.title': 'Change Admin Password',
            'adminSelfPwd.oldPassword': 'Current Password',
            'adminSelfPwd.oldPasswordPlaceholder': 'Enter current password',
            'adminSelfPwd.newPassword': 'New Password',
            'adminSelfPwd.newPasswordPlaceholder': 'At least 6 characters',
            'adminSelfPwd.confirmPassword': 'Confirm Password',
            'adminSelfPwd.confirmPlaceholder': 'Re-enter new password',
            'adminSelfPwd.submit': 'Confirm',
            'adminSelfPwd.fillAll': 'Please fill in all fields',
            'adminSelfPwd.tooShort': 'New password must be at least 6 characters',
            'adminSelfPwd.mismatch': 'Passwords do not match',
            'adminSelfPwd.success': 'Password changed successfully!',

            // ===== Settings =====
            'settings.title': 'Settings',
            'settings.allowRegister': 'Allow Registration',
            'settings.allowRegisterHint': 'When disabled, users cannot register with username/password',
            'settings.allowOauth': 'Allow Linux.Do OAuth',
            'settings.allowOauthHint': 'When disabled, new users cannot register via Linux.Do; existing accounts unaffected',
            'settings.allowGithub': 'Allow GitHub OAuth',
            'settings.allowGithubHint': 'When disabled, new users cannot register via GitHub; existing accounts unaffected',
            'settings.defaultQuota': 'Default Domain Quota',
            'settings.defaultQuotaHint': 'Quota for new users, 0 = unlimited',
            'settings.save': 'Save Settings',
            'settings.success': 'Settings saved successfully!',
            'settings.loadFailed': 'Failed to load settings',

            // ===== DNS Delegation Verification =====
            'verify.title': '🔑 Subdomain Delegation Verify',
            'verify.btn': '🔑 DNS Delegation Verify',
            'verify.subdomain': 'Subdomain',
            'verify.provider': 'DNS Provider',
            'verify.txtValue': 'Verification TXT Value',
            'verify.txtValuePlaceholder': 'Paste the verification code from the provider',
            'verify.submit': 'Create Verification Record',
            'verify.fillAll': 'Please fill in all fields',
            'verify.success': 'Verification TXT record created, please verify within 5 minutes',
            'verify.noRecords': 'No domain records yet, please add a domain first',
            'verify.statusTitle': '📝 Active Verifications',
            'verify.domain': 'Verify Domain',
            'verify.platform': 'Provider',
            'verify.value': 'TXT Value',
            'verify.expires': 'Time Left',
            'verify.expired': 'Expired',
            'verify.providerAliyun': 'Alibaba Cloud (Alidns)',
            'verify.providerTencent': 'Tencent Cloud (DNSPod)',
            'verify.providerHuawei': 'Huawei Cloud DNS',
            'verify.hint': 'This feature creates temporary TXT records for DNS delegation verification. Records are auto-deleted after 5 minutes.',
            'verify.finish': 'Delete Record',
        }
    },

    /** 获取翻译文本，支持 {key} 占位符替换 */
    t(key, params) {
        const val = this.dict[this._lang]?.[key] || this.dict['zh'][key] || key;
        if (!params) return val;
        return val.replace(/\{(\w+)\}/g, (_, k) => params[k] !== undefined ? params[k] : `{${k}}`);
    },

    /** 获取当前语言 */
    lang() {
        return this._lang;
    },

    /** 设置语言并重新渲染 */
    setLang(lang) {
        this._lang = lang;
        localStorage.setItem('lang', lang);
        this.apply();
        // 更新 lang 按钮文字
        const btn = document.getElementById('langToggleBtn');
        if (btn) btn.textContent = lang === 'zh' ? 'EN' : '中';
        // 更新 html lang 属性
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    },

    /** 切换语言 */
    toggle() {
        this.setLang(this._lang === 'zh' ? 'en' : 'zh');
        // 通知页面语言变更，让页面可以重新渲染动态内容
        if (typeof onLangChange === 'function') onLangChange();
    },

    /** 扫描 DOM 并应用翻译 */
    apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = this.t(key);
            if (val !== key) el.textContent = val;
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const val = this.t(key);
            if (val !== key) el.innerHTML = val;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const val = this.t(key);
            if (val !== key) el.placeholder = val;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const val = this.t(key);
            if (val !== key) el.title = val;
        });
    }
};

/** 全局快捷函数 */
function t(key, params) { return I18N.t(key, params); }

// 初始化时机
document.addEventListener('DOMContentLoaded', () => {
    I18N.apply();
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
        btn.textContent = I18N.lang() === 'zh' ? 'EN' : '中';
        btn.addEventListener('click', () => I18N.toggle());
    }
    document.documentElement.lang = I18N.lang() === 'zh' ? 'zh-CN' : 'en';
});
