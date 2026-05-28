import request from './request'

export const getOrderList = (params) => request.get('/order/list', { params })
export const getOrderStats = () => request.get('/order/stats')
export const refundOrder = (data) => request.post('/order/refund', data)
