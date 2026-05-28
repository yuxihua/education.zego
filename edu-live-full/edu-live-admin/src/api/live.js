import request from './request'

export const getLiveList = (params) => request.get('/live/list', { params })
export const createLiveRoom = (data) => request.post('/live/create', data)
export const getLiveRoomDetail = (id) => request.get('/live/detail', { params: { id } })
export const getLiveStats = (id) => request.get('/live/stats', { params: { id } })
export const endLive = (id) => request.post('/live/end', { id })
