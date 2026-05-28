import request from './request'

export const getHomeworkList = (params) => request.get('/homework/list', { params })
export const createHomework = (data) => request.post('/homework/create', data)
export const getHomeworkSubmissions = (params) => request.get('/homework/submissions', { params })
export const gradeHomework = (data) => request.post('/homework/grade', data)
