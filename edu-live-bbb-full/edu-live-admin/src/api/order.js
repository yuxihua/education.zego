import request from './request'

export const getOrderList = (params) => request.get('/order/list', { params })
export const getOrderStats = (params) => request.get('/order/stats', { params })
export const refundOrder = (data) => request.post('/order/refund', data)
export const createOrder = (data) => request.post('/order/create', data)
export const updateOrder = (data) => request.post('/order/update', data)
export const setOrderPayType = (data) => request.post('/order/set-pay-type', data)
