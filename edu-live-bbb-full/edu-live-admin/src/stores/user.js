import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, logoutApi, getUserInfo } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(null)
  const permissions = ref([])

  const isPlatformAdmin = computed(() => userInfo.value?.role === 'superadmin')
  const isInstitutionAdmin = computed(() => ['admin', 'superadmin'].includes(userInfo.value?.role))
  const currentInstitutionId = computed(() => userInfo.value?.institutionId)

  const setToken = (val) => {
    token.value = val
    localStorage.setItem('token', val)
  }

  const loginAction = async (credentials) => {
    const res = await login(credentials)
    setToken(res.token)
    userInfo.value = res.user
    permissions.value = res.permissions || []
    return res
  }

  const fetchUserInfo = async () => {
    const res = await getUserInfo()
    userInfo.value = res
    permissions.value = res.permissions || []
    return res
  }

  const logout = async () => {
    try { await logoutApi() } catch (e) {}
    token.value = ''
    userInfo.value = null
    permissions.value = []
    localStorage.removeItem('token')
  }

  return {
    token, userInfo, permissions,
    isPlatformAdmin, isInstitutionAdmin, currentInstitutionId,
    loginAction, logout, fetchUserInfo
  }
})
