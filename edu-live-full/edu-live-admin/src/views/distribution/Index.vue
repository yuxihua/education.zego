<template>
  <div class="distribution-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>分销管理</span>
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
          <el-button type="success" @click="exportOrders">导出订单提成</el-button>
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

    <el-card v-if="!isSalesRole" style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>三级提成配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-table :data="configList" border>
        <el-table-column prop="level" label="层级" width="90">
          <template #default="{ row }">{{ row.level }}级</template>
        </el-table-column>
        <el-table-column label="阈值（团队月销量）" width="190">
          <template #default="{ row }">
            <el-input-number v-model="row.tierThreshold" :min="0" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="第一档比例" width="180">
          <template #default="{ row }">
            <el-input-number v-model="row.rateTier1" :min="0" :max="1" :step="0.001" :precision="4" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="第二档比例" width="180">
          <template #default="{ row }">
            <el-input-number v-model="row.rateTier2" :min="0" :max="1" :step="0.001" :precision="4" controls-position="right" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="!isSalesRole" style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>分销层级关系图（树形）</span>
          <div class="header-actions">
            <el-button @click="clearTreeLinkFilters">清空联动筛选</el-button>
            <el-button @click="loadTree">刷新树图</el-button>
          </div>
        </div>
      </template>

      <div class="tree-link-state" v-if="treeLinkedFilterText">
        <el-tag type="info">当前联动筛选：{{ treeLinkedFilterText }}</el-tag>
      </div>
      <div class="tree-link-state" v-if="treeStats.orderCount || treeStats.commissionAmount">
        <el-tag type="success">树图统计：月订单 {{ treeStats.orderCount }} 单，月提成 ¥{{ treeStats.commissionAmount }}</el-tag>
      </div>

      <el-tree
        :data="treeData"
        node-key="id"
        default-expand-all
        :props="treeProps"
        empty-text="暂无层级关系数据"
        @node-click="handleTreeNodeClick"
      />
    </el-card>

    <el-card v-if="!isSalesRole" style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>销售与学员归属</span>
          <el-button type="primary" @click="openCreateSales">新增销售账号</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="assignForm" class="search-form">
        <el-form-item label="学员">
          <el-select
            v-model="assignForm.studentId"
            placeholder="按姓名/手机号搜索学员"
            filterable
            remote
            clearable
            reserve-keyword
            style="width: 320px"
            :remote-method="searchStudents"
            @visible-change="handleStudentSelectorVisible"
          >
            <el-option v-for="s in studentOptions" :key="s.id" :label="s.label" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="销售">
          <el-select v-model="assignForm.salesUserId" placeholder="选择销售" filterable style="width: 220px">
            <el-option v-for="s in salesList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分销层级">
          <el-select v-model="assignForm.salesLevel" placeholder="选择层级" style="width: 130px">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitAssign">保存归属</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="createSalesVisible" title="新增销售账号" width="520px">
      <el-form :model="createSalesForm" label-width="100px">
        <el-form-item label="登录账号"><el-input v-model="createSalesForm.username" /></el-form-item>
        <el-form-item label="登录密码"><el-input v-model="createSalesForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="createSalesForm.nickname" /></el-form-item>
        <el-form-item label="销售层级">
          <el-select v-model="createSalesForm.salesLevel" style="width: 100%" @change="onSalesLevelChange">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="上级销售" v-if="createSalesForm.salesLevel > 1">
          <el-select v-model="createSalesForm.parentSalesUserId" placeholder="请选择上级销售" style="width: 100%" filterable>
            <el-option
              v-for="s in parentSalesOptions"
              :key="s.id"
              :label="`${s.name}（${s.username}）`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号"><el-input v-model="createSalesForm.phone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createSalesVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateSales">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import {
  assignStudentSales,
  createSalesUser,
  getDistributionConfig,
  getDistributionOrders,
  getDistributionSettlementStatus,
  getDistributionTree,
  getSalesList,
  lockDistributionSettlement,
  searchDistributionStudents,
  saveDistributionConfig,
  unlockDistributionSettlement
} from '@/api/distribution'

const userStore = useUserStore()
const isSalesRole = computed(() => userStore.userInfo?.role === 'sales')

const loading = ref(false)
const tableData = ref([])
const summary = reactive({ totalOrders: 0, totalAmount: 0, totalCommission: 0 })
const pagination = reactive({ page: 1, size: 20, total: 0 })

const filters = reactive({ month: '', salesUserId: null, salesLevel: null, keyword: '' })

const configList = ref([])
const salesList = ref([])
const treeData = ref([])
const treeProps = { children: 'children', label: 'label' }
const studentOptions = ref([])
const treeLinkedFilterText = ref('')
const treeStats = reactive({ orderCount: 0, commissionAmount: 0 })
const settlementStatus = reactive({ isLocked: false, lockAt: '' })

const assignForm = reactive({ studentId: null, salesUserId: null, salesLevel: 1 })

const createSalesVisible = ref(false)
const createSalesForm = reactive({ username: '', password: '', nickname: '', phone: '', salesLevel: 1, parentSalesUserId: null })

const parentSalesOptions = computed(() => {
  const parentLevel = Number(createSalesForm.salesLevel || 1) - 1
  if (parentLevel < 1) return []
  return (salesList.value || []).filter((item) => Number(item.salesLevel || 0) === parentLevel)
})

const loadSales = async () => {
  if (!userStore.userInfo) return
  salesList.value = await getSalesList({})
}

const loadConfig = async () => {
  if (isSalesRole.value) return
  configList.value = await getDistributionConfig({})
}

const loadTree = async () => {
  if (isSalesRole.value) return
  const res = await getDistributionTree({ month: filters.month })
  treeData.value = res.tree || []
  Object.assign(treeStats, {
    orderCount: Number(res.stats?.orderCount || 0),
    commissionAmount: Number(res.stats?.commissionAmount || 0)
  })
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

const searchStudents = async (keyword = '') => {
  studentOptions.value = await searchDistributionStudents({ keyword })
}

const handleStudentSelectorVisible = (visible) => {
  if (!visible) return
  if (!studentOptions.value.length) {
    searchStudents('')
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

const handleTreeNodeClick = (node) => {
  if (!node || !node.nodeType) return

  if (node.nodeType === 'level') {
    filters.salesLevel = node.salesLevel || null
    if (!isSalesRole.value) {
      filters.salesUserId = null
    }
    treeLinkedFilterText.value = `层级：${node.salesLevel}级`
  }

  if (node.nodeType === 'sales') {
    filters.salesLevel = node.salesLevel || null
    if (!isSalesRole.value) {
      filters.salesUserId = node.salesUserId || null
    }
    treeLinkedFilterText.value = `层级：${node.salesLevel}级，销售ID：${node.salesUserId}`
  }

  if (node.nodeType === 'student') {
    filters.salesLevel = node.salesLevel || null
    if (!isSalesRole.value) {
      filters.salesUserId = node.salesUserId || null
    }
    if (node.studentId) {
      filters.keyword = String(node.studentId)
    }
    treeLinkedFilterText.value = `层级：${node.salesLevel}级，销售ID：${node.salesUserId}，学员ID：${node.studentId}`
  }

  pagination.page = 1
  loadOrders()
}

const clearTreeLinkFilters = () => {
  filters.salesLevel = null
  filters.salesUserId = null
  filters.keyword = ''
  treeLinkedFilterText.value = ''
  pagination.page = 1
  loadOrders()
}

const handleSearch = () => {
  pagination.page = 1
  loadOrders()
  loadTree()
  loadSettlementStatus()
}

const handleReset = () => {
  filters.month = ''
  filters.salesUserId = null
  filters.salesLevel = null
  filters.keyword = ''
  pagination.page = 1
  loadOrders()
  loadTree()
  loadSettlementStatus()
}

const handleLockSettlement = async () => {
  if (!filters.month) {
    ElMessage.warning('请先选择结算月份')
    return
  }
  await lockDistributionSettlement({ month: filters.month })
  ElMessage.success('当月分销结算已锁定')
  await Promise.all([loadSettlementStatus(), loadOrders(), loadTree()])
}

const handleUnlockSettlement = async () => {
  if (!filters.month) {
    ElMessage.warning('请先选择结算月份')
    return
  }
  await unlockDistributionSettlement({ month: filters.month })
  ElMessage.success('当月分销结算已解锁')
  await Promise.all([loadSettlementStatus(), loadOrders(), loadTree()])
}

const saveConfig = async () => {
  await saveDistributionConfig({ configs: configList.value })
  ElMessage.success('分销提成配置已保存')
}

const submitAssign = async () => {
  if (!assignForm.studentId || !assignForm.salesUserId || !assignForm.salesLevel) {
    ElMessage.warning('请填写完整归属信息')
    return
  }
  await assignStudentSales(assignForm)
  ElMessage.success('学员分销归属已设置')
  await loadTree()
}

const onSalesLevelChange = () => {
  if (Number(createSalesForm.salesLevel || 1) <= 1) {
    createSalesForm.parentSalesUserId = null
  }
}

const openCreateSales = () => {
  Object.assign(createSalesForm, {
    username: '',
    password: '',
    nickname: '',
    phone: '',
    salesLevel: 1,
    parentSalesUserId: null
  })
  createSalesVisible.value = true
}

const submitCreateSales = async () => {
  if (Number(createSalesForm.salesLevel || 1) > 1 && !createSalesForm.parentSalesUserId) {
    ElMessage.warning('二级/三级销售必须选择上级销售')
    return
  }
  await createSalesUser(createSalesForm)
  ElMessage.success('销售账号创建成功')
  createSalesVisible.value = false
  await loadSales()
}

const exportOrders = () => {
  const params = new URLSearchParams()
  if (filters.month) params.set('month', filters.month)
  if (filters.salesUserId) params.set('salesUserId', String(filters.salesUserId))
  if (filters.salesLevel) params.set('salesLevel', String(filters.salesLevel))
  if (filters.keyword) params.set('keyword', filters.keyword)

  const token = localStorage.getItem('token') || ''
  fetch(`/api/distribution/orders/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(async (res) => {
    if (!res.ok) {
      ElMessage.error('导出失败')
      return
    }
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="?([^";]+)"?/i)
    const filename = match?.[1] || 'distribution_orders.csv'

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  }).catch(() => ElMessage.error('导出失败'))
}

const loadAll = async () => {
  await Promise.all([loadSales(), loadConfig(), loadOrders(), loadTree(), loadSettlementStatus()])
}

onMounted(loadAll)
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-form {
  margin-bottom: 12px;
}

.summary-row {
  margin-bottom: 12px;
}

.tree-link-state {
  margin-bottom: 10px;
}

.settlement-status {
  margin-bottom: 12px;
}
</style>
