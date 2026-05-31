<template>
  <div class="order-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单财务</span>
          <div class="header-actions">
            <el-button type="primary" @click="openCreateOrderDialog">新增学员订单</el-button>
            <el-button type="success" @click="handleExport">导出报表</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="20" style="margin-bottom: 20px">
        <el-col :span="6">
          <el-statistic title="今日订单" :value="stats.todayCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="今日营收" :value="stats.todayAmount" prefix="¥" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="本月订单" :value="stats.monthCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="本月营收" :value="stats.monthAmount" prefix="¥" />
        </el-col>
      </el-row>

      <el-form :inline="true" :model="searchForm" style="margin-bottom: 16px">
        <el-form-item label="机构ID" v-if="userStore.isPlatformAdmin">
          <el-input-number v-model="searchForm.institutionId" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="订单号/学员/课程"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 140px">
            <el-option label="待支付" value="pending" />
            <el-option label="已支付" value="paid" />
            <el-option label="已退款" value="refunded" />
          </el-select>
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="searchForm.payType" placeholder="全部" clearable style="width: 140px">
            <el-option label="微信支付" value="wxpay" />
            <el-option label="支付宝" value="alipay" />
            <el-option label="免费" value="free" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column prop="studentName" label="学员" width="120" />
        <el-table-column prop="courseName" label="课程" min-width="200" />
        <el-table-column prop="amount" label="实付金额" width="120">
          <template #default="{ row }"><strong style="color: #f56c6c">¥{{ row.amount }}</strong></template>
        </el-table-column>
        <el-table-column prop="payType" label="支付方式" width="120">
          <template #default="{ row }">{{ { wxpay: '微信支付', alipay: '支付宝', free: '免费' }[row.payType] || row.payType }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'paid' ? 'success' : row.status === 'refunded' ? 'danger' : 'warning'">
              {{ { paid: '已支付', pending: '待支付', refunded: '已退款' }[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="下单时间" width="160" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'paid'" link type="danger" @click="handleRefund(row)">退款</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-dialog v-model="createDialogVisible" title="新增学员订单" width="640px">
      <el-form :model="createForm" label-width="110px">
        <el-form-item label="机构ID" v-if="userStore.isPlatformAdmin">
          <el-input-number v-model="createForm.institutionId" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="学员">
          <el-select
            v-model="createForm.studentId"
            filterable
            remote
            reserve-keyword
            clearable
            placeholder="输入姓名或手机号搜索"
            style="width: 100%"
            :remote-method="searchStudents"
            @visible-change="onStudentSelectVisible"
          >
            <el-option v-for="item in studentOptions" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程">
          <el-select v-model="createForm.courseId" filterable clearable placeholder="请选择课程" style="width: 100%">
            <el-option v-for="item in courseOptions" :key="item.id" :label="item.title" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额">
          <el-input-number v-model="createForm.amount" :min="0" :precision="2" :step="10" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支付方式">
          <el-select v-model="createForm.payType" style="width: 100%">
            <el-option label="免费" value="free" />
            <el-option label="微信支付" value="wxpay" />
            <el-option label="支付宝" value="alipay" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="createForm.status" style="width: 100%">
            <el-option label="已支付" value="paid" />
            <el-option label="待支付" value="pending" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="handleCreateOrder">创建订单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrderList, getOrderStats, refundOrder, createOrder } from '@/api/order'
import { useUserStore } from '@/stores/user'
import { getCourseList } from '@/api/course'
import { getStudentList } from '@/api/student'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const stats = reactive({ todayCount: 0, todayAmount: 0, monthCount: 0, monthAmount: 0 })
const searchForm = reactive({ keyword: '', status: '', payType: '', institutionId: null })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const createDialogVisible = ref(false)
const createLoading = ref(false)
const courseOptions = ref([])
const studentOptions = ref([])
const createForm = reactive({
  institutionId: null,
  studentId: null,
  courseId: null,
  amount: 0,
  payType: 'free',
  status: 'paid',
  remark: ''
})

const resetCreateForm = () => {
  Object.assign(createForm, {
    institutionId: userStore.isPlatformAdmin ? (searchForm.institutionId ?? null) : null,
    studentId: null,
    courseId: null,
    amount: 0,
    payType: 'free',
    status: 'paid',
    remark: ''
  })
}

const loadCourseOptions = async () => {
  const params = { page: 1, size: 1000 }
  if (userStore.isPlatformAdmin && createForm.institutionId !== null && createForm.institutionId !== undefined) {
    params.institutionId = createForm.institutionId
  }
  const res = await getCourseList(params)
  courseOptions.value = res.list || []
}

const searchStudents = async (keyword = '') => {
  const params = { page: 1, size: 50 }
  if (userStore.isPlatformAdmin && createForm.institutionId !== null && createForm.institutionId !== undefined) {
    params.institutionId = createForm.institutionId
  }
  if (/^\d{6,}$/.test(String(keyword || '').trim())) {
    params.phone = String(keyword || '').trim()
  } else if (keyword) {
    params.nickname = String(keyword || '').trim()
  }
  const res = await getStudentList(params)
  studentOptions.value = (res.list || []).map((item) => ({
    id: item.id,
    label: `${item.nickname || item.realName || '未命名'}（${item.phone || '无手机号'}）`
  }))
}

const onStudentSelectVisible = (visible) => {
  if (!visible) return
  if (!studentOptions.value.length) searchStudents('')
}

const openCreateOrderDialog = async () => {
  resetCreateForm()
  studentOptions.value = []
  await loadCourseOptions()
  createDialogVisible.value = true
}

const handleCreateOrder = async () => {
  if (!createForm.studentId || !createForm.courseId) {
    ElMessage.warning('请选择学员和课程')
    return
  }

  const payload = {
    studentId: createForm.studentId,
    courseId: createForm.courseId,
    amount: createForm.amount,
    payType: createForm.payType,
    status: createForm.status,
    remark: createForm.remark
  }
  if (userStore.isPlatformAdmin && createForm.institutionId !== null && createForm.institutionId !== undefined) {
    payload.institutionId = createForm.institutionId
  }

  createLoading.value = true
  try {
    await createOrder(payload)
    ElMessage.success('订单创建成功')
    createDialogVisible.value = false
    await loadData()
  } finally {
    createLoading.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const listParams = {
      page: pagination.page,
      size: pagination.size,
      ...searchForm
    }
    if (!userStore.isPlatformAdmin || listParams.institutionId === null || listParams.institutionId === undefined) {
      delete listParams.institutionId
    }

    const res = await getOrderList(listParams)
    tableData.value = res.list || []
    pagination.total = res.total || 0
    const statsParams = {}
    if (userStore.isPlatformAdmin && searchForm.institutionId !== null && searchForm.institutionId !== undefined) {
      statsParams.institutionId = searchForm.institutionId
    }
    const s = await getOrderStats(statsParams)
    Object.assign(stats, s || {})
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.payType = ''
  searchForm.institutionId = null
  pagination.page = 1
  loadData()
}

const handlePageChange = () => {
  loadData()
}

const handleRefund = async (row) => {
  await ElMessageBox.confirm(`确认退款订单【${row.orderNo}】？`, '提示', { type: 'warning' })
  await refundOrder({ orderId: row.id })
  ElMessage.success('退款成功')
  loadData()
}

const handleExport = () => {
  ElMessage.info('导出功能开发中...')
}

onMounted(loadData)
</script>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
