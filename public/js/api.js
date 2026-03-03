/**
 * API 请求封装
 */

const API_BASE = '/api';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    isLoggedIn() {
        return !!this.token;
    }

    isAdmin() {
        return this.user?.role === 'admin';
    }

    async request(method, path, body = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE}${path}`, options);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                this.clearAuth();
                window.location.href = '/';
            }
            throw new Error(data.error || '请求失败');
        }

        return data;
    }

    // Auth
    async register(username, email, password) {
        const data = await this.request('POST', '/auth/register', { username, email, password });
        this.setAuth(data.token, data.user);
        return data;
    }

    async login(username, password) {
        const data = await this.request('POST', '/auth/login', { username, password });
        this.setAuth(data.token, data.user);
        return data;
    }

    async getMe() {
        return this.request('GET', '/auth/me');
    }

    async updatePassword(oldPassword, newPassword) {
        return this.request('PUT', '/auth/password', { oldPassword, newPassword });
    }

    logout() {
        this.clearAuth();
        window.location.href = '/';
    }

    // Config
    async getConfig() {
        return this.request('GET', '/config');
    }

    // DNS
    async checkSubdomain(subdomain, domain, recordType) {
        let query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
        if (recordType) query += `${query ? '&' : '?'}recordType=${encodeURIComponent(recordType)}`;
        return this.request('GET', `/dns/check/${encodeURIComponent(subdomain)}${query}`);
    }

    async getRecords(page = 1, pageSize = 10) {
        return this.request('GET', `/dns/records?page=${page}&pageSize=${pageSize}`);
    }

    async createRecord(data) {
        return this.request('POST', '/dns/records', data);
    }

    async updateRecord(id, data) {
        return this.request('PUT', `/dns/records/${id}`, data);
    }

    async deleteRecord(id) {
        return this.request('DELETE', `/dns/records/${id}`);
    }

    // DNS Verification
    async requestVerification(data) {
        return this.request('POST', '/dns/verify', data);
    }

    async getVerifyStatus() {
        return this.request('GET', '/dns/verify/status');
    }

    async deleteVerification(id) {
        return this.request('DELETE', `/dns/verify/${id}`);
    }

    // Admin
    async getAdminRecords(keyword = '', page = 1, pageSize = 20) {
        const params = new URLSearchParams({ page, pageSize });
        if (keyword) params.set('keyword', keyword);
        return this.request('GET', `/admin/records?${params.toString()}`);
    }

    async getAdminUsers(page = 1, pageSize = 20) {
        return this.request('GET', `/admin/members?page=${page}&pageSize=${pageSize}`);
    }

    async updateAdminRecord(id, data) {
        return this.request('PUT', `/admin/records/${id}`, data);
    }

    async updateAdminRecordStatus(id, status) {
        return this.request('PUT', `/admin/records/${id}/status`, { status });
    }

    async deleteAdminRecord(id) {
        return this.request('DELETE', `/admin/records/${id}`);
    }

    async updateUserStatus(id, status) {
        return this.request('PUT', `/admin/members/${id}/status`, { status });
    }

    async resetUserPassword(id, password) {
        return this.request('PUT', `/admin/members/${id}/password`, { password });
    }

    async updateUserQuota(id, quota) {
        return this.request('PUT', `/admin/members/${id}/quota`, { quota });
    }

    async deleteUser(id) {
        return this.request('DELETE', `/admin/members/${id}`);
    }

    async getAdminSettings() {
        return this.request('GET', '/admin/settings');
    }

    async updateAdminSettings(settings) {
        return this.request('PUT', '/admin/settings', settings);
    }

    async updateAdminPassword(oldPassword, newPassword) {
        return this.request('PUT', '/admin/admin/password', { oldPassword, newPassword });
    }

    async getNotifications() {
        return this.request('GET', '/dns/notifications');
    }

    async getCreditConfig() {
        return this.request('GET', '/credit/config');
    }

    async createCreditOrder(quantity = 1) {
        return this.request('POST', '/credit/create', { quantity });
    }

    async markNotificationsRead() {
        return this.request('POST', '/dns/notifications/read');
    }

    async getAdminStats() {
        return this.request('GET', '/admin/stats');
    }
}

// 全局实例
const api = new ApiClient();

// Toast 通知
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
