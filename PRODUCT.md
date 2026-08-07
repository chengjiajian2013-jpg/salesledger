# SalesLedger — Product Context

## Product

**Name:** SalesLedger  
**Tagline:** 按笔记录交易的个人工作台  
**Category:** Personal productivity tool — sales commission tracker  
**Platform:** web  
**Domain:** salesledger.chengjiajian2013.workers.dev

SalesLedger is a personal sales ledger for tracking individual and company transactions with commission calculations. It's designed for sales staff in luxury resale (二奢) who need to quickly log completed deals on their phone and calculate their earnings from base salary plus commission across different sales channels.

## User

**Primary:** Sales employee at a luxury resale shop  
**Role:** Individual contributor tracking their own transactions  
**Context:** Works with both company inventory (quota/direct/recovery channels with base salary + commission) and personal side sales (personal channel, commission only)

**Usage scene:** Real-time logging immediately after closing a deal on mobile  
**Core need:** Fast transaction entry — record a sale in seconds on phone without friction  
**Success metric:** Can log a completed transaction in under 10 seconds while still on the sales floor

**Not the user:**
- Store managers coordinating multiple staff
- Multi-store owners
- Accountants requiring audit trails

## Constraints

**Must:**
- Work flawlessly on iPhone (Safari and Chrome on iOS)
- Support offline-first entry (though current v1 requires connection)
- Calculate commissions accurately across 4 channels with different rate structures
- Clearly separate company vs personal transactions
- Load and respond in under 2 seconds on mobile networks

**Must not:**
- Require authentication in v1 (single-user, password-protected access)
- Support team collaboration or multi-user access
- Integrate with accounting systems or POS
- Store customer personal data (privacy-first)

**Technical:**
- Zero-build deployment (no npm run build step)
- Cloudflare Workers + D1 stack
- Single HTML file + ES modules architecture
- 4位数字密码访问控制 (iPhone-style numeric keypad)

## Voice

**Tone:** Warm, efficient, professional  
**Language:** Simplified Chinese (简体中文)  
**Formality:** Informal-professional (职场口语化)

**Copy principles:**
- Direct action language: "添加交易" not "创建新记录"
- Show earnings prominently: "本月收入 ¥14,760" not "当前月度统计"
- Use industry terms naturally: "额度", "直款", "回收" (quota, direct, recovery channels)
- Provide immediate feedback: "已保存" appears instantly, not "保存成功"

**Examples:**
- Good: "公司 · 18 笔" (company · 18 transactions)
- Avoid: "当前筛选条件下共有18条公司交易记录"
- Good: "底薪¥8,000 + 利润¥6,760"
- Avoid: "工资构成：基本工资8000元，佣金收入6760元"

## Context

**Industry:** Luxury goods resale (二手奢侈品)  
**Channels:** Four distinct sales types with different commission structures:
- **额度 (quota):** Customer credit line, 10% commission on profit
- **直款 (direct):** Direct payment sales, 10% commission on profit  
- **回收 (recovery):** Buyback/consignment, 5% commission on profit
- **其他 (other/personal):** Personal side business, 100% profit to seller

**Compensation model:**
- Company sales: ¥8,000/month base + channel-specific commission
- Personal sales: 100% profit (no base salary component)

**Current state:** v3.2 deployed to production
- Authentication: 4-digit numeric passcode (0725)
- UI: iPhone-style keypad, dual-tab structure (Transactions/Monthly Stats)
- Transaction list with company/personal toggle
- Monthly statistics with earnings breakdown
- AI-powered transaction parsing from natural language

**Not yet built (v2 backlog):**
- PWA offline support
- Data export (CSV)
- Multi-account/multi-store
- Visualization charts (trend graphs)
- Integration with external systems (Tencent Docs MCP)

---

**Last updated:** 2026-08-04  
**Maintained by:** Product owner & Claude (via /impeccable init)
