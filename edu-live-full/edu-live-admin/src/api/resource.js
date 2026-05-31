import request from './request'

export const getClassrooms = (params) => request.get('/resource/classrooms', { params })
export const createClassroom = (data) => request.post('/resource/classrooms', data)
export const updateClassroom = (id, data) => request.put(`/resource/classrooms/${id}`, data)
export const deleteClassroom = (id, params) => request.delete(`/resource/classrooms/${id}`, { params })

export const getTeachers = (params) => request.get('/resource/teachers', { params })
export const createTeacher = (data) => request.post('/resource/teachers', data)
export const updateTeacher = (id, data) => request.put(`/resource/teachers/${id}`, data)
export const deleteTeacher = (id, params) => request.delete(`/resource/teachers/${id}`, { params })

export const getSchedules = (params) => request.get('/resource/schedules', { params })
export const createSchedule = (data) => request.post('/resource/schedules', data)
export const updateSchedule = (id, data) => request.put(`/resource/schedules/${id}`, data)
export const deleteSchedule = (id, params) => request.delete(`/resource/schedules/${id}`, { params })