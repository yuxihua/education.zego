const { RolePermission } = require('../models');
const { ROLE_DEFAULT_PERMISSIONS } = require('../config/permissions');

async function getUserPermissions(user) {
  if (!user || !user.role) return [];

  const role = user.role;
  const institutionId = Number(user.institutionId || 0);

  if (role === 'superadmin') {
    return ROLE_DEFAULT_PERMISSIONS.superadmin || [];
  }

  const row = await RolePermission.findOne({
    where: {
      institutionId,
      role
    }
  });

  if (!row) {
    return ROLE_DEFAULT_PERMISSIONS[role] || [];
  }

  return Array.isArray(row.permissions) ? row.permissions : [];
}

module.exports = {
  getUserPermissions
};
