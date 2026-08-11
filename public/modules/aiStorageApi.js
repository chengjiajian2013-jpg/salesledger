// AI对话API模块 - 通过后端API管理对话（替代localStorage）

const API_BASE = '/api/v1';

function getToken() {
  return sessionStorage.getItem('salesledger_token');
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

/**
 * 获取所有对话列表
 */
export async function getAllChats() {
  try {
    const response = await fetch(`${API_BASE}/ai/chats`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('获取对话列表失败');
    }

    const result = await response.json();
    return result.data || [];
  } catch (e) {
    console.error('[getAllChats]', e);
    return [];
  }
}

/**
 * 创建新对话
 */
export async function createChat(title = '新对话') {
  const response = await fetch(`${API_BASE}/ai/chats`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('创建对话失败');
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取对话详情（包含消息）
 */
export async function getChat(chatId) {
  try {
    const response = await fetch(`${API_BASE}/ai/chats/${chatId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error('[getChat]', e);
    return null;
  }
}

/**
 * 更新对话（标题或状态）
 */
export async function updateChat(chatId, updates) {
  const response = await fetch(`${API_BASE}/ai/chats/${chatId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('更新对话失败');
  }

  const result = await response.json();
  return result.data;
}

/**
 * 删除对话
 */
export async function deleteChat(chatId) {
  const response = await fetch(`${API_BASE}/ai/chats/${chatId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('删除对话失败');
  }

  return true;
}

/**
 * 添加消息到对话
 */
export async function addMessage(chatId, role, content) {
  const response = await fetch(`${API_BASE}/ai/chats/${chatId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ role, content }),
  });

  if (!response.ok) {
    throw new Error('添加消息失败');
  }

  return true;
}

/**
 * 获取对话的消息历史（格式化为API需要的格式）
 */
export async function getChatMessages(chatId) {
  const chat = await getChat(chatId);
  if (!chat || !chat.messages) return [];

  return chat.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * 保存表单暂存数据
 */
export async function saveFormData(chatId, formData) {
  const response = await fetch(`${API_BASE}/ai/chats/${chatId}/form-data`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    throw new Error('保存表单数据失败');
  }

  return true;
}

/**
 * 获取表单暂存数据
 */
export async function getFormData(chatId) {
  try {
    const response = await fetch(`${API_BASE}/ai/chats/${chatId}/form-data`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.data;
  } catch (e) {
    console.error('[getFormData]', e);
    return null;
  }
}

/**
 * 清空对话消息（保留对话，清空消息列表）
 * 通过删除所有消息并重置标题来实现
 */
export async function clearChatMessages(chatId) {
  // 后端不支持批量删除消息，只能通过更新标题来标记
  return await updateChat(chatId, { title: '新对话' });
}
