<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="6" v-for="item in statsCards" :key="item.title">
        <el-card shadow="hover" :body-style="{ padding: '20px' }">
          <div class="stat-card">
            <div class="stat-icon" :style="{ background: item.color }">
              <el-icon size="28" color="#fff"><component :is="item.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ item.value }}</div>
              <div class="stat-title">{{ item.title }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card title="今日直播">
          <template #header><span>今日直播课程</span></template>
          <el-table :data="todayLives" size="small">
            <el-table-column prop="title" label="课程名称" />
            <el-table-column prop="teacherName" label="讲师" width="120" />
            <el-table-column prop="startTime" label="开播时间" width="160" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'live' ? 'danger' : row.status === 'upcoming' ? 'primary' : 'success'">
                  {{ statusMap[row.status] }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>最近订单</span></template>
          <el-table :data="recentOrders" size="small">
            <el-table-column prop="orderNo" label="订单号" />
            <el-table-column prop="courseName" label="课程" />
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">¥{{ row.amount }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'paid' ? 'success' : 'warning'">
                  {{ row.status === 'paid' ? '已支付' : '待支付' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getLiveList } from '@/api/live'
import { getOrderList } from '@/api/order'

const statsCards = ref([
  { title: '今日直播', value: 12, icon: 'VideoCamera', color: '#ff6b6b' },
  { title: '在班学员', value: 3456, icon: 'User', color: '#4ecdc4' },
  { title: '今日订单', value: 89, icon: 'ShoppingCart', color: '#45b7d1' },
  { title: '本月营收', value: '¥128,500', icon: 'Money', color: '#f9ca24' }
])

const statusMap = { live: '直播中', upcoming: '即将开始', ended: '已结束' }
const todayLives = ref([])
const recentOrders = ref([])

onMounted(async () => {
  const lives = await getLiveList({ page: 1, size: 5, date: 'today' })
  todayLives.value = lives.list || []
  const orders = await getOrderList({ page: 1, size: 5 })
  recentOrders.value = orders.list || []
})
</script>

<style scoped>
.stat-card { display: flex; align-items: center; gap: 16px; }
.stat-icon { width: 56px; height: 56px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.stat-value { font-size: 28px; font-weight: 700; color: #333; }
.stat-title { font-size: 14px; color: #999; margin-top: 4px; }
</style>
