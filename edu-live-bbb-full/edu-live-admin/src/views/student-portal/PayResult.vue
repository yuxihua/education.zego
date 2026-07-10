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
        <el-alert
          v-if="queryError"
          :title="queryError"
          type="error"
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

    <div class="mobile-pay-bar">
      <el-button class="mobile-refresh-btn" :loading="loading" @click="queryOrder">刷新结果</el-button>
      <el-button class="mobile-center-btn" type="primary" @click="goCenter">返回学员中心</el-button>
      <el-button v-if="!studentToken" class="mobile-login-btn" @click="goLogin">去登录</el-button>
    </div>
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
const queryError = ref('')

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

const waitMs = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const queryOrderWithRetry = async (maxRetries = 2) => {
  let lastErr = null
  for (let i = 0; i <= maxRetries; i += 1) {
    try {
      return await studentOrderQuery(orderNo.value)
    } catch (err) {
      lastErr = err
      if (i < maxRetries) {
        await waitMs(350 * (2 ** i))
      }
    }
  }
  throw lastErr
}

const queryOrder = async () => {
  if (loading.value) return
  if (!orderNo.value) {
    ElMessage.warning('缺少订单号参数')
    return
  }
  if (!studentToken.value) {
    return
  }

  loading.value = true
  queryError.value = ''
  try {
    order.value = await queryOrderWithRetry(2)
  } catch (err) {
    order.value = {}
    queryError.value = '订单查询失败，网络可能不稳定，请点击“刷新结果”重试'
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
  --mobile-btn-height: 42px;
  --mobile-gap: 8px;
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

@media (max-width: 1024px) {
  .pay-result-page {
    align-items: flex-start;
    padding: 16px 12px;
  }
}

@media (max-width: 768px) {
  .pay-result-page {
    padding: 10px 8px;
    padding-bottom: 84px;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .order-no {
    font-size: 12px;
    word-break: break-all;
  }

  :deep(.el-result__title p) {
    font-size: 20px;
  }

  :deep(.el-result__subtitle p) {
    font-size: 13px;
  }

  :deep(.el-space) {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  :deep(.el-space .el-button) {
    flex: 1;
    min-width: 110px;
  }

  :deep(.el-descriptions__label),
  :deep(.el-descriptions__content) {
    font-size: 12px;
    word-break: break-all;
  }

  .mobile-pay-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    gap: var(--mobile-gap);
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.08);
    animation: bar-slide-up 220ms ease-out;
  }

  .mobile-refresh-btn,
  .mobile-center-btn,
  .mobile-login-btn {
    flex: 1;
    min-height: var(--mobile-btn-height);
  }
}

@keyframes bar-slide-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 769px) {
  .mobile-pay-bar {
    display: none;
  }
}
</style>