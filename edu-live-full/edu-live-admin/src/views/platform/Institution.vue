<template>
  <div class="institution-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>机构管理（平台后台）</span>
          <el-button type="primary" @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="机构名/账号/手机号" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable>
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="机构ID" width="100" />
        <el-table-column prop="institutionName" label="机构名称" min-width="180" />
        <el-table-column prop="username" label="管理员账号" width="160" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="注册时间" width="180" />
        <el-table-column prop="lastLoginAt" label="最后登录" width="180" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 1"
              link
              type="success"
              @click="handleAudit(row, 1)"
            >启用</el-button>
            <el-button
              v-if="row.status !== 0"
              link
              type="danger"
              @click="handleAudit(row, 0)"
            >禁用</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @change="loadData"
      />
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { auditInstitution, getInstitutionList } from '@/api/platform'

const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({
  keyword: '',
  status: null
})
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.page,
      size: pagination.size
    }
    if (params.status === null || params.status === undefined) {
      delete params.status
    }
    const res = await getInstitutionList(params)
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
  searchForm.status = null
  pagination.page = 1
  await loadData()
}

const handleAudit = async (row, status) => {
  const actionText = status === 1 ? '启用' : '禁用'
  await ElMessageBox.confirm(`确认${actionText}机构【${row.institutionName || row.username}】吗？`, '提示', {
    type: 'warning'
  })

  await auditInstitution({ institutionId: row.id, status })
  ElMessage.success(`${actionText}成功`)
  await loadData()
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
