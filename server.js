const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'beerlab-secret-key-change-in-production';

// PostgreSQL 连接
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 认证中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '需要登录' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token 无效' });
        req.user = user;
        next();
    });
}

// ========== 认证 API ==========

// 注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({ error: '请填写所有字段' });
        }

        // 检查用户是否存在
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        // 创建用户
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)',
            [userId, email, username, passwordHash]
        );

        // 生成 Token
        const token = jwt.sign({ userId, email, username }, JWT_SECRET, { expiresIn: '30d' });

        res.json({ token, user: { userId, email, username } });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ token, user: { userId: user.id, email: user.email, username: user.username } });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, username, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('获取用户错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// ========== 啤酒库 API ==========

// 获取所有啤酒
app.get('/api/beers', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM beers ORDER BY name'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('获取啤酒错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// 获取单款啤酒
app.get('/api/beers/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM beers WHERE id = $1',
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: '啤酒不存在' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('获取啤酒错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// ========== 用户收藏 API ==========

// 获取用户收藏
app.get('/api/user-beers', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ub.*, b.*, ub.id as user_beer_id
             FROM user_beers ub
             JOIN beers b ON ub.beer_id = b.id
             WHERE ub.user_id = $1
             ORDER BY ub.created_at DESC`,
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('获取收藏错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// 添加收藏
app.post('/api/user-beers', authenticateToken, async (req, res) => {
    try {
        const { beerId, rating, notes } = req.body;

        const result = await pool.query(
            `INSERT INTO user_beers (id, user_id, beer_id, rating, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [uuidv4(), req.user.userId, beerId, rating, notes]
        );

        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: '已经在收藏列表中了' });
        }
        console.error('添加收藏错误:', error);
        res.status(500).json({ error: '添加失败' });
    }
});

// 删除收藏
app.delete('/api/user-beers/:beerId', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM user_beers WHERE user_id = $1 AND beer_id = $2',
            [req.user.userId, req.params.beerId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('删除收藏错误:', error);
        res.status(500).json({ error: '删除失败' });
    }
});

// ========== 饮酒记录 API ==========

// 获取饮酒记录
app.get('/api/drank-records', authenticateToken, async (req, res) => {
    try {
        const limit = req.query.limit || 50;
        const result = await pool.query(
            `SELECT dr.*, b.name as beer_name, b.tag as beer_tag
             FROM drank_records dr
             LEFT JOIN beers b ON dr.beer_id = b.id
             WHERE dr.user_id = $1
             ORDER BY dr.drank_at DESC
             LIMIT $2`,
            [req.user.userId, limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('获取记录错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// 添加饮酒记录
app.post('/api/drank-records', authenticateToken, async (req, res) => {
    try {
        const { beerId, mood, location, companions, rating, notes, drankAt } = req.body;

        const result = await pool.query(
            `INSERT INTO drank_records (id, user_id, beer_id, mood, location, companions, rating, notes, drank_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [uuidv4(), req.user.userId, beerId, mood, location, companions, rating, notes, drankAt || new Date()]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('添加记录错误:', error);
        res.status(500).json({ error: '添加失败' });
    }
});

// ========== 好友 API ==========

// 获取好友列表
app.get('/api/friends', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.avatar_url, fr.created_at as friend_since
             FROM friendships fr
             JOIN users u ON (
                 (fr.user_id = $1 AND fr.friend_id = u.id) OR
                 (fr.friend_id = $1 AND fr.user_id = u.id)
             )
             WHERE (fr.user_id = $1 OR fr.friend_id = $1)
             AND fr.status = 'accepted'`,
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('获取好友错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// 获取好友请求
app.get('/api/friend-requests', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT fr.*, u.username, u.avatar_url
             FROM friendships fr
             JOIN users u ON fr.user_id = u.id
             WHERE fr.friend_id = $1 AND fr.status = 'pending'`,
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('获取请求错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// 搜索用户
app.get('/api/users/search', authenticateToken, async (req, res) => {
    try {
        const query = req.query.q || '';
        const result = await pool.query(
            `SELECT id, username, avatar_url
             FROM users
             WHERE username ILIKE $1 AND id != $2
             LIMIT 20`,
            [`%${query}%`, req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('搜索用户错误:', error);
        res.status(500).json({ error: '搜索失败' });
    }
});

// 发送好友请求
app.post('/api/friends/request', authenticateToken, async (req, res) => {
    try {
        const { friendId } = req.body;

        // 检查是否已是好友
        const existing = await pool.query(
            `SELECT id FROM friendships
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [req.user.userId, friendId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: '已经是好友或已有请求' });
        }

        await pool.query(
            `INSERT INTO friendships (id, user_id, friend_id, status)
             VALUES ($1, $2, $3, 'pending')`,
            [uuidv4(), req.user.userId, friendId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('发送请求错误:', error);
        res.status(500).json({ error: '发送失败' });
    }
});

// 接受好友请求
app.post('/api/friends/accept/:requestId', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            `UPDATE friendships SET status = 'accepted', updated_at = NOW()
             WHERE id = $1 AND friend_id = $2`,
            [req.params.requestId, req.user.userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('接受请求错误:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

// ========== 游戏记录 API ==========

// 保存游戏记录
app.post('/api/game-records', authenticateToken, async (req, res) => {
    try {
        const { gameType, score, result } = req.body;

        const dbResult = await pool.query(
            `INSERT INTO game_records (id, user_id, game_type, score, result)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [uuidv4(), req.user.userId, gameType, score, JSON.stringify(result)]
        );

        res.json(dbResult.rows[0]);
    } catch (error) {
        console.error('保存记录错误:', error);
        res.status(500).json({ error: '保存失败' });
    }
});

// 获取游戏统计
app.get('/api/game-records/stats', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT game_type, COUNT(*) as play_count, MAX(score) as best_score
             FROM game_records
             WHERE user_id = $1
             GROUP BY game_type`,
            [req.user.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('获取统计错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

// ========== 邀请码 API ==========

// 生成邀请码
app.post('/api/invite-codes', authenticateToken, async (req, res) => {
    try {
        const code = uuidv4().substring(0, 8).toUpperCase();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const result = await pool.query(
            `INSERT INTO invite_codes (id, code, creator_id, expires_at)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [uuidv4(), code, req.user.userId, expiresAt]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('生成邀请码错误:', error);
        res.status(500).json({ error: '生成失败' });
    }
});

// 使用邀请码
app.post('/api/invite-codes/use', authenticateToken, async (req, res) => {
    try {
        const { code } = req.body;

        const invite = await pool.query(
            'SELECT * FROM invite_codes WHERE code = $1',
            [code]
        );

        if (invite.rows.length === 0) {
            return res.status(404).json({ error: '邀请码无效' });
        }

        const inviteData = invite.rows[0];

        if (inviteData.used_by) {
            return res.status(400).json({ error: '邀请码已被使用' });
        }

        if (new Date(inviteData.expires_at) < new Date()) {
            return res.status(400).json({ error: '邀请码已过期' });
        }

        // 使用邀请码
        await pool.query(
            'UPDATE invite_codes SET used_by = $1, used_at = NOW() WHERE id = $2',
            [req.user.userId, inviteData.id]
        );

        // 建立好友关系
        await pool.query(
            `INSERT INTO friendships (id, user_id, friend_id, status)
             VALUES ($1, $2, $3, 'accepted')`,
            [uuidv4(), req.user.userId, inviteData.creator_id]
        );

        res.json({ success: true, message: '成为好友了！' });
    } catch (error) {
        console.error('使用邀请码错误:', error);
        res.status(500).json({ error: '操作失败' });
    }
});

// ========== 健康检查 ==========
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// SPA 路由 - 所有非 API 请求返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🍺 BeerLab API 运行在端口 ${PORT}`);
});
