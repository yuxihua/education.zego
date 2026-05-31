<template>
  <div class="student-login-page">
    <div class="login-card">
      <h2>学员登录</h2>
      <el-form :model="form" label-width="90px">
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" placeholder="首次登录可填写昵称" />
        </el-form-item>
        <el-form-item label="OpenID">
          <el-input v-model="form.openid" placeholder="微信场景可填写" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleLogin">登录</el-button>
          <el-button @click="goAdminLogin">后台登录</el-button>
        </el-form-item>
      </el-form>

      <el-divider>或使用微信扫码登录</el-divider>
      <div class="wx-login">
        <div class="qr-wrapper" v-if="wxLogin.qrUrl">
          <img :src="wxLogin.qrUrl" alt="微信扫码登录" class="qr-image" />
        </div>
        <div v-else class="qr-placeholder">点击下方按钮生成二维码</div>

        <div class="wx-actions">
          <el-button type="success" :loading="wxLogin.loading" @click="createWxQrLogin">
            {{ wxLogin.qrUrl ? '刷新二维码' : '微信扫码登录' }}
          </el-button>
          <span v-if="wxLogin.state" class="hint">二维码有效期 5 分钟，扫码后会自动登录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { studentLogin, studentTokenKey, studentCreateWxQr, studentCheckWxQr } from '@/api/studentPortal'

const router = useRouter()
const loading = ref(false)
const form = reactive({
  phone: '',
  nickname: '',
  openid: ''
})

const wxLogin = reactive({
  loading: false,
  state: '',
  qrUrl: ''
})

let wxPollTimer = null

const stopWxPolling = () => {
  if (wxPollTimer) {
    clearInterval(wxPollTimer)
    wxPollTimer = null
  }
}

const startWxPolling = () => {
  stopWxPolling()
  wxPollTimer = setInterval(async () => {
    if (!wxLogin.state) return
    try {
      const statusRes = await studentCheckWxQr(wxLogin.state)
      if (statusRes.status === 'pending') return
      if (statusRes.status === 'expired') {
        stopWxPolling()
        ElMessage.warning('二维码已过期，请重新生成')
        return
      }
      if (statusRes.status === 'failed') {
        stopWxPolling()
        ElMessage.error(statusRes.message || '扫码登录失败，请重试')
        return
      }
      if (statusRes.status === 'success' && statusRes.token) {
        stopWxPolling()
        localStorage.setItem(studentTokenKey, statusRes.token)
        ElMessage.success('微信登录成功')
        router.push('/student-center')
      }
    } catch (err) {
      // 轮询失败时静默，避免频繁抖动提示
    }
  }, 2000)
}

const createWxQrLogin = async () => {
  wxLogin.loading = true
  try {
    const res = await studentCreateWxQr()
    wxLogin.state = res.state
    wxLogin.qrUrl = res.qrUrl
    startWxPolling()
  } finally {
    wxLogin.loading = false
  }
}

const handleLogin = async () => {
  if (!form.phone && !form.openid) {
    ElMessage.warning('手机号或OpenID至少填写一个')
    return
  }

  loading.value = true
  try {
    const res = await studentLogin(form)
    localStorage.setItem(studentTokenKey, res.token)
    ElMessage.success('登录成功')
    router.push('/student-center')
  } finally {
    loading.value = false
  }
}

const goAdminLogin = () => {
  router.push('/login')
}

onBeforeUnmount(() => {
  stopWxPolling()
})
</script>

<style scoped>
.student-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(120deg, #f4f7ff 0%, #eaf5ff 100%);
}

.login-card {
  width: 460px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.08);
  padding: 28px;
}

h2 {
  margin: 0 0 20px;
}

.wx-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-wrapper {
  width: 220px;
  height: 220px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-placeholder {
  width: 220px;
  height: 220px;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.wx-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.hint {
  color: #6b7280;
  font-size: 12px;
}
</style>