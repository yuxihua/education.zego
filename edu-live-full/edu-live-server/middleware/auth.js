/**
 * JWT 认证中间件
 * 支持：AccessToken 认证、RefreshToken 刷新
 */
const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');
const redis = require('../config/redis');
const { getUserPermissions } = require('../utils/permission');

const JWT_SECRET = process.env.JWT_SECRET || 'edu_live_default_secret';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

/**
 * 生成 Token
 * @param {object} payload - 用户数据
 * @param {string} expiresIn - 过期时间
 * @returns {string}
 */
function generateToken(payload, expiresIn = JWT_EXPIRE) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * 验证 Token
 * @param {string} token
 * @returns {object|null}
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * 认证中间件
 * 验证请求头中的 Authorization: Bearer <token>
 */
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, '请先登录', 401, 401);
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return fail(res, '登录已过期，请重新登录', 401, 401);
    }
    
    // 检查 Token 是否在黑名单（用户登出）
    const isBlacklisted = await redis.get(`token:blacklist:${token}`);
    if (isBlacklisted) {
      return fail(res, '登录已失效，请重新登录', 401, 401);
    }
    
    // 将用户信息附加到请求对象
    req.user = decoded;
    req.token = token;
    
    next();
  } catch (err) {
    console.error('[Auth] 认证失败:', err.message);
    return fail(res, '认证失败', 401, 401);
  }
}

/**
 * 可选认证（不强制登录，但会解析 token）
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      if (decoded) {
        req.user = decoded;
        req.token = token;
      }
    }
    
    next();
  } catch (err) {
    next();
  }
}

/**
 * 角色权限检查
 * @param {Array<string>} roles - 允许的角色
 */
function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return fail(res, '请先登录', 401, 401);
    }
    
    if (!roles.includes(req.user.role)) {
      return fail(res, '权限不足', 403, 403);
    }
    
    next();
  };
}

/**
 * 权限点检查
 * @param {string} permissionKey
 */
function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return fail(res, '请先登录', 401, 401);
    }

    if (!permissionKey) return next();

    try {
      const permissions = await getUserPermissions(req.user);
      if (!permissions.includes(permissionKey)) {
        return fail(res, '权限不足', 403, 403);
      }
      next();
    } catch (err) {
      return fail(res, '权限校验失败', 500, 500);
    }
  };
}

/**
 * 机构权限检查
 * 确保用户只能访问自己机构的数据
 */
function requireInstitution(req, res, next) {
  if (!req.user) {
    return fail(res, '请先登录', 401, 401);
  }
  
  // 超管可以访问所有
  if (req.user.role === 'superadmin') {
    return next();
  }
  
  // 将机构ID附加到请求
  req.institutionId = req.user.institutionId;
  next();
}

module.exports = {
  auth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireInstitution,
  generateToken,
  verifyToken
};
