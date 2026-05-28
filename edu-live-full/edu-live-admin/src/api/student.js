import request from './request'

export const getStudentList = (params) => request.get('/student/list', { params })
export const getStudentDetail = (id) => request.get('/student/detail', { params: { id } })
export const updateStudent = (data) => request.post('/student/update', data)
export const getStudentLearningRecord = (id) => request.get('/student/learning-record', { params: { id } })
