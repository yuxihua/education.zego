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
            <el-descriptions-item label="会议ID">{{ roomInfo?.zegoRoomId }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header-row">
              <span>课件列表</span>
              <el-upload
                v-if="canManagePpt"
                :action="uploadAction"
                :headers="uploadHeaders"
                :show-file-list="false"
                :before-upload="beforeUpload"
                :on-success="handleUploadSuccess"
                :on-error="handleUploadError"
                :disabled="uploading"
              >
                <el-button type="primary" :loading="uploading">上传课件</el-button>
              </el-upload>
            </div>
          </template>
          <el-table :data="pptList" border size="small" v-loading="pptLoading">
            <el-table-column prop="filename" label="课件名称" min-width="220" />
            <el-table-column prop="fileType" label="类型" width="160">
              <template #default="{ row }">
                {{ formatFileType(row) }}
              </template>
            </el-table-column>
            <el-table-column prop="pageCount" label="页数" width="80">
              <template #default="{ row }">{{ row.pageCount ?? '-' }}</template>
            </el-table-column>
            <el-table-column prop="fileSize" label="大小" width="120">
              <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button link type="primary" @click="downloadPpt(row)">下载</el-button>
                <el-button link type="warning" @click="previewPpt(row)">打开</el-button>
                <el-button v-if="canManagePpt" link type="danger" @click="removePpt(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!pptList.length && !pptLoading" description="暂无课件，可直接上传" />
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header><span>回放管理</span></template>
          <div v-if="replayInfo">
            <p>回放状态：<el-tag type="success">已生成</el-tag></p>
            <p style="margin-top: 10px">视频时长：{{ formatDuration(replayInfo.duration) }}</p>
            <p style="margin-top: 10px">视频大小：{{ formatFileSize(replayInfo.size) }}</p>
            <p style="margin-top: 10px">回放数量：{{ replayList.length }}</p>
            <p style="margin-top: 10px; word-break: break-all">回放地址：{{ replayInfo.url }}</p>
            <el-button type="primary" style="margin-top: 15px; width: 100%" @click="handleOpenReplay()">查看回放</el-button>
            <el-button plain style="margin-top: 10px; width: 100%" @click="handleCopyReplayUrl()">复制回放地址</el-button>
            <el-button
              v-if="canDeleteReplay"
              type="danger"
              plain
              style="margin-top: 10px; width: 100%"
              :loading="deletingReplay"
              @click="handleDeleteReplay"
            >
              删除回放
            </el-button>
            <div v-if="replayList.length > 1" class="replay-list">
              <div class="replay-list-title">本场次全部回放</div>
              <div v-for="item in replayList" :key="item.recordingID || item.url" class="replay-list-item">
                <div class="replay-list-info">
                  <div>时长：{{ formatDuration(item.duration) }} · 大小：{{ formatFileSize(item.size) }}</div>
                  <div class="replay-list-url">{{ item.url }}</div>
                </div>
                <div class="replay-list-actions">
                  <el-button link type="primary" @click="handleOpenReplay(item.url)">查看</el-button>
                  <el-button link @click="handleCopyReplayUrl(item.url)">复制</el-button>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="roomInfo?.zegoRoomId">
            <p>回放状态：<el-tag type="info">待生成</el-tag></p>
            <p style="margin-top: 10px; color: #909399">会议结束并完成转码后，可刷新获取 BBB 回放地址。</p>
            <p v-if="replayPolling" style="margin-top: 10px; color: #909399">
              自动检测中：第 {{ replayPollCount }} / {{ REPLAY_POLL_MAX }} 次
            </p>
            <p v-if="isReplayPollExhausted" style="margin-top: 10px; color: #e6a23c">
              自动检测已结束，请稍后手动刷新回放状态。
            </p>
            <el-button
              type="primary"
              style="margin-top: 15px; width: 100%"
              :loading="generatingReplay"
              @click="handleRefreshReplay"
            >
              刷新回放状态
            </el-button>
          </div>
          <el-empty v-else description="暂无回放" />
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header><span>实时数据</span></template>
          <el-alert
            v-if="hasOnlineStatsMismatch"
            type="warning"
            :closable="false"
            style="margin-bottom: 12px"
            :title="`在线统计异常：当前在线 ${stats?.currentOnline || 0}，拆分合计 ${onlineBreakdownTotal}，差值 ${onlineStatsGap}`"
          />
          <div class="stats-item">
            <span>当前在线</span>
            <span class="stats-num">{{ stats?.currentOnline || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>累计观看</span>
            <span class="stats-num">{{ stats?.totalView || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>最高在线</span>
            <span class="stats-num">{{ stats?.peakOnline || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>家长在线</span>
            <span class="stats-num">{{ stats?.parentOnline || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>学员在线</span>
            <span class="stats-num">{{ stats?.studentOnline || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>其他在线</span>
            <span class="stats-num">{{ stats?.otherOnline || 0 }}</span>
          </div>
          <div class="stats-item">
            <span>在线拆分合计</span>
            <span class="stats-num">{{ onlineBreakdownTotal }}</span>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getLiveRoomDetail, getLiveStats, deleteLiveRoomPpt, getBbbReplayListByLiveRoom, deleteBbbReplayByLiveRoom } from '@/api/live'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomId = route.params.id

const roomInfo = ref(null)
const pptList = ref([])
const replayInfo = ref(null)
const replayList = ref([])
const stats = ref(null)
const pptLoading = ref(false)
const uploading = ref(false)
const generatingReplay = ref(false)
const deletingReplay = ref(false)
const replayPolling = ref(false)
const replayPollCount = ref(0)

const REPLAY_POLL_MAX = 3
const REPLAY_POLL_INTERVAL = 10000
let replayPollTimer = null

const uploadAction = computed(() => `/api/upload/ppt/${roomId}`)
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + userStore.token }))
const onlineBreakdownTotal = computed(() => (stats.value?.parentOnline || 0) + (stats.value?.studentOnline || 0) + (stats.value?.otherOnline || 0))
const onlineStatsGap = computed(() => (stats.value?.currentOnline || 0) - onlineBreakdownTotal.value)
const hasOnlineStatsMismatch = computed(() => stats.value && onlineStatsGap.value !== 0)
const isReplayPollExhausted = computed(() => !replayInfo.value?.url && !replayPolling.value && replayPollCount.value >= REPLAY_POLL_MAX)

const canManagePpt = computed(() => ['superadmin', 'admin', 'assistant', 'teacher'].includes(userStore.userInfo?.role))
const canDeleteReplay = computed(() => ['superadmin', 'admin'].includes(userStore.userInfo?.role))

const normalizePptItem = (item) => ({
  ...item,
  filename: item.filename || item.name || '未命名课件',
  fileType: item.fileType || item.type || '',
  fileUrl: item.fileUrl || item.url || '',
  fileSize: item.fileSize || item.size || 0,
  pageCount: item.pageCount ?? null
})

const refreshPptList = async () => {
  pptLoading.value = true
  try {
    roomInfo.value = await getLiveRoomDetail(roomId)
    pptList.value = (roomInfo.value?.pptList || []).map(normalizePptItem)
  } finally {
    pptLoading.value = false
  }
}

const formatFileType = (row) => {
  const value = String(row.fileType || '').toLowerCase()
  if (value.includes('ppt') || value.includes('presentation')) return 'PPT'
  if (value.includes('pdf')) return 'PDF'
  if (value.includes('word')) return 'Word'
  return row.fileType || '-'
}

const formatFileSize = (size) => {
  const bytes = Number(size || 0)
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const formatDuration = (seconds) => {
  const total = Math.max(0, Number(seconds || 0))
  if (!total) return '-'
  const hour = Math.floor(total / 3600)
  const minute = Math.floor((total % 3600) / 60)
  const second = total % 60
  if (hour > 0) return `${hour}时${minute}分${second}秒`
  if (minute > 0) return `${minute}分${second}秒`
  return `${second}秒`
}

const getAbsFileUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${window.location.origin}${url}`
}

const beforeUpload = (file) => {
  if (!canManagePpt.value) {
    ElMessage.warning('当前账号无课件管理权限')
    return false
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = ['ppt', 'pptx', 'pdf']
  if (!allowed.includes(ext)) {
    ElMessage.warning('仅支持上传 PPT、PPTX、PDF 文件')
    return false
  }
  uploading.value = true
  return true
}

const handleUploadSuccess = async () => {
  uploading.value = false
  ElMessage.success('课件上传成功')
  await refreshPptList()
}

const handleUploadError = () => {
  uploading.value = false
  ElMessage.error('课件上传失败，请重试')
}

const downloadPpt = (row) => {
  const url = getAbsFileUrl(row.fileUrl)
  if (!url) {
    ElMessage.warning('当前课件没有可下载地址')
    return
  }
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.target = '_blank'
  anchor.rel = 'noopener noreferrer'
  anchor.download = row.filename || '课件'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
}

const previewPpt = (row) => {
  const url = getAbsFileUrl(row.fileUrl)
  if (!url) {
    ElMessage.warning('当前课件没有可打开地址')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const removePpt = async (row) => {
  await ElMessageBox.confirm(`确认删除课件【${row.filename || '未命名'}】？`, '提示', { type: 'warning' })
  await deleteLiveRoomPpt(roomId, row.id)
  ElMessage.success('课件已删除')
  await refreshPptList()
}

const copyText = async (text) => {
  if (!text) return false
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const input = document.createElement('input')
  input.value = text
  document.body.appendChild(input)
  input.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(input)
  if (!copied) throw new Error('copy failed')
  return true
}

const normalizeReplayUrl = (value) => (typeof value === 'string' ? value.trim() : '')

const handleOpenReplay = (targetUrl = '') => {
  const url = normalizeReplayUrl(targetUrl) || normalizeReplayUrl(replayInfo.value?.url)
  if (!url) {
    ElMessage.warning('暂无可用回放地址')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const handleCopyReplayUrl = async (targetUrl = '') => {
  const url = normalizeReplayUrl(targetUrl) || normalizeReplayUrl(replayInfo.value?.url)
  if (!url) {
    ElMessage.warning('暂无可复制的回放地址')
    return
  }
  try {
    await copyText(url)
    ElMessage.success('回放地址已复制')
  } catch (err) {
    ElMessage.error('复制失败，请手动复制')
  }
}

const handleDeleteReplay = async () => {
  if (!roomInfo.value?.id) {
    ElMessage.warning('未找到直播间信息')
    return
  }
  if (!replayInfo.value?.url) {
    ElMessage.warning('暂无可删除回放')
    return
  }

  await ElMessageBox.confirm('确认删除当前直播间回放？删除后不可恢复。', '提示', { type: 'warning' })
  deletingReplay.value = true
  try {
    await deleteBbbReplayByLiveRoom(roomId)
    replayInfo.value = null
    replayList.value = []
    if (roomInfo.value) {
      roomInfo.value.replayUrl = null
      roomInfo.value.replayDuration = null
      roomInfo.value.replaySize = null
    }
    clearReplayPollTimer()
    ElMessage.success('回放已删除')
  } finally {
    deletingReplay.value = false
  }
}

const clearReplayPollTimer = () => {
  replayPolling.value = false
  if (replayPollTimer) {
    clearTimeout(replayPollTimer)
    replayPollTimer = null
  }
}

const fetchReplayListByRoom = async (options = {}) => {
  const { silent = false } = options
  if (!roomId) return []
  const list = await getBbbReplayListByLiveRoom(roomId)
  replayList.value = list
  replayInfo.value = list[0] || null
  if (!silent && list.length) {
    ElMessage.success('BBB 回放列表已更新')
  }
  return list
}

const scheduleReplayPoll = () => {
  if (!roomInfo.value?.zegoRoomId || replayInfo.value?.url) {
    clearReplayPollTimer()
    return
  }
  if (replayPollCount.value >= REPLAY_POLL_MAX) {
    clearReplayPollTimer()
    return
  }

  replayPolling.value = true
  replayPollTimer = setTimeout(async () => {
    replayPollTimer = null
    replayPollCount.value += 1
    try {
      const list = await fetchReplayListByRoom({ silent: true })
      if (list.length) {
        clearReplayPollTimer()
        return
      }
    } catch (err) {}
    scheduleReplayPoll()
  }, REPLAY_POLL_INTERVAL)
}

const handleRefreshReplay = async () => {
  if (!roomInfo.value?.zegoRoomId) {
    ElMessage.warning('当前直播间缺少会议ID')
    return
  }
  replayPollCount.value = 0
  generatingReplay.value = true
  try {
    const list = await fetchReplayListByRoom({ silent: false })
    if (list.length) {
      clearReplayPollTimer()
    } else {
      ElMessage.info('当前暂无可用回放，请稍后重试')
    }
  } catch (err) {
    ElMessage.info('回放尚未生成，请稍后重试')
  } finally {
    generatingReplay.value = false
  }
}

onMounted(async () => {
  await refreshPptList()
  stats.value = await getLiveStats(roomId)
  replayInfo.value = roomInfo.value?.replayInfo || null
  replayList.value = replayInfo.value ? [replayInfo.value] : []
  if (roomInfo.value?.zegoRoomId) {
    try {
      await fetchReplayListByRoom({ silent: true })
    } catch (err) {}
  }
  if (!replayInfo.value && roomInfo.value?.zegoRoomId) {
    try {
      await fetchReplayListByRoom({ silent: true })
    } catch (err) {}
    scheduleReplayPoll()
  }
})

onBeforeUnmount(() => {
  clearReplayPollTimer()
})
</script>

<style scoped>
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stats-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
.stats-item:last-child { border-bottom: none; }
.stats-num { font-weight: 700; color: #409EFF; }

.replay-list {
  margin-top: 14px;
  border-top: 1px solid #ebeef5;
  padding-top: 10px;
}

.replay-list-title {
  margin-bottom: 8px;
  color: #606266;
  font-size: 13px;
}

.replay-list-item {
  padding: 8px 0;
  border-bottom: 1px dashed #ebeef5;
}

.replay-list-item:last-child {
  border-bottom: none;
}

.replay-list-info {
  font-size: 12px;
  color: #606266;
}

.replay-list-url {
  margin-top: 4px;
  word-break: break-all;
  color: #909399;
}

.replay-list-actions {
  margin-top: 4px;
}
</style>
