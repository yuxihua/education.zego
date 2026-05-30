<template>
  <div class="order-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>订单财务</span>
          <el-button type="success" @click="handleExport">导出报表</el-button>
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
          <template #default="{ row }">{{ { wxpay: '微信支付', alipay: '支付宝' }[row.payType] }}</template>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getOrderList, getOrderStats, refundOrder } from '@/api/order'

const loading = ref(false)
const tableData = ref([])
const stats = reactive({ todayCount: 0, todayAmount: 0, monthCount: 0, monthAmount: 0 })
const searchForm = reactive({ keyword: '', status: '', payType: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

const loadData = async () => {
  loading.value = true
  try {
    const res = await getOrderList({
      page: pagination.page,
      size: pagination.size,
      ...searchForm
    })
    tableData.value = res.list || []
    pagination.total = res.total || 0
    const s = await getOrderStats()
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
