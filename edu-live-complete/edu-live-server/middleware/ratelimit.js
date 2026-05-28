/**
 * 接口限流中间件
 * 基于 Redis 实现滑动窗口限流
 */
const rateLimit = require('express-rate-limit');

/**
 * 通用限流配置
 */
const commonLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 100, // 每分钟最多100次请求
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
    data: null,
    timestamp: Date.now()
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 严格限流（登录、注册等敏感接口）
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 15分钟最多10次
  message: {
    code: 429,
    message: '操作过于频繁，请15分钟后再试',
    data: null,
    timestamp: Date.now()
  },
  standardHeaders: true,
  legacyHeaders: false,
  // 根据 IP + 请求体中的用户名/手机号进行限流
  keyGenerator: (req) => {
    const key = req.body?.username || req.body?.phone || req.ip;
    return `${req.ip}:${key}`;
  }
});

/**
 * 支付接口限流
 */
const payLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 20, // 每分钟最多20次
  message: {
    code: 429,
    message: '支付请求过于频繁，请稍后再试',
    data: null,
    timestamp: Date.now()
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * 直播相关限流
 */
const liveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 200, // 每分钟最多200次
  message: {
    code: 429,
    message: '直播间操作过于频繁，请稍后再试',
    data: null,
    timestamp: Date.now()
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  commonLimiter,
  strictLimiter,
  payLimiter,
  liveLimiter
};
