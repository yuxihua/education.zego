const { randomBytes, createCipheriv } = require('crypto');

function createError(errorCode, errorMessage) {
  const error = new Error(errorMessage);
  error.code = errorCode;
  return error;
}

function makeNonce() {
  const min = -Math.pow(2, 31);
  const max = Math.pow(2, 31) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function aesGcmEncrypt(plainText, key) {
  if (![16, 24, 32].includes(key.length)) {
    throw createError(5, 'Invalid Secret length. Key must be 16, 24, or 32 bytes.');
  }

  const nonce = randomBytes(12);
  const algorithmMap = {
    16: 'aes-128-gcm',
    24: 'aes-192-gcm',
    32: 'aes-256-gcm'
  };
  const cipher = createCipheriv(algorithmMap[key.length], Buffer.from(key, 'utf8'), nonce);
  cipher.setAutoPadding(true);
  const encrypted = cipher.update(plainText, 'utf8');
  const encryptBuf = Buffer.concat([encrypted, cipher.final(), cipher.getAuthTag()]);
  return { encryptBuf, nonce };
}

function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload = '') {
  if (!appId || typeof appId !== 'number') {
    throw createError(1, 'appID invalid');
  }

  if (!userId || typeof userId !== 'string' || userId.length > 64) {
    throw createError(3, 'userId invalid');
  }

  if (!secret || typeof secret !== 'string' || secret.length !== 32) {
    throw createError(5, 'secret must be a 32 byte string');
  }

  if (!(effectiveTimeInSeconds > 0)) {
    throw createError(6, 'effectiveTimeInSeconds invalid');
  }

  const versionFlag = '04';
  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: makeNonce(),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || ''
  };

  const plainText = JSON.stringify(tokenInfo);
  const { encryptBuf, nonce } = aesGcmEncrypt(plainText, secret);

  const expireBuf = new Uint8Array(8);
  const nonceLenBuf = new Uint8Array(2);
  const encryptLenBuf = new Uint8Array(2);
  const modeBuf = new Uint8Array(1);

  new DataView(expireBuf.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);
  new DataView(nonceLenBuf.buffer).setUint16(0, nonce.byteLength, false);
  new DataView(encryptLenBuf.buffer).setUint16(0, encryptBuf.byteLength, false);
  new DataView(modeBuf.buffer).setUint8(0, 1);

  const buf = Buffer.concat([
    Buffer.from(expireBuf),
    Buffer.from(nonceLenBuf),
    Buffer.from(nonce),
    Buffer.from(encryptLenBuf),
    Buffer.from(encryptBuf),
    Buffer.from(modeBuf)
  ]);

  return versionFlag + buf.toString('base64');
}

module.exports = {
  generateToken04
};