<template>
  <div class="recording-player-page">
    <el-card>
      <template #header>
        <div class="header-row">
          <div>
            <div class="title">{{ title || '录播学习' }}</div>
            <div class="meta">学习进度：{{ progressPercent }}%</div>
          </div>
          <el-button @click="goBack">返回学员中心</el-button>
        </div>
      </template>

      <el-alert
        v-if="!replayUrl"
        type="warning"
        :closable="false"
        show-icon
        title="未找到录播地址，请返回重试"
      />

      <el-alert
        v-else-if="showExternalFallback"
        type="info"
        :closable="false"
        show-icon
        title="当前页内播放器无法直接播放该回放，可改为打开 BBB 原始回放页"
      >
        <template #default>
          <el-button type="primary" link @click="openExternalReplay">打开原始回放页</el-button>
        </template>
      </el-alert>

      <video
        v-else
        ref="videoRef"
        class="video-player"
        :poster="videoCover"
        controls
        preload="metadata"
        @error="handlePlaybackError"
        @loadedmetadata="handleLoadedMetadata"
        @pause="handlePause"
        @ended="handleEnded"
      >
        <source v-for="source in replaySources" :key="source.src" :src="source.src" :type="source.type || undefined" />
      </video>

      <div v-if="isBbbReplay && !showExternalFallback" class="external-entry">
        <el-button type="info" link @click="openExternalReplay">改用 BBB 原始回放页</el-button>
      </div>
    </el-card>

    <div class="mobile-player-bar">
      <div class="mobile-progress">进度 {{ progressPercent }}%</div>
      <el-button class="mobile-back-btn" @click="goBack">返回学员中心</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { studentCreateAlipayOrder, studentGetRecordingProgress, studentSaveRecordingProgress } from '@/api/studentPortal'
import { getDirectReplaySources, isBbbPlaybackUrl, normalizeReplayUrl } from '@/utils/recording'

const route = useRoute()
const router = useRouter()
const videoRef = ref(null)
const progressPercent = ref(0)
const isReady = ref(false)
const trialBlocked = ref(false)
const hasPlaybackError = ref(false)
let saveTimer = null
let restoreSeconds = 0

const courseId = computed(() => Number(route.query.courseId || 0))
const videoId = computed(() => String(route.query.videoId || '').trim())
const title = computed(() => String(route.query.title || '').trim())
const replayUrl = computed(() => normalizeReplayUrl(route.query.replayUrl))
const replaySources = computed(() => getDirectReplaySources(replayUrl.value))
const videoCover = computed(() => String(route.query.videoCover || '').trim())
const trialDuration = computed(() => Math.max(0, Number(route.query.trialDuration || 0)))
const isPurchased = computed(() => String(route.query.isPurchased || '0') === '1')
const isBbbReplay = computed(() => isBbbPlaybackUrl(replayUrl.value))
const showExternalFallback = computed(() => isBbbReplay.value && hasPlaybackError.value)
const primaryReplaySource = computed(() => replaySources.value[0]?.src || replayUrl.value)

const shouldLimitByTrial = computed(() => !isPurchased.value && trialDuration.value > 0)

const goBack = () => {
  router.push('/student-center')
}

const openExternalReplay = () => {
  if (!replayUrl.value) return
  window.location.replace(replayUrl.value)
}

const handlePlaybackError = () => {
  hasPlaybackError.value = true
}

const saveProgress = async (force = false) => {
  if (!isPurchased.value) return
  if (!courseId.value || !videoId.value || !videoRef.value || !isReady.value) return

  const current = Number(videoRef.value.currentTime || 0)
  const duration = Number(videoRef.value.duration || 0)
  if (!force && duration > 0 && current <= 0) return

  try {
    const res = await studentSaveRecordingProgress({
      courseId: courseId.value,
      videoId: videoId.value,
      progressSeconds: Math.floor(current),
      durationSeconds: Math.floor(duration)
    })
    progressPercent.value = Number(res?.progressPercent || 0)
  } catch (err) {}
}

const startAutoSave = () => {
  if (saveTimer) clearInterval(saveTimer)
  saveTimer = setInterval(() => {
    saveProgress(false)
  }, 15000)
}

const handleLoadedMetadata = async () => {
  isReady.value = true
  if (restoreSeconds > 3 && videoRef.value && videoRef.value.duration > restoreSeconds + 2) {
    videoRef.value.currentTime = restoreSeconds
  }
  if (isPurchased.value) {
    startAutoSave()
  }
}

const handlePause = () => {
  saveProgress(true)
}

const handleEnded = async () => {
  await saveProgress(true)
  ElMessage.success('学习完成，进度已保存')
}

const startBuyCourse = async () => {
  if (!courseId.value) {
    ElMessage.warning('课程参数缺失，无法下单')
    return
  }
  const res = await studentCreateAlipayOrder(courseId.value)
  if (res?.status === 'paid') {
    ElMessage.success('购买成功，返回课程继续学习')
    router.push('/student-center')
    return
  }
  if (!res.formHtml) {
    ElMessage.error('下单失败：未获取支付表单')
    return
  }

  const container = document.createElement('div')
  container.style.display = 'none'
  container.innerHTML = res.formHtml
  document.body.appendChild(container)
  const form = container.querySelector('form')
  if (form) {
    form.submit()
  } else {
    ElMessage.error('支付表单解析失败')
  }
}

const handleTimeUpdate = async () => {
  if (!videoRef.value || !shouldLimitByTrial.value || trialBlocked.value) return
  const current = Number(videoRef.value.currentTime || 0)
  if (current < trialDuration.value) return

  trialBlocked.value = true
  videoRef.value.pause()
  videoRef.value.currentTime = Math.max(0, trialDuration.value)
  await saveProgress(true)

  try {
    await ElMessageBox.confirm('试听已结束，购买课程后可继续学习完整内容。', '提示', {
      type: 'warning',
      confirmButtonText: '去购买',
      cancelButtonText: '返回课程列表'
    })
    await startBuyCourse()
  } catch (err) {
    router.push('/student-center')
  }
}

onMounted(async () => {
  if (!replayUrl.value) {
    ElMessage.warning('参数不完整，无法播放录播')
    return
  }

  if (!courseId.value || !videoId.value || !primaryReplaySource.value) {
    ElMessage.warning('当前录播链接暂不支持页内播放，请返回重试')
    return
  }

  try {
    if (isPurchased.value) {
      const progress = await studentGetRecordingProgress({
        courseId: courseId.value,
        videoId: videoId.value
      })
      restoreSeconds = Number(progress?.progressSeconds || 0)
      progressPercent.value = Number(progress?.progressPercent || 0)
    }
  } catch (err) {}

  if (videoRef.value) {
    videoRef.value.addEventListener('timeupdate', handleTimeUpdate)
  }
})

onBeforeUnmount(() => {
  if (videoRef.value) {
    videoRef.value.removeEventListener('timeupdate', handleTimeUpdate)
  }
  if (saveTimer) {
    clearInterval(saveTimer)
    saveTimer = null
  }
  if (isPurchased.value) {
    saveProgress(true)
  }
})
</script>

<style scoped>
.recording-player-page {
  --mobile-btn-height: 42px;
  --mobile-gap: 10px;
  max-width: 1100px;
  margin: 20px auto;
  padding: 0 12px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.meta {
  color: #606266;
  font-size: 13px;
  margin-top: 4px;
}

.video-player {
  width: 100%;
  min-height: 360px;
  max-height: 72vh;
  background: #000;
  border-radius: 8px;
}

@media (max-width: 1024px) {
  .recording-player-page {
    margin: 12px auto;
    padding: 0 10px;
  }

  .video-player {
    min-height: 280px;
    max-height: 64vh;
  }
}

@media (max-width: 768px) {
  .recording-player-page {
    margin: 8px auto;
    padding: 0 8px;
    padding-bottom: 74px;
  }

  .header-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .title {
    font-size: 16px;
  }

  .meta {
    font-size: 12px;
  }

  .video-player {
    min-height: 210px;
    max-height: 56vh;
    border-radius: 6px;
  }

  :deep(.el-card__body) {
    padding: 12px;
  }

  .mobile-player-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--mobile-gap);
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(6px);
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -8px 18px rgba(15, 23, 42, 0.08);
    animation: bar-slide-up 220ms ease-out;
  }

  .mobile-progress {
    font-size: 13px;
    color: #374151;
    font-weight: 500;
    white-space: nowrap;
  }

  .mobile-back-btn {
    min-width: 128px;
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
  .mobile-player-bar {
    display: none;
  }
}
</style>
