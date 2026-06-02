<template>
  <div class="student-live-room">
    <div class="page-header">
      <div>
        <h2>{{ roomInfo?.title || '课程直播' }}</h2>
        <div class="meta">{{ roomInfo?.course?.title || '直播课程' }} · {{ roomInfo?.anchorName || roomInfo?.course?.teacherName || '讲师待定' }}</div>
      </div>
      <div class="header-actions">
        <el-button @click="router.push('/student-center')">返回学员中心</el-button>
        <el-button type="primary" @click="loadRoom">刷新</el-button>
      </div>
    </div>

    <el-skeleton :loading="loading" animated :rows="8">
      <template #default>
        <el-empty v-if="!roomInfo" description="该课程暂未创建直播间或你暂无观看权限" />

        <template v-else>
          <el-row :gutter="16">
            <el-col :span="16">
              <el-card class="player-card">
                <template #header>
                  <div class="card-title-row">
                    <span>直播观看</span>
                    <el-tag :type="statusTagType">{{ statusText }}</el-tag>
                  </div>
                </template>

                <div v-if="showRealtimePlayer" class="video-wrapper realtime-wrapper">
                  <div ref="remoteVideoRef" class="realtime-player"></div>
                </div>

                <div v-if="teacherStreams.length > 1" class="stream-switcher">
                  <span class="stream-switcher-label">观看机位</span>
                  <el-switch
                    v-model="autoFollowTeacherFocus"
                    size="small"
                    inline-prompt
                    active-text="跟随"
                    inactive-text="手动"
                  />
                  <el-select
                    v-model="selectedTeacherStreamId"
                    size="small"
                    style="width: 240px"
                    @change="handleTeacherStreamChange"
                  >
                    <el-option
                      v-for="item in teacherStreams"
                      :key="item.streamID"
                      :label="item.label"
                      :value="item.streamID"
                    />
                  </el-select>
                </div>

                <div v-else-if="primaryVideoUrl" class="video-wrapper">
                  <video :src="primaryVideoUrl" controls playsinline class="video-player" />
                </div>
                <el-alert
                  v-else
                  type="info"
                  :closable="false"
                  title="当前直播未提供网页直播放流地址，可先查看直播状态；若已结束，可使用回放地址观看。"
                />

                <el-alert
                  v-if="liveNotice"
                  style="margin-top: 12px"
                  type="success"
                  :closable="false"
                  :title="liveNotice"
                />

                <el-alert
                  v-if="liveError"
                  style="margin-top: 12px"
                  type="warning"
                  :closable="false"
                  :title="liveError"
                />

                <div class="action-links">
                  <el-button v-if="realtimeEligible" type="primary" link @click="connectRealtime">连接实时直播</el-button>
                  <el-button v-if="canRequestCohost" type="warning" link @click="requestCohost">申请连麦</el-button>
                  <el-button v-if="cohostRequested && !isCohosting" type="info" link disabled>已申请连麦</el-button>
                  <el-button v-if="isCohosting" type="danger" link @click="leaveCohost">结束连麦</el-button>
                  <el-button v-if="roomInfo.hlsUrl" type="primary" link @click="openExternal(roomInfo.hlsUrl)">打开直播流</el-button>
                  <el-button v-if="roomInfo.pullUrl" type="primary" link @click="openExternal(roomInfo.pullUrl)">打开播放地址</el-button>
                  <el-button v-if="roomInfo.replayUrl" type="success" link @click="openExternal(roomInfo.replayUrl)">打开回放</el-button>
                </div>

                <div v-if="isCohosting || pendingCohostApproval" class="cohost-panel">
                  <div class="cohost-status">{{ isCohosting ? '你正在连麦中' : '已获准连麦，正在准备设备...' }}</div>
                  <div class="cohost-preview" ref="localVideoRef"></div>
                  <div class="cohost-actions">
                    <el-button :type="isMicOn ? 'primary' : 'info'" @click="toggleMic">{{ isMicOn ? '关闭麦克风' : '开启麦克风' }}</el-button>
                    <el-button :type="isCameraOn ? 'primary' : 'info'" @click="toggleCamera">{{ isCameraOn ? '关闭摄像头' : '开启摄像头' }}</el-button>
                  </div>
                </div>
              </el-card>
            </el-col>

            <el-col :span="8">
              <el-card>
                <template #header><span>直播信息</span></template>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="课程">{{ roomInfo.course?.title || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="讲师">{{ roomInfo.anchorName || roomInfo.course?.teacherName || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="直播状态">{{ statusText }}</el-descriptions-item>
                  <el-descriptions-item label="开播时间">{{ roomInfo.actualStartTime || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="在线人数">{{ roomInfo.onlineCount || 0 }}</el-descriptions-item>
                  <el-descriptions-item label="累计观看">{{ roomInfo.totalViewCount || 0 }}</el-descriptions-item>
                  <el-descriptions-item label="ZEGO房间号">{{ roomInfo.zegoRoomId || '-' }}</el-descriptions-item>
                </el-descriptions>
              </el-card>

              <el-card style="margin-top: 16px">
                <template #header><span>课件与回放</span></template>
                <div class="replay-block">
                  <div>回放状态：{{ roomInfo.replayUrl ? '已生成' : '未生成' }}</div>
                  <div v-if="roomInfo.replayDuration">回放时长：{{ roomInfo.replayDuration }} 秒</div>
                  <div v-if="roomInfo.replaySize">回放大小：{{ roomInfo.replaySize }}</div>
                </div>
                <el-table :data="roomInfo.pptFiles || []" size="small" border style="margin-top: 12px">
                  <el-table-column prop="name" label="课件名称" min-width="120" />
                  <el-table-column prop="type" label="类型" width="90" />
                  <el-table-column prop="pageCount" label="页数" width="70" />
                </el-table>
                <el-empty v-if="!(roomInfo.pptFiles || []).length" description="暂无课件" />
              </el-card>

              <el-card style="margin-top: 16px" class="chat-card">
                <template #header><span>课堂聊天</span></template>
                <div class="chat-messages" ref="chatScrollRef">
                  <div v-for="msg in chatMessages" :key="msg.id" class="chat-message">
                    <div class="chat-meta">
                      <span class="chat-name">{{ msg.nickname || '匿名用户' }}</span>
                      <span class="chat-time">{{ formatTime(msg.createdAt) }}</span>
                    </div>
                    <div class="chat-content">{{ msg.content }}</div>
                  </div>
                  <el-empty v-if="!chatMessages.length" description="暂无课堂消息" />
                </div>
                <div class="chat-composer">
                  <el-input
                    v-model="chatText"
                    type="textarea"
                    :rows="3"
                    maxlength="200"
                    show-word-limit
                    placeholder="输入课堂消息，按回车发送"
                    @keydown.enter.exact.prevent="sendChat"
                  />
                  <el-button type="primary" :loading="chatSending" @click="sendChat">发送消息</el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </template>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ZegoExpressEngine } from 'zego-express-engine-webrtc'
import { studentLiveRoomByCourse, studentLiveChatHistory, studentLiveSendChat, studentTokenKey } from '@/api/studentPortal'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const roomInfo = ref(null)
const remoteVideoRef = ref(null)
const zg = ref(null)
const joinedRoom = ref(false)
const currentStreamId = ref('')
const liveNotice = ref('')
const liveError = ref('')
const zegoAuthInfo = ref(null)
const chatMessages = ref([])
const chatText = ref('')
const chatSending = ref(false)
const chatScrollRef = ref(null)
const teacherStreams = ref([])
const selectedTeacherStreamId = ref('')
const autoFollowTeacherFocus = ref(true)
const localVideoRef = ref(null)
const localStream = ref(null)
const cohostRequested = ref(false)
const pendingCohostApproval = ref(false)
const isCohosting = ref(false)
const isMicOn = ref(true)
const isCameraOn = ref(true)
let chatPollTimer = null

const renderLocalStream = async (container, stream) => {
  if (!container || !stream) return
  container.innerHTML = ''
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.muted = true
  videoEl.playsInline = true
  videoEl.srcObject = stream
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  videoEl.style.objectFit = 'cover'
  container.appendChild(videoEl)
  try {
    await videoEl.play()
  } catch (e) {}
}

const ZEGO_CONFIG = {
  appID: 0,
  server: '',
  tokenUrl: '/api/zego/token'
}

const statusTextMap = {
  waiting: '未开始',
  living: '直播中',
  paused: '直播暂停',
  finished: '已结束',
  closed: '已关闭'
}

const statusTagTypeMap = {
  waiting: 'primary',
  living: 'danger',
  paused: 'warning',
  finished: 'info',
  closed: 'info'
}

const statusText = computed(() => statusTextMap[roomInfo.value?.status] || roomInfo.value?.status || '-')
const statusTagType = computed(() => statusTagTypeMap[roomInfo.value?.status] || 'info')
const realtimeEligible = computed(() => ['living', 'paused'].includes(roomInfo.value?.status) && !!roomInfo.value?.zegoRoomId)
const canRequestCohost = computed(() => realtimeEligible.value && !cohostRequested.value && !isCohosting.value)
const showRealtimePlayer = computed(() => realtimeEligible.value && !!currentStreamId.value)
const primaryVideoUrl = computed(() => {
  if (showRealtimePlayer.value) return ''
  if (roomInfo.value?.hlsUrl) return roomInfo.value.hlsUrl
  if (roomInfo.value?.replayUrl) return roomInfo.value.replayUrl
  return ''
})

const getTeacherStreamMeta = (streamID) => {
  const roomNumericId = String(roomInfo.value?.id || '')
  const base = roomNumericId ? `teacher_${roomNumericId}` : ''
  if (!streamID || !base) return null
  if (streamID === `${base}_screen`) {
    return { streamID, label: '讲师屏幕共享', priority: 3 }
  }
  if (streamID === base) {
    return { streamID, label: '讲师主机位', priority: 2 }
  }
  if (streamID.startsWith(`${base}_cam_`)) {
    return { streamID, label: `讲师副机位 ${streamID.slice((`${base}_cam_`).length, (`${base}_cam_`).length + 4)}`, priority: 1 }
  }
  return null
}

const sortTeacherStreams = (list) => {
  return [...list].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    return a.label.localeCompare(b.label)
  })
}

const upsertTeacherStreams = (streamList) => {
  let changed = false
  streamList.forEach((stream) => {
    const meta = getTeacherStreamMeta(stream.streamID)
    if (!meta) return
    const existing = teacherStreams.value.find((item) => item.streamID === meta.streamID)
    if (!existing) {
      teacherStreams.value.push(meta)
      changed = true
    }
  })
  if (changed) {
    teacherStreams.value = sortTeacherStreams(teacherStreams.value)
  }
}

const removeTeacherStreams = (streamList) => {
  const removeSet = new Set(streamList.map((item) => item.streamID))
  teacherStreams.value = teacherStreams.value.filter((item) => !removeSet.has(item.streamID))
  if (!teacherStreams.value.some((item) => item.streamID === selectedTeacherStreamId.value)) {
    selectedTeacherStreamId.value = ''
  }
}

const handleTeacherStreamChange = async (streamID) => {
  if (!streamID) return
  autoFollowTeacherFocus.value = false
  const ok = await playStream(streamID)
  if (!ok) {
    liveError.value = '机位切换失败，请稍后重试'
  }
}

const handleTeacherFocusMessage = async (streamID, source = '') => {
  if (!streamID) return
  upsertTeacherStreams([{ streamID }])
  const sourceText = source === 'screen_share_start' || source === 'scene_screen'
    ? '屏幕共享'
    : source === 'scene_main' || source === 'live_start' || source === 'main_camera' || source === 'screen_share_stop'
      ? '主讲机位'
      : source === 'scene_preview'
        ? '副机位'
        : '机位'
  if (!autoFollowTeacherFocus.value) {
    liveNotice.value = `老师已切换到${sourceText}（当前为手动机位模式）`
    return
  }
  const played = await playStream(streamID)
  if (!played) {
    liveError.value = `老师切换到了${sourceText}，但当前机位暂不可播放`
  }
}

const reportOnlineState = async (action) => {
  if (!roomInfo.value?.id) return
  const token = localStorage.getItem(studentTokenKey)
  if (!token) return

  try {
    await fetch(`/api/live/room/${roomInfo.value.id}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ userId: zegoAuthInfo.value?.userId || `student_${Date.now()}` })
    })
  } catch (err) {}
}

const scrollChatToBottom = () => {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

const loadChatHistory = async (silent = true) => {
  if (!roomInfo.value?.id) return
  try {
    const list = await studentLiveChatHistory(roomInfo.value.id, { limit: 100 })
    chatMessages.value = Array.isArray(list) ? list : []
    scrollChatToBottom()
  } catch (err) {
    if (!silent) {
      ElMessage.error('加载课堂消息失败')
    }
  }
}

const startChatPolling = () => {
  if (chatPollTimer || !roomInfo.value?.id) return
  chatPollTimer = window.setInterval(() => {
    loadChatHistory(true)
  }, 5000)
}

const stopChatPolling = () => {
  if (chatPollTimer) {
    window.clearInterval(chatPollTimer)
    chatPollTimer = null
  }
}

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

const sendChat = async () => {
  const content = String(chatText.value || '').trim()
  if (!content) {
    ElMessage.warning('请输入消息内容')
    return
  }
  if (!roomInfo.value?.id) {
    ElMessage.warning('直播间尚未加载完成')
    return
  }

  chatSending.value = true
  try {
    await studentLiveSendChat(roomInfo.value.id, {
      content,
      userId: zegoAuthInfo.value?.userId,
      nickname: zegoAuthInfo.value?.userName || '学员'
    })
    chatText.value = ''
    await loadChatHistory(true)
  } finally {
    chatSending.value = false
  }
}

const stopPlaying = () => {
  if (zg.value && currentStreamId.value) {
    try {
      zg.value.stopPlayingStream(currentStreamId.value)
    } catch (err) {}
  }
  currentStreamId.value = ''
}

const playStream = async (streamID) => {
  if (!zg.value || !remoteVideoRef.value || !streamID) return false
  if (currentStreamId.value === streamID) return true

  stopPlaying()
  await nextTick()
  try {
    await zg.value.startPlayingStream(streamID, {
      video: remoteVideoRef.value,
      audio: true
    })
    currentStreamId.value = streamID
    selectedTeacherStreamId.value = streamID
    liveError.value = ''
    liveNotice.value = streamID.endsWith('_screen') ? '当前正在观看老师屏幕共享' : '已接入老师实时直播'
    return true
  } catch (err) {
    return false
  }
}

const tryPlayKnownStreams = async () => {
  if (!roomInfo.value?.id) return false
  const knownCandidates = sortTeacherStreams(teacherStreams.value).map((item) => item.streamID)
  const fallbackCandidates = [`teacher_${roomInfo.value.id}_screen`, `teacher_${roomInfo.value.id}`]
  const candidates = [...new Set([...knownCandidates, ...fallbackCandidates])]
  for (const streamID of candidates) {
    const played = await playStream(streamID)
    if (played) return true
  }
  return false
}

const initZego = async () => {
  zg.value = new ZegoExpressEngine(ZEGO_CONFIG.appID, ZEGO_CONFIG.server)

  zg.value.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
    if (roomID !== roomInfo.value?.zegoRoomId) return

    if (updateType === 'ADD') {
      upsertTeacherStreams(streamList)
      const orderedStreams = sortTeacherStreams(
        streamList
          .map((stream) => getTeacherStreamMeta(stream.streamID))
          .filter(Boolean)
      )
      if (!currentStreamId.value) {
        for (const stream of orderedStreams) {
          const ok = await playStream(stream.streamID)
          if (ok) break
        }
      } else {
        const screenStream = orderedStreams.find((item) => item.streamID.endsWith('_screen'))
        if (screenStream && currentStreamId.value !== screenStream.streamID) {
          await playStream(screenStream.streamID)
        }
      }
    } else {
      removeTeacherStreams(streamList)
      if (streamList.some((item) => item.streamID === currentStreamId.value)) {
        stopPlaying()
        const switched = await tryPlayKnownStreams()
        if (!switched) {
          liveNotice.value = ''
          liveError.value = '老师当前未推流，可稍后刷新重试'
        }
      }
    }
  })

  zg.value.on('IMRecvBroadcastMessage', async (roomID, chatData) => {
    if (roomID !== roomInfo.value?.zegoRoomId) return
    for (const msg of chatData) {
      try {
        const data = JSON.parse(msg.message)
        if (data.type === 'chat' && data.content) {
          chatMessages.value.push({
            id: msg.messageID || `${Date.now()}_${Math.random()}`,
            nickname: msg.fromUser?.userName || '课堂成员',
            content: data.content,
            createdAt: new Date().toISOString()
          })
          scrollChatToBottom()
        } else if (data.type === 'cohost_accept' && data.targetUserID === zegoAuthInfo.value?.userId) {
          pendingCohostApproval.value = true
          cohostRequested.value = false
          liveNotice.value = '老师已同意你的连麦申请，正在上麦...'
          await startCohost()
        } else if (data.type === 'cohost_reject' && data.targetUserID === zegoAuthInfo.value?.userId) {
          cohostRequested.value = false
          pendingCohostApproval.value = false
          liveError.value = '老师已拒绝你的连麦申请'
        } else if (data.type === 'cohost_kick' && data.targetUserID === zegoAuthInfo.value?.userId) {
          await stopCohost(false)
          liveError.value = '老师已结束你的连麦'
        } else if (data.type === 'stream_focus' && data.streamID) {
          await handleTeacherFocusMessage(data.streamID, data.source || '')
        }
      } catch (err) {}
    }
  })
}

const getZegoAuth = async (publish = false) => {
  const token = localStorage.getItem(studentTokenKey)
  const query = new URLSearchParams({ roomID: roomInfo.value?.zegoRoomId || '' })
  if (publish) query.set('publish', '1')
  const res = await fetch(`${ZEGO_CONFIG.tokenUrl}?${query.toString()}`, {
    headers: token ? { Authorization: 'Bearer ' + token } : {}
  })
  const data = await res.json()
  if (!res.ok || ![0, 200].includes(data.code)) {
    throw new Error(data.message || data.msg || '获取直播令牌失败')
  }

  const authInfo = data.data || {}
  ZEGO_CONFIG.appID = Number(authInfo.appId || 0)
  ZEGO_CONFIG.server = authInfo.server || ''
  zegoAuthInfo.value = authInfo
  return authInfo
}

const connectRealtime = async () => {
  if (!realtimeEligible.value) return

  liveError.value = ''
  teacherStreams.value = []
  selectedTeacherStreamId.value = ''
  try {
    const authInfo = await getZegoAuth()
    if (!ZEGO_CONFIG.appID) {
      throw new Error('ZEGO_APP_ID 未配置')
    }

    if (!zg.value) {
      await initZego()
    }

    if (!joinedRoom.value) {
      await zg.value.loginRoom(roomInfo.value.zegoRoomId, authInfo.token, {
        userID: authInfo.userId,
        userName: authInfo.userName
      })
      joinedRoom.value = true
      await reportOnlineState('online')
    }

    const played = await tryPlayKnownStreams()
    if (!played) {
      liveNotice.value = '已进入直播间，等待老师开始推流...'
    }
  } catch (err) {
    liveError.value = err.message || '连接实时直播失败'
  }
}

const requestCohost = async () => {
  if (!joinedRoom.value || !zg.value || !zegoAuthInfo.value?.userId) {
    await connectRealtime()
  }

  if (!zg.value || !zegoAuthInfo.value?.userId) {
    ElMessage.warning('尚未连接直播间，无法申请连麦')
    return
  }

  await zg.value.sendBroadcastMessage(roomInfo.value.zegoRoomId, JSON.stringify({ type: 'handup' }))
  cohostRequested.value = true
  liveNotice.value = '已提交连麦申请，请等待老师同意'
  try {
    const token = localStorage.getItem(studentTokenKey)
    if (token) {
      await fetch(`/api/live/room/${roomInfo.value.id}/cohost/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          userId: zegoAuthInfo.value?.userId,
          userName: zegoAuthInfo.value?.userName
        })
      })
    }
  } catch (err) {}
}

const startCohost = async () => {
  try {
    const authInfo = await getZegoAuth(true)
    if (!authInfo.canPublish) {
      throw new Error('当前尚未获得连麦推流权限')
    }

    if (joinedRoom.value && zg.value && roomInfo.value?.zegoRoomId) {
      await zg.value.logoutRoom(roomInfo.value.zegoRoomId)
      joinedRoom.value = false
    }

    if (!zg.value) {
      await initZego()
    }

    await zg.value.loginRoom(roomInfo.value.zegoRoomId, authInfo.token, {
      userID: authInfo.userId,
      userName: authInfo.userName
    })
    joinedRoom.value = true

    localStream.value = await zg.value.createStream({
      camera: { video: true, audio: true, videoQuality: 2, width: 640, height: 360 }
    })

    await nextTick()
    await renderLocalStream(localVideoRef.value, localStream.value)
    const studentStreamID = `${authInfo.userId}_${roomInfo.value.id}`
    await zg.value.startPublishingStream(studentStreamID, localStream.value)

    isCohosting.value = true
    pendingCohostApproval.value = false
    liveNotice.value = '已成功连麦'
  } catch (err) {
    pendingCohostApproval.value = false
    liveError.value = err.message || '连麦失败'
  }
}

const stopCohost = async (rejoinViewer = true) => {
  if (localStream.value && zg.value && zegoAuthInfo.value?.userId && roomInfo.value?.id) {
    try {
      await zg.value.stopPublishingStream(`${zegoAuthInfo.value.userId}_${roomInfo.value.id}`)
    } catch (err) {}
    try {
      zg.value.destroyStream(localStream.value)
    } catch (err) {}
    localStream.value = null
  }

  isCohosting.value = false
  pendingCohostApproval.value = false
  cohostRequested.value = false
  isMicOn.value = true
  isCameraOn.value = true

  if (rejoinViewer) {
    await connectRealtime()
  }
}

const leaveCohost = async () => {
  await stopCohost(true)
  liveNotice.value = '你已结束连麦'
}

const toggleMic = () => {
  if (!localStream.value || !zg.value) return
  localStream.value.getAudioTracks().forEach(track => {
    track.enabled = !isMicOn.value
  })
  isMicOn.value = !isMicOn.value
}

const toggleCamera = () => {
  if (!localStream.value || !zg.value) return
  localStream.value.getVideoTracks().forEach(track => {
    track.enabled = !isCameraOn.value
  })
  isCameraOn.value = !isCameraOn.value
}

const cleanupRealtime = async () => {
  stopPlaying()
  stopChatPolling()
  teacherStreams.value = []
  selectedTeacherStreamId.value = ''
  autoFollowTeacherFocus.value = true
  if (isCohosting.value) {
    await stopCohost(false)
  }
  if (joinedRoom.value && zg.value && roomInfo.value?.zegoRoomId) {
    try {
      await reportOnlineState('offline')
      await zg.value.logoutRoom(roomInfo.value.zegoRoomId)
    } catch (err) {}
  }
  joinedRoom.value = false
  if (zg.value) {
    try {
      zg.value.destroyEngine()
    } catch (err) {}
  }
  zg.value = null
}

const loadRoom = async () => {
  loading.value = true
  try {
    roomInfo.value = await studentLiveRoomByCourse(route.params.courseId)
    liveNotice.value = ''
    liveError.value = ''
    await loadChatHistory(false)
    startChatPolling()
    if (realtimeEligible.value) {
      await connectRealtime()
    } else {
      await cleanupRealtime()
      startChatPolling()
    }
  } catch (err) {
    roomInfo.value = null
    await cleanupRealtime()
  } finally {
    loading.value = false
  }
}

const openExternal = (url) => {
  if (!url) {
    ElMessage.warning('当前没有可打开的直播地址')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

onMounted(loadRoom)
onBeforeUnmount(cleanupRealtime)
</script>

<style scoped>
.student-live-room {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.meta {
  color: #666;
  margin-top: 6px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.player-card {
  min-height: 420px;
}

.video-wrapper {
  background: #000;
  border-radius: 10px;
  overflow: hidden;
}

.realtime-wrapper {
  min-height: 360px;
}

.realtime-player {
  width: 100%;
  min-height: 360px;
  background: #000;
}

.realtime-player :deep(video) {
  width: 100%;
  height: 100%;
  min-height: 360px;
  object-fit: contain;
  background: #000;
}

.video-player {
  width: 100%;
  min-height: 360px;
  background: #000;
}

.stream-switcher {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.stream-switcher-label {
  font-size: 13px;
  color: #606266;
}

.action-links {
  margin-top: 12px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.cohost-panel {
  margin-top: 16px;
  padding: 12px;
  background: #f7f9fc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.cohost-status {
  margin-bottom: 8px;
  color: #606266;
}

.cohost-preview {
  width: 100%;
  min-height: 180px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.cohost-preview :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cohost-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.replay-block {
  color: #606266;
  line-height: 1.8;
}

.chat-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-messages {
  max-height: 320px;
  overflow-y: auto;
  background: #f7f9fc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
}

.chat-message + .chat-message {
  margin-top: 12px;
}

.chat-meta {
  display: flex;
  justify-content: space-between;
  color: #909399;
  font-size: 12px;
  margin-bottom: 4px;
}

.chat-name {
  font-weight: 600;
  color: #303133;
}

.chat-content {
  color: #303133;
  line-height: 1.6;
  word-break: break-word;
}

.chat-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>