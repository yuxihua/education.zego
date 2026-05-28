import request from './request'

export const getQuestionList = (params) => request.get('/question/list', { params })
export const createQuestion = (data) => request.post('/question/create', data)
export const updateQuestion = (data) => request.post('/question/update', data)
export const deleteQuestion = (id) => request.post('/question/delete', { id })
export const getQuestionCategories = () => request.get('/question/categories')
