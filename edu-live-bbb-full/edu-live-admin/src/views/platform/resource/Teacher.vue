<template>
  <div class="resource-teacher-page">
    <el-card v-if="userStore.isPlatformAdmin" style="margin-bottom: 16px">
      <el-form inline>
        <el-form-item label="机构">
          <el-select v-model="currentInstitutionId" filterable placeholder="请选择机构" style="width: 280px" @change="loadTeachers">
            <el-option v-for="item in institutionOptions" :key="item.id" :label="item.institutionName || item.nickname || item.username" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>讲师管理</span>
          <el-button type="primary" size="small" @click="openTeacherDialog()">新增</el-button>
        </div>
      </template>

      <el-form :inline="true" class="search-form">
        <el-form-item>
          <el-input v-model="teacherKeyword" placeholder="搜索讲师账号/姓名/手机号" clearable style="width: 260px" @keyup.enter="loadTeachers" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadTeachers">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="teachers" size="small" v-loading="teacherLoading" border>
        <el-table-column prop="nickname" label="姓名" min-width="120" />
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="phone" label="手机号" min-width="130" />
        <el-table-column prop="email" label="邮箱" min-width="180" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTeacherDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDeleteTeacher(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="teacherDialogVisible" :title="teacherForm.id ? '编辑讲师' : '新增讲师'" width="560px">
      <el-form :model="teacherForm" label-width="100px">
        <el-form-item label="账号"><el-input v-model="teacherForm.username" /></el-form-item>
        <el-form-item v-if="!teacherForm.id" label="密码"><el-input v-model="teacherForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="teacherForm.nickname" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="teacherForm.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="teacherForm.email" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="teacherForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teacherDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTeacher">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getInstitutionList } from '@/api/platform'
import { createTeacher, deleteTeacher, getTeachers, updateTeacher } from '@/api/resource'

const userStore = useUserStore()
const institutionOptions = ref([])
const currentInstitutionId = ref(userStore.currentInstitutionId || null)

const teacherLoading = ref(false)
const teachers = ref([])
const teacherKeyword = ref('')
const teacherDialogVisible = ref(false)
const teacherForm = reactive({ id: null, username: '', password: '', nickname: '', phone: '', email: '', status: 1 })

const buildCommonParams = () => {
  const params = {}
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    params.institutionId = currentInstitutionId.value
  }
  return params
}

const loadInstitutions = async () => {
  if (!userStore.isPlatformAdmin) return
  const res = await getInstitutionList({ page: 1, size: 1000 })
  institutionOptions.value = res.list || []
  if (!currentInstitutionId.value && institutionOptions.value.length) {
    currentInstitutionId.value = institutionOptions.value[0].id
  }
}

const loadTeachers = async () => {
  teacherLoading.value = true
  try {
    teachers.value = await getTeachers({ ...buildCommonParams(), keyword: teacherKeyword.value })
  } finally {
    teacherLoading.value = false
  }
}

const openTeacherDialog = (row = null) => {
  Object.assign(teacherForm, row ? { ...row, password: '' } : { id: null, username: '', password: '', nickname: '', phone: '', email: '', status: 1 })
  teacherDialogVisible.value = true
}

const saveTeacher = async () => {
  const payload = { ...teacherForm }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }
  if (!payload.id && !payload.password) {
    ElMessage.warning('新增讲师必须填写密码')
    return
  }

  if (payload.id) await updateTeacher(payload.id, payload)
  else await createTeacher(payload)

  ElMessage.success('讲师已保存')
  teacherDialogVisible.value = false
  await loadTeachers()
}

const handleDeleteTeacher = async (row) => {
  await ElMessageBox.confirm(`确认删除讲师【${row.nickname || row.username}】吗？`, '提示', { type: 'warning' })
  await deleteTeacher(row.id, buildCommonParams())
  ElMessage.success('讲师已删除')
  await loadTeachers()
}

onMounted(async () => {
  await loadInstitutions()
  await loadTeachers()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 12px;
}
</style>
