<template>
  <div class="student-bbb-live">
    <el-card shadow="never" v-loading="roomLoading">
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
        <el-button :disabled="!joinUrl || joining" @click="copyJoinUrl">复制入会链接</el-button>
        <el-button :loading="roomLoading" @click="loadRoom">重试加载</el-button>
      </div>

      <el-input v-model="joinUrl" readonly placeholder="点击进入课堂后生成链接" />
    </el-card>

    <el-alert
      title="欢迎使用AI空中课堂"
      type="success"
      :closable="false"
      show-icon
    />

    <div class="mobile-join-bar">
      <el-button class="mobile-copy-btn" :disabled="!joinUrl || joining" @click="copyJoinUrl">复制链接</el-button>
      <el-button class="mobile-join-btn" type="primary" :loading="joining" @click="joinMeeting">进入课堂</el-button>
    </div>
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
const roomLoading = ref(false)
const roomLoadError = ref('')

const waitMs = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const withRetry = async (task, maxRetries = 2, baseDelay = 400) => {
  let lastErr = null
  for (let i = 0; i <= maxRetries; i += 1) {
    try {
      return await task()
    } catch (err) {
      lastErr = err
      if (i < maxRetries) {
        await waitMs(baseDelay * (2 ** i))
      }
    }
  }
  throw lastErr
}

const loadRoom = async () => {
  if (!courseId.value) return
  roomLoading.value = true
  roomLoadError.value = ''
  try {
    const roomBase = await withRetry(() => studentLiveRoomByCourse(courseId.value), 2, 350)
    if (!roomBase?.id) {
      ElMessage.warning('当前课程暂无直播间')
      return
    }
    roomInfo.value = await withRetry(() => studentLiveRoomDetail(roomBase.id), 2, 350)
  } catch (err) {
    roomLoadError.value = '直播间加载失败，网络可能不稳定，请重试'
    ElMessage.error(roomLoadError.value)
  } finally {
    roomLoading.value = false
  }
}

const joinMeeting = async () => {
  if (roomLoading.value) {
    ElMessage.warning('直播间正在加载，请稍后重试')
    return
  }
  if (!roomInfo.value?.id) {
    ElMessage.warning('直播间信息未就绪')
    return
  }

  joining.value = true
  try {
    const res = await withRetry(() => studentBbbJoin(encodeURIComponent(roomInfo.value.id)), 2, 450)
    joinUrl.value = res.joinUrl || ''
    if (!joinUrl.value) {
      ElMessage.error('未获取到入会链接')
      return
    }
    window.open(joinUrl.value, '_blank', 'noopener')
    ElMessage.success('正在进入 BBB 课堂')
  } catch (err) {
    ElMessage.error('进入课堂失败，请检查网络后重试')
  } finally {
    joining.value = false
  }
}

const copyJoinUrl = async () => {
  if (!joinUrl.value) return
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(joinUrl.value)
      ElMessage.success('已复制入会链接')
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = joinUrl.value
    textarea.setAttribute('readonly', 'readonly')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (!copied) throw new Error('copy_failed')
    ElMessage.success('已复制入会链接')
  } catch (err) {
    ElMessage.error('复制失败，请手动长按链接复制')
  }
}

onMounted(loadRoom)
</script>

<style scoped>
.student-bbb-live {
  --mobile-btn-height: 44px;
  --mobile-gap: 8px;
  max-width: 960px;
  margin: 24px auto;
  padding: 0 12px;
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

@media (max-width: 1024px) {
  .student-bbb-live {
    margin: 16px auto;
    padding: 0 10px;
  }
}

@media (max-width: 768px) {
  .student-bbb-live {
    margin: 10px auto;
    padding: 0 8px;
    padding-bottom: 80px;
  }

  .header-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .actions {
    gap: var(--mobile-gap);
  }

  .actions :deep(.el-button) {
    flex: 1;
    min-width: 120px;
  }

  :deep(.el-descriptions__label),
  :deep(.el-descriptions__content) {
    font-size: 13px;
    word-break: break-all;
  }

  .mobile-join-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: var(--mobile-gap);
    box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.08);
    animation: bar-slide-up 220ms ease-out;
  }

  .mobile-join-btn {
    flex: 1;
    min-height: var(--mobile-btn-height);
    font-size: 15px;
  }

  .mobile-copy-btn {
    min-width: 102px;
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
  .mobile-join-bar {
    display: none;
  }
}
</style>
