# SalesLedger — AI 协作指南

> **项目名称**: Joeyzou记账本（代号 SalesLedger）  
> **架构**: Cloudflare Workers + D1 + 原生前端（零构建）  
> **部署**: 生产 `salesledger.chengjiajian2013.workers.dev` / 测试 `salesledger-test.chengjiajian2013.workers.dev`  
> **当前版本**: v1.0 (已上线)

---

## 项目结构

```
SalesLedger/
├── src/
│   └── worker.js          # Cloudflare Worker 入口（API + 静态托管）
├── public/
│   ├── index.html         # 单页应用主文件（含完整 CSS）
│   ├── app.js             # 主应用逻辑
│   ├── modules/           # ES Modules
│   │   ├── api.js         # fetch 封装 + loading 控制
│   │   ├── auth.js        # 密码验证
│   │   ├── state.js       # 全局状态管理
│   │   ├── format.js      # 格式化工具
│   │   └── commission.js  # 佣金计算
│   └── cat-loading.png    # 加载动画素材
├── docs/                  # 契约文档（Contract First）
│   ├── api-contract.md    # REST API 契约
│   ├── data-models.md     # 数据模型契约
│   ├── frontend-architecture.md  # 前端架构契约
│   └── dev-plan.md        # V1 开发计划
├── DESIGN.md              # 设计系统（暖奢风格）
├── PRODUCT.md             # 产品上下文
├── wrangler.toml          # Cloudflare 配置
└── schema.sql             # D1 数据库表结构
```

---

## 核心约束与红线

### 架构边界
- **前端**: 单文件 HTML + 原生 ES Modules，**禁止引入构建工具**（V1 承诺）
- **后端**: 所有数据库操作在 `src/worker.js`，**禁止前端直接操作 D1**
- **样式**: 所有 CSS 内联在 `<style>` 块，使用 CSS 变量，**禁止外部样式表**
- **状态**: 单一 `appState` 对象，**禁止多处 `let` 散落状态**

### 数据约束
- 金额单位：**元**（不是分），存储 `REAL`，显示 2 位小数
- 日期格式：**ISO-8601** `YYYY-MM-DD`，禁止其他格式
- `profit` 永远等于 `price - cost`，**禁止手动输入利润**
- 删除操作：**物理删除**（非软删除），V1 无审计

### 部署规则
- 开发分支：`dev`，测试环境自动部署
- 生产分支：`main`，**必须先合并 dev，通过测试后手动部署**
- 测试环境密码：`1234`（hardcoded in worker）
- 生产环境密码：通过 Cloudflare Secret 配置（不在代码中）

---

## 环境配置

### 数据库

| 环境 | 数据库名 | Database ID |
|------|---------|-------------|
| 生产 | `salesledger-db` | `1a88bdc1-98a3-462f-8f48-8dad0730f6ad` |
| 测试 | `salesledger-test-db` | `6e82a163-0b1a-4031-91d9-fce3979c7c13` |

### 环境变量

```toml
# wrangler.toml
[vars]
ENV = "development"  # 或 "test"

# Cloudflare Secret（生产）
ACCESS_KEY = "****"  # 通过 wrangler secret put ACCESS_KEY 设置
```

### 部署命令

```bash
# 测试环境
npm run deploy -- --env test

# 生产环境（需要在 main 分支）
npm run deploy
```

---

## API 路由清单

**Base**: `/api/v1`

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/auth/login` | 密码验证 |
| GET | `/transactions` | 交易列表（支持分页、筛选） |
| POST | `/transactions` | 创建交易 |
| GET | `/transactions/:id` | 单个交易详情 |
| PUT | `/transactions/:id` | 更新交易 |
| DELETE | `/transactions/:id` | 删除交易 |
| GET | `/summary` | 汇总统计（支持按月、按渠道） |

详细契约见 **[docs/api-contract.md](docs/api-contract.md)**

---

## 数据模型速查

### Transaction 表

```sql
CREATE TABLE transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT    NOT NULL,           -- 'YYYY-MM-DD'
  product     TEXT    NOT NULL,           -- 商品名
  channel     TEXT    NOT NULL DEFAULT 'other',  -- quota|recovery|direct|other
  cost        REAL    NOT NULL DEFAULT 0, -- 成本（元）
  price       REAL    NOT NULL,           -- 售价（元）
  note        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Channel 枚举

- `quota` - 配额（基本工资 + 10% 佣金）
- `direct` - 直营（基本工资 + 10% 佣金）
- `recovery` - 回收（基本工资 + 5% 佣金）
- `other` - 个人（100% 利润，无基本工资）

---

## 加载动画说明

**实现**: 纯 CSS3 小猫转圈动画（来自 bootstrapmb.com demo）

**触发时机**: 所有 API 请求（通过 `modules/api.js` 统一控制）

**关键文件**:
- `public/index.html` - CSS 动画定义（`.cat`, `.cat__head`, `.cat__tail`, `.cat__body`）
- `public/cat-loading.png` - 小猫素材（已处理背景色为 `#F4F1EA` 匹配界面）
- `public/modules/api.js` - `showLoading()` / `hideLoading()` 控制显示

**注意**: 小猫图片背景色已通过 Python PIL 处理为米白色 `#F4F1EA`，与加载层背景一致。

---

## 设计系统

**风格**: 暖奢 — 米白底 + 金色点缀 + 深绿利润

**主色**: `#B8860B` (金色)  
**背景**: `#F4F1EA` (米白)  
**文字**: `#1C1A17` (深棕)  
**利润**: `#3A7D3A` (深绿)

详见 **[DESIGN.md](DESIGN.md)** 完整 Design Token 表

---

## 命令速查

```bash
# 本地开发
npm run dev                  # 启动本地 Workers 开发服务器

# 数据库管理
npm run db:create            # 创建新数据库
npm run db:init:local        # 初始化本地数据库表结构
npm run db:init              # 初始化远程数据库表结构
npm run db:query:local       # 本地数据库查询
npm run db:query             # 远程数据库查询

# 测试数据
npm run db:seed              # 加载测试数据（test-data.sql）

# 部署
npm run deploy -- --env test # 部署到测试环境
npm run deploy               # 部署到生产环境（需在 main 分支）
```

---

## 常见任务

### 添加新 API 端点
1. 在 `src/worker.js` 添加路由处理
2. 更新 `docs/api-contract.md`（先改契约！）
3. 在 `public/modules/api.js` 添加客户端方法
4. 更新本文档的「API 路由清单」

### 修改数据模型
1. 更新 `docs/data-models.md`（先改契约！）
2. 修改 `schema.sql`
3. 创建迁移脚本（如需）
4. 更新本文档的「数据模型速查」

### 添加新页面/模块
1. 评估是否符合 V1 范围（见 `docs/dev-plan.md`）
2. 如果是 V2 功能，记入 `docs/dev-plan.md` § V2 Backlog
3. 如果是 V1 内，按契约先行原则更新 `docs/frontend-architecture.md`

---

## 深入文档

| 文档 | 用途 |
|------|------|
| [docs/api-contract.md](docs/api-contract.md) | REST API 完整规范、错误码、状态码处理 |
| [docs/data-models.md](docs/data-models.md) | Transaction 模型、枚举、校验规则、统计模型 |
| [docs/frontend-architecture.md](docs/frontend-architecture.md) | 文件结构、状态管理、iOS 适配、性能基线 |
| [docs/dev-plan.md](docs/dev-plan.md) | V1 功能清单、时间线、V2 Backlog |
| [DESIGN.md](DESIGN.md) | 完整 Design System、色彩、字体、间距、组件规范 |
| [PRODUCT.md](PRODUCT.md) | 产品定位、用户画像、业务规则、佣金模型 |

---

## V1 已完成功能

- ✅ 交易 CRUD（列表、新增、编辑、删除）
- ✅ 月度统计（收入、支出、利润、佣金）
- ✅ 公司/个人切换
- ✅ 渠道筛选（quota/direct/recovery/other）
- ✅ 4 位数字密码登录
- ✅ iOS 适配（安全区域、键盘、触摸优化）
- ✅ 小猫加载动画
- ✅ 测试环境独立部署

## V2 Backlog（禁止在 V1 实现）

- [ ] PWA 离线支持
- [ ] 数据导出（CSV）
- [ ] 图表可视化
- [ ] 腾讯文档 MCP 同步
- [ ] 多账户/多店铺
- [ ] 记账模块
- [ ] todolist 模块

---

**最后更新**: 2026-08-07  
**维护者**: AI (Claude Opus 4.8)
