<template>
  <div class="student-bbb-live">
    <el-card shadow="never">
      <template #header>
        <div class="header-row">
          <span>{{ roomInfo?.title || '课程直播间' }}</span>
          <el-tag type="success">BBB 课堂</el-tag>
        </div>
      </template>

      <el-descriptions :column="1" border>
        <el-descriptions-item label="课程ID">{{ courseId }}</el-descriptions-item>
        <el-descriptions-item label="直播间ID">{{ roomInfo?.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="会议ID">{{ roomInfo?.zegoRoomId || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ roomInfo?.status || '-' }}</el-descriptions-item>
      </el-descriptions>

      <div class="actions">
        <el-button type="primary" :loading="joining" @click="joinMeeting">进入课堂</el-button>
        <el-button :disabled="!joinUrl" @click="copyJoinUrl">复制入会链接</el-button>
      </div>

      <el-input v-model="joinUrl" readonly placeholder="点击进入课堂后生成链接" />
    </el-card>

    <el-alert
      title="本页面已切换为 BBB 入会模式，不再使用 ZEGO 拉流"
      type="success"
      :closable="false"
      show-icon
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { studentLiveRoomByCourse, studentLiveRoomDetail, studentBbbJoin } from '@/api/studentPortal'

const route = useRoute()
const courseId = computed(() => route.params.courseId)

const roomInfo = ref(null)
const joinUrl = ref('')
const joining = ref(false)

const loadRoom = async () => {
  if (!courseId.value) return
  const roomBase = await studentLiveRoomByCourse(courseId.value)
  if (!roomBase?.id) {
    ElMessage.warning('当前课程暂无直播间')
    return
  }
  roomInfo.value = await studentLiveRoomDetail(roomBase.id)
}

const joinMeeting = async () => {
  if (!roomInfo.value?.id) {
    ElMessage.warning('直播间信息未就绪')
    return
  }

  joining.value = true
  try {
    const res = await studentBbbJoin(encodeURIComponent(roomInfo.value.id))
    joinUrl.value = res.joinUrl || ''
    if (!joinUrl.value) {
      ElMessage.error('未获取到入会链接')
      return
    }
    window.open(joinUrl.value, '_blank', 'noopener')
    ElMessage.success('正在进入 BBB 课堂')
  } finally {
    joining.value = false
  }
}

const copyJoinUrl = async () => {
  if (!joinUrl.value) return
  await navigator.clipboard.writeText(joinUrl.value)
  ElMessage.success('已复制入会链接')
}

onMounted(loadRoom)
</script>

<style scoped>
.student-bbb-live {
  max-width: 960px;
  margin: 24px auto;
  display: grid;
  gap: 16px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions {
  margin: 16px 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
