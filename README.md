# 实时评论墙

一个基于 React + FastAPI + PostgreSQL 的全栈实时评论墙应用，支持多人在线协作、实时同步、情绪分析和智能整理。

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
- **后端**：Python 3.11 + FastAPI + asyncpg + WebSocket
- **数据库**：PostgreSQL
- **部署**：Docker + CloudBase

## 本地启动

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端服务默认运行在 `http://localhost:8000`。

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器默认运行在 `http://localhost:5173`。

## 环境变量配置

在项目根目录或 `backend/` 目录下创建 `.env` 文件：

```env
# 数据库连接字符串
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/commentwall

# JWT 密钥（生产环境请务必更换）
SECRET_KEY=super-secret-key-change-in-production
```

前端在 `frontend/.env` 中配置：

```env
VITE_API_URL=http://localhost:8000
```

## 部署到 CloudBase

### 后端部署（云托管）

1. 在 CloudBase 控制台创建云托管服务
2. 选择「使用 Dockerfile 部署」
3. 上传 `backend/` 目录代码
4. 构建并发布服务
5. 在云托管环境中设置环境变量（DATABASE_URL、SECRET_KEY）

### 前端部署（静态托管）

```bash
cd frontend
npm run build
```

将 `dist/` 目录上传至 CloudBase 静态网站托管。

### 数据库配置

在腾讯云 CloudBase 控制台创建 PostgreSQL 数据库实例，获取连接字符串后填入环境变量 `DATABASE_URL`。

## 目录结构

```
realtime-comment-wall/
├── backend/
│   ├── main.py                 # FastAPI 主应用
│   ├── database.py             # asyncpg 数据库操作
│   ├── models.py               # Pydantic 数据模型
│   ├── websocket_manager.py    # WebSocket 连接管理
│   ├── Dockerfile              # 后端容器化
│   └── requirements.txt        # Python 依赖
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # 主应用组件
│   │   ├── main.tsx            # 入口文件
│   │   ├── store/
│   │   │   └── useStore.ts     # Zustand 状态管理
│   │   ├── components/
│   │   │   ├── Sidebar.tsx     # 侧边栏
│   │   │   ├── StickyNote.tsx  # 便签卡片
│   │   │   ├── LoginModal.tsx  # 登录弹窗
│   │   │   ├── CreateModal.tsx # 发表建议弹窗
│   │   │   ├── Toolbar.tsx     # 底部工具栏
│   │   │   └── SentimentOverview.tsx  # 情绪概览
│   │   └── utils.ts            # 工具函数
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

## WebSocket 协议

所有消息格式：`{ "type": "EVENT_TYPE", "payload": { ... } }`

- `CREATE_COMMENT` / `NEW_COMMENT` - 创建评论
- `MOVE_COMMENT` / `COMMENT_MOVED` - 移动评论
- `LIKE_COMMENT` / `COMMENT_LIKED` - 点赞
- `PING` / `PONG` - 心跳保活（每 15 秒）
- `presence:update` - 在线用户更新

## 许可证

MIT