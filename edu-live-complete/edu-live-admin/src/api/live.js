import request from './request'

export const getLiveList = (params) => request.get('/live/rooms', { params })
export const createLiveRoom = (data) => request.post('/live/room', data)
export const getLiveRoomDetail = (id) => request.get(`/live/room/${id}`)
export const getLiveStats = (id) => request.get(`/live/room/${id}`)  // 复用详情接口
export const endLive = (id) => request.post(`/live/room/${id}/stop`)
