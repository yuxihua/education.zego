<template>
  <div class="teacher-live-room">
    <!-- 顶部工具栏 -->
    <div class="top-bar">
      <div class="room-info">
        <el-tag type="danger" effect="dark" v-if="isLiving">● 直播中</el-tag>
        <el-tag type="info" v-else>未开始</el-tag>
        <span class="room-title">{{ roomInfo.title }}</span>
        <span class="online-count">
          <el-icon><User /></el-icon> 在线 {{ onlineCount }} 人
        </span>
      </div>
      <div class="actions">
        <el-button 
          :type="isLiving ? 'danger' : 'primary'" 
          size="large"
          @click="isLiving ? handleEndLive() : handleStartLive()"
        >
          {{ isLiving ? '结束直播' : '开始直播' }}
        </el-button>
      </div>
    </div>

    <div class="main-area">
      <!-- 左侧：视频 + 白板 -->
      <div class="left-panel">
        <!-- 视频区域 -->
        <div class="video-container" v-show="!isWhiteboardFull">
          <div class="local-video" ref="localVideoRef"></div>
          <div class="video-controls">
            <el-button 
              :type="isCameraOn ? 'primary' : 'info'" 
              circle 
              @click="toggleCamera"
            >
              <el-icon><VideoCamera /></el-icon>
            </el-button>
            <el-button 
              :type="isMicOn ? 'primary' : 'info'" 
              circle 
              @click="toggleMic"
            >
              <el-icon><Microphone /></el-icon>
            </el-button>
            <el-button 
              :type="isScreenSharing ? 'danger' : 'info'" 
              circle 
              @click="toggleScreenShare"
            >
              <el-icon><Monitor /></el-icon>
            </el-button>
            <el-button type="info" circle @click="switchCamera">
              <el-icon><Switch /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 白板区域 -->
        <div class="whiteboard-container" :class="{ fullscreen: isWhiteboardFull }">
          <div class="wb-toolbar">
            <el-button-group>
              <el-button size="small" @click="setWbTool('selector')">选择</el-button>
              <el-button size="small" @click="setWbTool('pen')">画笔</el-button>
              <el-button size="small" @click="setWbTool('text')">文字</el-button>
              <el-button size="small" @click="setWbTool('eraser')">橡皮</el-button>
            </el-button-group>
            <el-color-picker v-model="wbColor" size="small" @change="setWbColor" />
            <el-button size="small" @click="clearWb">清空</el-button>
            <el-button size="small" type="primary" :disabled="!isLiving" @click="uploadPPT">上传 PPT</el-button>
            <el-button size="small" @click="prevPage" :disabled="currentPage <= 1">上一页</el-button>
            <span class="page-info">{{ currentPage }} / {{ totalPage }}</span>
            <el-button size="small" @click="nextPage" :disabled="currentPage >= totalPage">下一页</el-button>
            <el-button size="small" @click="isWhiteboardFull = !isWhiteboardFull">
              {{ isWhiteboardFull ? '退出全屏' : '全屏' }}
            </el-button>
          </div>
          <div class="whiteboard" :id="whiteboardDomId" ref="whiteboardRef"></div>
        </div>
      </div>

      <!-- 右侧：互动面板 -->
      <div class="right-panel">
        <!-- 连麦申请 -->
        <el-card class="panel-card" v-if="handUpList.length > 0">
          <template #header>
            <span>连麦申请 ({{ handUpList.length }})</span>
          </template>
          <div v-for="item in handUpList" :key="item.userID" class="handup-item">
            <span>{{ item.userName }}</span>
            <div>
              <el-button size="small" type="success" @click="acceptCoHost(item)">同意</el-button>
              <el-button size="small" @click="rejectCoHost(item)">拒绝</el-button>
            </div>
          </div>
        </el-card>

        <!-- 连中学生视频 -->
        <el-card class="panel-card" v-if="coHostStreams.length > 0">
          <template #header><span>连麦学生</span></template>
          <div class="cohost-grid">
            <div v-for="stream in coHostStreams" :key="stream.streamID" class="cohost-item">
              <div :id="'cohost-' + stream.streamID" class="cohost-video"></div>
              <span class="cohost-name">{{ stream.userName }}</span>
              <el-button link type="danger" size="small" @click="kickCoHost(stream)">挂断</el-button>
            </div>
          </div>
        </el-card>

        <!-- 聊天区 -->
        <el-card class="panel-card chat-card">
          <template #header><span>课堂互动</span></template>
          <div class="chat-messages" ref="chatScrollRef">
            <div 
              v-for="msg in messages" 
              :key="msg.id" 
              class="chat-msg"
              :class="{ self: msg.isSelf, system: msg.isSystem }"
            >
              <div class="msg-header">
                <span class="msg-name">{{ msg.userName }}</span>
                <span class="msg-time">{{ msg.time }}</span>
              </div>
              <div class="msg-content">{{ msg.content }}</div>
            </div>
          </div>
          <div class="chat-input">
            <el-input 
              v-model="chatText" 
              placeholder="输入消息..." 
              @keyup.enter="sendChat"
            >
              <template #append>
                <el-button @click="sendChat">发送</el-button>
              </template>
            </el-input>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 结束直播确认 -->
    <el-dialog v-model="endDialogVisible" title="结束直播" width="400px">
      <p>确认结束直播？结束后将自动生成回放。</p>
      <template #footer>
        <el-button @click="endDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmEndLive">确认结束</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ZegoExpressEngine } from 'zego-express-engine-webrtc'
import { ZegoSuperBoardManager } from 'zego-superboard-web'
import { getLiveRoomDetail, endLive, approveCohost as approveCohostApi, rejectCohost as rejectCohostApi, kickCohost as kickCohostApi } from '@/api/live'

const route = useRoute()
const roomId = route.params.id

// ==================== ZEGO 配置 ====================
const ZEGO_CONFIG = {
  appID: 0,
  server: '',
  tokenUrl: '/api/zego/token' // 自研后端获取 token 的接口
}
const zegoSessionId = `teacher_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

// ==================== 状态 ====================
const zg = ref(null)
const zegoRoomID = ref('')
const localStream = ref(null)
const screenStream = ref(null)
const isLiving = ref(false)
const isCameraOn = ref(true)
const isMicOn = ref(true)
const isScreenSharing = ref(false)
const onlineCount = ref(0)
const roomInfo = ref({})

// 白板
const whiteboardRef = ref(null)
const zegoSuperBoard = ref(null)
const currentSuperBoardView = ref(null)
const isWhiteboardFull = ref(false)
const wbColor = ref('#000000')
const currentPage = ref(1)
const totalPage = ref(1)
const whiteboardReady = ref(false)
const whiteboardDomId = `teacher-whiteboard-${roomId}`

// 连麦
const handUpList = ref([])
const coHostStreams = ref([])

// 聊天
const messages = ref([])
const chatText = ref('')
const chatScrollRef = ref(null)
const localVideoRef = ref(null)
const zegoAuthInfo = ref(null)

// 结束直播弹窗
const endDialogVisible = ref(false)

const parseErrorMessage = (err, fallback = '未知错误') => {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err.message) return err.message
  if (err.msg) return err.msg
  if (err.error && typeof err.error === 'string') return err.error
  try {
    return JSON.stringify(err)
  } catch (e) {
    return fallback
  }
}

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ==================== 初始化 ZEGO ====================
const initZego = async () => {
  zg.value = ZEGO_CONFIG.server
    ? new ZegoExpressEngine(ZEGO_CONFIG.appID, ZEGO_CONFIG.server)
    : new ZegoExpressEngine(ZEGO_CONFIG.appID)
  
  // 监听房间用户变化
  zg.value.on('roomUserUpdate', (roomID, updateType, userList) => {
    if (updateType === 'ADD') {
      onlineCount.value += userList.length
    } else {
      onlineCount.value = Math.max(0, onlineCount.value - userList.length)
    }
  })

  // 监听流变化（学生连麦推流）
  zg.value.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
    if (updateType === 'ADD') {
      for (const stream of streamList) {
        if (!stream.streamID.includes('screen')) {
          coHostStreams.value.push({
            streamID: stream.streamID,
            userID: stream.userID,
            userName: stream.userName || '学生'
          })
          await nextTick()
          zg.value.startPlayingStream(stream.streamID, {
            video: document.getElementById('cohost-' + stream.streamID),
            audio: true
          })
        }
      }
    } else {
      for (const stream of streamList) {
        zg.value.stopPlayingStream(stream.streamID)
        coHostStreams.value = coHostStreams.value.filter(s => s.streamID !== stream.streamID)
      }
    }
  })

  // 监听 IM 消息
  zg.value.on('IMRecvBroadcastMessage', (roomID, chatData) => {
    chatData.forEach(msg => {
      try {
        const data = JSON.parse(msg.message)
        if (data.type === 'chat') {
          messages.value.push({
            id: Date.now() + Math.random(),
            userName: msg.fromUser.userName,
            content: data.content,
            time: new Date().toLocaleTimeString(),
            isSelf: false
          })
          scrollToBottom()
        } else if (data.type === 'handup') {
          if (!handUpList.value.find(h => h.userID === msg.fromUser.userID)) {
            handUpList.value.push({
              userID: msg.fromUser.userID,
              userName: msg.fromUser.userName
            })
            ElMessage.info(`${msg.fromUser.userName} 申请连麦`)
          }
        }
      } catch (e) {}
    })
  })
}

// 获取 Token
const getZegoAuth = async () => {
  const token = localStorage.getItem('token')
  const query = new URLSearchParams({
    roomID: String(zegoRoomID.value || ''),
    sessionId: zegoSessionId
  })
  const res = await fetch(`${ZEGO_CONFIG.tokenUrl}?${query.toString()}`, {
    headers: token ? { Authorization: 'Bearer ' + token } : {}
  })
  const data = await res.json()
  if (!res.ok || ![0, 200].includes(data.code)) {
    throw new Error(data.message || data.msg || '获取 ZEGO Token 失败')
  }

  const authInfo = data.data || {}
  ZEGO_CONFIG.appID = Number(authInfo.appId || 0)
  ZEGO_CONFIG.server = authInfo.server || null
  zegoAuthInfo.value = authInfo
  return authInfo
}

const ensureZegoReady = async () => {
  const authInfo = await getZegoAuth()
  if (!ZEGO_CONFIG.appID) {
    throw new Error('ZEGO_APP_ID 未配置')
  }
  if (!zg.value) {
    await initZego()
  }
  return authInfo
}

// ==================== 直播控制 ====================
const handleStartLive = async () => {
  try {
    const authInfo = await ensureZegoReady()
    if (!authInfo.canPublish) {
      throw new Error('当前账号不是本直播间讲师，无推流权限')
    }
    const userID = authInfo.userId
    const userName = authInfo.userName
    const token = authInfo.token
    
    await zg.value.loginRoom(zegoRoomID.value, token, { userID, userName })

    localStream.value = await zg.value.createStream({
      camera: { video: true, audio: true, videoQuality: 2, width: 1280, height: 720 }
    })
    
    await renderLocalStream(localVideoRef.value, localStream.value)

    const streamID = 'teacher_' + roomId
    await zg.value.startPublishingStream(streamID, localStream.value)
    isLiving.value = true
    ElMessage.success('直播已开始')

    try {
      whiteboardReady.value = false
      currentSuperBoardView.value = null
      await initWhiteboard(zegoRoomID.value, token, userID, userName)
    } catch (wbErr) {
      whiteboardReady.value = false
      ElMessage.warning('直播已开始，但白板初始化失败：' + parseErrorMessage(wbErr))
    }
  } catch (err) {
    ElMessage.error('开始直播失败: ' + parseErrorMessage(err))
  }
}

const refreshCurrentSuperBoardView = () => {
  const boardView = zegoSuperBoard.value?.getSuperBoardView?.()
  const activeSubView = boardView?.getCurrentSuperBoardSubView?.()
  if (!activeSubView) return false

  currentSuperBoardView.value = activeSubView
  totalPage.value = activeSubView.getPageCount?.() || 1
  currentPage.value = activeSubView.getCurrentPage?.() || 1
  return true
}

const switchToCreatedSubView = async (result) => {
  // 兼容不同 SDK 返回结构：可能直接带 fileView/whiteboardView，也可能仅返回 uniqueID。
  const directView = result?.fileView || result?.whiteboardView || null
  if (directView) {
    currentSuperBoardView.value = directView
    totalPage.value = directView.getPageCount?.() || 1
    currentPage.value = directView.getCurrentPage?.() || 1
    return
  }

  const uniqueID = result?.uniqueID || result?.model?.uniqueID || null
  if (!uniqueID) {
    refreshCurrentSuperBoardView()
    return
  }

  const boardView = zegoSuperBoard.value?.getSuperBoardView?.()
  if (!boardView?.switchSuperBoardSubView) {
    refreshCurrentSuperBoardView()
    return
  }

  await boardView.switchSuperBoardSubView(uniqueID)
  refreshCurrentSuperBoardView()
}

const handleEndLive = () => {
  endDialogVisible.value = true
}

const confirmEndLive = async () => {
  try {
    const streamID = 'teacher_' + roomId
    try {
      zg.value.stopPublishingStream(streamID)
    } catch (e) {}

    try {
      if (localStream.value) {
        zg.value.destroyStream(localStream.value)
        localStream.value = null
      }
    } catch (e) {}

    try {
      if (screenStream.value) {
        zg.value.stopPublishingStream(streamID + '_screen')
        zg.value.destroyStream(screenStream.value)
        screenStream.value = null
      }
    } catch (e) {}

    try {
      coHostStreams.value.forEach(s => {
        try {
          zg.value.stopPlayingStream(s.streamID)
        } catch (e) {}
      })
      coHostStreams.value = []
    } catch (e) {}

    let stopError = null
    try {
      await endLive(roomId)
    } catch (err) {
      stopError = err
    }

    try {
      await zg.value.logoutRoom(zegoRoomID.value)
    } catch (e) {}

    try {
      if (zegoSuperBoard.value) {
        zegoSuperBoard.value.destroy()
      }
    } catch (e) {}

    whiteboardReady.value = false
    currentSuperBoardView.value = null

    if (stopError) {
      throw stopError
    }

    isLiving.value = false
    endDialogVisible.value = false
    onlineCount.value = 0
    ElMessage.success('直播已结束，回放生成中...')
  } catch (err) {
    ElMessage.error('结束直播失败：' + parseErrorMessage(err))
  }
}

// ==================== 设备控制 ====================
const toggleCamera = () => {
  if (!localStream.value) return
  localStream.value.getVideoTracks().forEach(track => {
    track.enabled = !isCameraOn.value
  })
  isCameraOn.value = !isCameraOn.value
}

const toggleMic = () => {
  if (!localStream.value) return
  localStream.value.getAudioTracks().forEach(track => {
    track.enabled = !isMicOn.value
  })
  isMicOn.value = !isMicOn.value
}

const toggleScreenShare = async () => {
  if (isScreenSharing.value) {
    const screenStreamID = 'teacher_' + roomId + '_screen'
    zg.value.stopPublishingStream(screenStreamID)
    zg.value.destroyStream(screenStream.value)
    screenStream.value = null
    isScreenSharing.value = false
    const streamID = 'teacher_' + roomId
    await zg.value.startPublishingStream(streamID, localStream.value)
  } else {
    try {
      screenStream.value = await zg.value.createStream({
        screen: { audio: true, videoQuality: 2, width: 1920, height: 1080, frameRate: 15, bitrate: 1500 }
      })
      const streamID = 'teacher_' + roomId
      zg.value.stopPublishingStream(streamID)
      const screenStreamID = streamID + '_screen'
      await zg.value.startPublishingStream(screenStreamID, screenStream.value)
      isScreenSharing.value = true
    } catch (err) {
      ElMessage.warning('屏幕共享已取消')
    }
  }
}

const switchCamera = async () => {
  const devices = await zg.value.enumDevices()
  ElMessage.info('切换摄像头功能')
}

// ==================== 白板 ====================
const initWhiteboard = async (roomID, token, userID, userName) => {
  await nextTick()

  if (!whiteboardRef.value || !whiteboardRef.value.offsetWidth || !whiteboardRef.value.offsetHeight) {
    throw new Error('白板容器未就绪，请稍后重试')
  }

  zegoSuperBoard.value = ZegoSuperBoardManager.getInstance()
  
  await zegoSuperBoard.value.init(zg.value, {
    parentDomID: whiteboardDomId,
    appID: ZEGO_CONFIG.appID,
    token: token,
    userID: userID,
    userName: userName || roomInfo.value.teacherName || userID,
    isTestEnv: false
  })

  const result = await zegoSuperBoard.value.createWhiteboardView({
    name: '课件白板', perPageWidth: 1600, perPageHeight: 900, pageCount: 5
  })

  await switchToCreatedSubView(result)
  whiteboardReady.value = true
}

const setWbTool = (tool) => {
  if (!currentSuperBoardView.value) return
  const toolMap = { selector: 0, pen: 1, text: 2, eraser: 4 }
  currentSuperBoardView.value.setToolType(toolMap[tool] || 0)
}

const setWbColor = (color) => {
  if (!currentSuperBoardView.value) return
  currentSuperBoardView.value.setBrushColor(color)
}

const clearWb = () => {
  if (!currentSuperBoardView.value) return
  currentSuperBoardView.value.clear()
}

const uploadPPT = async () => {
  if (!isLiving.value) {
    ElMessage.warning('请先开始直播后再上传 PPT')
    return
  }
  if (!zegoSuperBoard.value) {
    ElMessage.warning('白板尚未初始化，请稍后重试')
    return
  }
  if (!whiteboardReady.value || !currentSuperBoardView.value) {
    ElMessage.warning('白板尚未就绪，请先确认开播后白板初始化成功')
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ppt,.pptx,.pdf'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const lowerName = String(file.name || '').toLowerCase()
    const isPdf = lowerName.endsWith('.pdf')
    const isPpt = lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx')
    if (!isPdf && !isPpt) {
      ElMessage.warning('仅支持 .ppt / .pptx / .pdf 文件')
      return
    }
    
    ElMessage.info('PPT 上传中...')
    try {
      // SDK 在不同打包形态下可能拿不到枚举对象，这里使用固定数值更稳定：
      // IMG = 2, DynamicPPTH5 = 6, VectorAndIMG = 3
      const primaryRenderType = isPdf ? 2 : 6
      const fallbackRenderType = 3
      let fileID = ''

      try {
        fileID = await zegoSuperBoard.value.uploadFile(
          file,
          primaryRenderType,
          () => {},
          { renderImgType: 1 }
        )
      } catch (primaryErr) {
        if (isPdf) throw primaryErr
        // 动态PPT不可用时自动回退到通用模式，保证可展示
        fileID = await zegoSuperBoard.value.uploadFile(
          file,
          fallbackRenderType,
          () => {},
          { renderImgType: 1 }
        )
      }

      let wbResult = null
      try {
        wbResult = await zegoSuperBoard.value.createFileView({ fileID })
      } catch (createErr) {
        console.warn('[LivePush] createFileView failed, fallback to query list:', createErr)
      }

      if (wbResult) {
        await switchToCreatedSubView(wbResult)
      } else {
        let switched = false
        for (let retry = 0; retry < 8; retry += 1) {
          const subViewList = await zegoSuperBoard.value.querySuperBoardSubViewList()
          const targetSubView = subViewList.find((item) => item.fileID === fileID || item.name === file.name)
          if (targetSubView?.uniqueID) {
            await zegoSuperBoard.value.getSuperBoardView()?.switchSuperBoardSubView(targetSubView.uniqueID)
            refreshCurrentSuperBoardView()
            switched = true
            break
          }
          await delay(500)
        }

        if (!switched) {
          refreshCurrentSuperBoardView()
        }
      }
      ElMessage.success('PPT 加载成功')
    } catch (err) {
      ElMessage.error('PPT 上传失败: ' + (err?.message || '请检查白板转码配置'))
      console.error('[LivePush] PPT 上传失败:', err)
    }
  }
  input.click()
}

const prevPage = () => {
  if (!currentSuperBoardView.value || currentPage.value <= 1) return
  currentSuperBoardView.value.flipToPage(--currentPage.value)
}

const nextPage = () => {
  if (!currentSuperBoardView.value || currentPage.value >= totalPage.value) return
  currentSuperBoardView.value.flipToPage(++currentPage.value)
}

// ==================== 连麦管理 ====================
const acceptCoHost = async (student) => {
  await approveCohostApi(roomId, { userId: student.userID })
  await zg.value.sendBroadcastMessage(
    zegoRoomID.value,
    JSON.stringify({ type: 'cohost_accept', targetUserID: student.userID })
  )
  handUpList.value = handUpList.value.filter(h => h.userID !== student.userID)
  ElMessage.success(`已同意 ${student.userName} 连麦`)
}

const rejectCoHost = async (student) => {
  await rejectCohostApi(roomId, { userId: student.userID })
  await zg.value.sendBroadcastMessage(
    zegoRoomID.value,
    JSON.stringify({ type: 'cohost_reject', targetUserID: student.userID })
  )
  handUpList.value = handUpList.value.filter(h => h.userID !== student.userID)
}

const kickCoHost = async (stream) => {
  await kickCohostApi(roomId, { userId: stream.userID })
  await zg.value.sendBroadcastMessage(
    zegoRoomID.value,
    JSON.stringify({ type: 'cohost_kick', targetUserID: stream.userID })
  )
  zg.value.stopPlayingStream(stream.streamID)
  coHostStreams.value = coHostStreams.value.filter(s => s.streamID !== stream.streamID)
}

// ==================== 聊天 ====================
const sendChat = async () => {
  if (!chatText.value.trim()) return
  
  const msg = { type: 'chat', content: chatText.value.trim() }
  await zg.value.sendBroadcastMessage(zegoRoomID.value, JSON.stringify(msg))
  
  messages.value.push({
    id: Date.now(),
    userName: '我',
    content: chatText.value,
    time: new Date().toLocaleTimeString(),
    isSelf: true
  })
  
  chatText.value = ''
  scrollToBottom()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

// ==================== 生命周期 ====================
onMounted(async () => {
  const res = await getLiveRoomDetail(roomId)
  roomInfo.value = res
  zegoRoomID.value = res.zegoRoomId || 'room_' + roomId
})

onBeforeUnmount(() => {
  if (isLiving.value) {
    confirmEndLive()
  }
  if (zg.value) {
    zg.value.destroyEngine()
  }
})
</script>

<style scoped lang="scss">
.teacher-live-room {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a2e;
  color: #fff;
}

.top-bar {
  height: 56px;
  background: #16213e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid #0f3460;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.room-title {
  font-size: 16px;
  font-weight: 600;
}

.online-count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #aaa;
  font-size: 14px;
}

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  overflow: hidden;
}

.video-container {
  height: 40%;
  min-height: 240px;
  background: #0f0f23;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.local-video {
  width: 100%;
  height: 100%;
  
  :deep(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.video-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  background: rgba(0,0,0,0.6);
  padding: 8px 16px;
  border-radius: 24px;
}

.whiteboard-container {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  
  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    border-radius: 0;
  }
}

.wb-toolbar {
  height: 44px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid #ddd;
  
  .page-info {
    color: #333;
    font-size: 14px;
    min-width: 60px;
    text-align: center;
  }
}

.whiteboard {
  flex: 1;
  position: relative;
  
  :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
  }
}

.right-panel {
  width: 340px;
  background: #16213e;
  border-left: 1px solid #0f3460;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
}

.panel-card {
  background: #1a1a2e;
  border: 1px solid #0f3460;
  
  :deep(.el-card__header) {
    background: #16213e;
    color: #fff;
    border-bottom: 1px solid #0f3460;
    padding: 12px 16px;
  }
  
  :deep(.el-card__body) {
    padding: 12px;
    color: #ddd;
  }
}

.handup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #333;
  
  &:last-child {
    border-bottom: none;
  }
}

.cohost-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cohost-item {
  background: #0f0f23;
  border-radius: 8px;
  overflow: hidden;
  text-align: center;
  padding-bottom: 8px;
}

.cohost-video {
  width: 100%;
  height: 100px;
  background: #000;
  
  :deep(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.cohost-name {
  display: block;
  font-size: 12px;
  margin: 4px 0;
  color: #aaa;
}

.chat-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-msg {
  .msg-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: 12px;
  }
  
  .msg-name {
    color: #409EFF;
    font-weight: 600;
  }
  
  .msg-time {
    color: #666;
  }
  
  .msg-content {
    background: #0f3460;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 14px;
    word-break: break-all;
  }
  
  &.self {
    .msg-name {
      color: #67C23A;
    }
    
    .msg-content {
      background: #1f4f28;
    }
  }
  
  &.system {
    text-align: center;
    
    .msg-content {
      background: transparent;
      color: #999;
      font-size: 12px;
    }
  }
}

.chat-input {
  padding: 12px;
  border-top: 1px solid #0f3460;
}
</style>
