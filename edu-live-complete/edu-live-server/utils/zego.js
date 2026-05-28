/**
 * ZEGO Token 生成工具
 * 使用 ZEGO 官方算法生成用于鉴权的 Token
 */
const crypto = require('crypto');

// 从环境变量读取 ZEGO 配置
const ZEGO_CONFIG = {
  appID: parseInt(process.env.ZEGO_APP_ID) || 0,
  serverSecret: process.env.ZEGO_SERVER_SECRET || ''
};

/**
 * 生成 ZEGO Token
 * @param {string} userID - 用户ID
 * @param {string} roomID - 房间ID
 * @param {number} expireSeconds - 过期时间（秒），默认 3600
 * @returns {string} token
 */
function generateZegoToken(userID, roomID, expireSeconds = 3600) {
  if (!ZEGO_CONFIG.appID || !ZEGO_CONFIG.serverSecret) {
    throw new Error('ZEGO 配置不完整，请设置 ZEGO_APP_ID 和 ZEGO_SERVER_SECRET');
  }

  const appId = ZEGO_CONFIG.appID;
  const secret = ZEGO_CONFIG.serverSecret;
  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + expireSeconds;
  const nonce = Math.floor(Math.random() * 2147483647);

  // 构建鉴权 payload
  const payload = JSON.stringify({
    room_id: roomID
  });

  // 按 ZEGO 官方算法构建待签名字符串
  const plainText = `
    app_id:${appId}
    user_id:${userID}
    nonce:${nonce}
    ctime:${createTime}
    expire:${expireTime}
    payload:${payload}
  `.trim();

  // HMAC-SHA256 签名
  const hash = crypto.createHmac('sha256', secret)
    .update(plainText)
    .digest('hex');

  // 构建 token 字符串
  const tokenData = {
    ver: 'zego_v1',
    app_id: appId,
    user_id: userID,
    nonce: nonce,
    ctime: createTime,
    expire: expireTime,
    payload: Buffer.from(payload).toString('base64'),
    hash: hash
  };

  // Base64 编码
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

/**
 * 生成 ZEGO 简单 Token（无房间限制，用于测试）
 * @param {string} userID - 用户ID
 * @param {number} expireSeconds - 过期时间
 * @returns {string} token
 */
function generateSimpleToken(userID, expireSeconds = 3600) {
  return generateZegoToken(userID, '*', expireSeconds);
}

module.exports = {
  generateZegoToken,
  generateSimpleToken
};
