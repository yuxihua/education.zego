import request from './request'

export const getInstitutionList = (params) => request.get('/platform/institution/list', { params })
export const createInstitution = (data) => request.post('/platform/institution/create', data)
export const auditInstitution = (data) => request.post('/platform/institution/audit', data)
export const getAuditList = (params) => request.get('/platform/audit/list', { params })
