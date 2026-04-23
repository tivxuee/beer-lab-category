// Supabase 客户端配置
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ========== 认证相关 ==========

export async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    })
    return { data, error }
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })
    return { data, error }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
}

// ========== 用户资料 ==========

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
    return { data, error }
}

export async function updateProfile(userId, updates) {
    const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
    return { data, error }
}

// ========== 啤酒库 ==========

export async function getAllBeers() {
    const { data, error } = await supabase
        .from('beers')
        .select('*')
        .order('name')
    return { data, error }
}

export async function getBeerById(beerId) {
    const { data, error } = await supabase
        .from('beers')
        .select('*')
        .eq('id', beerId)
        .single()
    return { data, error }
}

export async function searchBeers(query) {
    const { data, error } = await supabase
        .from('beers')
        .select('*')
        .or(`name.ilike.%${query}%,name_en.ilike.%${query}%`)
    return { data, error }
}

// ========== 用户收藏 ==========

export async function getUserBeers(userId) {
    const { data, error } = await supabase
        .from('user_beers')
        .select('*, beers(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    return { data, error }
}

export async function addUserBeer(userId, beerId, rating, notes) {
    const { data, error } = await supabase
        .from('user_beers')
        .insert({ user_id: userId, beer_id: beerId, rating, notes })
    return { data, error }
}

export async function removeUserBeer(userId, beerId) {
    const { error } = await supabase
        .from('user_beers')
        .delete()
        .eq('user_id', userId)
        .eq('beer_id', beerId)
    return { error }
}

// ========== 饮酒记录 ==========

export async function getDrankRecords(userId, limit = 50) {
    const { data, error } = await supabase
        .from('drank_records')
        .select('*, beers(*)')
        .eq('user_id', userId)
        .order('drank_at', { ascending: false })
        .limit(limit)
    return { data, error }
}

export async function addDrankRecord(userId, record) {
    const { data, error } = await supabase
        .from('drank_records')
        .insert({ user_id: userId, ...record })
    return { data, error }
}

// ========== 好友关系 ==========

export async function getFriends(userId) {
    // 获取已接受的好友
    const { data, error } = await supabase
        .from('friendships')
        .select(`
            *,
            profiles:friend_id (*)
        `)
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted')
    return { data, error }
}

export async function getPendingRequests(userId) {
    const { data, error } = await supabase
        .from('friendships')
        .select(`
            *,
            profiles:user_id (*)
        `)
        .eq('friend_id', userId)
        .eq('status', 'pending')
    return { data, error }
}

export async function sendFriendRequest(userId, friendId) {
    const { data, error } = await supabase
        .from('friendships')
        .insert({ user_id: userId, friend_id: friendId })
    return { data, error }
}

export async function acceptFriendRequest(requestId) {
    const { data, error } = await supabase
        .from('friendships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId)
    return { data, error }
}

export async function searchUsers(query) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${query}%`)
    return { data, error }
}

// ========== 游戏记录 ==========

export async function saveGameRecord(userId, gameType, score, result) {
    const { data, error } = await supabase
        .from('game_records')
        .insert({
            user_id: userId,
            game_type: gameType,
            score,
            result
        })
    return { data, error }
}

export async function getGameStats(userId) {
    const { data, error } = await supabase
        .from('game_records')
        .select('game_type, score, played_at')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
    return { data, error }
}

// ========== 邀请码 ==========

export async function createInviteCode(creatorId) {
    const code = generateInviteCode()
    const { data, error } = await supabase
        .from('invite_codes')
        .insert({
            code,
            creator_id: creatorId,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
        })
    return { data: { ...data, code }, error }
}

export async function useInviteCode(code, userId) {
    // 先查询邀请码
    const { data: invite, error: findError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', code)
        .single()
    
    if (findError || !invite) return { error: { message: '邀请码无效' } }
    if (invite.used_by) return { error: { message: '邀请码已被使用' } }
    if (new Date(invite.expires_at) < new Date()) return { error: { message: '邀请码已过期' } }
    
    // 使用邀请码
    const { error: useError } = await supabase
        .from('invite_codes')
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq('id', invite.id)
    
    if (useError) return { error: useError }
    
    // 建立好友关系
    await sendFriendRequest(invite.creator_id, userId)
    
    return { data: invite, error: null }
}

function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}
