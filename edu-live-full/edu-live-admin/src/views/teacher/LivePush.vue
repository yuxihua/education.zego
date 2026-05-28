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
            <el-button size="small" type="primary" @click="uploadPPT">上传 PPT</el-button>
            <el-button size="small" @click="prevPage" :disabled="currentPage <= 1">上一页</el-button>
            <span class="page-info">{{ currentPage }} / {{ totalPage }}</span>
            <el-button size="small" @click="nextPage" :disabled="currentPage >= totalPage">下一页</el-button>
            <el-button size="small" @click="isWhiteboardFull = !isWhiteboardFull">
              {{ isWhiteboardFull ? '退出全屏' : '全屏' }}
            </el-button>
          </div>
          <div class="whiteboard" ref="whiteboardRef"></div>
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
import { getLiveRoomDetail, endLive } from '@/api/live'

const route = useRoute()
const roomId = route.params.id

// ==================== ZEGO 配置 ====================
const ZEGO_CONFIG = {
  appID: 0, // 你的 ZEGO appID
  server: '', // 你的 ZEGO server 地址
  tokenUrl: '/api/zego/token' // 自研后端获取 token 的接口
}

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

// 连麦
const handUpList = ref([])
const coHostStreams = ref([])

// 聊天
const messages = ref([])
const chatText = ref('')
const chatScrollRef = ref(null)
const localVideoRef = ref(null)

// 结束直播弹窗
const endDialogVisible = ref(false)

// ==================== 初始化 ZEGO ====================
const initZego = async () => {
  zg.value = new ZegoExpressEngine(ZEGO_CONFIG.appID, ZEGO_CONFIG.server)
  
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
const getToken = async (userID) => {
  const res = await fetch(`${ZEGO_CONFIG.tokenUrl}?userID=${userID}&roomID=${zegoRoomID.value}`)
  const data = await res.json()
  return data.token
}

// ==================== 直播控制 ====================
const handleStartLive = async () => {
  try {
    const userID = 'teacher_' + roomInfo.value.teacherId
    const userName = roomInfo.value.teacherName
    const token = await getToken(userID)
    
    await zg.value.loginRoom(zegoRoomID.value, token, { userID, userName })

    localStream.value = await zg.value.createStream({
      camera: { video: true, audio: true, videoQuality: 2, width: 1280, height: 720 }
    })
    
    localStream.value.playVideo(localVideoRef.value)
    localStream.value.muteAudio(false)

    const streamID = 'teacher_' + roomId
    await zg.value.startPublishingStream(streamID, localStream.value)

    await initWhiteboard(zegoRoomID.value, token, userID)

    isLiving.value = true
    ElMessage.success('直播已开始')
  } catch (err) {
    ElMessage.error('开始直播失败: ' + err.message)
  }
}

const handleEndLive = () => {
  endDialogVisible.value = true
}

const confirmEndLive = async () => {
  try {
    const streamID = 'teacher_' + roomId
    zg.value.stopPublishingStream(streamID)
    
    if (localStream.value) {
      zg.value.destroyStream(localStream.value)
      localStream.value = null
    }
    
    if (screenStream.value) {
      zg.value.stopPublishingStream(streamID + '_screen')
      zg.value.destroyStream(screenStream.value)
      screenStream.value = null
    }

    coHostStreams.value.forEach(s => {
      zg.value.stopPlayingStream(s.streamID)
    })
    coHostStreams.value = []

    await zg.value.logoutRoom(zegoRoomID.value)

    if (zegoSuperBoard.value) {
      zegoSuperBoard.value.destroy()
    }

    await endLive(roomId)
    
    isLiving.value = false
    endDialogVisible.value = false
    onlineCount.value = 0
    ElMessage.success('直播已结束，回放生成中...')
  } catch (err) {
    ElMessage.error('结束直播失败')
  }
}

// ==================== 设备控制 ====================
const toggleCamera = () => {
  if (!localStream.value) return
  zg.value.mutePublishStreamVideo(localStream.value, isCameraOn.value)
  isCameraOn.value = !isCameraOn.value
}

const toggleMic = () => {
  if (!localStream.value) return
  zg.value.mutePublishStreamAudio(localStream.value, isMicOn.value)
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
const initWhiteboard = async (roomID, token, userID) => {
  zegoSuperBoard.value = ZegoSuperBoardManager.getInstance()
  
  await zegoSuperBoard.value.init(zg.value, {
    parentDom: whiteboardRef.value,
    appID: ZEGO_CONFIG.appID,
    token: token,
    roomID: roomID,
    userID: userID,
    userName: roomInfo.value.teacherName
  })

  const result = await zegoSuperBoard.value.createWhiteboardView({
    name: '课件白板', perPageWidth: 1600, perPageHeight: 900, pageCount: 5
  })

  currentSuperBoardView.value = result.whiteboardView
  totalPage.value = result.whiteboardView.getPageCount()
  
  currentSuperBoardView.value.on('scrollChange', (data) => {
    currentPage.value = data.currentPage
  })
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
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ppt,.pptx,.pdf'
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    ElMessage.info('PPT 上传中...')
    try {
      const result = await zegoSuperBoard.value.uploadFile(file, {
        fileName: file.name,
        fileType: file.name.endsWith('.pdf') ? 512 : 256
      })
      
      const wbResult = await zegoSuperBoard.value.createFileView({
        fileID: result.fileID,
        name: file.name
      })
      
      currentSuperBoardView.value = wbResult.fileView
      totalPage.value = wbResult.fileView.getPageCount()
      currentPage.value = 1
      ElMessage.success('PPT 加载成功')
    } catch (err) {
      ElMessage.error('PPT 上传失败')
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
  await zg.value.sendBroadcastMessage(
    zegoRoomID.value,
    JSON.stringify({ type: 'cohost_accept', targetUserID: student.userID })
  )
  handUpList.value = handUpList.value.filter(h => h.userID !== student.userID)
  ElMessage.success(`已同意 ${student.userName} 连麦`)
}

const rejectCoHost = async (student) => {
  await zg.value.sendBroadcastMessage(
    zegoRoomID.value,
    JSON.stringify({ type: 'cohost_reject', targetUserID: student.userID })
  )
  handUpList.value = handUpList.value.filter(h => h.userID !== student.userID)
}

const kickCoHost = async (stream) => {
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
  await initZego()
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
