# SalesLedger 代码审查报告 (ds_debug)

> 审查日期: 2026-08-12
> 审查范围: 最近提交 dfa91d3 (交易类型由AI回复决定) + 前后端全链路
> 涉及文件: src/*.js, public/app.js, public/modules/*.js, schema.sql, src/schema.js

---

## 严重 (需立即处理)

### BUG-1: 硬编码 AI API Key 泄漏到公开仓库

文件: src/ai.js:4
问题: 写死了 API_KEY = 'sk-f12f1e89a5f14d953a7433c7065567f999123bff2da924ebbeae1e9812896dd4'
影响: 已提交到 main 分支并推送到公开仓库 chengjiajian2013-jpg/salesledger (首次引入于 commit 4d051f2)。
      任何能读到仓库的人都能直接盗用 LLM API，烧额度/产生费用。
修复:
  1. 立即轮换该 Key
  2. 改为 Cloudflare Secret/Binding，通过 env 注入
     (参考 src/parse.js 已正确使用 env.DEEPSEEK_API_KEY 的做法)
  3. 用 git filter-repo 清洗历史中的该 key

---

## 高 (最近改动引入的缺陷)

### BUG-2: 两个分支的交易类型默认值不一致，违背 commit 意图

文件: public/app.js:2080-2101
问题: 本次 commit 声明"AI 无结果 → 默认 personal"，但只改对了一个分支:
  - savedFormData 分支 (public/app.js:2080): type: typeFromAI || 'personal' (正确)
  - else 分支 (public/app.js:2088-2101): parseFormFromQuestion 内部默认 type:'company'
    (见 public/app.js:2225)，且 typeFromAI 仅在非空时覆盖
影响: 无表单暂存数据时 (常见于只问答、未填表单的简单对话)，
      若 AI 未输出 **交易类型:** 且问题没提"个人/公司交易"，
      会默认录成公司交易 — 恰好复现了 commit 想修的 bug。
修复: 两分支统一默认逻辑，else 分支也改为 type: typeFromAI || 'personal'

### BUG-3: openTransactionModal 的 else 分支无空值保护

文件: public/app.js:2358-2359
问题: 当无 savedFormData 且无 user 消息时，formInfo 为 null，
      else 分支执行 formInfo.quota.toFixed(2) 会抛 TypeError。
      if 分支已做 formInfo && ... 保护，else 分支却未保护。
修复: 补 formInfo = formInfo || {} 或判空

### BUG-4: parseTransactionTypeFromAI 兜底逻辑可能误判

文件: public/app.js:2162-2179
问题: 兜底用 .includes('个人交易')。
      若 AI 写成"这不是个人交易，是公司交易"之类否定句式，会误判为 personal。
修复: 优先用更严格的正则 **交易类型:**X交易 匹配，命中失败再回退关键词

---

## 中 (建议修复)

### BUG-5: schema.js 与 schema.sql 的 FK CASCADE 不一致

文件: src/schema.js vs schema.sql:49/65
问题: schema.sql 和 migrations/001_add_ai_tables.sql 都声明了 ON DELETE CASCADE，
      但 Worker 自初始化用的 src/schema.js 建表没有 FK 约束。
      若表由 Worker 首请求自建 (src/worker.js 的 ensureSchema)，
      则 handleDeleteChat (src/aiChats.js:88) 删除对话会遗留孤儿 ai_messages/ai_form_data，
      与注释"CASCADE 自动删除"不符。
修复: 让 schema.js 与 schema.sql 的 FK 定义保持一致

### BUG-6: CORS 全开放

文件: src/worker.js
问题: 对所有响应设置 Access-Control-Allow-Origin: *。
      虽然所有数据接口都需 Bearer 认证，但配合长期 token(12h)仍偏宽松。
修复: 单用户应用建议锁定为实际域名

---

## 其它观察

- parseAIResponse 的客户支付/利润等正则依赖 AI 固定输出格式，
  AI 一旦换措辞就会拿不到值；本次改动逻辑上依赖这些解析，建议加更多容错格式。
- handleDeleteChat 用了 result.meta.changes 判断是否 404，逻辑正确。

---

## 修复优先级

1. BUG-1: 轮换/外置 src/ai.js 的 API Key (最高优先)
2. BUG-2: 统一两分支的交易类型默认值
3. BUG-3: 修复 openTransactionModal 空 formInfo 崩溃
4. BUG-4: 改进 parseTransactionTypeFromAI 兜底逻辑
5. BUG-5: 让 schema.js 与 schema.sql 的 FK 定义保持一致
6. BUG-6: 收紧 CORS 策略