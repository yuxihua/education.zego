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
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getLiveRoomDetail, getLiveStats, deleteLiveRoomPpt } from '@/api/live'
import request from '@/api/request'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomId = route.params.id

const roomInfo = ref(null)
const pptList = ref([])
const replayInfo = ref(null)
const stats = ref(null)
const pptLoading = ref(false)
const uploading = ref(false)

const uploadAction = computed(() => `/api/upload/ppt/${roomId}`)
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + userStore.token }))

const canManagePpt = computed(() => ['superadmin', 'admin', 'assistant', 'teacher'].includes(userStore.userInfo?.role))

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

onMounted(async () => {
  await refreshPptList()
  stats.value = await getLiveStats(roomId)
  replayInfo.value = roomInfo.value?.replayInfo || null
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
</style>
