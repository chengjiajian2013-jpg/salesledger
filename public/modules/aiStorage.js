// AI对话存储模块 - 使用localStorage

const STORAGE_KEY = 'salesledger_ai_chats';

/**
 * 对话数据结构
 * {
 *   id: string,
 *   title: string,
 *   createdAt: number,
 *   updatedAt: number,
 *   messages: [{role: 'user'|'assistant', content: string, timestamp: number}]
 * }
 */

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 从消息生成标题（取第一条用户消息的前20字）
function generateTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '新对话';
  const content = firstUser.content.trim();
  return content.length > 20 ? content.slice(0, 20) + '...' : content;
}

// 获取所有对话
export function getAllChats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('读取对话失败:', e);
    return [];
  }
}

// 保存所有对话
function saveAllChats(chats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch (e) {
    console.error('保存对话失败:', e);
  }
}

// 创建新对话
export function createChat() {
  const chat = {
    id: generateId(),
    title: '新对话',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  const chats = getAllChats();
  chats.unshift(chat); // 新对话放在最前面
  saveAllChats(chats);

  return chat;
}

// 获取单个对话
export function getChat(id) {
  const chats = getAllChats();
  return chats.find(c => c.id === id);
}

// 更新对话（添加消息）
export function addMessage(chatId, role, content) {
  const chats = getAllChats();
  const chat = chats.find(c => c.id === chatId);

  if (!chat) return false;

  const message = {
    role,
    content,
    timestamp: Date.now(),
  };

  chat.messages.push(message);
  chat.updatedAt = Date.now();

  // 如果是第一条用户消息，自动生成标题
  if (chat.messages.length === 1 && role === 'user') {
    chat.title = generateTitle(chat.messages);
  }

  saveAllChats(chats);
  return true;
}

// 删除对话
export function deleteChat(id) {
  const chats = getAllChats();
  const filtered = chats.filter(c => c.id !== id);
  saveAllChats(filtered);
  return filtered.length < chats.length; // 返回是否删除成功
}

// 清空对话消息（但保留对话）
export function clearChatMessages(chatId) {
  const chats = getAllChats();
  const chat = chats.find(c => c.id === chatId);

  if (!chat) return false;

  chat.messages = [];
  chat.title = '新对话';
  chat.updatedAt = Date.now();

  saveAllChats(chats);
  return true;
}

// 获取对话的消息历史（格式化为API需要的格式）
export function getChatMessages(chatId) {
  const chat = getChat(chatId);
  if (!chat) return [];

  return chat.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));
}
