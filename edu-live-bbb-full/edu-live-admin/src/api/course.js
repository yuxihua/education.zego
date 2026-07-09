import request from './request'

export const getCourseList = (params) => request.get('/course/list', { params })
export const createCourse = (data) => request.post('/course', data)
export const updateCourse = (data) => request.put(`/course/${data.id}`, data)
export const deleteCourse = (id) => request.delete(`/course/${id}`)
export const publishCourse = (id) => request.post(`/course/${id}/publish`)
export const archiveCourse = (id) => request.post(`/course/${id}/archive`)
export const getTeacherList = (params) => request.get('/auth/teachers', { params })
export const createTeacher = (data) => request.post('/auth/teacher', data)
export const listUploadedImages = (params) => request.get('/upload/images', { params })
export const listUploadedVideos = (params) => request.get('/upload/videos', { params })
export const getCourseRecordings = (courseId) => request.get(`/course/${courseId}/recordings`)
export const updateCourseRecordings = (courseId, list) => request.put(`/course/${courseId}/recordings`, { list })
