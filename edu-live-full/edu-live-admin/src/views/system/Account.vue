<template>
  <div class="system-account-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统账号管理</span>
          <el-button type="primary" @click="openCreateDialog">新增账号</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="账号/昵称/手机号/邮箱" clearable />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.role" placeholder="全部" clearable style="width: 140px">
            <el-option label="admin" value="admin" />
            <el-option label="teacher" value="teacher" />
            <el-option label="assistant" value="assistant" />
            <el-option label="sales" value="sales" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="机构ID" v-if="userStore.isPlatformAdmin">
          <el-input-number v-model="searchForm.institutionId" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border v-loading="loading">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="username" label="账号" min-width="150" />
        <el-table-column prop="nickname" label="昵称" min-width="130" />
        <el-table-column prop="role" label="角色" width="110" />
        <el-table-column prop="institutionId" label="机构ID" width="110" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最后登录" width="180" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="warning" @click="openResetPasswordDialog(row)">重置密码</el-button>
            <el-button
              v-if="row.status === 1"
              link
              type="danger"
              @click="handleStatus(row, 0)"
            >禁用</el-button>
            <el-button
              v-else
              link
              type="success"
              @click="handleStatus(row, 1)"
            >启用</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @change="loadData"
      />
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新增系统账号" width="560px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="账号" prop="username">
          <el-input v-model="createForm.username" placeholder="4-20位字符" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createForm.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="createForm.nickname" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="admin" value="admin" />
            <el-option label="teacher" value="teacher" />
            <el-option label="assistant" value="assistant" />
            <el-option label="sales" value="sales" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="createForm.phone" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="createForm.email" />
        </el-form-item>
        <el-form-item label="机构ID" v-if="userStore.isPlatformAdmin">
          <el-input-number v-model="createForm.institutionId" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="480px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="110px">
        <el-form-item label="目标账号">
          <el-input v-model="passwordForm.username" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resettingPassword" @click="handleResetPassword">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  createSystemAccount,
  getSystemAccounts,
  resetSystemAccountPassword,
  updateSystemAccountStatus
} from '@/api/system'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ page: 1, size: 10, total: 0 })

const searchForm = reactive({
  keyword: '',
  role: '',
  status: null,
  institutionId: null
})

const createDialogVisible = ref(false)
const createFormRef = ref()
const creating = ref(false)
const createForm = reactive({
  username: '',
  password: '',
  nickname: '',
  role: 'assistant',
  phone: '',
  email: '',
  institutionId: null
})
const createRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const passwordDialogVisible = ref(false)
const passwordFormRef = ref()
const resettingPassword = ref(false)
const passwordForm = reactive({ id: null, username: '', newPassword: '' })
const passwordRules = {
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.page,
      size: pagination.size
    }
    if (params.status === null || params.status === undefined) delete params.status
    if (!params.role) delete params.role
    if (!userStore.isPlatformAdmin) delete params.institutionId
    if (params.institutionId === null || params.institutionId === undefined) delete params.institutionId

    const res = await getSystemAccounts(params)
    tableData.value = res.list || []
    pagination.total = Number(res.total || 0)
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  pagination.page = 1
  await loadData()
}

const handleReset = async () => {
  searchForm.keyword = ''
  searchForm.role = ''
  searchForm.status = null
  searchForm.institutionId = null
  pagination.page = 1
  await loadData()
}

const openCreateDialog = () => {
  Object.assign(createForm, {
    username: '',
    password: '',
    nickname: '',
    role: 'assistant',
    phone: '',
    email: '',
    institutionId: null
  })
  createDialogVisible.value = true
}

const handleCreate = async () => {
  await createFormRef.value.validate()
  creating.value = true
  try {
    await createSystemAccount(createForm)
    ElMessage.success('系统账号创建成功')
    createDialogVisible.value = false
    pagination.page = 1
    await loadData()
  } finally {
    creating.value = false
  }
}

const handleStatus = async (row, status) => {
  const actionText = status === 1 ? '启用' : '禁用'
  await ElMessageBox.confirm(`确认${actionText}账号【${row.username}】吗？`, '提示', { type: 'warning' })
  await updateSystemAccountStatus(row.id, { status })
  ElMessage.success(`${actionText}成功`)
  await loadData()
}

const openResetPasswordDialog = (row) => {
  Object.assign(passwordForm, { id: row.id, username: row.username, newPassword: '' })
  passwordDialogVisible.value = true
}

const handleResetPassword = async () => {
  await passwordFormRef.value.validate()
  resettingPassword.value = true
  try {
    await resetSystemAccountPassword(passwordForm.id, { newPassword: passwordForm.newPassword })
    ElMessage.success('密码重置成功')
    passwordDialogVisible.value = false
  } finally {
    resettingPassword.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-form {
  margin-bottom: 12px;
}
</style>
