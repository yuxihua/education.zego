import request from './request'

export const getSystemAccounts = (params) => request.get('/system/accounts', { params })
export const createSystemAccount = (data) => request.post('/system/accounts', data)
export const updateSystemAccount = (id, data) => request.put(`/system/accounts/${id}`, data)
export const updateSystemAccountStatus = (id, data) => request.put(`/system/accounts/${id}/status`, data)
export const resetSystemAccountPassword = (id, data) => request.post(`/system/accounts/${id}/reset-password`, data)

export const getOperationLogs = (params) => request.get('/system/operation-logs', { params })
export const exportOperationLogs = (params) => request.get('/system/operation-logs/export', { params, responseType: 'blob' })
