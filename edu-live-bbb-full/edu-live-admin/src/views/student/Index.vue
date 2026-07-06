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
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
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
        <el-form-item label="登录密码">
          <el-input v-model="createForm.password" type="password" show-password placeholder="至少6位" />
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

    <el-dialog v-model="editDialogVisible" title="修改学员" width="640px">
      <el-form :model="editForm" label-width="110px">
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" />
        </el-form-item>
        <el-form-item label="真实姓名">
          <el-input v-model="editForm.realName" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="editForm.phone" />
        </el-form-item>
        <el-form-item label="重置密码">
          <el-input v-model="editForm.password" type="password" show-password placeholder="不修改请留空，至少6位" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="editForm.region" />
        </el-form-item>
        <el-form-item label="归属销售">
          <el-select v-model="editForm.salesUserId" placeholder="不设置" clearable filterable style="width: 100%">
            <el-option v-for="item in salesOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分销层级">
          <el-select v-model="editForm.salesLevel" placeholder="不设置" clearable style="width: 100%">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号状态">
          <el-radio-group v-model="editForm.status">
            <el-radio :label="1">正常</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpdateStudent">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getStudentList, getStudentDetail, getStudentLearningRecord, createStudent, updateStudent } from '@/api/student'
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
const editDialogVisible = ref(false)
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
  password: '',
  email: '',
  region: '',
  salesUserId: null,
  salesLevel: null
})

const editForm = reactive({
  id: null,
  nickname: '',
  realName: '',
  phone: '',
  password: '',
  email: '',
  region: '',
  salesUserId: null,
  salesLevel: null,
  status: 1
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
    password: '',
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
  if (!createForm.phone) {
    ElMessage.warning('请填写学员手机号')
    return
  }

  if (!createForm.password || String(createForm.password).trim().length < 6) {
    ElMessage.warning('请填写至少6位学员登录密码')
    return
  }

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

const resetEditForm = () => {
  Object.assign(editForm, {
    id: null,
    nickname: '',
    realName: '',
    phone: '',
    password: '',
    email: '',
    region: '',
    salesUserId: null,
    salesLevel: null,
    status: 1
  })
}

const openEditDialog = async (row) => {
  resetEditForm()
  try {
    const detail = await getStudentDetail(row.id)
    Object.assign(editForm, {
      id: detail.id,
      nickname: detail.nickname || '',
      realName: detail.realName || '',
      phone: detail.phone || '',
      password: '',
      email: detail.email || '',
      region: detail.region || '',
      salesUserId: detail.salesUserId || null,
      salesLevel: detail.salesLevel || null,
      status: Number(detail.status === undefined ? 1 : detail.status)
    })
    salesOptions.value = await getSalesList({ institutionId: detail.institutionId || searchForm.institutionId || undefined })
    editDialogVisible.value = true
  } catch (err) {
    ElMessage.error('加载学员信息失败')
  }
}

const handleUpdateStudent = async () => {
  if (!editForm.id) {
    ElMessage.warning('缺少学员ID，无法保存')
    return
  }

  if (editForm.password && String(editForm.password).trim().length < 6) {
    ElMessage.warning('重置密码至少6位')
    return
  }

  if ((editForm.salesUserId && !editForm.salesLevel) || (!editForm.salesUserId && editForm.salesLevel)) {
    ElMessage.warning('设置分销时需要同时选择归属销售和分销层级')
    return
  }

  const payload = {
    id: editForm.id,
    nickname: editForm.nickname,
    realName: editForm.realName,
    phone: editForm.phone,
    email: editForm.email,
    region: editForm.region,
    salesUserId: editForm.salesUserId,
    salesLevel: editForm.salesLevel,
    status: editForm.status
  }

  if (editForm.password && String(editForm.password).trim()) {
    payload.password = String(editForm.password).trim()
  }

  await updateStudent(payload)
  ElMessage.success('学员信息已更新')
  editDialogVisible.value = false
  loadData()
}

onMounted(loadData)
</script>
