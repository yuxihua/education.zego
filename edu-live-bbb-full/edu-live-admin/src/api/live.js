import request from './request'

const statusMap = {
	waiting: 'upcoming',
	living: 'living',
	paused: 'living',
	finished: 'ended',
	closed: 'ended'
}

const buildReplayInfo = (payload = {}) => {
	if (!payload?.url) return null
	return {
		duration: payload.duration || 0,
		size: payload.size || 0,
		url: payload.url
	}
}

export const getLiveList = async (params = {}) => {
	const { page = 1, size = 10, ...rest } = params
	const res = await request.get('/live/rooms', {
		params: {
			page,
			pageSize: size,
			...rest
		}
	})

	const list = (res.list || []).map(item => ({
		...item,
		courseName: item.course?.title || '',
		teacherName: item.anchorName || item.teacherName || '',
		startTime: item.actualStartTime || item.createdAt || '',
		status: statusMap[item.status] || item.status
	}))

	return {
		list,
		total: res.pagination?.total || 0,
		page: res.pagination?.page || page,
		size: res.pagination?.pageSize || size
	}
}

export const createLiveRoom = (data) => request.post('/live/room', data)
export const startLive = (id, data) => request.post(`/live/room/${id}/start`, data)

export const getLiveRoomDetail = async (id) => {
	const res = await request.get(`/live/room/${id}`)
	const replayUrl = res.replayUrl || res.replayFallbackUrl
	const replayDuration = res.replayUrl ? res.replayDuration : res.replayFallbackDuration
	const replaySize = res.replayUrl ? res.replaySize : res.replayFallbackSize
	return {
		...res,
		teacherName: res.anchorName || '',
		startTime: res.actualStartTime || '',
		pptList: res.pptFiles || [],
		replayInfo: buildReplayInfo({
			url: replayUrl,
			duration: replayDuration,
			size: replaySize
		})
	}
}

export const getBbbReplayByRoom = async (meetingID) => {
	if (!meetingID) return null
	const res = await request.get(`/bbb/replay/${encodeURIComponent(meetingID)}`)
	return buildReplayInfo(res)
}

export const getBbbReplayByLiveRoom = async (roomId) => {
	if (!roomId) return null
	const res = await request.get(`/bbb/replay-room/${encodeURIComponent(roomId)}`)
	return buildReplayInfo(res)
}

export const deleteBbbReplayByLiveRoom = async (roomId) => {
	if (!roomId) return null
	return request.delete(`/bbb/replay-room/${encodeURIComponent(roomId)}`)
}

// 兼容旧调用，后续可全量替换为 getBbbReplayByLiveRoom
export const getZegoReplayByRoom = getBbbReplayByLiveRoom

export const getLiveStats = async (id) => {
	const detail = await getLiveRoomDetail(id)
	return {
		totalView: detail.totalViewCount || 0,
		currentOnline: detail.onlineCount || 0,
		peakOnline: detail.peakCount || 0,
		parentOnline: detail.parentOnlineCount || 0,
		studentOnline: detail.studentOnlineCount || 0,
		otherOnline: detail.otherOnlineCount || 0,
		messageCount: 0
	}
}

export const endLive = (id) => request.post(`/live/room/${id}/stop`)
export const deleteLiveRoomPpt = (roomId, pptId) => request.delete(`/live/room/${roomId}/ppt/${pptId}`)
export const approveCohost = (id, data) => request.post(`/live/room/${id}/cohost/approve`, data)
export const rejectCohost = (id, data) => request.post(`/live/room/${id}/cohost/reject`, data)
export const kickCohost = (id, data) => request.post(`/live/room/${id}/cohost/kick`, data)
