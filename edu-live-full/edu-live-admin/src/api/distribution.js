import request from './request'

export const getDistributionConfig = (params) => request.get('/distribution/config', { params })
export const saveDistributionConfig = (data) => request.post('/distribution/config', data)

export const getSalesList = (params) => request.get('/distribution/sales/list', { params })
export const createSalesUser = (data) => request.post('/distribution/sales/create', data)
export const searchDistributionStudents = (params) => request.get('/distribution/students/search', { params })
export const getDistributionTree = (params) => request.get('/distribution/tree', { params })

export const assignStudentSales = (data) => request.post('/distribution/student/assign', data)

export const getDistributionOrders = (params) => request.get('/distribution/orders', { params })
