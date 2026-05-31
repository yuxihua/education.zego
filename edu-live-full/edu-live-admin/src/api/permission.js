import request from './request'

export const getRolePermissions = (params) => request.get('/system/role-permissions', { params })
export const updateRolePermissions = (role, data) => request.put(`/system/role-permissions/${role}`, data)
