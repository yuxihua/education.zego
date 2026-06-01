import request from './request'

const statusMap = {
	waiting: 'upcoming',
	living: 'living',
	paused: 'living',
	finished: 'ended',
	closed: 'ended'
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

export const getLiveRoomDetail = async (id) => {
	const res = await request.get(`/live/room/${id}`)
	return {
		...res,
		teacherName: res.anchorName || '',
		startTime: res.actualStartTime || '',
		pptList: res.pptFiles || [],
		replayInfo: res.replayUrl
			? {
					duration: res.replayDuration || 0,
					size: res.replaySize || 0,
					url: res.replayUrl
				}
			: null
	}
}

export const getLiveStats = async (id) => {
	const detail = await getLiveRoomDetail(id)
	return {
		totalView: detail.totalViewCount || 0,
		peakOnline: detail.peakCount || 0,
		messageCount: 0
	}
}

export const endLive = (id) => request.post(`/live/room/${id}/stop`)
export const approveCohost = (id, data) => request.post(`/live/room/${id}/cohost/approve`, data)
export const rejectCohost = (id, data) => request.post(`/live/room/${id}/cohost/reject`, data)
export const kickCohost = (id, data) => request.post(`/live/room/${id}/cohost/kick`, data)
