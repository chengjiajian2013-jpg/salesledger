# 安全配置指南

## ⚠️ 紧急：API Key 泄漏修复

### 问题说明
之前版本将 Claude API Key 硬编码在 `src/ai.js` 中，已被推送到公开仓库。

### 立即操作

#### 1. 轮换泄漏的 API Key
前往 API 提供商控制台：
- 删除或禁用旧 Key: `sk-f12f1e89a5f14d953a7433c7065567f999123bff2da924ebbeae1e9812896dd4`
- 生成新的 Claude API Key

#### 2. 配置新的 Secret

**测试环境:**
```bash
cd SalesLedger
wrangler secret put CLAUDE_API_KEY --env test
# 粘贴新的 Claude API Key

wrangler secret put DEEPSEEK_API_KEY --env test
# 粘贴 DeepSeek API Key
```

**生产环境:**
```bash
wrangler secret put CLAUDE_API_KEY
# 粘贴新的 Claude API Key

wrangler secret put DEEPSEEK_API_KEY
# 粘贴 DeepSeek API Key
```

#### 3. 验证配置
```bash
# 测试环境
wrangler deploy --env test

# 生产环境
wrangler deploy
```

#### 4. 清理 Git 历史（可选但推荐）
使用 `git-filter-repo` 清除历史中的敏感信息：
```bash
pip install git-filter-repo

# 备份仓库
git clone <repo-url> salesledger-backup

# 清理包含 API Key 的 commits
git filter-repo --path src/ai.js --invert-paths --force

# 或使用 BFG Repo-Cleaner
# https://rtyley.github.io/bfg-repo-cleaner/
```

## 当前架构

### API Keys 管理
- ✅ `DEEPSEEK_API_KEY`: 用于 `src/parse.js` 自然语言解析
- ✅ `CLAUDE_API_KEY`: 用于 `src/ai.js` AI 对话助手

### 环境变量注入
Cloudflare Workers 通过 `env` 对象注入 secrets：
```javascript
export async function handleAIChat(request, env) {
  const apiKey = env.CLAUDE_API_KEY;
  if (!apiKey) {
    return jsonError('CONFIG_ERROR', 'AI服务未配置', 500);
  }
  // ...
}
```

### 不要做的事
❌ 不要在代码中硬编码 API Keys
❌ 不要将 secrets 写在 `wrangler.toml` 的 `[vars]` 中
❌ 不要将 `.env` 文件提交到 git

### 正确做法
✅ 使用 `wrangler secret put` 命令设置密钥
✅ 通过 `env.SECRET_NAME` 读取
✅ 在代码中检查密钥是否存在再使用
