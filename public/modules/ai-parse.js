// SalesLedger - pure AI response parsers

export function extractAIData(content) {
  const match = content.match(/<ai-data>(.*?)<\/ai-data>/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch (error) {
    console.error('解析AI数据JSON失败:', error);
    return null;
  }
}

export function removeAIDataTag(content) {
  return content.replace(/<ai-data>.*?<\/ai-data>/s, '').trim();
}

export function parseAIResponse(content) {
  const aiData = extractAIData(content);
  if (aiData) {
    return {
      customerPay: aiData.customerPay || 0,
      toCompany: aiData.toCompany || 0,
      profit: aiData.profit || 0,
      excess: aiData.excess || 0,
      quota: aiData.quota || 0,
    };
  }

  const result = { customerPay: 0, toCompany: 0, profit: 0, excess: 0, quota: 0 };
  const customerPaySection = content.match(/\*\*客户(?:实际)?(?:支付|需支付)[：:]\*\*([\s\S]*?)(?=\n\n|\*\*|$)/);
  if (customerPaySection) {
    const totalMatch = customerPaySection[1].match(/合计[：:]\s*\*?\*?([\d,]+(?:\.\d+)?)\s*元/);
    if (totalMatch) result.customerPay = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  const toCompanyMatch = content.match(/给公司的钱[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
  if (toCompanyMatch) result.toCompany = parseFloat(toCompanyMatch[1].replace(/,/g, ''));

  const profitMatch = content.match(/(?:实际)?利润[：:]\s*[\d,\s\-+×().]*?\*?\*?([\d,]+(?:\.\d+)?)\s*元/);
  if (profitMatch) result.profit = parseFloat(profitMatch[1].replace(/,/g, ''));

  const excessMatch = content.match(/超额(?:部分)?[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
  if (excessMatch) result.excess = parseFloat(excessMatch[1].replace(/,/g, ''));

  const quotaMatch = content.match(/额度[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
  if (quotaMatch) result.quota = parseFloat(quotaMatch[1].replace(/,/g, ''));
  return result;
}

export function parseTransactionTypeFromAI(aiResponse) {
  const aiData = extractAIData(aiResponse);
  if (aiData && aiData.transactionType) return aiData.transactionType;

  const typeMatch = aiResponse.match(/\*\*交易类型[：:]\*\*\s*(个人交易|公司交易)/);
  if (typeMatch) return typeMatch[1] === '个人交易' ? 'personal' : 'company';

  const positiveMatch = aiResponse.match(/(?:这是|这笔|帮你算(?:一下)?(?:这笔)?)\s*(个人|公司)交易/);
  if (positiveMatch) return positiveMatch[1] === '个人' ? 'personal' : 'company';
  if (aiResponse.includes('个人交易')) return 'personal';
  if (aiResponse.includes('公司交易')) return 'company';
  return null;
}

export function parseGoodsFromAIResponse(aiResponse) {
  const aiData = extractAIData(aiResponse);
  if (aiData && aiData.goods && aiData.goods.length > 0) {
    return aiData.goods.map(item => ({ name: item.name, amount: item.amount }));
  }

  const goods = [];
  const goodsSection = aiResponse.match(/\*\*货物明细[：:]\*\*([\s\S]*?)(?=\n\n|$)/);
  if (goodsSection) {
    for (const line of goodsSection[1].split('\n')) {
      const match = line.match(/-\s*([^：:]+)[：:]\s*([\d,]+(?:\.\d+)?)\s*元/);
      if (!match) continue;
      const name = match[1].trim();
      const amount = parseFloat(match[2].replace(/,/g, ''));
      if (amount > 0 && !name.match(/^(总计|合计|小计)$/)) goods.push({ name, amount });
    }
  }

  if (goods.length === 0) {
    const totalMatch = aiResponse.match(/货物总价[：:]\s*[\d,]+(?:\.\d+)?\s*元[（(]([^)）]+)[)）]/);
    if (totalMatch) {
      for (const match of totalMatch[1].matchAll(/([^+、，,]+?)([\d,]+(?:\.\d+)?)\s*元/g)) {
        const amount = parseFloat(match[2].replace(/,/g, ''));
        if (amount > 0) goods.push({ name: match[1].trim(), amount });
      }
    }
  }
  return goods;
}

export function parseFormFromQuestion(question) {
  const info = { type: 'company', quota: 0, price: 0, cost: 0 };
  if (question.includes('个人交易')) info.type = 'personal';
  else if (question.includes('公司交易')) info.type = 'company';

  const quotaMatch = question.match(/额度\s*([\d,]+\.?\d*)\s*元/);
  if (quotaMatch) info.quota = parseFloat(quotaMatch[1].replace(/,/g, ''));
  const priceMatch = question.match(/(\d+)折/);
  if (priceMatch) info.price = parseInt(priceMatch[1]) / 100;
  const costMatch = question.match(/成本(\d+)折/);
  if (costMatch) info.cost = parseInt(costMatch[1]) / 100;
  return info;
}

export function parseGoodsFromQuestion(question) {
  const goods = [];
  let goodsSection = '';
  const sectionMatch = question.match(/(?:货物明细|实际货物)[^：:]*[：:](.*?)(?:。|客户|帮我|$)/s);
  if (sectionMatch) goodsSection = sectionMatch[1];

  const parseMatches = text => {
    const matches = [];
    const goodsRegex = /([一-龥_a-zA-Z]+)[：:]\s*([\d,]+\.?\d*)\s*元/g;
    let match;
    while ((match = goodsRegex.exec(text)) !== null) {
      matches.push({ name: match[1], amount: parseFloat(match[2].replace(/,/g, '')) });
    }
    return matches;
  };

  if (goodsSection) goods.push(...parseMatches(goodsSection));
  if (goods.length === 0) {
    for (const item of parseMatches(question)) {
      if (!['额度', '成本', '利润', '超额', '客户', '公司', '货物'].includes(item.name)) goods.push(item);
    }
  }
  return goods;
}
