import request from './request'

export const getCheckinList = (params) => request.get('/checkin/list', { params })
export const getCheckinStats = (params) => request.get('/checkin/stats', { params })
export const exportCheckin = (params) => request.get('/checkin/export', { params, responseType: 'blob' })
