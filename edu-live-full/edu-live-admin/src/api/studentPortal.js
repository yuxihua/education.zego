import axios from 'axios'
import { ElMessage } from 'element-plus'

const STUDENT_TOKEN_KEY = 'student_token'

const studentClient = axios.create({
  baseURL: '/api',
  timeout: 15000
})

studentClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(STUDENT_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = 'Bearer ' + token
  }
  return config
})

studentClient.interceptors.response.use(
  (res) => {
    const successCodes = [0, 200]
    if (!successCodes.includes(res.data.code)) {
      ElMessage.error(res.data.message || '请求失败')
      return Promise.reject(res.data)
    }
    return res.data.data
  },
  (err) => {
    ElMessage.error(err.response?.data?.message || '网络错误')
    return Promise.reject(err)
  }
)

export const studentTokenKey = STUDENT_TOKEN_KEY

export const studentLogin = (data) => studentClient.post('/student/login', data)
export const studentProfile = () => studentClient.get('/student/profile')
export const studentLogout = () => studentClient.post('/student/logout')
export const studentMyCourses = (params) => studentClient.get('/student/my-courses', { params })

export const studentCourseList = (params) => studentClient.get('/course/list', { params })

export const studentCreateAlipayOrder = (courseId) => studentClient.post('/pay/alipay/create', { courseId })
export const studentCreateAlipayWapOrder = (courseId) => studentClient.post('/pay/alipay/wap/create', { courseId })
export const studentOrderQuery = (orderNo) => studentClient.get('/pay/order/query', { params: { orderNo } })
export const studentOrders = (params) => studentClient.get('/pay/orders', { params })