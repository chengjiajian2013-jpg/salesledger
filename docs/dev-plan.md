# SalesLedger — Development Plan

> **项目代号**: SalesLedger
> **目标**: 面向"按笔记录交易"场景的个人工作台，部署于 Cloudflare
> **范围 (V1)**: 交易 CRUD + 月度统计 + iOS 适配
> **开工日期**: 2026-07-31

---

## 1. 契约先行

开发前已锁定三份契约（**实现必须与契约一致**）：

1. **`docs/api-contract.md`** —— REST API：7 个端点、错误码、HTTP 语义、版本策略
2. **`docs/data-models.md`** —— 数据模型：Transaction 实体、枚举、校验规则、统计模型
3. **`docs/frontend-architecture.md`** —— 前端架构：文件结构、状态管理、iOS 适配、性能基线

任何契约变更必须**先改文档，再改代码**，并更新版本号。

---

## 2. V1 功能清单（**不可增删**）

### 2.1 必备（Must Have）

- [ ] 交易列表（按日期倒序、分页、按渠道/日期筛选）
- [ ] 新增交易（表单 + 客户端校验 + 服务端校验）
- [ ] 编辑交易（PATCH 部分更新）
- [ ] 删除交易（确认弹窗）
- [ ] 月度统计卡片（本月收入/成本/利润/笔数）
- [ ] 统计详情（按渠道聚合 + 按日聚合）
- [ ] 健康检查（前端启动探测后端）
- [ ] 深色/浅色主题（跟随系统 + 手动切换）

### 2.2 明确不做（Not in V1）

- ❌ 用户认证 / 多用户
- ❌ 腾讯文档同步（V2）
- ❌ 记账模块（V2）
- ❌ todolist（V2）
- ❌ 数据导入导出
- ❌ 图表可视化（仅数字+简单进度条）
- ❌ 离线 / PWA
- ❌ 管理后台

---

## 3. 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | Cloudflare Workers（JavaScript ES2022） |
| 数据库 | Cloudflare D1（SQLite） |
| 前端 | 原生 HTML5 + CSS3 + ES Modules（无框架） |
| 部署 | Wrangler CLI → CF Pages（前端）+ CF Workers（API） |
| 开发 | Node.js 18+、npm |

---

## 4. 开发节奏（7 天）

### Day 1: 项目初始化 ✅

- [x] 创建目录结构
- [x] 编写 `package.json` / `wrangler.toml` / `schema.sql`
- [x] 编写契约文档（api / data-models / frontend-architecture）
- [ ] 初始化 npm、安装 wrangler
- [ ] 创建 D1 数据库并绑定

### Day 2: 后端骨架 + 数据库

- [ ] 实现 `src/db.js`（D1 操作封装）
- [ ] 实现 `src/worker.js`（路由分发 + 错误处理中间件）
- [ ] 实现 `GET /api/v1/transactions`（列表 + 筛选 + 分页）
- [ ] 本地 `wrangler dev` 跑通

### Day 3: 后端 CRUD 完成

- [ ] `POST /api/v1/transactions`（创建 + 校验）
- [ ] `GET /api/v1/transactions/:id`
- [ ] `PATCH /api/v1/transactions/:id`
- [ ] `DELETE /api/v1/transactions/:id`
- [ ] 校验中间件（所有规则）

### Day 4: 后端统计 + 部署验证

- [ ] `GET /api/v1/summary`（按渠道 + 按日聚合）
- [ ] `GET /api/v1/health`
- [ ] `wrangler deploy` 部署到生产
- [ ] curl / Postman 验证所有端点

### Day 5: 前端骨架 + API 层

- [ ] `public/index.html`（复用 PersonalOS 设计系统）
- [ ] `public/styles.css`（业务样式 + iOS 适配）
- [ ] `public/app.js`（入口 + 初始化）
- [ ] `public/modules/api.js`（fetch 封装）
- [ ] `public/modules/state.js`（状态管理）

### Day 6: 前端视图

- [ ] 首页：月度统计卡片 + 快捷入口
- [ ] 交易列表：筛选 + 分页 + 删除
- [ ] 新增/编辑表单：模态框 + 校验
- [ ] 统计详情：按渠道 + 按日视图
- [ ] Toast + 加载态 + 错误处理

### Day 7: iOS 真机调试 + 上线

- [ ] iOS Safari 真机走查（见下方清单）
- [ ] iOS Chrome 走查
- [ ] 深色模式切换测试
- [ ] 修复所有 iOS 适配问题
- [ ] 生产环境端到端测试（真实交易录入）
- [ ] 写 README（项目说明 + 部署步骤）

---

## 5. iOS 真机走查清单

### 5.1 布局

- [ ] Safe Area 不遮挡内容（刘海屏 + Home Indicator）
- [ ] 100dvh 正确（地址栏变化时布局不崩溃）
- [ ] 横屏不崩溃（可锁定竖屏）
- [ ] 最小触控目标 44x44px

### 5.2 输入

- [ ] 数字键盘唤起正确（金额字段）
- [ ] 日期选择器唤起正确
- [ ] 输入框聚焦时页面不缩放
- [ ] 键盘弹出时按钮不被遮挡

### 5.3 交互

- [ ] 滚动流畅（60fps）
- [ ] 惯性滚动正常
- [ ] 点击反馈明确（:active 状态）
- [ ] 双击不缩放页面

### 5.4 视觉

- [ ] 深色模式跟随系统
- [ ] 手动切换主题正常
- [ ] 字体清晰（抗锯齿）
- [ ] 动画流畅

---

## 6. 验收标准

V1 完成的定义：

1. ✅ 所有 API 端点按契约工作
2. ✅ 所有校验规则正确执行
3. ✅ iOS Safari 真机完成走查清单
4. ✅ 生产环境可访问（CF Workers URL）
5. ✅ 用户（你本人）可以**连续 7 天**每天录入真实交易
6. ✅ 月度统计数字与手动计算一致

---

## 7. 风险管理

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 动力衰减（做一半不想做） | 高 | 高 | 严格 7 天工期、只做 V1、不给自己加戏 |
| CF D1 学习曲线 | 中 | 中 | 提前看文档、先用本地 sqlite 验证 |
| iOS 适配踩坑 | 中 | 中 | Day 7 专门留真机调试 |
| 需求蔓延 | 高 | 高 | 任何新想法写入 V2 backlog，V1 不动 |

---

## 8. V2 Backlog（**V1 期间不许做**）

- [ ] 腾讯文档 MCP 同步
- [ ] PWA（manifest + service worker）
- [ ] 记账模块（独立实体）
- [ ] todolist 模块
- [ ] 多账户/多店铺
- [ ] 数据导入导出（CSV）
- [ ] 用户认证（Auth）
- [ ] 图表可视化（日/周/月趋势）
- [ ] 数据备份

---

## 9. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-31 | 初始开发计划 |
