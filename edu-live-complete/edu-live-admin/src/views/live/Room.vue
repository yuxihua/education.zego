<template>
  <div class="live-room-detail">
    <el-page-header @back="router.back()" :title="roomInfo?.title || '直播间详情'" />

    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="16">
        <el-card>
          <template #header><span>直播信息</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="房间ID">{{ roomInfo?.id }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="roomInfo?.status === 'living' ? 'danger' : 'info'">
                {{ roomInfo?.status === 'living' ? '直播中' : '已结束' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="讲师">{{ roomInfo?.teacherName }}</el-descriptions-item>
            <el-descriptions-item label="在线人数">{{ roomInfo?.onlineCount || 0 }}</el-descriptions-item>
            <el-descriptions-item label="开播时间">{{ roomInfo?.startTime }}</el-descriptions-item>
            <el-descriptions-item label="ZEGO房间号">{{ roomInfo?.zegoRoomId }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header><span>课件列表</span></template>
          <el-table :data="pptList" border size="small">
            <el-table-column prop="name" label="课件名称" />
            <el-table-column prop="type" label="类型" width="100" />
            <el-table-column prop="pageCount" label="页数" width="80" />
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button link type="primary">预览</el-button>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header><span>回放管理</span></template>
          <div v-if="replayInfo">
            <p>回放状态：<el-tag type="success">已生成</el-tag></p>
            <p style="margin-top: 10px">视频时长：{{ replayInfo.duration }}</p>
            <p style="margin-top: 10px">视频大小：{{ replayInfo.size }}</p>
            <el-button type="primary" style="margin-top: 15px; width: 100%">查看回放</el-button>
          </div>
          <el-empty v-else description="暂无回放" />
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header><span>实时数据</span></template>
          <div class="stats-item">
            <span>累计观看</span>
            <span class="stats-num">{{ stats?.totalView || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>最高在线</span>
            <span class="stats-num">{{ stats?.peakOnline || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>互动消息</span>
            <span class="stats-num">{{ stats?.messageCount || 0 }}</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getLiveRoomDetail, getLiveStats } from '@/api/live'

const route = useRoute()
const router = useRouter()
const roomId = route.params.id

const roomInfo = ref(null)
const pptList = ref([])
const replayInfo = ref(null)
const stats = ref(null)

onMounted(async () => {
  roomInfo.value = await getLiveRoomDetail(roomId)
  stats.value = await getLiveStats(roomId)
  pptList.value = roomInfo.value?.pptList || []
  replayInfo.value = roomInfo.value?.replayInfo || null
})
</script>

<style scoped>
.stats-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
.stats-item:last-child { border-bottom: none; }
.stats-num { font-weight: 700; color: #409EFF; }
</style>
