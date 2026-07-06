import request from './request'

export const login = (data) => request.post('/auth/login', data)
export const logoutApi = () => request.post('/auth/logout')
export const getUserInfo = () => request.get('/auth/profile')
