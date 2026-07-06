<template>
  <div class="pay-result-page">
    <el-card class="pay-result-card">
      <template #header>
        <div class="header">
          <span>支付结果</span>
          <span class="order-no">订单号：{{ orderNo || '-' }}</span>
        </div>
      </template>

      <div v-loading="loading">
        <el-alert
          v-if="!studentToken"
          title="未检测到学员登录，请先登录后再查询订单状态"
          type="warning"
          :closable="false"
          style="margin-bottom: 12px"
        />

        <el-result :icon="resultIcon" :title="resultTitle" :sub-title="resultSubTitle">
          <template #extra>
            <el-space>
              <el-button @click="queryOrder">刷新结果</el-button>
              <el-button type="primary" @click="goCenter">返回学员中心</el-button>
              <el-button v-if="!studentToken" @click="goLogin">去登录</el-button>
            </el-space>
          </template>
        </el-result>

        <el-descriptions v-if="order.orderNo" :column="2" border>
          <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="支付方式">{{ payTypeMap[order.payType] || order.payType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">{{ statusMap[order.status] || order.status || '-' }}</el-descriptions-item>
          <el-descriptions-item label="订单金额">¥{{ order.amount || 0 }}</el-descriptions-item>
          <el-descriptions-item label="支付时间">{{ order.payTime || '-' }}</el-descriptions-item>
          <el-descriptions-item label="课程名称">{{ order.course?.title || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { studentOrderQuery, studentTokenKey } from '@/api/studentPortal'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const order = ref({})

const orderNo = computed(() => route.query.orderNo || '')
const studentToken = computed(() => localStorage.getItem(studentTokenKey) || '')

const statusMap = {
  pending: '待支付',
  paid: '已支付',
  refunding: '退款中',
  refunded: '已退款',
  cancelled: '已取消',
  expired: '已过期'
}

const payTypeMap = {
  wxpay: '微信支付',
  alipay: '支付宝',
  free: '免费'
}

const resultIcon = computed(() => {
  if (order.value.status === 'paid') return 'success'
  if (order.value.status === 'pending') return 'warning'
  if (!order.value.status) return 'info'
  return 'error'
})

const resultTitle = computed(() => {
  if (order.value.status === 'paid') return '支付成功'
  if (order.value.status === 'pending') return '支付处理中'
  if (!order.value.status) return '等待查询订单状态'
  return '支付未完成'
})

const resultSubTitle = computed(() => {
  if (order.value.status === 'paid') return '你可以返回学员中心查看已购课程。'
  if (order.value.status === 'pending') return '支付回调可能有延迟，请稍后刷新。'
  if (!order.value.status) return '点击“刷新结果”查询该订单最新状态。'
  return `当前状态：${statusMap[order.value.status] || order.value.status}`
})

const queryOrder = async () => {
  if (!orderNo.value) {
    ElMessage.warning('缺少订单号参数')
    return
  }
  if (!studentToken.value) {
    return
  }

  loading.value = true
  try {
    order.value = await studentOrderQuery(orderNo.value)
  } catch (err) {
    order.value = {}
  } finally {
    loading.value = false
  }
}

const goCenter = () => {
  router.push('/student-center')
}

const goLogin = () => {
  router.push('/student-login')
}

onMounted(queryOrder)
</script>

<style scoped>
.pay-result-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(120deg, #f6fbff 0%, #eef5ff 100%);
}

.pay-result-card {
  width: 920px;
  max-width: 100%;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.order-no {
  color: #666;
}
</style>