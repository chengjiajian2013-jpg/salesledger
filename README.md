# SalesLedger

按笔记录交易的个人工作台，部署于 Cloudflare Workers + D1。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 创建 D1 数据库
npm run db:create
# 把生成的 database_id 填入 wrangler.toml

# 3. 初始化表结构
npm run db:init:local   # 本地
npm run db:init         # 远程

# 4. 本地开发
npm run dev

# 5. 部署
npm run deploy
```

## 文档

- [开发计划](docs/dev-plan.md)
- [API 契约](docs/api-contract.md)
- [数据模型](docs/data-models.md)
- [前端架构](docs/frontend-architecture.md)

## 技术栈

- Cloudflare Workers + D1（SQLite）
- 原生 HTML/CSS/JS（ES Modules）
- 零构建、零框架

## 版本

- v1.0 — 交易 CRUD + 月度统计 + iOS 适配
