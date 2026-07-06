<template>
  <div class="distribution-hierarchy-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>分销层级关系图（树形）</span>
          <div class="header-actions">
            <el-date-picker v-model="month" type="month" value-format="YYYY-MM" placeholder="选择月份" clearable style="width: 140px" />
            <el-button @click="clearTreeLinkFilters">清空联动筛选</el-button>
            <el-button type="primary" @click="loadTree">刷新树图</el-button>
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
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getDistributionTree } from '@/api/distribution'

const router = useRouter()
const month = ref('')
const treeData = ref([])
const treeProps = { children: 'children', label: 'label' }
const treeLinkedFilterText = ref('')
const treeStats = reactive({ orderCount: 0, commissionAmount: 0 })

const loadTree = async () => {
  const res = await getDistributionTree({ month: month.value })
  treeData.value = res.tree || []
  Object.assign(treeStats, {
    orderCount: Number(res.stats?.orderCount || 0),
    commissionAmount: Number(res.stats?.commissionAmount || 0)
  })
}

const handleTreeNodeClick = (node) => {
  if (!node || !node.nodeType) return

  const query = {}
  if (month.value) query.month = month.value

  if (node.nodeType === 'level') {
    query.salesLevel = node.salesLevel || ''
    treeLinkedFilterText.value = `层级：${node.salesLevel}级`
  }

  if (node.nodeType === 'sales') {
    query.salesLevel = node.salesLevel || ''
    query.salesUserId = node.salesUserId || ''
    treeLinkedFilterText.value = `层级：${node.salesLevel}级，销售ID：${node.salesUserId}`
  }

  if (node.nodeType === 'student') {
    query.salesLevel = node.salesLevel || ''
    query.salesUserId = node.salesUserId || ''
    query.keyword = String(node.studentId || '')
    treeLinkedFilterText.value = `层级：${node.salesLevel}级，销售ID：${node.salesUserId}，学员ID：${node.studentId}`
  }

  router.push({ path: '/distribution/orders', query })
}

const clearTreeLinkFilters = () => {
  treeLinkedFilterText.value = ''
  router.push({ path: '/distribution/orders', query: month.value ? { month: month.value } : {} })
}

onMounted(loadTree)
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

.tree-link-state {
  margin-bottom: 10px;
}
</style>
