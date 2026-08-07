# SalesLedger — 运维手册

> **受众**: 运维人员、接手开发者、未来的自己  
> **用途**: 部署、故障排查、数据维护

---

## 环境配置

### 生产环境

- **URL**: https://salesledger.chengjiajian2013.workers.dev
- **Cloudflare Account ID**: `4acb902ae1aa08b49b81c76d3f948aca`
- **Worker Name**: `salesledger`
- **数据库**: `salesledger-db` (ID: `1a88bdc1-98a3-462f-8f48-8dad0730f6ad`)
- **Git 分支**: `main`
- **访问密码**: 通过 Cloudflare Secret 配置（不在代码中）

### 测试环境

- **URL**: https://salesledger-test.chengjiajian2013.workers.dev
- **Worker Name**: `salesledger-test`
- **数据库**: `salesledger-test-db` (ID: `6e82a163-0b1a-4031-91d9-fce3979c7c13`)
- **Git 分支**: `dev`
- **访问密码**: `1234` (hardcoded in worker.js)
- **测试数据**: 19 条交易记录（见 test-data.sql）

---

## 部署流程

### 测试环境部署

**前置条件**: 
- 在 `dev` 分支
- 代码已推送到 GitHub
- 已设置环境变量（CLOUDFLARE_API_TOKEN 和 CLOUDFLARE_ACCOUNT_ID）

```bash
# 1. 设置环境变量（从安全的地方获取 token）
export CLOUDFLARE_API_TOKEN="<your-cloudflare-api-token>"
export CLOUDFLARE_ACCOUNT_ID="<your-cloudflare-account-id>"

# 2. 部署
npm run deploy -- --env test

# 3. 验证
curl https://salesledger-test.chengjiajian2013.workers.dev/api/v1/health
```

### 生产环境部署

**前置条件**:
- 在 `main` 分支
- 已合并并测试通过 `dev` 分支
- 已设置生产密码（见下方"配置访问密码"）

```bash
# 1. 合并 dev 到 main
git checkout main
git pull origin main
git merge dev --no-ff -m "Merge dev to main - <描述>"
git push origin main

# 2. 设置环境变量（从安全的地方获取 token）
export CLOUDFLARE_API_TOKEN="<your-cloudflare-api-token>"
export CLOUDFLARE_ACCOUNT_ID="<your-cloudflare-account-id>"

# 3. 部署
npm run deploy

# 4. 验证
curl https://salesledger.chengjiajian2013.workers.dev/api/v1/health
```

**注意**: 禁止在 `main` 分支直接修改代码，所有开发在 `dev` 分支完成。

---

## 环境变量管理

### 配置访问密码

**生产环境**（通过 Cloudflare Secret）:

```bash
# 设置密码（只需执行一次）
npx wrangler secret put ACCESS_KEY
# 提示输入时输入 4 位数字密码

# 查看已设置的 secret（不显示值）
npx wrangler secret list
```

**测试环境**: 密码 `1234` hardcoded 在 `src/worker.js` 中，无需配置。

### 其他环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
ENV = "development"  # 或 "test"
```

**不要在代码中硬编码敏感信息**，所有密码、token 通过 Cloudflare Secret 管理。

---

## 数据库管理

### 查看数据库内容

**本地**:
```bash
npm run db:query:local "SELECT * FROM transactions LIMIT 10;"
```

**远程生产**:
```bash
npm run db:query "SELECT * FROM transactions ORDER BY date DESC LIMIT 10;"
```

**远程测试**:
```bash
npm run db:query -- --env test "SELECT * FROM transactions LIMIT 10;"
```

### 重置测试数据

```bash
# 1. 清空测试数据库
npm run db:query -- --env test "DELETE FROM transactions;"

# 2. 重新加载测试数据
npm run db:seed -- --env test
```

### 备份数据库

Cloudflare D1 目前不支持自动备份，手动备份方法：

```bash
# 导出所有数据为 SQL
npm run db:query "SELECT * FROM transactions;" > backup-$(date +%Y%m%d).sql
```

### 表结构变更

**流程**:
1. 修改 `schema.sql`
2. 创建迁移脚本（如需）
3. 先在测试环境执行
4. 验证通过后在生产环境执行

**示例** — 添加新列:
```bash
# 测试环境
npm run db:query -- --env test "ALTER TABLE transactions ADD COLUMN new_field TEXT;"

# 验证
npm run db:query -- --env test "PRAGMA table_info(transactions);"

# 生产环境（确认无误后）
npm run db:query "ALTER TABLE transactions ADD COLUMN new_field TEXT;"
```

---

## 监控与日志

### 查看 Worker 日志

**实时日志**（本地开发）:
```bash
npm run dev
# 日志自动输出到终端
```

**生产日志**（Cloudflare Dashboard）:
1. 访问 https://dash.cloudflare.com
2. 进入 Workers & Pages
3. 选择 `salesledger`
4. 查看 Logs 标签

### 冒烟测试

**健康检查**（无需认证）:
```bash
curl https://salesledger.chengjiajian2013.workers.dev/api/v1/health
# 预期: {"status":"ok"}
```

**登录测试**:
```bash
# 测试环境
curl -X POST https://salesledger-test.chengjiajian2013.workers.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"accessKey":"1234"}'
# 预期: {"data":{"authenticated":true}}
```

**交易列表测试**:
```bash
# 需要先登录获取 session，或直接在浏览器中测试
```

---

## 故障排查

### 问题：部署后 404

**原因**: Worker 路由未生效或静态资源未上传

**排查**:
```bash
# 1. 检查 Worker 是否部署成功
npx wrangler deployments list

# 2. 检查静态资源
curl -I https://salesledger.chengjiajian2013.workers.dev/index.html

# 3. 查看 Worker 日志
npx wrangler tail
```

**解决**: 重新部署
```bash
npm run deploy
```

### 问题：数据库查询失败

**错误信息**: `D1_ERROR` 或 `no such table`

**排查**:
```bash
# 检查数据库绑定
npx wrangler d1 list

# 检查表是否存在
npm run db:query "SELECT name FROM sqlite_master WHERE type='table';"
```

**解决**: 重新初始化表结构
```bash
npm run db:init
```

### 问题：登录失败

**症状**: 输入密码后提示"密码错误"

**排查**:
1. **测试环境**: 确认密码是 `1234`
2. **生产环境**: 检查 Cloudflare Secret 是否设置
   ```bash
   npx wrangler secret list
   # 应该能看到 ACCESS_KEY
   ```

**解决**: 重新设置密码
```bash
npx wrangler secret put ACCESS_KEY
```

### 问题：加载动画不显示

**症状**: 切换视图时没有小猫动画

**排查**:
1. 检查 `cat-loading.png` 是否部署
   ```bash
   curl -I https://salesledger.chengjiajian2013.workers.dev/cat-loading.png
   # 应该返回 200
   ```
2. 检查浏览器控制台是否有 CSS 错误

**解决**: 
- 确认 `public/cat-loading.png` 存在
- 重新部署

### 问题：小猫图片背景色不一致

**症状**: 小猫图片周围有不同颜色的背景

**原因**: 使用了原始图片 `cat-original.png` 而非处理后的 `cat-loading.png`

**解决**: 
- 确认 `index.html` 引用的是 `/cat-loading.png`
- `cat-loading.png` 是通过 Python PIL 处理过的版本（背景色 `#F4F1EA`）

---

## 性能优化

### 静态资源缓存

Cloudflare Workers Assets 自动处理缓存，无需额外配置。

### 数据库查询优化

**索引**（已在 schema.sql 中定义）:
```sql
CREATE INDEX idx_date ON transactions(date);
CREATE INDEX idx_channel ON transactions(channel);
```

**查询建议**:
- 列表查询始终带 `LIMIT` 和 `OFFSET`
- 统计查询使用 `date >= ? AND date <= ?` 过滤
- 避免 `SELECT *`，只查询需要的列

---

## 安全注意事项

### 访问控制

- **密码长度**: 4 位数字，安全性较低，仅用于个人工具
- **Session 管理**: V1 无 session，每次请求验证密码（通过前端 localStorage）
- **HTTPS**: Cloudflare 自动提供，所有流量加密

### 敏感信息

**禁止在代码中出现**:
- 生产访问密码
- API Token
- 数据库 ID（已在 wrangler.toml 中，属于公开配置）

**通过 Cloudflare Secret 管理**:
```bash
npx wrangler secret put SECRET_NAME
```

---

## 常用命令速查

```bash
# 开发
npm run dev                           # 本地开发服务器

# 数据库
npm run db:query "SQL"                # 生产数据库查询
npm run db:query -- --env test "SQL" # 测试数据库查询
npm run db:init                       # 初始化生产数据库
npm run db:seed -- --env test        # 加载测试数据

# 部署
npm run deploy -- --env test         # 部署测试环境
npm run deploy                       # 部署生产环境

# 日志
npx wrangler tail                    # 实时查看生产日志
npx wrangler tail --env test         # 实时查看测试日志

# Secret 管理
npx wrangler secret list             # 列出所有 secret
npx wrangler secret put SECRET_NAME  # 设置 secret
npx wrangler secret delete SECRET_NAME # 删除 secret
```

---

## 联系与支持

**代码仓库**: https://github.com/chengjiajian2013-jpg/salesledger  
**Cloudflare Dashboard**: https://dash.cloudflare.com  
**技术栈文档**: 
- Cloudflare Workers: https://developers.cloudflare.com/workers
- Cloudflare D1: https://developers.cloudflare.com/d1

---

**最后更新**: 2026-08-07  
**维护者**: Claude Opus 4.8
