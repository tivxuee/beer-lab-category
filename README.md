# BeerLab - 精酿啤酒社交应用 🍺

## 快速部署到 Railway

### 1. 创建 Railway 项目
1. 登录 [railway.app](https://railway.app) (GitHub 登录)
2. 点击 **New Project** → **Empty Project**

### 2. 添加数据库
1. 在项目中点击 **Add a Database**
2. 选择 **PostgreSQL**
3. 等待数据库创建完成

### 3. 部署应用
1. 点击 **Add a Service** → **GitHub**
2. 连接仓库 `tivxuee/beer-lab-category` (或新建仓库)
3. Railway 会自动检测 Node.js 项目

### 4. 配置环境变量
在 Railway 项目的 Settings → Variables 中添加：

```
NODE_ENV=production
```

### 5. 初始化数据库
1. 在 PostgreSQL 数据库中打开 **Query Editor**
2. 复制 `schema.sql` 的内容粘贴执行

### 6. 部署完成
Railway 会自动分配域名，如 `beerlab.railway.app`

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问 http://localhost:3000
```

本地需要设置环境变量：
```bash
# macOS/Linux
export DATABASE_URL="postgresql://user:password@localhost:5432/beerlab"

# Windows (PowerShell)
$env:DATABASE_URL="postgresql://user:password@localhost:5432/beerlab"
```

---

## 项目结构

```
beer-lab/
├── public/
│   └── index.html      # 前端应用（包含登录、游戏等）
├── src/
│   └── lib/
│       └── api.js      # API 客户端
├── server.js           # Express 后端
├── schema.sql         # 数据库结构
├── package.json       # 依赖配置
├── railway.json       # Railway 配置
└── README.md
```

---

## 功能列表

- [x] 用户注册/登录（邮箱+密码）
- [x] 游客模式（不保存数据）
- [x] 啤酒库浏览（30+酒款）
- [x] 转盘摇酒
- [x] 心情推荐
- [x] 炸裂小怪兽游戏
- [x] 饮酒记录
- [x] 收藏酒款
- [x] 好友系统
- [x] 邀请码

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/auth/me | 获取当前用户 |
| GET | /api/beers | 获取所有啤酒 |
| GET | /api/user-beers | 获取收藏 |
| POST | /api/user-beers | 添加收藏 |
| GET | /api/drank-records | 获取饮酒记录 |
| POST | /api/drank-records | 添加记录 |
| GET | /api/friends | 获取好友 |
| POST | /api/friends/request | 发送好友请求 |
| POST | /api/game-records | 保存游戏记录 |
| POST | /api/invite-codes | 生成邀请码 |

---

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **后端**: Node.js + Express
- **数据库**: PostgreSQL
- **部署**: Railway
