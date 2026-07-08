import request from './request'

const statusMap = {
	waiting: 'upcoming',
	living: 'living',
	paused: 'living',
	finished: 'ended',
	closed: 'ended'
}

const toLocalDateTime = (value) => {
	if (!value) return ''
	const dt = new Date(value)
	if (Number.isNaN(dt.getTime())) return String(value)
	const y = dt.getFullYear()
	const m = String(dt.getMonth() + 1).padStart(2, '0')
	const d = String(dt.getDate()).padStart(2, '0')
	const hh = String(dt.getHours()).padStart(2, '0')
	const mm = String(dt.getMinutes()).padStart(2, '0')
	const ss = String(dt.getSeconds()).padStart(2, '0')
	return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const buildReplayInfo = (payload = {}) => {
	if (!payload?.url) return null
	return {
		recordingID: payload.recordingID || '',
		duration: payload.duration || 0,
		size: payload.size || 0,
		url: payload.url,
		startTime: toLocalDateTime(payload.startTime) || null,
		endTime: toLocalDateTime(payload.endTime) || null,
		publishedAt: toLocalDateTime(payload.publishedAt) || null
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
		startTime: toLocalDateTime(item.actualStartTime || item.createdAt),
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
	return {
		...res,
		teacherName: res.anchorName || '',
		startTime: toLocalDateTime(res.actualStartTime),
		endTime: toLocalDateTime(res.endTime),
		pptList: res.pptFiles || [],
		replayInfo: buildReplayInfo({
			url: res.replayUrl,
			duration: res.replayDuration,
			size: res.replaySize
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

export const getBbbReplayListByLiveRoom = async (roomId) => {
	if (!roomId) return []
	const res = await request.get(`/bbb/replay-room/${encodeURIComponent(roomId)}/all`)
	const list = res?.list || (Array.isArray(res) ? res : [])
	return list.map(buildReplayInfo).filter(Boolean)
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
