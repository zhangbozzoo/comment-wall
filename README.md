# 实时评论墙

一个基于 React + FastAPI + CloudBase HTTP API 的全栈实时评论墙应用，支持多人在线协作、实时同步、情绪分析和智能整理。

## 项目简介

实时评论墙是一个类似在线便签墙的应用，用户可以在画布上创建便签卡片，卡片会根据文本内容进行情绪分析并自动变色。支持拖拽移动、实时同步、在线状态显示、点赞等功能。

### 功能特性

- **实时同步**：多端实时看到新增、移动、点赞等操作
- **在线状态**：左侧边栏显示在线用户头像
- **情绪分析**：自动识别文本情绪并赋予不同颜色（正面绿色、负面红色、中性黄色）
- **智能整理**：一键按情绪类别排列卡片
- **JWT 鉴权**：安全的用户认证机制
- **WebSocket 通信**：实时双向通信，支持心跳保活

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Zustand + react-rnd
- **后端**：Python 3.11 + FastAPI + httpx + WebSocket
- **数据库**：PostgreSQL（通过 CloudBase HTTP API / PostgREST 访问）
- **部署**：Docker + CloudBase 云托管

## 本地启动

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端服务默认运行在 `http://localhost:9000`（CloudBase 要求 WebSocket 监听 9000 端口）。

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认运行在 `http://localhost:5173`，已配置代理转发到后端 9000 端口。

## 环境变量配置

在 `backend/` 目录下创建 `.env` 文件：

```env
# CloudBase 环境 ID（在 CloudBase 控制台获取）
TCB_ENV_ID=your-cloudbase-env-id

# CloudBase API Key（在 CloudBase 控制台生成）
TCB_API_KEY=your-cloudbase-api-key

# JWT 密钥（生产环境请务必更换）
SECRET_KEY=super-secret-key-change-in-production
```

前端在 `frontend/` 目录下创建 `.env` 文件：

```env
VITE_API_URL=http://localhost:9000
```

## 部署到 CloudBase

### 后端部署（云托管）

1. 在 CloudBase 控制台创建云托管服务
2. 选择「使用 Dockerfile 部署」
3. 上传 `backend/` 目录代码
4. 构建并发布服务
5. 在云托管环境中设置环境变量：
   - `TCB_ENV_ID`：云开发环境 ID
   - `TCB_API_KEY`：云开发 API Key
   - `SECRET_KEY`：JWT 签名密钥
6. 确保服务监听端口为 **9000**

### 前端部署（静态托管）

```bash
cd frontend
npm run build
```

将 `dist/` 目录上传至 CloudBase 静态网站托管。部署后将 `VITE_API_URL` 设置为云托管服务的公网地址，重新构建并上传。

### 数据库配置

在腾讯云 CloudBase 控制台创建 PostgreSQL 数据库实例（共享集群版），数据通过 CloudBase HTTP API (PostgREST) 访问，无需 TCP 直连。

需要在数据库中创建以下表：

```sql
-- 评论表
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    user_id TEXT,
    x FLOAT DEFAULT 0.0,
    y FLOAT DEFAULT 0.0,
    color TEXT DEFAULT '#fef3c7',
    rotate FLOAT DEFAULT 0.0,
    likes INT DEFAULT 0,
    sentiment TEXT DEFAULT 'neutral',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 点赞表（防止重复点赞）
CREATE TABLE likes (
    comment_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (comment_id, user_id)
);

-- 用户表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT
);
```

## 目录结构

```
realtime-comment-wall/
├── backend/
│   ├── main.py                 # FastAPI 主应用（端口 9000）
│   ├── database.py             # httpx CloudBase HTTP API 数据访问层
│   ├── models.py               # Pydantic 数据模型
│   ├── websocket_manager.py    # WebSocket 连接管理
│   ├── Dockerfile              # 后端容器化（EXPOSE 9000）
│   ├── requirements.txt        # Python 依赖
│   └── .env.example            # 环境变量示例
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # 主应用组件
│   │   ├── main.tsx            # 入口文件
│   │   ├── utils.ts            # 工具函数（API 地址）
│   │   ├── store/
│   │   │   └── useStore.ts     # Zustand 状态管理
│   │   └── components/
│   │       ├── Sidebar.tsx     # 侧边栏
│   │       ├── StickyNote.tsx  # 便签卡片
│   │       ├── LoginModal.tsx  # 登录弹窗
│   │       ├── CreateModal.tsx # 发表建议弹窗
│   │       ├── Toolbar.tsx     # 底部工具栏
│   │       └── SentimentOverview.tsx  # 情绪概览
│   ├── vite.config.ts          # Vite 配置（代理到 9000）
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.example            # 前端环境变量示例
└── README.md
```

## WebSocket 协议

所有消息格式：`{ "type": "EVENT_TYPE", "payload": { ... } }`

- `CREATE_COMMENT` / `NEW_COMMENT` - 创建评论
- `MOVE_COMMENT` / `COMMENT_MOVED` - 移动评论
- `LIKE_COMMENT` / `COMMENT_LIKED` - 点赞
- `UPDATE_COMMENT` / `COMMENT_UPDATED` - 更新评论内容
- `PING` / `PONG` - 心跳保活（每 15 秒）
- `presence:update` - 在线用户更新

## CloudBase HTTP API 接口映射

| 操作 | HTTP 方法 | 端点 |
|---|---|---|
| 查询评论列表 | GET | `/v1/rdb/rest/comments?select=*&order=created_at.desc` |
| 新增评论 | POST | `/v1/rdb/rest/comments` |
| 更新坐标 | PATCH | `/v1/rdb/rest/comments?id=eq.{id}` |
| 更新内容 | PATCH | `/v1/rdb/rest/comments?id=eq.{id}` |
| 查询点赞 | GET | `/v1/rdb/rest/likes?comment_id=eq.{cid}&user_id=eq.{uid}` |
| 新增点赞 | POST | `/v1/rdb/rest/likes` |
| 取消点赞 | DELETE | `/v1/rdb/rest/likes?comment_id=eq.{cid}&user_id=eq.{uid}` |
| 查询用户 | GET | `/v1/rdb/rest/users?username=eq.{name}` |
| 注册用户 | POST | `/v1/rdb/rest/users` |

## 许可证

MIT