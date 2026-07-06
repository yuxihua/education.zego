<template>
  <div class="distribution-orders-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>分销订单结算</span>
          <el-button type="primary" @click="loadAll">刷新</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="filters" class="search-form">
        <el-form-item label="月份">
          <el-date-picker v-model="filters.month" type="month" value-format="YYYY-MM" placeholder="选择月份" clearable @change="loadSettlementStatus" />
        </el-form-item>
        <el-form-item label="销售" v-if="!isSalesRole">
          <el-select v-model="filters.salesUserId" placeholder="全部销售" clearable filterable style="width: 200px">
            <el-option v-for="s in salesList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="层级">
          <el-select v-model="filters.salesLevel" placeholder="全部层级" clearable style="width: 130px">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="订单号/学员/课程" clearable @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="warning" v-if="!isSalesRole" @click="handleLockSettlement">锁定当月结算</el-button>
          <el-button v-if="!isSalesRole" @click="handleUnlockSettlement">解锁当月结算</el-button>
          <el-button type="success" @click="handleExport">导出订单提成</el-button>
        </el-form-item>
      </el-form>

      <div class="settlement-status" v-if="filters.month">
        <el-tag v-if="settlementStatus.isLocked" type="danger">
          {{ filters.month }} 已锁定（{{ settlementStatus.lockAt || '时间未知' }}）
        </el-tag>
        <el-tag v-else type="info">
          {{ filters.month }} 未锁定（实时计算）
        </el-tag>
      </div>

      <el-row :gutter="12" class="summary-row">
        <el-col :span="8"><el-tag type="info">订单数：{{ summary.totalOrders }}</el-tag></el-col>
        <el-col :span="8"><el-tag type="success">订单金额：¥{{ summary.totalAmount }}</el-tag></el-col>
        <el-col :span="8"><el-tag type="warning">提成金额：¥{{ summary.totalCommission }}</el-tag></el-col>
      </el-row>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="orderNo" label="订单号" min-width="170" />
        <el-table-column prop="payTime" label="支付时间" width="170" />
        <el-table-column prop="courseName" label="课程" min-width="160" />
        <el-table-column prop="studentName" label="学员" width="120" />
        <el-table-column prop="salesUserName" label="销售" width="130" />
        <el-table-column prop="salesLevel" label="层级" width="80" />
        <el-table-column prop="amount" label="订单金额" width="110" />
        <el-table-column prop="teamSalesAmount" label="团队销量" width="120" />
        <el-table-column prop="monthlyOrderSeq" label="月序号" width="90" />
        <el-table-column prop="commissionRate" label="提成比例" width="100">
          <template #default="{ row }">{{ Number(row.commissionRate || 0) * 100 }}%</template>
        </el-table-column>
        <el-table-column prop="commissionAmount" label="提成金额" width="110" />
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end"
        @size-change="loadOrders"
        @current-change="loadOrders"
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  exportDistributionOrders,
  getDistributionOrders,
  getDistributionSettlementStatus,
  getSalesList,
  lockDistributionSettlement,
  unlockDistributionSettlement
} from '@/api/distribution'

const userStore = useUserStore()
const isSalesRole = computed(() => userStore.userInfo?.role === 'sales')

const loading = ref(false)
const tableData = ref([])
const salesList = ref([])
const summary = reactive({ totalOrders: 0, totalAmount: 0, totalCommission: 0 })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const filters = reactive({ month: '', salesUserId: null, salesLevel: null, keyword: '' })
const settlementStatus = reactive({ isLocked: false, lockAt: '' })

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const loadSales = async () => {
  if (isSalesRole.value) {
    salesList.value = []
    return
  }
  salesList.value = await getSalesList({})
}

const loadSettlementStatus = async () => {
  if (!filters.month) {
    settlementStatus.isLocked = false
    settlementStatus.lockAt = ''
    return
  }
  try {
    const res = await getDistributionSettlementStatus({ month: filters.month })
    settlementStatus.isLocked = Boolean(res.isLocked || res.locked)
    settlementStatus.lockAt = res.lockAt || res.lockedAt || ''
  } catch (err) {
    settlementStatus.isLocked = false
    settlementStatus.lockAt = ''
  }
}

const loadOrders = async () => {
  loading.value = true
  try {
    const res = await getDistributionOrders({
      page: pagination.page,
      size: pagination.size,
      month: filters.month,
      salesUserId: filters.salesUserId,
      salesLevel: filters.salesLevel,
      keyword: filters.keyword
    })

    tableData.value = res.list || []
    pagination.total = Number(res.pagination?.total || 0)
    Object.assign(summary, {
      totalOrders: Number(res.summary?.totalOrders || 0),
      totalAmount: Number(res.summary?.totalAmount || 0),
      totalCommission: Number(res.summary?.totalCommission || 0)
    })
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  pagination.page = 1
  await Promise.all([loadOrders(), loadSettlementStatus()])
}

const handleReset = async () => {
  filters.month = ''
  filters.salesUserId = null
  filters.salesLevel = null
  filters.keyword = ''
  pagination.page = 1
  await Promise.all([loadOrders(), loadSettlementStatus()])
}

const handleLockSettlement = async () => {
  if (!filters.month) {
    ElMessage.warning('请先选择结算月份')
    return
  }
  await lockDistributionSettlement({ month: filters.month })
  ElMessage.success('当月分销结算已锁定')
  await Promise.all([loadSettlementStatus(), loadOrders()])
}

const handleUnlockSettlement = async () => {
  if (!filters.month) {
    ElMessage.warning('请先选择结算月份')
    return
  }
  await unlockDistributionSettlement({ month: filters.month })
  ElMessage.success('当月分销结算已解锁')
  await Promise.all([loadSettlementStatus(), loadOrders()])
}

const handleExport = async () => {
  const { blob, filename } = await exportDistributionOrders({
    month: filters.month,
    salesUserId: filters.salesUserId,
    salesLevel: filters.salesLevel,
    keyword: filters.keyword
  })
  downloadBlob(blob, filename)
  ElMessage.success('导出成功')
}

const loadAll = async () => {
  await Promise.all([loadSales(), loadOrders(), loadSettlementStatus()])
}

onMounted(loadAll)
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

.summary-row {
  margin-bottom: 12px;
}

.settlement-status {
  margin-bottom: 12px;
}
</style>
