<template>
  <div class="student-page">
    <el-card>
      <template #header><span>学员管理</span></template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="机构ID" v-if="userStore.isPlatformAdmin">
          <el-input-number v-model="searchForm.institutionId" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="searchForm.nickname" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="success" @click="openCreateDialog">新增学员</el-button>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="avatar" label="头像" width="80">
          <template #default="{ row }">
            <el-avatar :size="40" :src="row.avatar" />
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="courseCount" label="已购课程" width="100" />
        <el-table-column prop="studyDuration" label="学习时长" width="120" />
        <el-table-column prop="lastStudyTime" label="最近学习" width="160" />
        <el-table-column prop="createTime" label="注册时间" width="160" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleDetail(row)">详情</el-button>
            <el-button link type="primary" @click="handleRecord(row)">学习记录</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        style="margin-top: 20px; justify-content: flex-end"
        @change="loadData"
      />
    </el-card>

    <el-dialog v-model="detailDialogVisible" title="学员详情" width="600px">
      <el-descriptions :column="2" border v-if="detailData.id">
        <el-descriptions-item label="学员ID">{{ detailData.id }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ detailData.nickname || '-' }}</el-descriptions-item>
        <el-descriptions-item label="真实姓名">{{ detailData.realName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ detailData.phone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱">{{ detailData.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="地区">{{ detailData.region || '-' }}</el-descriptions-item>
        <el-descriptions-item label="已购课程">{{ detailData.courseCount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ detailData.createTime || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-empty v-else description="暂无数据" />
    </el-dialog>

    <el-dialog v-model="recordDialogVisible" title="学习记录" width="800px">
      <el-row :gutter="12" style="margin-bottom: 12px">
        <el-col :span="6"><el-tag type="info">已购课程：{{ recordSummary.paidCourseCount }}</el-tag></el-col>
        <el-col :span="6"><el-tag type="success">累计消费：¥{{ recordSummary.totalAmount }}</el-tag></el-col>
        <el-col :span="6"><el-tag>已提交作业：{{ recordSummary.homeworkSubmitted }}</el-tag></el-col>
        <el-col :span="6"><el-tag type="warning">已批改：{{ recordSummary.homeworkGraded }}</el-tag></el-col>
      </el-row>
      <el-table :data="recordList" border>
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column prop="courseName" label="课程" min-width="180" />
        <el-table-column label="金额" width="110">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column label="支付方式" width="110">
          <template #default="{ row }">{{ payTypeMap[row.payType] || row.payType || '-' }}</template>
        </el-table-column>
        <el-table-column label="订单状态" width="110">
          <template #default="{ row }">{{ statusMap[row.status] || row.status || '-' }}</template>
        </el-table-column>
        <el-table-column prop="homeworkSubmitted" label="作业提交" width="100" />
        <el-table-column prop="homeworkGraded" label="作业批改" width="100" />
        <el-table-column prop="lastLearningTime" label="最近学习" width="170" />
        <el-table-column prop="paidAt" label="支付时间" width="170" />
      </el-table>
      <el-empty v-if="!recordList.length" description="暂无学习记录" style="margin-top: 12px" />
    </el-dialog>

    <el-dialog v-model="createDialogVisible" title="新增学员" width="640px">
      <el-form :model="createForm" label-width="110px">
        <el-form-item label="昵称">
          <el-input v-model="createForm.nickname" />
        </el-form-item>
        <el-form-item label="真实姓名">
          <el-input v-model="createForm.realName" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="createForm.phone" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createForm.email" />
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="createForm.region" />
        </el-form-item>
        <el-form-item label="归属销售">
          <el-select v-model="createForm.salesUserId" placeholder="不设置" clearable filterable style="width: 100%">
            <el-option v-for="item in salesOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分销层级">
          <el-select v-model="createForm.salesLevel" placeholder="不设置" clearable style="width: 100%">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateStudent">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getStudentList, getStudentDetail, getStudentLearningRecord, createStudent } from '@/api/student'
import { getSalesList } from '@/api/distribution'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ phone: '', nickname: '', institutionId: null })
const pagination = reactive({ page: 1, size: 10, total: 0 })
const detailDialogVisible = ref(false)
const recordDialogVisible = ref(false)
const createDialogVisible = ref(false)
const detailData = ref({})
const recordList = ref([])
const salesOptions = ref([])
const recordSummary = reactive({
  paidCourseCount: 0,
  totalAmount: 0,
  homeworkSubmitted: 0,
  homeworkGraded: 0
})

const payTypeMap = {
  wxpay: '微信支付',
  alipay: '支付宝',
  free: '免费'
}

const statusMap = {
  pending: '待支付',
  paid: '已支付',
  refunding: '退款中',
  refunded: '已退款',
  cancelled: '已取消',
  expired: '已过期'
}

const createForm = reactive({
  nickname: '',
  realName: '',
  phone: '',
  email: '',
  region: '',
  salesUserId: null,
  salesLevel: null
})

const loadData = async () => {
  loading.value = true
  const params = { ...searchForm, ...pagination }
  if (!userStore.isPlatformAdmin || params.institutionId === null || params.institutionId === undefined) {
    delete params.institutionId
  }
  const res = await getStudentList(params)
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
}

const handleReset = () => {
  searchForm.phone = ''
  searchForm.nickname = ''
  searchForm.institutionId = null
  pagination.page = 1
  loadData()
}

const handleDetail = async (row) => {
  try {
    detailData.value = await getStudentDetail(row.id)
    detailDialogVisible.value = true
  } catch (err) {
    ElMessage.error('加载学员详情失败')
  }
}

const handleRecord = async (row) => {
  try {
    const res = await getStudentLearningRecord(row.id)
    recordList.value = res?.list || (Array.isArray(res) ? res : [])
    Object.assign(recordSummary, {
      paidCourseCount: Number(res?.summary?.paidCourseCount || recordList.value.length || 0),
      totalAmount: Number(res?.summary?.totalAmount || 0),
      homeworkSubmitted: Number(res?.summary?.homeworkSubmitted || 0),
      homeworkGraded: Number(res?.summary?.homeworkGraded || 0)
    })
    recordDialogVisible.value = true
  } catch (err) {
    ElMessage.error('加载学习记录失败')
  }
}

const resetCreateForm = () => {
  Object.assign(createForm, {
    nickname: '',
    realName: '',
    phone: '',
    email: '',
    region: '',
    salesUserId: null,
    salesLevel: null
  })
}

const openCreateDialog = async () => {
  resetCreateForm()
  try {
    salesOptions.value = await getSalesList({ institutionId: searchForm.institutionId || undefined })
  } catch (err) {
    salesOptions.value = []
  }
  createDialogVisible.value = true
}

const handleCreateStudent = async () => {
  if ((createForm.salesUserId && !createForm.salesLevel) || (!createForm.salesUserId && createForm.salesLevel)) {
    ElMessage.warning('设置分销时需要同时选择归属销售和分销层级')
    return
  }

  const payload = { ...createForm }
  if (userStore.isPlatformAdmin && searchForm.institutionId !== null && searchForm.institutionId !== undefined) {
    payload.institutionId = searchForm.institutionId
  }

  await createStudent(payload)
  ElMessage.success('学员创建成功')
  createDialogVisible.value = false
  loadData()
}

onMounted(loadData)
</script>
