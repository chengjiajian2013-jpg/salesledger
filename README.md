# Joeyzou记账本

按笔记录交易的个人工作台，部署于 Cloudflare Workers + D1。

**线上地址**:
- 生产环境: https://salesledger.chengjiajian2013.workers.dev
- 测试环境: https://salesledger-test.chengjiajian2013.workers.dev (密码: 1234)

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 本地开发
npm run dev

# 3. 部署
npm run deploy -- --env test  # 测试环境
npm run deploy                # 生产环境（需在 main 分支）
```

### 数据库初始化（首次部署）

```bash
# 创建数据库（生产）
npx wrangler d1 create salesledger-db
# 将返回的 database_id 填入 wrangler.toml

# 创建数据库（测试）
npx wrangler d1 create salesledger-test-db
# 将返回的 database_id 填入 wrangler.toml [env.test]

# 初始化表结构
npm run db:init:local   # 本地
npm run db:init         # 远程生产
npm run db:init -- --env test  # 远程测试

# 加载测试数据（可选）
npm run db:seed -- --env test
```

## 文档

- [AI 协作指南](CLAUDE.md) — 项目结构、约束、命令速查
- [运维手册](docs/runbook.md) — 部署流程、故障排查、数据维护
- [开发计划](docs/dev-plan.md) — V1 功能清单、时间线
- [API 契约](docs/api-contract.md) — REST API 完整规范
- [数据模型](docs/data-models.md) — Transaction 模型、校验规则
- [前端架构](docs/frontend-architecture.md) — 文件结构、状态管理、iOS 适配
- [设计系统](DESIGN.md) — 暖奢风格、色彩、组件规范
- [产品上下文](PRODUCT.md) — 用户画像、业务规则、佣金模型

## 技术栈

- Cloudflare Workers + D1（SQLite）
- 原生 HTML/CSS/JS（ES Modules）
- 零构建、零框架

## 版本

- **v1.0** (2026-08-07) — 生产上线
  - 交易 CRUD + 月度统计 + iOS 适配
  - 小猫加载动画
  - 测试环境独立部署
  - 应用更名为 Joeyzou记账本
