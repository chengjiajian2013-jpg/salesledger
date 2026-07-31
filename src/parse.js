// SalesLedger — 自然语言解析为交易草稿（DeepSeek v4 flash）

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const SYSTEM_PROMPT = `你是一个二奢店销售记账助手。用户会用自然语言描述一笔交易，你需要从中提取结构化字段。

渠道说明：
- quota（额度/寄卖/抽成）：利润 = 售价 × 佣金比例。通常只说售价，成本未知/留空。
- direct（直款/全款）：利润 = (售价 − 成本) × 佣金比例。需要成本和售价。
- recovery（回收/回购）：利润 = (售价 − 成本) × 佣金比例。需要成本和售价。
- other（其他/杂项）：直接说利润多少，手动填写。

渠道推断关键词：额度、寄卖、抽成 → quota；直款、全款、一次性 → direct；回收、回购 → recovery；其他、杂项 → other。

佣金比例：如果用户提到"X个点"/"X%"/"抽X%"，提取为 0-1 的小数（如1个点=0.01，2个点=0.02）。如果没提则返回 null。

金额：提取数字，统一为元（如果用户说"3万"→30000，"三千五"→3500，"3500"→3500）。

日期：用户可能说"今天"/"昨天"/"3号"/"7月30"。参考提供的 today 日期换算为 YYYY-MM-DD。如果没提日期则返回 null（用今天）。

货源（source）：从"XX的包"/"从XX那"/"XX说"等表述提取人名或渠道名（如"苏苏"、"小李"）。如果没提则返回 null。

品牌名（brand）：从商品描述提取奢侈品品牌（如 Chanel、LV、Hermès、Gucci、Dior 等）。如果没提或不确定则返回 null。

seller 是 "{{seller}}"（company=公司/personal=个人）。

请严格返回以下 JSON 格式（不要 markdown 代码块，不要解释，只输出 JSON）：
{
  "source": "货源/人名或null",
  "brand": "品牌名或null",
  "product": "商品名称，简洁",
  "channel": "quota|direct|recovery|other",
  "price": 数字或null,
  "cost": 数字或null,
  "commissionRate": 0-1小数或null,
  "profit": 数字或null,
  "account": "款项去向文本或null",
  "note": "其他备注或null",
  "date": "YYYY-MM-DD或null",
  "confidence": "high|medium|low"
}

confidence 判断：
- high：商品、渠道、核心金额都明确
- medium：有一项不太确定
- low：多项模糊，提醒用户仔细核对
`;

export async function handleParse(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonError('MALFORMED_JSON', '请求体 JSON 解析失败', 400); }

  const text = (body.text || '').trim();
  if (!text) return jsonError('VALIDATION_ERROR', '请提供需要解析的文字', 422);
  if (text.length > 2000) return jsonError('VALIDATION_ERROR', '文字过长，请控制在 2000 字以内', 422);

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) return jsonError('CONFIG_ERROR', '服务端未配置 DEEPSEEK_API_KEY', 500);

  const systemContent = SYSTEM_PROMPT.replace('{{seller}}', body.seller || 'company')
    + `\n\ntoday 是 ${body.today || new Date().toISOString().slice(0,10)}。`;

  let content;
  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        // 推理模型先在 reasoning_content 里思考，再写 content
        // 降低 max_tokens 加快响应：简单 JSON 只需 200-300 tokens
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error('[DeepSeek] HTTP', resp.status, errText.slice(0, 500));
      return jsonError('LLM_ERROR', `模型调用失败 (HTTP ${resp.status})`, 502);
    }

    // 先读原始文本，便于诊断
    const rawText = await resp.text();
    let data;
    try { data = JSON.parse(rawText); }
    catch {
      console.error('[DeepSeek] 非 JSON 响应', rawText.slice(0, 500));
      return jsonError('LLM_ERROR', `模型返回非 JSON: ${rawText.slice(0, 100)}`, 502);
    }
    content = data.choices?.[0]?.message?.content;
    if (!content) {
      // content 为空通常是推理模型 token 不足、思考被截断；reasoning_content 是思考过程而非答案，不可用
      console.error('[DeepSeek] content 为空', rawText.slice(0, 500));
      const finish = data.choices?.[0]?.finish_reason || 'unknown';
      return jsonError('LLM_ERROR', `模型未返回答案 (finish_reason: ${finish})，可能是 token 被截断`, 502);
    }
  } catch (err) {
    console.error('[DeepSeek] 请求异常', err);
    return jsonError('LLM_ERROR', '模型调用异常: ' + (err?.message || String(err)), 502);
  }

  // 解析 JSON
  let draft;
  try {
    let clean = content.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    draft = JSON.parse(clean);
  } catch (err) {
    console.error('[DeepSeek] JSON 解析失败', content.slice(0, 300));
    return jsonError('LLM_ERROR', '模型输出无法解析为 JSON', 502);
  }

  // 字段清洗 + 兜底
  const CHANNELS = ['quota', 'direct', 'recovery', 'other'];
  const result = {
    source: draft.source ? String(draft.source).slice(0, 50) : '',
    brand: draft.brand ? String(draft.brand).slice(0, 50) : '',
    product: draft.product ? String(draft.product).slice(0, 200) : '',
    channel: CHANNELS.includes(draft.channel) ? draft.channel : 'quota',
    price: numOrZero(draft.price),
    cost: numOrZero(draft.cost),
    commissionRate: normalizeRate(draft.commissionRate),
    profit: numOrNull(draft.profit),
    account: draft.account ? String(draft.account).slice(0, 500) : '',
    note: draft.note ? String(draft.note).slice(0, 500) : '',
    date: isValidDate(draft.date) ? draft.date : null,
    confidence: ['high', 'medium', 'low'].includes(draft.confidence) ? draft.confidence : 'medium',
  };

  return Response.json({ data: result });
}

function numOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
// 兼容模型把"1个点"返回为 1（百分比）或 0.01（小数）两种情况，统一为 0~1 小数
function normalizeRate(v) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  if (v > 1 && v <= 100) return Math.round(v * 100) / 10000; // 百分比 → 小数
  if (v <= 1) return v;
  return null;
}
function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}
function jsonError(code, message, status = 400) {
  return Response.json({ error: { code, message } }, { status });
}
