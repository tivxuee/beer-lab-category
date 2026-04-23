const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'beerlab-secret-2024';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (for frontend)
app.use(express.static('public', {
  etag: false,
  setHeaders: (res) => res.setHeader('Cache-Control', 'no-store')
}));

// Auth middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============ AUTH ============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    
    db.prepare('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)')
      .run(id, email, username, passwordHash);

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id, email, username } });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, username: user.username } 
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?')
    .get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ============ BEERS ============

app.get('/api/beers', (req, res) => {
  const beers = db.prepare('SELECT * FROM beers ORDER BY name').all();
  res.json(beers);
});

app.get('/api/beers/:id', (req, res) => {
  const beer = db.prepare('SELECT * FROM beers WHERE id = ?').get(req.params.id);
  if (!beer) return res.status(404).json({ error: 'Not found' });
  res.json(beer);
});

// ============ DRANK RECORDS ============

app.get('/api/drank', authenticate, (req, res) => {
  const records = db.prepare(`
    SELECT * FROM drank_records 
    WHERE user_id = ? 
    ORDER BY drank_at DESC 
    LIMIT 100
  `).all(req.userId);
  res.json(records);
});

app.post('/api/drank', authenticate, (req, res) => {
  const { beer_name, location, mood, rating, note } = req.body;
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO drank_records (id, user_id, beer_name, location, mood, rating, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, beer_name, location || '', mood || '', rating || 0, note || '');

  const record = db.prepare('SELECT * FROM drank_records WHERE id = ?').get(id);
  res.json(record);
});

// ============ FAVORITES ============

app.get('/api/favorites', authenticate, (req, res) => {
  const favs = db.prepare(`
    SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.userId);
  res.json(favs);
});

app.post('/api/favorites', authenticate, (req, res) => {
  const { beer_name } = req.body;
  const existing = db.prepare(
    'SELECT id FROM favorites WHERE user_id = ? AND beer_name = ?'
  ).get(req.userId, beer_name);
  
  if (existing) {
    return res.json({ success: true, message: 'Already favorited' });
  }

  const id = uuidv4();
  db.prepare('INSERT INTO favorites (id, user_id, beer_name) VALUES (?, ?, ?)')
    .run(id, req.userId, beer_name);
  res.json({ id, beer_name });
});

app.delete('/api/favorites/:beer_name', authenticate, (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND beer_name = ?')
    .run(req.userId, req.params.beer_name);
  res.json({ success: true });
});

// ============ GAME RECORDS ============

app.get('/api/games', authenticate, (req, res) => {
  const records = db.prepare(`
    SELECT * FROM game_records WHERE user_id = ? ORDER BY played_at DESC LIMIT 50
  `).all(req.userId);
  res.json(records);
});

app.post('/api/games', authenticate, (req, res) => {
  const { game_type, score } = req.body;
  const id = uuidv4();
  
  db.prepare('INSERT INTO game_records (id, user_id, game_type, score) VALUES (?, ?, ?, ?)')
    .run(id, req.userId, game_type, score);
  
  res.json({ id, game_type, score });
});

// ============ FRIENDSHIPS ============

app.get('/api/friends', authenticate, (req, res) => {
  const friends = db.prepare(`
    SELECT u.id, u.username, u.email, f.created_at
    FROM friendships f
    JOIN users u ON (f.friend_id = u.id OR f.user_id = u.id) AND u.id != ?
    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
  `).all(req.userId, req.userId, req.userId);
  res.json(friends);
});

app.post('/api/friends/request', authenticate, (req, res) => {
  const { friend_id } = req.body;
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, 'pending')
  `).run(id, req.userId, friend_id);
  
  res.json({ id, status: 'pending' });
});

app.post('/api/friends/accept/:id', authenticate, (req, res) => {
  db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ? AND friend_id = ?")
    .run(req.params.id, req.userId);
  res.json({ success: true });
});

// Stats
app.get('/api/stats', authenticate, (req, res) => {
  const totalDrinks = db.prepare(
    'SELECT COUNT(*) as count FROM drank_records WHERE user_id = ?'
  ).get(req.userId).count;
  
  const uniqueBeers = db.prepare(
    'SELECT COUNT(DISTINCT beer_name) as count FROM drank_records WHERE user_id = ?'
  ).get(req.userId).count;

  const totalGames = db.prepare(
    'SELECT COUNT(*) as count FROM game_records WHERE user_id = ?'
  ).get(req.userId).count;

  res.json({ totalDrinks, uniqueBeers, totalGames });
});

// Catch-all for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('BeerLab API Running');
  }
});

app.listen(PORT, () => {
  console.log(`🍺 BeerLab running on port ${PORT}`);
});
