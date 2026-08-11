// AI助手模块 - 通过后端代理调用

/**
 * 调用AI API（通过后端代理）
 * @param {Array} messages - 对话历史 [{role: 'user'|'assistant', content: '...'}]
 * @returns {Promise<string>} - AI回复内容
 */
export async function callAI(messages) {
  const token = sessionStorage.getItem('salesledger_token');

  const response = await fetch('/api/v1/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'AI调用失败');
  }

  const data = await response.json();
  return data.data.content;
}
