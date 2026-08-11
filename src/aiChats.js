// AI对话管理模块 - CRUD操作

/**
 * 生成唯一ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 获取所有对话列表
 * GET /api/v1/ai/chats
 */
export async function handleGetChats(request, env) {
  const { results } = await env.DB.prepare(`
    SELECT id, title, status, created_at, updated_at
    FROM ai_chats
    ORDER BY updated_at DESC
  `).all();

  return new Response(JSON.stringify({ data: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 创建新对话
 * POST /api/v1/ai/chats
 * Body: { title?: string }
 */
export async function handleCreateChat(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = generateId();
  const title = body.title || '新对话';

  await env.DB.prepare(`
    INSERT INTO ai_chats (id, title, status)
    VALUES (?, ?, 'active')
  `).bind(id, title).run();

  const chat = await env.DB.prepare(`
    SELECT id, title, status, created_at, updated_at
    FROM ai_chats
    WHERE id = ?
  `).bind(id).first();

  return new Response(JSON.stringify({ data: chat }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 获取对话详情（包含消息）
 * GET /api/v1/ai/chats/:id
 */
export async function handleGetChat(request, env, chatId) {
  const chat = await env.DB.prepare(`
    SELECT id, title, status, created_at, updated_at
    FROM ai_chats
    WHERE id = ?
  `).bind(chatId).first();

  if (!chat) {
    return new Response(JSON.stringify({ error: { message: '对话不存在' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { results: messages } = await env.DB.prepare(`
    SELECT id, role, content, created_at
    FROM ai_messages
    WHERE chat_id = ?
    ORDER BY created_at ASC
  `).bind(chatId).all();

  return new Response(JSON.stringify({
    data: {
      ...chat,
      messages,
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 更新对话
 * PATCH /api/v1/ai/chats/:id
 * Body: { title?: string, status?: 'active'|'closed' }
 */
export async function handleUpdateChat(request, env, chatId) {
  const body = await request.json();
  const updates = [];
  const params = [];

  if (body.title !== undefined) {
    updates.push('title = ?');
    params.push(body.title);
  }

  if (body.status !== undefined) {
    updates.push('status = ?');
    params.push(body.status);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: { message: '没有可更新的字段' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  updates.push('updated_at = datetime("now")');
  params.push(chatId);

  await env.DB.prepare(`
    UPDATE ai_chats
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...params).run();

  const chat = await env.DB.prepare(`
    SELECT id, title, status, created_at, updated_at
    FROM ai_chats
    WHERE id = ?
  `).bind(chatId).first();

  return new Response(JSON.stringify({ data: chat }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 删除对话
 * DELETE /api/v1/ai/chats/:id
 */
export async function handleDeleteChat(request, env, chatId) {
  // CASCADE会自动删除关联的messages和form_data
  const result = await env.DB.prepare(`
    DELETE FROM ai_chats WHERE id = ?
  `).bind(chatId).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: { message: '对话不存在' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ data: { success: true } }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 添加消息到对话
 * POST /api/v1/ai/chats/:id/messages
 * Body: { role: 'user'|'assistant', content: string }
 */
export async function handleAddMessage(request, env, chatId) {
  const body = await request.json();

  if (!body.role || !body.content) {
    return new Response(JSON.stringify({ error: { message: 'role和content是必填项' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 添加消息
  await env.DB.prepare(`
    INSERT INTO ai_messages (chat_id, role, content)
    VALUES (?, ?, ?)
  `).bind(chatId, body.role, body.content).run();

  // 更新对话的updated_at和title（如果是第一条用户消息）
  const { results: messages } = await env.DB.prepare(`
    SELECT role, content FROM ai_messages WHERE chat_id = ?
  `).bind(chatId).all();

  let newTitle = null;
  if (messages.length === 1 && body.role === 'user') {
    // 第一条用户消息，生成标题
    const content = body.content.trim();
    newTitle = content.length > 20 ? content.slice(0, 20) + '...' : content;
  }

  if (newTitle) {
    await env.DB.prepare(`
      UPDATE ai_chats
      SET title = ?, updated_at = datetime("now")
      WHERE id = ?
    `).bind(newTitle, chatId).run();
  } else {
    await env.DB.prepare(`
      UPDATE ai_chats
      SET updated_at = datetime("now")
      WHERE id = ?
    `).bind(chatId).run();
  }

  return new Response(JSON.stringify({ data: { success: true } }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 保存表单暂存数据
 * PUT /api/v1/ai/chats/:id/form-data
 * Body: { type, quota, cost, price, goods, input_text }
 */
export async function handleSaveFormData(request, env, chatId) {
  const body = await request.json();

  const type = body.type || 'personal';
  const quota = body.quota || '';
  const cost = body.cost || '';
  const price = body.price || '';
  const goods = JSON.stringify(body.goods || []);
  const input_text = body.input_text || '';

  // 使用 INSERT OR REPLACE
  await env.DB.prepare(`
    INSERT OR REPLACE INTO ai_form_data (chat_id, type, quota, cost, price, goods, input_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))
  `).bind(chatId, type, quota, cost, price, goods, input_text).run();

  return new Response(JSON.stringify({ data: { success: true } }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 获取表单暂存数据
 * GET /api/v1/ai/chats/:id/form-data
 */
export async function handleGetFormData(request, env, chatId) {
  const formData = await env.DB.prepare(`
    SELECT type, quota, cost, price, goods, input_text, updated_at
    FROM ai_form_data
    WHERE chat_id = ?
  `).bind(chatId).first();

  if (!formData) {
    return new Response(JSON.stringify({ data: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 解析goods JSON
  try {
    formData.goods = JSON.parse(formData.goods);
  } catch (e) {
    formData.goods = [];
  }

  return new Response(JSON.stringify({ data: formData }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
