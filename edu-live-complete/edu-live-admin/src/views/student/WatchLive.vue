<template>
  <div class="watch-live">
    <!-- 顶部栏 -->
    <div class="header">
      <div class="live-info">
        <el-tag v-if="status === 'living'" type="danger" effect="dark">● 直播中</el-tag>
        <el-tag v-else-if="status === 'upcoming'" type="primary">即将开始</el-tag>
        <el-tag v-else type="info">已结束</el-tag>
        <span class="title">{{ roomInfo?.title || '直播间' }}</span>
        <span v-if="roomInfo?.anchorName" class="anchor">主播：{{ roomInfo.anchorName }}</span>
      </div>
      <div class="right-info">
        <span class="online">
          <el-icon><User /></el-icon> {{ onlineCount }} 人在线
        </span>
        <el-button v-if="isTeacher" type="warning" size="small" @click="goToPush">
          去推流
        </el-button>
      </div>
    </div>

    <div class="main">
      <!-- 左侧：视频 + 白板 -->
      <div class="left">
        <!-- 视频区域 -->
        <div class="video-box" v-show="!isWhiteboardFull" :style="{ height: hasScreenShare ? '40%' : '60%' }">
          <div id="remote-video" class="video-player"></div>
          <!-- 屏幕分享流 -->
          <div v-if="hasScreenShare" id="screen-video" class="screen-player"></div>
          <div class="video-placeholder" v-if="status !== 'living'">
            <el-icon size="48"><VideoCamera /></el-icon>
            <p>{{ status === 'upcoming' ? '直播即将开始，请稍候...' : '直播已结束，感谢观看' }}</p>
            <p v-if="roomInfo?.scheduledAt" class="schedule-time">
              预计开始：{{ formatTime(roomInfo.scheduledAt) }}
            </p>
          </div>
        </div>

        <!-- 白板区域 -->
        <div class="whiteboard-box" :class="{ fullscreen: isWhiteboardFull }" v-if="hasWhiteboard">
          <div class="wb-header">
            <span class="wb-title">课件白板</span>
            <div class="wb-controls">
              <el-button-group v-if="totalPage > 1">
                <el-button size="small" @click="prevPage" :disabled="currentPage <= 1">
                  <el-icon><ArrowLeft /></el-icon>
                </el-button>
                <el-button size="small" disabled>{{ currentPage }} / {{ totalPage }}</el-button>
                <el-button size="small" @click="nextPage" :disabled="currentPage >= totalPage">
                  <el-icon><ArrowRight /></el-icon>
                </el-button>
              </el-button-group>
              <el-button size="small" @click="isWhiteboardFull = !isWhiteboardFull">
                <el-icon><FullScreen /></el-icon>
                {{ isWhiteboardFull ? '退出全屏' : '全屏' }}
              </el-button>
            </div>
          </div>
          <div class="whiteboard" ref="whiteboardRef" id="superboard"></div>
        </div>
      </div>

      <!-- 右侧：聊天 -->
      <div class="right">
        <div class="chat-box">
          <div class="chat-header">
            <el-icon><ChatDotRound /></el-icon> 课堂互动
          </div>
          <div class="chat-messages" ref="chatScrollRef">
            <div v-if="messages.length === 0" class="chat-empty">
              暂无消息，来说两句吧~
            </div>
            <div v-for="msg in messages" :key="msg.id" class="chat-msg" :class="{ self: msg.isSelf, system: msg.isSystem }">
              <div v-if="msg.isSystem" class="system-text">{{ msg.content }}</div>
              <template v-else>
                <div class="msg-header">
                  <span class="msg-name">{{ msg.userName }}</span>
                  <span class="msg-time">{{ msg.time }}</span>
                </div>
                <div class="msg-content">{{ msg.content }}</div>
              </template>
            </div>
          </div>
          <div class="chat-input">
            <el-input
              v-model="chatText"
              placeholder="输入消息参与互动..."
              maxlength="100"
              show-word-limit
              @keyup.enter="sendChat"
            >
              <template #append>
                <el-button type="primary" @click="sendChat" :loading="sending">发送</el-button>
              </template>
            </el-input>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getLiveRoomDetail } from '@/api/live'

const route = useRoute()
const router = useRouter()
const roomId = route.params.id

// 老师身份检查（URL参数 ?role=teacher 用于老师预览）
const isTeacher = ref(route.query.role === 'teacher')

// 直播间信息
const roomInfo = ref({})
const status = ref('upcoming') // upcoming | living | finished
const onlineCount = ref(0)
const hasWhiteboard = ref(false)
const hasScreenShare = ref(false)
const sending = ref(false)

// 白板
const whiteboardRef = ref(null)
const isWhiteboardFull = ref(false)
const currentPage = ref(1)
const totalPage = ref(1)

// 聊天
const messages = ref([])
const chatText = ref('')
const chatScrollRef = ref(null)

// ZEGO 相关
let zg = null
let zegoSuperBoard = null
let zegoRoomID = ''
let userID = ''
let streamMap = new Map()

const ZEGO_CONFIG = ref({
  appID: 0,
  server: '',
  tokenUrl: '/api/live/token'
})

// 加载 ZEGO Express SDK
const loadZegoSDK = () => {
  return new Promise((resolve, reject) => {
    if (window.ZegoExpressEngine) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://zego-im-sdk.s3.cn-north-1.amazonaws.com.cn/zegocloud/web/ZegoExpressEnginewebrtc-3.7.0.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('ZEGO SDK 加载失败'))
    document.head.appendChild(script)
  })
}

// 加载 ZEGO SuperBoard SDK
const loadSuperBoardSDK = () => {
  return new Promise((resolve, reject) => {
    if (window.ZegoSuperBoardManager) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://storage.zego.im/goclass/ZegoSuperBoardManagerWeb/dist/main.js'
    script.onload = resolve
    script.onerror = () => reject(new Error('SuperBoard SDK 加载失败'))
    document.head.appendChild(script)
  })
}

// 获取直播间信息
const fetchRoomInfo = async () => {
  try {
    const res = await getLiveRoomDetail(roomId)
    roomInfo.value = res.data || {}
    zegoRoomID = roomInfo.value.zegoRoomId || 'room_' + roomId
    status.value = roomInfo.value.status || 'upcoming'

    // 更新 ZEGO 配置（如果后端返回了配置）
    if (roomInfo.value.zegoAppId) {
      ZEGO_CONFIG.value.appID = Number(roomInfo.value.zegoAppId)
      ZEGO_CONFIG.value.server = roomInfo.value.zegoServer || ''
    }

    // 如果有白板ID，标记需要加载白板
    if (roomInfo.value.whiteboardRoomId) {
      hasWhiteboard.value = true
    }

    return roomInfo.value
  } catch (err) {
    ElMessage.error('获取直播间信息失败')
    throw err
  }
}

// 初始化 ZEGO Express（学生 - 拉流观看）
const initZego = async () => {
  if (!ZEGO_CONFIG.value.appID || !ZEGO_CONFIG.value.server) {
    console.warn('ZEGO 未配置，仅使用聊天功能')
    return false
  }

  await loadZegoSDK()
  const ZegoExpressEngine = window.ZegoExpressEngine
  zg = new ZegoExpressEngine(ZEGO_CONFIG.value.appID, ZEGO_CONFIG.value.server)

  // 监听房间用户变化
  zg.on('roomUserUpdate', (roomID, updateType, userList) => {
    if (updateType === 'ADD') {
      onlineCount.value += userList.length
      userList.forEach(u => {
        addSystemMessage(`${u.userName} 进入了直播间`)
      })
    } else {
      onlineCount.value = Math.max(0, onlineCount.value - userList.length)
      userList.forEach(u => {
        addSystemMessage(`${u.userName} 离开了直播间`)
      })
    }
  })

  // 监听房间流变化（老师推流）
  zg.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
    if (updateType === 'ADD') {
      for (const stream of streamList) {
        const streamID = stream.streamID

        if (streamID.includes('screen')) {
          // 屏幕分享流
          hasScreenShare.value = true
          await zg.startPlayingStream(streamID, {
            video: document.getElementById('screen-video'),
            audio: false
          })
          streamMap.set(streamID, 'screen')
        } else if (streamID.includes('whiteboard')) {
          // 白板视频流（可选）
          streamMap.set(streamID, 'whiteboard')
        } else {
          // 老师摄像头流
          await zg.startPlayingStream(streamID, {
            video: document.getElementById('remote-video'),
            audio: true
          })
          streamMap.set(streamID, 'camera')
          status.value = 'living'
        }
      }
      // 首次收到视频流，更新状态
      if (status.value !== 'finished') {
        status.value = 'living'
      }
    } else {
      // 流停止
      for (const stream of streamList) {
        const streamID = stream.streamID
        if (streamMap.has(streamID)) {
          await zg.stopPlayingStream(streamID)
          streamMap.delete(streamID)
        }
        if (streamID.includes('screen')) {
          hasScreenShare.value = false
        }
      }
      // 如果没有摄像头流了，标记直播结束
      const hasCamera = Array.from(streamMap.values()).includes('camera')
      if (!hasCamera && status.value === 'living') {
        status.value = 'finished'
        addSystemMessage('直播已结束')
      }
    }
  })

  // 监听 IM 消息
  zg.on('IMRecvBroadcastMessage', (roomID, chatData) => {
    chatData.forEach(msg => {
      try {
        const data = JSON.parse(msg.message)
        if (data.type === 'chat') {
          messages.value.push({
            id: Date.now() + Math.random(),
            userName: msg.fromUser.userName,
            content: data.content,
            time: new Date().toLocaleTimeString(),
            isSelf: false,
            isSystem: false
          })
          scrollToBottom()
        } else if (data.type === 'system') {
          addSystemMessage(data.content)
        }
      } catch (e) {
        // 纯文本消息
        messages.value.push({
          id: Date.now() + Math.random(),
          userName: msg.fromUser.userName,
          content: msg.message,
          time: new Date().toLocaleTimeString(),
          isSelf: false,
          isSystem: false
        })
        scrollToBottom()
      }
    })
  })

  // 监听房间状态
  zg.on('roomStateChanged', (roomID, reason, errorCode, extend) => {
    console.log('房间状态变化:', roomID, reason, errorCode)
    if (reason === 'LOGINING') {
      addSystemMessage('正在连接直播间...')
    } else if (reason === 'LOGINED') {
      addSystemMessage('已成功进入直播间')
    } else if (reason === 'LOGOUT') {
      addSystemMessage('已断开连接')
    } else if (reason === 'LOGIN_FAILED') {
      addSystemMessage('连接失败，正在重试...')
    }
  })

  return true
}

// 初始化白板（SuperBoard）
const initWhiteboard = async () => {
  if (!hasWhiteboard.value) return
  try {
    await loadSuperBoardSDK()
    const ZegoSuperBoardManager = window.ZegoSuperBoardManager
    zegoSuperBoard = ZegoSuperBoardManager.getInstance()

    await zegoSuperBoard.init(zg, {
      parentDom: 'superboard',
      appID: ZEGO_CONFIG.value.appID,
      userID,
      token: await getToken(userID, zegoRoomID)
    })

    // 获取当前白板页码信息
    zegoSuperBoard.on('superBoardPageChanged', (page, total) => {
      currentPage.value = page
      totalPage.value = total
    })

    // 监听白板切换（老师切换PPT）
    zegoSuperBoard.on('remoteSuperBoardSubViewAdded', () => {
      ElMessage.info('老师分享了新的课件')
    })
  } catch (err) {
    console.warn('白板初始化失败:', err.message)
  }
}

// 进入房间
const enterRoom = async () => {
  try {
    // 获取直播间信息
    await fetchRoomInfo()

    // 生成/恢复用户ID（刷新页面保持同一身份）
    const storageKey = `watch_user_${roomId}`
    const savedUserID = localStorage.getItem(storageKey)
    if (savedUserID) {
      userID = savedUserID
    } else {
      userID = 's_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
      localStorage.setItem(storageKey, userID)
    }

    const userName = localStorage.getItem('watch_name') || '同学' + Math.floor(Math.random() * 9999)

    // 初始化 ZEGO
    const inited = await initZego()
    if (!inited) {
      addSystemMessage('直播服务未配置，仅显示聊天功能')
      return
    }

    // 获取 Token
    const token = await getToken(userID, zegoRoomID)

    // 登录房间
    await zg.loginRoom(zegoRoomID, token, { userID, userName })

    // 初始化白板
    await initWhiteboard()

    // 如果当前正在直播，主动查询流列表
    const streamList = await zg.streamQueriesNonOrig(zegoRoomID)
    if (streamList && streamList.length > 0) {
      status.value = 'living'
    }

  } catch (err) {
    console.error('进入直播失败:', err)
    addSystemMessage('进入直播间失败: ' + (err.message || '请刷新页面重试'))
  }
}

// 获取 Token
const getToken = async (uid, roomID) => {
  try {
    const res = await fetch(`${ZEGO_CONFIG.value.tokenUrl}?userID=${uid}&roomID=${roomID}`)
    const data = await res.json()
    if (data.code !== 0) throw new Error(data.msg || '获取 Token 失败')
    return data.token
  } catch (err) {
    console.error('获取 Token 失败:', err)
    // 返回一个空token让流程继续（实际项目中应该处理错误）
    return ''
  }
}

// 发送聊天
const sendChat = async () => {
  if (!chatText.value.trim()) return
  if (!zg) {
    ElMessage.warning('聊天服务未连接')
    return
  }

  sending.value = true
  try {
    const content = chatText.value.trim()
    const msg = { type: 'chat', content }
    await zg.sendBroadcastMessage(zegoRoomID, JSON.stringify(msg))

    messages.value.push({
      id: Date.now(),
      userName: '我',
      content: content,
      time: new Date().toLocaleTimeString(),
      isSelf: true,
      isSystem: false
    })

    chatText.value = ''
    scrollToBottom()
  } catch (err) {
    ElMessage.error('发送失败')
  } finally {
    sending.value = false
  }
}

// 添加系统消息
const addSystemMessage = (text) => {
  messages.value.push({
    id: Date.now() + Math.random(),
    userName: '系统',
    content: text,
    time: new Date().toLocaleTimeString(),
    isSelf: false,
    isSystem: true
  })
  scrollToBottom()
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight
    }
  })
}

// 白板翻页
const prevPage = () => {
  if (currentPage.value > 1 && zegoSuperBoard) {
    zegoSuperBoard.flipPage(currentPage.value - 1)
  }
}
const nextPage = () => {
  if (currentPage.value < totalPage.value && zegoSuperBoard) {
    zegoSuperBoard.flipPage(currentPage.value + 1)
  }
}

// 跳转到推流页面（老师）
const goToPush = () => {
  router.push(`/teacher/live-push/${roomId}`)
}

// 格式化时间
const formatTime = (t) => {
  if (!t) return ''
  return new Date(t).toLocaleString()
}

// 心跳保活
let heartbeatTimer = null
const startHeartbeat = () => {
  heartbeatTimer = setInterval(async () => {
    try {
      await fetch(`/api/live/room/${roomId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userID })
      })
    } catch (e) {}
  }, 30000)
}

// 页面可见性变化处理（切回页面时重连）
const handleVisibilityChange = () => {
  if (!document.hidden && zg) {
    // 页面重新可见，检查连接状态
    zg.roomStateQueriesNonOrig(zegoRoomID).then(state => {
      if (state === 'DISCONNECTED') {
        addSystemMessage('重新连接中...')
        enterRoom()
      }
    }).catch(() => {
      addSystemMessage('重新连接中...')
      enterRoom()
    })
  }
}

// 生命周期
onMounted(() => {
  enterRoom()
  startHeartbeat()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (zg) {
    // 发送离开消息
    try {
      const msg = { type: 'system', content: '有观众离开了直播间' }
      zg.sendBroadcastMessage(zegoRoomID, JSON.stringify(msg))
    } catch (e) {}
    zg.logoutRoom(zegoRoomID)
    zg.destroyEngine()
  }
})
</script>

<style scoped>
.watch-live {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0a1a;
  color: #fff;
  overflow: hidden;
}

.header {
  height: 50px;
  background: #141428;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #1e1e3a;
  flex-shrink: 0;
}

.live-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 16px;
  font-weight: 600;
}

.anchor {
  color: #9094a6;
  font-size: 13px;
}

.right-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.online {
  color: #9094a6;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 12px;
  min-width: 0;
}

.video-box {
  min-height: 200px;
  background: #0a0a1a;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  border: 1px solid #1e1e3a;
  display: flex;
  flex-direction: column;
}

.video-player {
  flex: 1;
  min-height: 0;
}

.video-player :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.screen-player {
  height: 60%;
  border-top: 1px solid #1e1e3a;
}

.screen-player :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.video-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #4a4a6a;
  gap: 12px;
  background: #0a0a1a;
}

.schedule-time {
  font-size: 13px;
  color: #606080;
}

.whiteboard-box {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #1e1e3a;
  min-height: 200px;
}

.whiteboard-box.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  border-radius: 0;
  border: none;
}

.wb-header {
  height: 40px;
  background: #f0f0f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #ddd;
  flex-shrink: 0;
}

.wb-title {
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.wb-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.whiteboard {
  flex: 1;
  background: #fff;
  min-height: 0;
}

.right {
  width: 340px;
  background: #141428;
  border-left: 1px solid #1e1e3a;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.chat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-weight: 600;
  border-bottom: 1px solid #1e1e3a;
  font-size: 14px;
  gap: 6px;
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-empty {
  text-align: center;
  color: #4a4a6a;
  padding: 40px 20px;
  font-size: 13px;
}

.chat-msg {
  font-size: 13px;
}

.msg-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.msg-name {
  color: #409EFF;
  font-weight: 600;
  font-size: 12px;
}

.msg-time {
  color: #4a4a6a;
  font-size: 11px;
}

.msg-content {
  background: #1e1e3a;
  padding: 8px 12px;
  border-radius: 8px;
  word-break: break-all;
  color: #e0e0e0;
  line-height: 1.5;
}

.chat-msg.self .msg-name {
  color: #67C23A;
}

.chat-msg.self .msg-content {
  background: #1a3a1a;
}

.chat-msg.system {
  text-align: center;
  padding: 4px 0;
}

.system-text {
  display: inline-block;
  color: #9094a6;
  font-size: 12px;
  background: #1a1a2e;
  padding: 4px 12px;
  border-radius: 12px;
}

.chat-input {
  padding: 12px;
  border-top: 1px solid #1e1e3a;
  flex-shrink: 0;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .main {
    flex-direction: column;
  }
  .right {
    width: 100%;
    height: 280px;
    border-left: none;
    border-top: 1px solid #1e1e3a;
  }
  .left {
    padding: 8px;
    gap: 8px;
  }
}
</style>
