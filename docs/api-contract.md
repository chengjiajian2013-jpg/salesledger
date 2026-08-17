# SalesLedger — API Contract

> **契约版本**: v1.0
> **生效日期**: 2026-07-31
> **状态**: ACTIVE
> **原则**: Contract First —— 本契约先于任何前端/后端实现，双方必须遵守。

---

## 1. 基础约定

### 1.1 Base URL

| 环境 | URL |
|------|-----|
| 本地开发 | `http://localhost:8787` |
| 测试 | `https://salesledger-test.chengjiajian2013.workers.dev` |
| 生产 | `https://salesledger.chengjiajian2013.workers.dev` |

所有 API 路径以 `/api/v1` 为前缀。**v1 保证向后兼容**，破坏性变更只能发生在 v2。

### 1.2 内容协商

- 请求/响应一律 `application/json; charset=utf-8`
- 字符编码 UTF-8
- 日期格式 ISO-8601: `YYYY-MM-DD`
- 时间格式 ISO-8601: `YYYY-MM-DDTHH:mm:ssZ`
- 金额：数字（浮点数），单位人民币元，**不**以"分"为单位

### 1.3 通用响应包装

**成功响应 (2xx)**:
```json
{
  "data": { ... },
  "meta": { ... }
}
```

**错误响应 (4xx/5xx)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": [ ... ]
  }
}
```

`meta` 字段仅在需要时出现（如分页、聚合统计），**不**在单个资源响应中强制。

### 1.4 HTTP 语义

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | GET 单个/列表、PATCH 更新 |
| 201 | Created | POST 创建成功 |
| 204 | No Content | DELETE 成功（无 body） |
| 400 | Bad Request | 请求体 JSON 解析失败 |
| 401 | Unauthorized | 未认证（V1 预留） |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 业务冲突（如重复） |
| 422 | Unprocessable Entity | **校验失败**（字段级错误） |
| 429 | Too Many Requests | 限流 |
| 500 | Internal Server Error | 服务器内部错误 |

### 1.5 错误码体系

| error.code | HTTP | 含义 |
|------------|------|------|
| `VALIDATION_ERROR` | 422 | 字段校验失败，`details` 包含字段错误 |
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 |
| `MALFORMED_JSON` | 400 | 请求体 JSON 非法 |
| `INVALID_QUERY` | 400 | 查询参数非法 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误（不暴露细节） |

**错误详情格式 (VALIDATION_ERROR)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求数据校验失败",
    "details": [
      { "field": "date", "code": "REQUIRED", "message": "日期不能为空" },
      { "field": "price", code": "MIN_VALUE", "message": "售出价必须大于 0" }
    ]
  }
}
```

---

## 2. 接口清单

### 2.1 `GET /api/v1/transactions` —— 列表查询

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | string (YYYY-MM-DD) | 否 | 开始日期（含） |
| `endDate` | string (YYYY-MM-DD) | 否 | 结束日期（含） |
| `channel` | string | 否 | 渠道过滤：`quota` / `recovery` / `direct` / `other` |
| `keyword` | string | 否 | 商品名/备注模糊搜索 |
| `page` | integer (≥1, default 1) | 否 | 页码 |
| `pageSize` | integer (1-100, default 20) | 否 | 每页数量 |
| `sortBy` | string (default `date`) | 否 | 排序字段：`date` / `price` / `profit` / `createdAt` |
| `sortOrder` | string (default `desc`) | 否 | `asc` / `desc` |

**响应 200**:
```json
{
  "data": [
    {
      "id": 42,
      "date": "2026-07-31",
      "product": "Chanel 中号 CF 黑金",
      "channel": "quota",
      "cost": 28000.00,
      "price": 35000.00,
      "profit": 7000.00,
      "note": "老客户，99新",
      "createdAt": "2026-07-31T14:30:00Z",
      "updatedAt": "2026-07-31T14:30:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 156,
      "totalPages": 8
    }
  }
}
```

**错误**: `INVALID_QUERY` (400)

---

### 2.2 `POST /api/v1/transactions` —— 创建交易

**请求体**:
```json
{
  "date": "2026-07-31",
  "product": "Chanel 中号 CF 黑金",
  "channel": "quota",
  "cost": 28000.00,
  "price": 35000.00,
  "note": "老客户，99新"
}
```

**字段校验**:

| 字段 | 规则 |
|------|------|
| `date` | 必填，合法日期，不超过今天+7天 |
| `product` | 必填，1-200 字符 |
| `channel` | 必填，枚举 `quota` / `recovery` / `direct` / `other` |
| `cost` | 必填，≥0，最多2位小数 |
| `price` | 必填，>0，最多2位小数，必须 ≥ cost |
| `note` | 选填，0-500 字符 |

**响应 201**:
```json
{
  "data": { /* 创建后的完整对象，含 id */ }
}
```

**错误**: `VALIDATION_ERROR` (422), `MALFORMED_JSON` (400)

> **注意**: `profit` 由服务端计算（`price - cost`），客户端**不得**传此字段，传了则忽略。

---

### 2.3 `GET /api/v1/transactions/:id` —— 单个查询

**响应 200**: `{ "data": { ...单个交易... } }`

**错误**: `RESOURCE_NOT_FOUND` (404)

---

### 2.4 `PATCH /api/v1/transactions/:id` —— 部分更新

**请求体**: 与 POST 相同，但**所有字段可选**。只更新提供的字段。

**响应 200**: `{ "data": { ...更新后的完整对象... } }`

**错误**: `RESOURCE_NOT_FOUND` (404), `VALIDATION_ERROR` (422)

> **注意**: `profit` 服务端重算。

---

### 2.5 `DELETE /api/v1/transactions/:id` —— 删除

**响应 204**: 无 body

**错误**: `RESOURCE_NOT_FOUND` (404)

> **幂等性**: 删除不存在的资源返回 204（而非 404），符合幂等原则。**V1 为调试方便改为 404，V2 可调整。**

---

### 2.6 `GET /api/v1/summary` —— 聚合统计

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | string | 是 | 开始日期 |
| `endDate` | string | 是 | 结束日期 |

**响应 200**:
```json
{
  "data": {
    "period": { "startDate": "2026-07-01", "endDate": "2026-07-31" },
    "totalRevenue": 128000.00,
    "totalCost": 96000.00,
    "totalProfit": 32000.00,
    "transactionCount": 12,
    "averageProfit": 2666.67,
    "byChannel": [
      { "channel": "quota", "revenue": 80000, "profit": 20000, "count": 7 },
      { "channel": "recovery", "revenue": 30000, "profit": 8000, "count": 3 },
      { "channel": "direct", "revenue": 18000, "profit": 4000, "count": 2 }
    ],
    "daily": [
      { "date": "2026-07-01", "revenue": 12000, "profit": 3000, "count": 1 }
    ]
  }
}
```

**错误**: `INVALID_QUERY` (400) —— 日期缺失或格式错误

---

### 2.7 `GET /api/v1/health` —— 健康检查

**响应 200**:
```json
{ "data": { "status": "ok", "version": "1.0.0" } }
```

无认证，用于前端启动时探测后端可达性。

---

### 2.8 风华记账

所有接口沿用现有 Bearer Token 鉴权，数据存放于独立的 `fenghua_entries` 表。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/fenghua/entries?month=YYYY-MM&page=1&pageSize=100` | 按月查询账目；单页最多 100 条；`meta.summary` 返回收入、支出和结余 |
| POST | `/api/v1/fenghua/entries` | 新增账目 |
| PATCH | `/api/v1/fenghua/entries/:id` | 部分更新账目 |
| DELETE | `/api/v1/fenghua/entries/:id` | 删除账目 |

新增或更新字段：`type` (`income` / `expense`)、`amount`（0.01–99,999,999 元，最多两位小数）、`category`、`date` (`YYYY-MM-DD`) 和可选 `note`。

### 2.9 风华待办

待办存放于独立的 `fenghua_todos` 表，不包含优先级、重复规则或提醒。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/fenghua/todos?page=1&pageSize=100` | 查询待办；单页最多 100 条 |
| POST | `/api/v1/fenghua/todos` | 新增待办 |
| PATCH | `/api/v1/fenghua/todos/:id` | 更新内容、截止日期或完成状态 |
| DELETE | `/api/v1/fenghua/todos/:id` | 删除待办 |

字段：`content`（1–120 字符）、可选 `dueDate` (`YYYY-MM-DD`) 和 `isCompleted`（布尔值）。

---

## 3. 鉴权（V1 预留）

V1 为单用户模式，**不做真实鉴权**。但接口设计预留：

- 请求头 `Authorization: Bearer <token>` —— V1 忽略，V2 启用
- 响应头 `X-Request-Id` —— 所有响应返回，用于调试

---

## 4. 限流与性能

- V1 不做服务端限流（CF 自带基础防护）
- 单次 list 请求最大 `pageSize=100`
- summary 接口日期范围不超过 366 天

---

## 5. 变更策略（One-Version Rule）

**允许（向后兼容）**:
- 新增可选请求字段
- 新增响应字段（客户端忽略未知字段）
- 新增端点
- 新增 error.code

**禁止（破坏性，必须升 v2）**:
- 删除/重命名已有字段
- 改变字段类型
- 改变错误码含义
- 改变必填/选填状态

---

## 6. 前端消费约定

### 6.1 错误处理模板

```javascript
async function apiRequest(path, options = {}) {
  const res = await fetch(`/api/v1${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) return null;

  const body = await res.json();

  if (!res.ok) {
    // 统一抛出 APIError
    const err = new Error(body.error?.message || '请求失败');
    err.code = body.error?.code;
    err.details = body.error?.details;
    err.status = res.status;
    throw err;
  }

  return body.data;
}
```

### 6.2 客户端校验

**客户端校验仅用于 UX**（即时反馈、减少请求），**不作为安全边界**。所有业务校验以服务端为准。

### 6.3 状态码处理

| 状态码 | 前端行为 |
|--------|----------|
| 422 | 遍历 `error.details`，在对应字段下显示错误 |
| 404 | 资源不存在 → Toast + 刷新列表 |
| 500 | 通用错误 Toast，不暴露细节 |
| 网络失败 | "网络异常，请检查连接" |

---

## 7. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-31 | 初始版本 |
