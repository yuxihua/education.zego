const crypto = require('crypto');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const config = require('../config/bbb');

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: true
});

const normalizeEndpoint = (url = '') => url.replace(/\/+$/, '');

const buildQuery = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
};

const buildSignedPath = (callName, params = {}) => {
  const queryString = buildQuery(params);
  const checksum = crypto
    .createHash('sha1')
    .update(`${callName}${queryString}${config.secret}`)
    .digest('hex');
  return `/api/${callName}?${queryString}${queryString ? '&' : ''}checksum=${checksum}`;
};

const parseResponse = (xmlText) => {
  const data = parser.parse(xmlText || '');
  return data.response || data;
};

const ensureConfig = () => {
  if (!config.endpoint || !config.secret) {
    const err = new Error('BBB 未配置，请检查 BBB_API_BASE_URL 和 BBB_SHARED_SECRET');
    err.statusCode = 500;
    throw err;
  }
};

const callBbb = async (callName, params = {}) => {
  ensureConfig();
  const endpoint = normalizeEndpoint(config.endpoint);
  const signedPath = buildSignedPath(callName, params);
  const url = `${endpoint}${signedPath}`;
  const res = await axios.get(url, { timeout: 15000, responseType: 'text' });
  const payload = parseResponse(res.data);
  const returnCode = String(payload.returncode || '').toUpperCase();
  if (returnCode !== 'SUCCESS') {
    const err = new Error(payload.messageKey || payload.message || 'BBB API 调用失败');
    err.statusCode = 400;
    err.payload = payload;
    throw err;
  }
  return payload;
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
};

const listRecordings = (recordingsNode) => {
  const recordings = recordingsNode?.recording;
  if (!recordings) return [];
  if (Array.isArray(recordings)) return recordings;
  return [recordings];
};

module.exports = {
  callBbb,
  toBool,
  listRecordings,
  buildJoinUrl: (params = {}) => {
    ensureConfig();
    const endpoint = normalizeEndpoint(config.endpoint);
    return `${endpoint}${buildSignedPath('join', params)}`;
  }
};
