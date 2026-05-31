<template>
  <div class="operation-log-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统操作日志</span>
          <el-button @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="账号/角色/路径/IP" clearable />
        </el-form-item>
        <el-form-item label="方法">
          <el-select v-model="searchForm.method" placeholder="全部" clearable style="width: 120px">
            <el-option label="POST" value="POST" />
            <el-option label="PUT" value="PUT" />
            <el-option label="PATCH" value="PATCH" />
            <el-option label="DELETE" value="DELETE" />
          </el-select>
        </el-form-item>
        <el-form-item label="路径">
          <el-input v-model="searchForm.path" placeholder="如 /api/system/accounts" clearable />
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="searchForm.success" placeholder="全部" clearable style="width: 120px">
            <el-option label="成功" :value="1" />
            <el-option label="失败" :value="0" />
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
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column prop="username" label="操作人" width="130" />
        <el-table-column prop="role" label="角色" width="100" />
        <el-table-column prop="institutionId" label="机构ID" width="100" />
        <el-table-column prop="method" label="方法" width="90" />
        <el-table-column prop="path" label="路径" min-width="230" />
        <el-table-column prop="ip" label="IP" width="140" />
        <el-table-column prop="statusCode" label="状态码" width="90" />
        <el-table-column prop="success" label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="参数" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="showPayload(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @change="loadData"
      />
    </el-card>

    <el-dialog v-model="payloadDialogVisible" title="请求参数详情" width="700px">
      <pre class="payload-pre">{{ payloadText }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { getOperationLogs } from '@/api/system'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ page: 1, size: 20, total: 0 })
const searchForm = reactive({
  keyword: '',
  method: '',
  path: '',
  success: null,
  institutionId: null
})

const payloadDialogVisible = ref(false)
const payloadText = ref('')

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      ...searchForm,
      page: pagination.page,
      size: pagination.size
    }
    if (!params.method) delete params.method
    if (!params.path) delete params.path
    if (params.success === null || params.success === undefined) delete params.success
    if (!userStore.isPlatformAdmin) delete params.institutionId
    if (params.institutionId === null || params.institutionId === undefined) delete params.institutionId

    const res = await getOperationLogs(params)
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
  searchForm.method = ''
  searchForm.path = ''
  searchForm.success = null
  searchForm.institutionId = null
  pagination.page = 1
  await loadData()
}

const showPayload = (row) => {
  payloadText.value = JSON.stringify(row.requestBody || {}, null, 2)
  payloadDialogVisible.value = true
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

.payload-pre {
  max-height: 480px;
  overflow: auto;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
}
</style>
