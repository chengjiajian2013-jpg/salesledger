// SalesLedger — 访问密钥认证模块
// HMAC-SHA-256 签名的短期 Bearer Token

const ALGORITHM = 'SHA-256';
const TOKEN_VALIDITY_MS = 12 * 60 * 60 * 1000; // 12 小时

// 生成签名 Token
async function generateToken(env) {
  const payload = {
    iat: Date.now(),
    exp: Date.now() + TOKEN_VALIDITY_MS,
  };
  const message = JSON.stringify(payload);
  const signature = await sign(message, env.ACCESS_KEY);
  return btoa(JSON.stringify({ payload, signature }));
}

// 验证 Token
async function verifyToken(token, env) {
  if (!token) return false;

  try {
    const decoded = JSON.parse(atob(token));
    const { payload, signature } = decoded;

    // 检查过期
    if (payload.exp < Date.now()) return false;

    // 验证签名
    const expectedSignature = await sign(JSON.stringify(payload), env.ACCESS_KEY);
    return signature === expectedSignature;
  } catch {
    return false;
  }
}

// HMAC-SHA-256 签名
async function sign(message, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: ALGORITHM },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return arrayBufferToHex(signature);
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 登录接口
export async function handleLogin(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('INVALID_JSON', '请求体必须是有效的 JSON', 400);
  }

  const { password } = body;

  if (!env.ACCESS_KEY) {
    return jsonError('CONFIG_ERROR', '服务器未配置访问密钥', 500);
  }

  if (!password || password !== env.ACCESS_KEY) {
    return jsonError('UNAUTHORIZED', '密码错误', 401);
  }

  const token = await generateToken(env);

  return Response.json({
    data: { token },
  });
}

// 认证中间件
export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonError('UNAUTHORIZED', '缺少认证令牌', 401);
  }

  const token = authHeader.substring(7);
  const isValid = await verifyToken(token, env);

  if (!isValid) {
    return jsonError('UNAUTHORIZED', '令牌无效或已过期', 401);
  }

  return null; // 认证通过
}

function jsonError(code, message, status) {
  return Response.json({
    error: { code, message },
  }, { status });
}
