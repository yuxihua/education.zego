const { RolePermission } = require('../models');
const { ROLE_DEFAULT_PERMISSIONS } = require('../config/permissions');

const LEGACY_PERMISSION_EXPANDERS = {
  'distribution.manage': [
    'distribution.orders.view',
    'distribution.config.manage',
    'distribution.hierarchy.view',
    'distribution.assignment.manage'
  ]
};

function expandLegacyPermissions(permissions = []) {
  const set = new Set(Array.isArray(permissions) ? permissions : []);
  for (const key of [...set]) {
    const expanded = LEGACY_PERMISSION_EXPANDERS[key] || [];
    expanded.forEach((item) => set.add(item));
  }
  return [...set];
}

async function getUserPermissions(user) {
  if (!user || !user.role) return [];

  const role = user.role;
  const institutionId = Number(user.institutionId || 0);

  if (role === 'superadmin') {
    return expandLegacyPermissions(ROLE_DEFAULT_PERMISSIONS.superadmin || []);
  }

  const row = await RolePermission.findOne({
    where: {
      institutionId,
      role
    }
  });

  if (!row) {
    return expandLegacyPermissions(ROLE_DEFAULT_PERMISSIONS[role] || []);
  }

  return expandLegacyPermissions(Array.isArray(row.permissions) ? row.permissions : []);
}

module.exports = {
  getUserPermissions
};
