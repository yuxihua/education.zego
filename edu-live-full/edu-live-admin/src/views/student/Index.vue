<template>
  <div class="student-page">
    <el-card>
      <template #header><span>学员管理</span></template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="searchForm.nickname" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
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
      <el-table :data="recordList" border>
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column label="课程" min-width="200">
          <template #default="{ row }">{{ row.course?.title || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="100" />
        <el-table-column prop="payType" label="支付方式" width="110" />
        <el-table-column prop="status" label="订单状态" width="100" />
        <el-table-column prop="createdAt" label="下单时间" width="180" />
      </el-table>
      <el-empty v-if="!recordList.length" description="暂无学习记录" style="margin-top: 12px" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getStudentList, getStudentDetail, getStudentLearningRecord } from '@/api/student'

const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ phone: '', nickname: '' })
const pagination = reactive({ page: 1, size: 10, total: 0 })
const detailDialogVisible = ref(false)
const recordDialogVisible = ref(false)
const detailData = ref({})
const recordList = ref([])

const loadData = async () => {
  loading.value = true
  const res = await getStudentList({ ...searchForm, ...pagination })
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
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
    recordList.value = await getStudentLearningRecord(row.id)
    recordDialogVisible.value = true
  } catch (err) {
    ElMessage.error('加载学习记录失败')
  }
}

onMounted(loadData)
</script>
