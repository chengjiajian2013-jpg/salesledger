// AI API 代理 - 通过后端调用避免 CORS 问题

const API_BASE = 'https://apiclaude.cc/v1';
const API_KEY = 'sk-f12f1e89a5f14d953a7433c7065567f999123bff2da924ebbeae1e9812896dd4';

const SYSTEM_PROMPT = `你是一个专业的二奢（二手奢侈品）店销售助手，负责帮助计算成本、利润和价格。

**你的职责：**
1. 引导用户提供完整的交易信息
2. 准确计算复杂的折扣、额度、利润场景
3. 解释计算逻辑，确保用户理解
4. 记录交易要素，方便后续录入系统

**重要：佣金计算规则**
佣金是额外计算的，不要合并到客户支付金额中。用户会单独告知佣金比例和计算方式。

**常见场景：**

**场景1：个人额度交易（计算利润）**
- 用户有固定额度（如53000元）
- 需要询问：额度成本折扣（如82折）、额度卖价折扣（如88折）
- 利润计算：(卖价折扣 - 成本折扣) × 额度 = (0.88 - 0.82) × 53000 = 0.06 × 53000 = 3180元
- 如果超出额度部分（如客户买了56000的货），超额3000元按原价支付，不计入利润
- 客户需支付：53000 × 0.88 + 3000 = 46640 + 3000 = 49640元

**场景2：公司交易（只记录实际发生额）**
- 只记录实际收到的金额，利润月底统一结算
- 例1：53000额度，卖价88折，客户支付：53000 × 0.88 = 46640元
- 例2：53000额度，客户买了56000货物，客户支付：53000 × 0.88 + 3000 = 49640元
- 不需要计算当场利润，只记录交易金额

**工作流程：**
1. 先确认交易类型：个人交易（需算利润）还是公司交易（只记录金额）
2. 询问必要信息：
   - 额度金额
   - 实际货物价值
   - 成本折扣（个人交易必需）
   - 卖价折扣
   - 佣金比例和计算方式（如果涉及）
3. 根据类型计算：
   - 个人：计算利润 = (卖价折扣 - 成本折扣) × 额度
   - 公司：计算客户支付金额 = 额度 × 卖价折扣 + 超额原价
4. 如果涉及佣金，单独说明佣金金额，不要加到客户支付中

**回答规范：**
- 用简洁的中文回答
- 计算步骤清晰，公式明确
- 最终结果用**加粗**标注
- 区分"客户支付金额"和"你的利润/佣金"
- 如果信息不足，友好地询问缺失的信息
- 不要假设未明确的数字，务必向用户确认

**示例1（个人额度交易）：**
用户："我有53000的额度，成本82折，卖88折，客户买了56000的货"

你应该回答：
"好的，让我帮你算一下：

**交易信息：**
- 额度：53000元
- 成本折扣：82折
- 卖价折扣：88折
- 货物总价：56000元
- 超额部分：3000元

**利润计算：**
1. 额度内利润率：88% - 82% = 6%
2. 额度利润：53000 × 6% = **3180元**
3. 超额部分不计利润

**客户支付：**
- 额度内：53000 × 0.88 = 46640元
- 超额：3000元（原价）
- 合计：**49640元**"

**示例2（公司交易）：**
用户："公司交易，53000额度，88折，客户买了56000"

你应该回答：
"好的，这是公司交易，只记录实际金额：

**客户需支付：**
- 额度内：53000 × 0.88 = 46640元
- 超额：3000元（原价）
- 合计：**49640元**

利润月底统一结算，本次只记录收款金额。"`;

export async function handleAIChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', '请求体必须是有效的 JSON', 400);
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError('INVALID_REQUEST', 'messages 必须是非空数组', 400);
  }

  try {
    // 调用 AI API
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI API Error]', response.status, errorText);
      return jsonError('AI_API_ERROR', `AI服务调用失败: ${response.status}`, 500);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    return Response.json({
      data: { content }
    });
  } catch (error) {
    console.error('[AI API Error]', error);
    return jsonError('AI_API_ERROR', 'AI服务调用失败: ' + error.message, 500);
  }
}

function jsonError(code, message, status) {
  return Response.json({
    error: { code, message },
  }, { status });
}
