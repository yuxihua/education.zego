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
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { studentLogin, studentTokenKey } from '@/api/studentPortal'

const router = useRouter()
const loading = ref(false)
const form = reactive({
  phone: '',
  nickname: '',
  openid: ''
})

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
</style>