import request from './request'

export const getBuildings = (params) => request.get('/resource/buildings', { params })
export const createBuilding = (data) => request.post('/resource/buildings', data)
export const updateBuilding = (id, data) => request.put(`/resource/buildings/${id}`, data)
export const deleteBuilding = (id, params) => request.delete(`/resource/buildings/${id}`, { params })

export const getClassrooms = (params) => request.get('/resource/classrooms', { params })
export const createClassroom = (data) => request.post('/resource/classrooms', data)
export const updateClassroom = (id, data) => request.put(`/resource/classrooms/${id}`, data)
export const deleteClassroom = (id, params) => request.delete(`/resource/classrooms/${id}`, { params })

export const getTeachers = (params) => request.get('/resource/teachers', { params })
export const createTeacher = (data) => request.post('/resource/teachers', data)
export const updateTeacher = (id, data) => request.put(`/resource/teachers/${id}`, data)
export const deleteTeacher = (id, params) => request.delete(`/resource/teachers/${id}`, { params })

export const getSchedules = (params) => request.get('/resource/schedules', { params })
export const checkScheduleConflict = (data) => request.post('/resource/schedules/check-conflict', data)
export const createSchedule = (data) => request.post('/resource/schedules', data)
export const updateSchedule = (id, data) => request.put(`/resource/schedules/${id}`, data)
export const deleteSchedule = (id, params) => request.delete(`/resource/schedules/${id}`, { params })
export const copyWeekSchedules = (data) => request.post('/resource/schedules/copy-week', data)
export const getTimeLanes = (params) => request.get('/resource/time-lanes', { params })
export const saveTimeLanes = (data) => request.post('/resource/time-lanes', data)

export const exportSchedules = async (params = {}) => {
	const search = new URLSearchParams()
	Object.entries(params || {}).forEach(([key, value]) => {
		if (value === null || value === undefined || value === '') return
		search.set(key, String(value))
	})

	const token = localStorage.getItem('token') || ''
	const res = await fetch(`/api/resource/schedules/export?${search.toString()}`, {
		headers: { Authorization: `Bearer ${token}` }
	})
	if (!res.ok) {
		const text = await res.text()
		throw new Error(text || '导出失败')
	}

	const disposition = res.headers.get('Content-Disposition') || ''
	const match = disposition.match(/filename="?([^";]+)"?/i)
	const filename = match?.[1] || `schedules_${Date.now()}.csv`
	const blob = await res.blob()

	return { blob, filename }
}