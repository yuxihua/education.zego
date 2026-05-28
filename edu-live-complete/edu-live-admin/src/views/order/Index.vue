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
          <el-statistic title="今日营收" :value="stats.todayAmount" prefix="\u00A5" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="本月订单" :value="stats.monthCount" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="本月营收" :value="stats.monthAmount" prefix="\u00A5" />
        </el-col>
      </el-row>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column prop="studentName" label="学员" width="120" />
        <el-table-column prop="courseName" label="课程" min-width="200" />
        <el-table-column prop="amount" label="实付金额" width="120">
          <template #default="{ row }"><strong style="color: #f56c6c">\u00A5{{ row.amount }}</strong></template>
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

const loadData = async () => {
  loading.value = true
  const res = await getOrderList({ page: 1, size: 20 })
  tableData.value = res.list
  const s = await getOrderStats()
  Object.assign(stats, s)
  loading.value = false
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
