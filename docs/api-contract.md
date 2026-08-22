# SalesLedger API Contract

> **契约版本**: v1.1
> **生效日期**: 2026-08-20
> **状态**: ACTIVE
> **原则**: Contract First。实现、前端调用和运维验证以本文档为准。

---

## 1. 基础约定

### 1.1 Base URL

| 环境 | URL |
|------|-----|
| 本地开发 | `http://localhost:8787` |
| 测试 | `https://salesledger-test.chengjiajian2013.workers.dev` |
| 生产 | `https://salesledger.chengjiajian2013.workers.dev` |

页面入口为 `/`（Joeyzou 记账本）和 `/fenghua`（风华记账直达地址）。API 路径统一以 `/api/v1` 为前缀。

### 1.2 内容与数据格式

- 请求/响应使用 JSON，字符集 UTF-8。
- 日期使用 `YYYY-MM-DD`；风华月度查询使用 `YYYY-MM`。
- 时间字段由服务端生成，使用 ISO-8601 字符串。
- 金额单位为人民币元，使用数字而不是“分”；金额显示通常保留两位小数。

### 1.3 通用响应包装

成功响应：

```json
{ "data": { "...": "..." }, "meta": { "...": "..." } }
```

错误响应：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求数据校验失败",
    "details": [{ "field": "date", "code": "REQUIRED", "message": "日期不能为空" }]
  }
}
```

`meta` 只在分页或聚合响应中返回。

### 1.4 HTTP 状态码

| 状态码 | 使用场景 |
|--------|----------|
| 200 | GET 成功、PATCH 更新成功 |
| 201 | POST 创建成功 |
| 204 | DELETE 成功；删除接口保持幂等 |
| 400 | JSON、查询参数或请求格式错误 |
| 401 | 缺少、无效或过期的 Bearer Token；登录密码错误 |
| 404 | 查询或更新的资源不存在 |
| 409 | 自定义类目在同一收支类型下重复 |
| 422 | 字段校验失败 |
| 500 | 服务端内部错误 |

### 1.5 错误码

实现中使用的主要错误码：`UNAUTHORIZED`、`CONFIG_ERROR`、`MALFORMED_JSON`、`INVALID_JSON`、`INVALID_QUERY`、`VALIDATION_ERROR`、`CATEGORY_EXISTS`、`RESOURCE_NOT_FOUND`、`METHOD_NOT_ALLOWED`、`INTERNAL_ERROR`。

---

## 2. 认证

### 2.1 登录

`POST /api/v1/auth/login` 无需认证。

请求：

```json
{ "password": "<访问密钥>" }
```

成功响应：

```json
{ "data": { "token": "<短期 Bearer Token>" } }
```

服务端使用 Cloudflare Secret `ACCESS_KEY` 校验密码，并签发有效期 12 小时的 HMAC-SHA-256 Token。测试和生产环境都通过 Secret 注入，访问密钥不写入代码、文档或 `[vars]`。

### 2.2 受保护请求

除健康检查和登录外，所有 API 都必须带：

```http
Authorization: Bearer <token>
```

前端把 Token 放在当前浏览器标签页的 `sessionStorage`（键名 `salesledger_token`）。401 时清除 Token 并重新显示登录流程；不使用第二套账号或密码。

### 2.3 健康检查

`GET /api/v1/health` 无需认证，响应：

```json
{ "data": { "status": "ok", "version": "1.0.0" } }
```

---

## 3. Joeyzou 交易 API

### 3.1 `GET /api/v1/transactions`

支持分页、筛选和排序：

| 参数 | 说明 |
|------|------|
| `seller` | `company` 或 `personal` |
| `startDate` / `endDate` | 日期范围（含边界） |
| `channel` | `quota` / `direct` / `recovery` / `other` |
| `keyword` | 商品名或备注模糊搜索 |
| `page` | 正整数，默认 1 |
| `pageSize` | 1-100，默认 20 |
| `sortBy` | `date` / `price` / `profit` / `createdAt`，默认 `date` |
| `sortOrder` | `asc` / `desc`，默认 `desc` |

响应的 `data` 为交易数组，`meta.pagination` 包含 `page`、`pageSize`、`totalItems`、`totalPages`。

### 3.2 `POST /api/v1/transactions`

请求字段：

```json
{
  "seller": "company",
  "source": "苏苏",
  "brand": "Chanel",
  "date": "2026-08-20",
  "product": "中号 CF 黑金",
  "channel": "quota",
  "cost": 28000,
  "price": 35000,
  "commission_rate": 0.1,
  "profit": 700,
  "account": "微信",
  "note": "老客户，99新"
}
```

`seller`、`date`、`product`、`channel`、`commission_rate`、`profit` 必须提供。`source`、`brand`、`account`、`note` 可选，长度限制分别为 50、50、500、500 字符；成本和售价可选但不能为负，售价上限为 9,999,999。利润由当前交易规则和前端预览计算后提交，服务端持久化该字段。

### 3.3 `GET /api/v1/transactions/:id`

返回单笔交易；不存在返回 404 `RESOURCE_NOT_FOUND`。

### 3.4 `PATCH /api/v1/transactions/:id`

部分更新交易。请求体字段均可选，只更新提供的字段；不存在返回 404。客户端应使用 `PATCH`，不使用旧的 `PUT` 语义。

### 3.5 `DELETE /api/v1/transactions/:id`

删除交易并返回 204。删除操作为物理删除。

### 3.6 `GET /api/v1/summary`

必填查询参数 `startDate`、`endDate`，范围不能超过 366 天；可选 `seller`。

响应包含：

```json
{
  "data": {
    "period": { "startDate": "2026-08-01", "endDate": "2026-08-31" },
    "filter": { "seller": "all" },
    "totalRevenue": 35000,
    "totalCost": 28000,
    "totalProfit": 700,
    "transactionCount": 1,
    "averageProfit": 700,
    "byChannel": [{ "channel": "quota", "profit": 700, "count": 1 }],
    "daily": [{ "date": "2026-08-20", "profit": 700, "count": 1 }]
  }
}
```

### 3.7 `GET /api/v1/reports/export`

导出 Joeyzou 交易报表，不读取或混入风华记账数据。`month` 和 `ledger` 必填：

| 参数 | 说明 |
|------|------|
| `month` | `YYYY-MM`，按月份查询，包含该月首尾日期 |
| `ledger` | `company` 或 `personal` |

接口直接返回 `.xlsx` 文件。公司账本和个人账本按弹窗中选择的性质分别下载；文件名为 `公司账本-YYYY-MM.xlsx` 或 `个人账本-YYYY-MM.xlsx`。公司报表的换货记录将成本和售出价留空，底部保留“提成合计”，并在 I/J/K 三列分别显示换货、直款、直客回收合计；个人报表使用简洁字段表。无记录月份仍返回带表头的空文件。

---

## 4. 风华记账 API

风华是普通个人收支工具，不涉及 Joeyzou 交易字段。账目、待办和自定义类目分别写入 `fenghua_entries`、`fenghua_todos`、`fenghua_categories`，三者都与 `transactions` 隔离。

### 4.1 账目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/fenghua/entries?month=YYYY-MM&page=1&pageSize=100` | 查询指定月份，单页最多 100 条 |
| POST | `/api/v1/fenghua/entries` | 新增账目 |
| PATCH | `/api/v1/fenghua/entries/:id` | 部分更新账目 |
| DELETE | `/api/v1/fenghua/entries/:id` | 删除账目，返回 204 |

字段：`type` 为 `income`/`expense`；`amount` 为 0.01-99,999,999 元、最多两位小数；`category` 为内置分类或合法的 `custom:<id>`；`date` 为有效日期；`note` 可选且不超过 200 字符。列表响应的 `meta.summary` 返回 `income`、`expense`、`balance`，并带分页信息。

### 4.2 自定义类目

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/fenghua/categories?type=expense` | 按 `income` 或 `expense` 查询；不传则返回全部 |
| POST | `/api/v1/fenghua/categories` | 创建自定义类目 |

创建请求：`{ "type": "expense", "name": "宠物" }`。成功后服务端生成稳定 key `custom:<id>`；同一收支类型下名称不区分大小写去重。自定义收入类目不能用于支出账目，反之亦然。

### 4.3 待办

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/fenghua/todos?page=1&pageSize=100` | 查询待办，单页最多 100 条 |
| POST | `/api/v1/fenghua/todos` | 新增待办 |
| PATCH | `/api/v1/fenghua/todos/:id` | 更新内容、截止日期或完成状态 |
| DELETE | `/api/v1/fenghua/todos/:id` | 删除待办，返回 204 |

字段：`content` 为 1-120 字符；`dueDate` 可为空且必须是有效日期；`isCompleted` 为布尔值。待办不包含优先级、重复规则或提醒。

---

## 5. 前端消费约定

`public/modules/api.js` 统一加入 `Content-Type` 和当前 `sessionStorage` 中的 Bearer Token；204 直接返回 `null`；401 清除 Token 并触发重新登录；其他错误转为带 `code`、`details`、`status` 的 Error。

客户端校验只用于即时反馈，服务端校验才是安全边界。422 应按 `error.details` 显示字段错误，404 刷新列表，500 不向用户暴露内部细节。

---

## 6. 变更策略

允许新增可选字段、响应字段、端点和错误码；删除或重命名字段、改变字段类型或必填性时必须升级 API 版本。

---

## 7. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.1 | 2026-08-20 | 补充 Bearer Token、风华账本/待办、统计报表和自定义类目契约 |
| v1.0 | 2026-07-31 | 初始交易 API 契约 |
