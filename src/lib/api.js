// BeerLab API 客户端
// 用于前端与后端通信

const API_BASE = window.location.origin + '/api';

// 获取 Token
function getToken() {
    return localStorage.getItem('beerlab_token');
}

// 通用请求封装
async function request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || '请求失败');
    }

    return data;
}

// ========== 认证 API ==========

export async function register(email, password, username) {
    const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, username })
    });
    localStorage.setItem('beerlab_token', data.token);
    localStorage.setItem('beerlab_user', JSON.stringify(data.user));
    return data;
}

export async function login(email, password) {
    const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    localStorage.setItem('beerlab_token', data.token);
    localStorage.setItem('beerlab_user', JSON.stringify(data.user));
    return data;
}

export function logout() {
    localStorage.removeItem('beerlab_token');
    localStorage.removeItem('beerlab_user');
}

export async function getCurrentUser() {
    return request('/auth/me');
}

export function getUserFromStorage() {
    const user = localStorage.getItem('beerlab_user');
    return user ? JSON.parse(user) : null;
}

export function isLoggedIn() {
    return !!getToken();
}

// ========== 啤酒库 API ==========

export async function getAllBeers() {
    return request('/beers');
}

export async function getBeer(id) {
    return request(`/beers/${id}`);
}

// ========== 用户收藏 API ==========

export async function getUserBeers() {
    return request('/user-beers');
}

export async function addUserBeer(beerId, rating, notes) {
    return request('/user-beers', {
        method: 'POST',
        body: JSON.stringify({ beerId, rating, notes })
    });
}

export async function removeUserBeer(beerId) {
    return request(`/user-beers/${beerId}`, { method: 'DELETE' });
}

// ========== 饮酒记录 API ==========

export async function getDrankRecords(limit = 50) {
    return request(`/drank-records?limit=${limit}`);
}

export async function addDrankRecord(record) {
    return request('/drank-records', {
        method: 'POST',
        body: JSON.stringify(record)
    });
}

// ========== 好友 API ==========

export async function getFriends() {
    return request('/friends');
}

export async function getFriendRequests() {
    return request('/friend-requests');
}

export async function searchUsers(query) {
    return request(`/users/search?q=${encodeURIComponent(query)}`);
}

export async function sendFriendRequest(friendId) {
    return request('/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendId })
    });
}

export async function acceptFriendRequest(requestId) {
    return request(`/friends/accept/${requestId}`, { method: 'POST' });
}

// ========== 游戏记录 API ==========

export async function saveGameRecord(gameType, score, result) {
    return request('/game-records', {
        method: 'POST',
        body: JSON.stringify({ gameType, score, result })
    });
}

export async function getGameStats() {
    return request('/game-records/stats');
}

// ========== 邀请码 API ==========

export async function createInviteCode() {
    return request('/invite-codes', { method: 'POST' });
}

export async function useInviteCode(code) {
    return request('/invite-codes/use', {
        method: 'POST',
        body: JSON.stringify({ code })
    });
}
