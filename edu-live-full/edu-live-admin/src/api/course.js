import request from './request'

export const getCourseList = (params) => request.get('/course/list', { params })
export const createCourse = (data) => request.post('/course', data)
export const updateCourse = (data) => request.put(`/course/${data.id}`, data)
export const deleteCourse = (id) => request.delete(`/course/${id}`)
export const publishCourse = (id) => request.post(`/course/${id}/publish`)
export const archiveCourse = (id) => request.post(`/course/${id}/archive`)
export const getTeacherList = () => request.get('/auth/teachers')
export const createTeacher = (data) => request.post('/auth/teacher', data)
