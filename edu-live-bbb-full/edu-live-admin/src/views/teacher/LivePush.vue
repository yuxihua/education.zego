<template>
  <div class="bbb-live-page">
    <el-card class="header-card" shadow="never">
      <template #header>
        <div class="header-row">
          <h2>教师直播间（BBB）</h2>
          <el-tag type="success">BigBlueButton</el-tag>
        </div>
      </template>

      <el-descriptions :column="2" border>
        <el-descriptions-item label="直播间ID">{{ roomId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="会议ID">{{ meetingID || '-' }}</el-descriptions-item>
        <el-descriptions-item label="课程名称">{{ roomInfo?.course?.title || roomInfo?.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="主讲老师">{{ roomInfo?.anchorName || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="action-card" shadow="never">
      <div class="action-row">
        <el-button v-if="canManageMeeting" type="primary" :loading="creating" @click="createMeeting">创建会议</el-button>
        <el-button type="success" :loading="joining" @click="joinMeeting">{{ joinButtonText }}</el-button>
        <el-button v-if="canManageMeeting" type="danger" :loading="ending" @click="endMeeting">结束会议</el-button>
      </div>
      <p class="tip">{{ meetingTip }}</p>
    </el-card>

    <el-card shadow="never">
      <template #header>快捷链接</template>
      <el-input v-model="joinUrl" readonly :placeholder="joinPlaceholder" />
      <div class="quick-actions">
        <el-button :disabled="!joinUrl" @click="copyJoinUrl">复制链接</el-button>
        <el-button :disabled="!joinUrl" type="primary" @click="openJoinUrl">打开链接</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/api/request'
import { getLiveRoomDetail } from '@/api/live'

const route = useRoute()
const roomId = computed(() => route.params.id)

const roomInfo = ref(null)
const meetingID = ref('')
const joinUrl = ref('')
const creating = ref(false)
const joining = ref(false)
const ending = ref(false)
const joinRole = computed(() => (String(route.query.mode || '').toLowerCase() === 'audience' ? 'attendee' : 'moderator'))
const canManageMeeting = computed(() => joinRole.value === 'moderator')
const joinButtonText = computed(() => (joinRole.value === 'moderator' ? '主持人入会' : '听众入会'))
const joinPlaceholder = computed(() => `点击${joinButtonText.value}后会生成链接`)
const meetingTip = computed(() => {
  if (joinRole.value === 'moderator') {
    return '说明：首次入会会自动创建 BBB 会议并切换直播状态。'
  }
  return '说明：当前为听众模式，不会自动创建会议，请在老师开课后进入。'
})

const ensureMeetingReady = async () => {
  if (!roomId.value) return
  await request.post(`/bbb/meeting/${encodeURIComponent(roomId.value)}/create`)
  await request.post(`/live/room/${encodeURIComponent(roomId.value)}/start`, {})
}

const loadRoom = async () => {
  if (!roomId.value) return
  roomInfo.value = await getLiveRoomDetail(roomId.value)
  meetingID.value = roomInfo.value?.zegoRoomId || String(roomId.value)
}

const createMeeting = async () => {
  if (!canManageMeeting.value) return
  if (!roomId.value) return
  creating.value = true
  try {
    await ensureMeetingReady()
    await loadRoom()
    ElMessage.success('BBB 会议创建成功')
  } finally {
    creating.value = false
  }
}

const joinMeeting = async () => {
  if (!roomId.value) return
  joining.value = true
  try {
    if (canManageMeeting.value) {
      await ensureMeetingReady()
    }

    const res = await request.get(`/bbb/join/${encodeURIComponent(roomId.value)}`, {
      params: { role: joinRole.value }
    })
    joinUrl.value = res.joinUrl || ''
    meetingID.value = res.meetingID || meetingID.value
    if (!joinUrl.value) {
      ElMessage.error('未获取到入会链接')
      return
    }
    window.open(joinUrl.value, '_blank', 'noopener')
    ElMessage.success(joinRole.value === 'moderator' ? '正在打开 BBB 主持人会议' : '正在打开 BBB 课堂')
  } finally {
    joining.value = false
  }
}

const endMeeting = async () => {
  if (!canManageMeeting.value) return
  if (!roomId.value) return
  ending.value = true
  try {
    const results = await Promise.allSettled([
      request.post(`/bbb/meeting/${encodeURIComponent(roomId.value)}/end`),
      request.post(`/live/room/${encodeURIComponent(roomId.value)}/stop`)
    ])

    if (results.every(item => item.status === 'fulfilled')) {
      ElMessage.success('会议与直播状态已结束')
    } else if (results.some(item => item.status === 'fulfilled')) {
      ElMessage.warning('已部分结束，请刷新后确认状态')
    } else {
      ElMessage.error('结束失败，请重试')
    }

    await loadRoom()
  } finally {
    ending.value = false
  }
}

const copyJoinUrl = async () => {
  if (!joinUrl.value) return
  await navigator.clipboard.writeText(joinUrl.value)
  ElMessage.success('链接已复制')
}

const openJoinUrl = () => {
  if (!joinUrl.value) return
  window.open(joinUrl.value, '_blank', 'noopener')
}

onMounted(loadRoom)
</script>

<style scoped>
.bbb-live-page {
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-row h2 {
  margin: 0;
  font-size: 20px;
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.tip {
  margin: 12px 0 0;
  color: #606266;
}

.quick-actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}
</style>
