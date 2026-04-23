const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'beerlab.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS beers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    brewery TEXT,
    style TEXT,
    abv REAL,
    ibu INTEGER,
    description TEXT,
    color_hex TEXT,
    origin TEXT,
    tags TEXT
  );

  CREATE TABLE IF NOT EXISTS drank_records (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    beer_name TEXT,
    location TEXT,
    mood TEXT,
    rating INTEGER,
    note TEXT,
    drank_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    beer_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS game_records (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    game_type TEXT NOT NULL,
    score INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed beers if empty
const beerCount = db.prepare('SELECT COUNT(*) as count FROM beers').get();
if (beerCount.count === 0) {
  const beers = [
    { name: '青岛啤酒', name_en: 'Tsingtao', brewery: '青岛啤酒', style: '拉格', abv: 4.0, color: '#F5D76E', origin: '中国' },
    { name: '雪花啤酒', name_en: 'Snow Beer', brewery: '华润雪花', style: '拉格', abv: 3.6, color: '#F9E79F', origin: '中国' },
    { name: '百威', name_en: 'Budweiser', brewery: '百威英博', style: '拉格', abv: 5.0, color: '#F4D03F', origin: '美国' },
    { name: '喜力', name_en: 'Heineken', brewery: '喜力集团', style: '拉格', abv: 5.0, color: '#82E0AA', origin: '荷兰' },
    { name: '嘉士伯', name_en: 'Carlsberg', brewery: '嘉士伯', style: '拉格', abv: 4.6, color: '#F9E79F', origin: '丹麦' },
    { name: '科罗娜', name_en: 'Corona', brewery: '星座集团', style: '拉格', abv: 4.5, color: '#F4D03F', origin: '墨西哥' },
    { name: '1664白啤', name_en: '1664 Blanc', brewery: '嘉士伯', style: '小麦白啤', abv: 5.0, color: '#FDF5E6', origin: '法国' },
    { name: '福佳白', name_en: 'Hoegaarden', brewery: '百威英博', style: '小麦白啤', abv: 4.9, color: '#FFF8DC', origin: '比利时' },
    { name: '白啤', name_en: 'White Beer', brewery: 'Various', style: '小麦白啤', abv: 5.0, color: '#FFFACD', origin: '欧洲' },
    { name: 'IPA', name_en: 'India Pale Ale', brewery: 'Craft Brewer', style: 'IPA', abv: 6.5, color: '#D2691E', origin: '美国' },
    { name: '美式IPA', name_en: 'American IPA', brewery: 'Craft Brewer', style: 'IPA', abv: 6.8, color: '#CD853F', origin: '美国' },
    { name: '浑浊IPA', name_en: 'Hazy IPA', brewery: 'Craft Brewer', style: 'IPA', abv: 7.0, color: '#DEB887', origin: '美国' },
    { name: '世涛', name_en: 'Stout', brewery: 'Craft Brewer', style: '世涛', abv: 7.5, color: '#3D2314', origin: '爱尔兰' },
    { name: '波特', name_en: 'Porter', brewery: 'Craft Brewer', style: '波特', abv: 6.5, color: '#4A3728', origin: '英国' },
    { name: '皮尔森', name_en: 'Pilsner', brewery: 'Various', style: '皮尔森', abv: 4.4, color: '#F0E68C', origin: '捷克' },
    { name: '拉格', name_en: 'Lager', brewery: 'Various', style: '拉格', abv: 4.5, color: '#F5DEB3', origin: '德国' },
    { name: '小棕瓶', name_en: 'Brown Ale', brewery: 'Craft Brewer', style: '棕色艾尔', abv: 5.5, color: '#8B4513', origin: '英国' },
    { name: '比尔森', name_en: 'Pilsen', brewery: 'Pilsner Urquell', style: '比尔森', abv: 4.4, color: '#FAFAD2', origin: '捷克' },
    { name: '林德曼', name_en: 'Lindemans', brewery: 'Lindemans', style: '水果啤酒', abv: 3.5, color: '#FFB6C1', origin: '比利时' },
    { name: '乐蔓', name_en: 'Liefmans', brewery: 'Liefmans', style: '水果啤酒', abv: 6.0, color: '#C71585', origin: '比利时' },
    { name: '林德曼樱桃', name_en: 'Lindemans Kriek', brewery: 'Lindemans', style: '樱桃啤酒', abv: 3.5, color: '#DC143C', origin: '比利时' },
    { name: '迷失海岸', name_en: 'Lost Coast', brewery: 'Lost Coast', style: 'IPA', abv: 6.5, color: '#DAA520', origin: '美国' },
    { name: '鹅岛', name_en: 'Goose Island', brewery: '鹅岛', style: 'IPA', abv: 5.9, color: '#CD853F', origin: '美国' },
    { name: '酿酒狗', name_en: 'BrewDog', brewery: 'BrewDog', style: 'IPA', abv: 7.2, color: '#B8860B', origin: '苏格兰' },
    { name: '内华达山脉', name_en: 'Sierra Nevada', brewery: 'Sierra Nevada', style: 'IPA', abv: 6.8, color: '#D2691E', origin: '美国' },
    { name: '柏龙', name_en: 'Paulaner', brewery: 'Paulaner', style: '小麦啤酒', abv: 5.5, color: '#FFF8DC', origin: '德国' },
    { name: '教士', name_en: 'Franziskaner', brewery: 'Paulaner', style: '小麦啤酒', abv: 5.0, color: '#FFFACD', origin: '德国' },
    { name: '范家乐', name_en: 'VanderGinst', brewery: 'VanderGinst', style: '琥珀艾尔', abv: 5.5, color: '#CD853F', origin: '比利时' },
    { name: '粉象', name_en: 'Delirium', brewery: 'Huyghe', style: '粉色啤酒', abv: 8.5, color: '#FFB6C1', origin: '比利时' },
    { name: '智美', name_en: 'Chimay', brewery: 'Scourmont Abbey', style: '修道院啤酒', abv: 9.0, color: '#8B4513', origin: '比利时' }
  ];

  const insert = db.prepare(`
    INSERT INTO beers (id, name, name_en, brewery, style, abv, color_hex, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of beers) {
    insert.run(uuidv4(), b.name, b.name_en, b.brewery, b.style, b.abv, b.color, b.origin);
  }
  console.log('Seeded 30 beers');
}

module.exports = db;
