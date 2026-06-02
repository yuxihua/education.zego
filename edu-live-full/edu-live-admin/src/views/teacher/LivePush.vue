<template>
  <div class="teacher-live-room">
    <!-- 顶部工具栏 -->
    <div class="top-bar">
      <div class="room-info">
        <el-tag type="success" effect="dark" v-if="isLiving && !canPublishLive">● 听课中</el-tag>
        <el-tag type="danger" effect="dark" v-else-if="isLiving">● 直播中</el-tag>
        <el-tag type="info" v-else>未开始</el-tag>
        <span class="room-title">{{ roomInfo.title }}</span>
        <span class="online-count">
          <el-icon><User /></el-icon> 在线 {{ onlineCount }} 人
        </span>
      </div>
      <div class="actions">
        <el-button size="large" @click="toggleLayoutMode">
          {{ layoutFreeMode ? '锁定布局' : '自由布局' }}
        </el-button>
        <el-button size="large" @click="resetLayout">
          重置布局
        </el-button>
        <el-button size="large" @click="showVideoPanel = !showVideoPanel">
          {{ showVideoPanel ? '隐藏摄像头' : '显示摄像头' }}
        </el-button>
        <el-button size="large" @click="showInteractionPanel = !showInteractionPanel">
          {{ showInteractionPanel ? '隐藏交流窗' : '显示交流窗' }}
        </el-button>
        <el-select
          v-if="canPublishLive"
          v-model="activeCameraDeviceId"
          placeholder="主摄像头"
          size="large"
          filterable
          clearable
          style="width: 220px"
          @change="handleMainCameraChange"
        >
          <el-option
            v-for="device in cameraDevices"
            :key="device.deviceId"
            :label="device.label"
            :value="device.deviceId"
          />
        </el-select>
        <el-button v-if="canPublishLive" size="large" @click="addCameraPreview">
          添加摄像头
        </el-button>
        <el-button v-if="canPublishLive" size="large" @click="refreshCameraDevices">
          刷新设备
        </el-button>
        <el-button 
          :type="isLiving ? 'danger' : 'primary'" 
          size="large"
          @click="isLiving ? handleEndLive() : handleStartLive()"
        >
          {{ canPublishLive ? (isLiving ? '结束直播' : '开始直播') : (isLiving ? '退出听课' : '进入听课') }}
        </el-button>
      </div>
    </div>

    <div class="main-area" :class="{ 'free-layout': layoutFreeMode }" ref="workspaceRef">
      <!-- 左侧：视频 + 白板 -->
      <div class="left-panel" ref="leftPanelRef">
        <!-- 视频区域 -->
        <div v-if="!layoutFreeMode && showVideoPanel && !isWhiteboardFull" class="video-container" ref="videoContainerRef">
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

        <div
          v-else-if="layoutFreeMode && showVideoPanel && !isWhiteboardFull"
          class="video-container floating-video"
          :style="getVideoPanelStyle()"
        >
          <div class="floating-handle" @mousedown.prevent="beginPanelDrag('video', $event)">
            <span>摄像头</span>
            <div class="floating-actions">
              <el-button text size="small" @click.stop="showVideoPanel = false">隐藏</el-button>
            </div>
          </div>
          <div class="local-video" ref="localVideoRef"></div>
          <div class="video-controls floating-controls">
            <el-button :type="isCameraOn ? 'primary' : 'info'" circle @click="toggleCamera">
              <el-icon><VideoCamera /></el-icon>
            </el-button>
            <el-button :type="isMicOn ? 'primary' : 'info'" circle @click="toggleMic">
              <el-icon><Microphone /></el-icon>
            </el-button>
            <el-button :type="isScreenSharing ? 'danger' : 'info'" circle @click="toggleScreenShare">
              <el-icon><Monitor /></el-icon>
            </el-button>
            <el-button type="info" circle @click="switchCamera">
              <el-icon><Switch /></el-icon>
            </el-button>
          </div>
          <div class="resize-handle" @mousedown.prevent="beginPanelResize('video', $event)"></div>
        </div>

        <!-- 白板区域 -->
        <div
          class="whiteboard-container"
          :class="{ fullscreen: isWhiteboardFull }"
          :style="getWhiteboardContainerStyle()"
          ref="whiteboardContainerRef"
        >
          <div class="wb-toolbar">
            <el-select
              v-if="!wbClassProtectMode && wbToolbarCompact"
              v-model="wbToolPicker"
              :disabled="wbToolbarLocked"
              size="small"
              style="width: 106px"
              @change="selectWbToolFromPicker"
            >
              <el-option v-for="item in wbToolPickerOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-button-group v-if="!wbClassProtectMode && !wbToolbarCompact">
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'selector' ? 'primary' : 'default'" @click="setWbTool('selector')">选择</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'scroll' ? 'primary' : 'default'" @click="setWbOperationMode('scroll')">拖拽</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'pen' ? 'primary' : 'default'" @click="setWbTool('pen')">画笔</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'text' ? 'primary' : 'default'" @click="setWbTool('text')">文字</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'line' ? 'primary' : 'default'" @click="setWbTool('line')">直线</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'rect' ? 'primary' : 'default'" @click="setWbTool('rect')">矩形</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'ellipse' ? 'primary' : 'default'" @click="setWbTool('ellipse')">椭圆</el-button>
              <el-button size="small" :disabled="wbToolbarLocked" :type="wbOperationMode === 'draw' && wbActiveTool === 'eraser' ? 'primary' : 'default'" @click="setWbTool('eraser')">橡皮</el-button>
            </el-button-group>
            <el-button v-if="!wbClassProtectMode" size="small" :disabled="wbToolbarLocked" @click="switchWbPrevTool">上一工具(Tab)</el-button>
            <el-button v-if="!wbClassProtectMode" size="small" @click="toggleWbToolbarCompact">{{ wbToolbarCompact ? '展开工具' : '精简工具' }}</el-button>
            <el-button size="small" @click="toggleWbToolbarLock">{{ wbToolbarLocked ? '解锁工具' : '锁定工具' }}</el-button>
            <el-button size="small" @click="toggleWbClassProtectMode">{{ wbClassProtectMode ? '退出课堂保护' : '课堂保护' }}</el-button>
            <el-color-picker v-if="!wbClassProtectMode && !wbToolbarCompact" v-model="wbColor" size="small" :disabled="wbToolbarLocked" @change="setWbColor" />
            <el-select
              v-if="!wbClassProtectMode && !wbToolbarCompact"
              v-model="wbBrushSize"
              :disabled="wbToolbarLocked"
              size="small"
              style="width: 96px"
              @change="setWbBrushSize"
            >
              <el-option v-for="size in wbBrushSizeOptions" :key="size" :label="`${size}px`" :value="size" />
            </el-select>
            <el-select
              v-if="!wbClassProtectMode && !wbToolbarCompact"
              v-model="wbLineStyle"
              :disabled="wbToolbarLocked"
              size="small"
              style="width: 88px"
              @change="setWbLineStyle"
            >
              <el-option label="实线" value="solid" />
              <el-option label="虚线" value="dashed" />
            </el-select>
            <el-switch
              v-if="!wbClassProtectMode && !wbToolbarCompact"
              v-model="wbShapeFilled"
              :disabled="wbToolbarLocked"
              size="small"
              inline-prompt
              active-text="填充"
              inactive-text="空心"
              @change="setWbShapeFilled"
            />
            <el-select
              v-if="!wbClassProtectMode && !wbToolbarCompact"
              v-model="wbAlpha"
              :disabled="wbToolbarLocked"
              size="small"
              style="width: 92px"
              @change="setWbAlpha"
            >
              <el-option
                v-for="alpha in wbAlphaOptions"
                :key="alpha"
                :label="`透明${100 - alpha}%`"
                :value="alpha"
              />
            </el-select>
            <el-button size="small" :disabled="wbToolbarLocked" @click="undoWb">撤销</el-button>
            <el-button v-if="!wbClassProtectMode" size="small" :disabled="wbToolbarLocked" @click="redoWb">重做</el-button>
            <el-button v-if="!wbClassProtectMode" size="small" :disabled="wbToolbarLocked" @click="clearWb">清空</el-button>
            <span class="wb-shortcut-tip">快捷键: G保护 K锁定 M精简 Tab切回 Ctrl+Z/Y [ / ]</span>
            <el-button v-if="!wbClassProtectMode" size="small" type="primary" :disabled="!isLiving" @click="uploadPPT">上传 PPT</el-button>
            <el-button size="small" @click="prevPage" :disabled="currentPage <= 1">上一页</el-button>
            <span class="page-info">{{ currentPage }} / {{ totalPage }}</span>
            <el-button size="small" @click="nextPage" :disabled="currentPage >= totalPage">下一页</el-button>
            <span v-if="wbStageText" class="wb-stage">{{ wbStageText }}</span>
            <el-button size="small" @click="toggleWhiteboardFull">
              {{ isWhiteboardFull ? '退出全屏' : '全屏' }}
            </el-button>
          </div>
          <div class="whiteboard" :id="whiteboardDomId" ref="whiteboardRef"></div>
          <div
            v-if="!isWhiteboardFull"
            class="wb-splitter wb-splitter-right"
            title="拖动调整白板宽度"
            @mousedown.prevent="beginWhiteboardWidthResize"
          ></div>
        </div>

        <div
          v-if="!isWhiteboardFull"
          class="wb-splitter"
          title="拖动调整白板高度"
          @mousedown.prevent="beginWhiteboardResize"
        ></div>

        <div v-if="cameraPreviewTiles.length > 0" class="camera-gallery" :class="{ 'free-layout': layoutFreeMode }" ref="cameraGalleryRef">
          <div class="camera-gallery-header">
            <div class="camera-gallery-summary">
              <span>多摄像头预览</span>
              <span class="camera-gallery-count">{{ cameraPreviewTiles.length }} 路</span>
            </div>
            <div class="camera-scene-actions">
              <el-button text size="small" @click="applyScenePreset('main')">主讲</el-button>
              <el-button text size="small" @click="applyScenePreset('screen')">屏幕</el-button>
              <el-button text size="small" @click="applyScenePreset('preview')">副机位巡览</el-button>
            </div>
          </div>
          <div class="camera-gallery-list">
            <div v-for="tile in cameraPreviewTiles" :key="tile.id" class="camera-gallery-item">
              <div class="camera-gallery-item-head">
                <div class="camera-title-wrap">
                  <span class="camera-gallery-title">{{ tile.label }}</span>
                  <span class="camera-stream-state" :class="{ publishing: tile.isPublishing }">
                    {{ tile.isPublishing ? '推流中' : '仅预览' }}
                  </span>
                </div>
                <div class="floating-actions">
                  <el-switch
                    :model-value="!!tile.autoPublish"
                    size="small"
                    inline-prompt
                    active-text="自动"
                    inactive-text="手动"
                    @change="(value) => setPreviewAutoPublish(tile.id, value)"
                  />
                  <el-button
                    text
                    size="small"
                    :disabled="!isLiving || tile.publishing"
                    @click="togglePreviewPublishing(tile.id)"
                  >
                    {{ tile.isPublishing ? '停推' : '副机位推流' }}
                  </el-button>
                  <el-button text size="small" @click="renameCameraPreview(tile.id)">重命名</el-button>
                  <el-button text size="small" @click="moveCameraPreview(tile.id, -1)">上移</el-button>
                  <el-button text size="small" @click="moveCameraPreview(tile.id, 1)">下移</el-button>
                  <el-button text size="small" @click="selectMainCameraFromPreview(tile.deviceId)">设主摄像头</el-button>
                  <el-button text size="small" @click="removeCameraPreview(tile.id)">关闭</el-button>
                </div>
              </div>
              <div :id="`camera-preview-${tile.id}`" class="camera-preview-video"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="layoutFreeMode && !showVideoPanel" class="restore-tab restore-video" @click="showVideoPanel = true">
        显示摄像头
      </div>

      <div v-if="layoutFreeMode && !showInteractionPanel" class="restore-tab restore-interaction" @click="showInteractionPanel = true">
        显示交流窗
      </div>

      <!-- 右侧：互动面板 -->
      <div
        v-if="showInteractionPanel"
        class="right-panel"
        :class="{ floating: layoutFreeMode, docked: !layoutFreeMode, collapsed: interactionCollapsed }"
        :style="getInteractionPanelStyle()"
      >
        <div v-if="!layoutFreeMode && !interactionCollapsed" class="dock-resize-handle" @mousedown.prevent="beginPanelResize('side', $event)"></div>
        <div v-if="layoutFreeMode" class="floating-panel-header" @mousedown.prevent="beginPanelDrag('interaction', $event)">
          <span>交流窗口</span>
          <div class="floating-actions">
            <el-button text size="small" @click.stop="toggleInteractionCollapse">
              {{ interactionCollapsed ? '展开' : '折叠' }}
            </el-button>
            <el-button text size="small" @click.stop="showInteractionPanel = false">隐藏</el-button>
          </div>
        </div>

        <div v-else-if="!layoutFreeMode" class="dock-panel-header">
          <span>交流窗口</span>
          <div class="floating-actions">
            <el-button text size="small" @click.stop="toggleInteractionCollapse">
              {{ interactionCollapsed ? '展开' : '折叠' }}
            </el-button>
            <el-button text size="small" @click.stop="showInteractionPanel = false">隐藏</el-button>
          </div>
        </div>

        <div v-if="interactionCollapsed" class="panel-collapsed-rail" @click="toggleInteractionCollapse">
          <span>交流窗</span>
        </div>

        <div v-else class="interaction-body">

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

        <div v-if="layoutFreeMode" class="resize-handle" @mousedown.prevent="beginPanelResize('interaction', $event)"></div>
        </div>
      </div>
    </div>

    <!-- 结束直播确认 -->
    <el-dialog v-model="endDialogVisible" :title="canPublishLive ? '结束直播' : '退出听课'" width="400px">
      <p>{{ canPublishLive ? '确认结束直播？结束后将自动生成回放。' : '确认退出当前听课房间？' }}</p>
      <template #footer>
        <el-button @click="endDialogVisible = false">取消</el-button>
        <el-button :type="canPublishLive ? 'danger' : 'primary'" @click="confirmEndLive">{{ canPublishLive ? '确认结束' : '确认退出' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { ZegoExpressEngine } from 'zego-express-engine-webrtc'
import * as ZegoSuperBoardWeb from 'zego-superboard-web'
import { ZegoSuperBoardManager } from 'zego-superboard-web'
import { getLiveRoomDetail, startLive, endLive, approveCohost as approveCohostApi, rejectCohost as rejectCohostApi, kickCohost as kickCohostApi } from '@/api/live'

const route = useRoute()
const roomId = route.params.id
const userStore = useUserStore()
const audienceMode = String(route.query.mode || '') === 'audience'

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
const wbBrushSize = ref(6)
const wbBrushSizeOptions = [2, 4, 6, 8, 10, 12, 16, 20]
const wbLineStyle = ref('solid')
const wbShapeFilled = ref(false)
const wbAlpha = ref(100)
const wbAlphaOptions = [100, 90, 80, 70, 60, 50, 40, 30, 20]
const wbActiveTool = ref('pen')
const wbPrevTool = ref('selector')
const wbOperationMode = ref('draw')
const wbHotkeyPanActive = ref(false)
const wbOperationModeBeforePan = ref('draw')
const wbToolbarCompact = ref(true)
const wbToolbarLocked = ref(false)
const wbClassProtectMode = ref(false)
const wbToolPicker = ref('pen')
const wbToolPickerOptions = [
  { label: '选择', value: 'selector' },
  { label: '拖拽', value: 'scroll' },
  { label: '画笔', value: 'pen' },
  { label: '文字', value: 'text' },
  { label: '直线', value: 'line' },
  { label: '矩形', value: 'rect' },
  { label: '椭圆', value: 'ellipse' },
  { label: '橡皮', value: 'eraser' }
]
const currentPage = ref(1)
const totalPage = ref(1)
const whiteboardReady = ref(false)
const whiteboardDomId = `teacher-whiteboard-${roomId}`
const wbStageText = ref('')

// 连麦
const handUpList = ref([])
const coHostStreams = ref([])

// 聊天
const messages = ref([])
const chatText = ref('')
const chatScrollRef = ref(null)
const localVideoRef = ref(null)
const zegoAuthInfo = ref(null)
const liveIdentity = ref(null)
const roomState = ref('DISCONNECTED')
const canPublishLive = ref(true)
const audienceMainStreamID = ref('')
const whiteboardLayoutRefreshTimer = ref(null)
const audienceWhiteboardRetryTimer = ref(null)
const audienceWhiteboardSyncing = ref(false)
const audienceRoomStatusRetryTimer = ref(null)
const audienceRoomStatusRetryCount = ref(0)
const workspaceRef = ref(null)
const leftPanelRef = ref(null)
const videoContainerRef = ref(null)
const whiteboardContainerRef = ref(null)
const cameraGalleryRef = ref(null)
const layoutFreeMode = ref(false)
const showVideoPanel = ref(true)
const showInteractionPanel = ref(true)
const cameraDevices = ref([])
const activeCameraDeviceId = ref('')
const cameraPreviewTiles = ref([])
const cameraPreviewSeq = ref(0)
const cameraPreviewPresets = ref([])
const previewSceneIndex = ref(0)
const localStreamProvider = ref('native')
const audienceAutoJoinStarted = ref(false)
const teacherAutoResumeStarted = ref(false)
const interactionCollapsed = ref(false)
const panelDragState = reactive({ active: false, panel: '', mode: '', startX: 0, startY: 0, startLeft: 0, startTop: 0, startWidth: 0, startHeight: 0 })
const whiteboardResizeState = reactive({ active: false, mode: '', startX: 0, startY: 0, startWidth: 0, startHeight: 0 })
const whiteboardPanelHeight = ref(0)
const whiteboardPanelWidth = ref(0)
const floatingVideoState = reactive({ x: 24, y: 24, width: 360, height: 260 })
const floatingInteractionState = reactive({ x: 0, y: 16, width: 360, height: 520 })
const layoutStorageKey = `teacher_live_push_layout_${roomId}`
const cameraStorageKey = `teacher_live_push_camera_${roomId}`
const cameraPreviewStorageKey = `teacher_live_push_camera_previews_${roomId}`
const snapDistance = 24
const defaultDockedRightPanelWidth = 340
const rightPanelWidth = ref(defaultDockedRightPanelWidth)

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

const normalizeRoomID = (value) => String(value || '').trim()

const ensureRoomIDReady = async () => {
  let roomID = normalizeRoomID(zegoRoomID.value || roomInfo.value?.zegoRoomId)
  if (roomID) {
    zegoRoomID.value = roomID
    return roomID
  }

  const detail = await getLiveRoomDetail(roomId)
  if (detail) {
    roomInfo.value = detail
  }
  roomID = normalizeRoomID(detail?.zegoRoomId)
  if (!roomID) {
    throw new Error('直播间 roomID 为空，无法初始化直播会话')
  }
  zegoRoomID.value = roomID
  return roomID
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

const renderPreviewStream = async (container, stream) => {
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

const renderRemoteStream = async (container, stream) => {
  if (!container || !stream) return
  container.innerHTML = ''
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.muted = false
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

const applyMainStreamTrackState = (stream) => {
  if (!stream) return
  stream.getVideoTracks().forEach((track) => {
    track.enabled = isCameraOn.value
  })
  stream.getAudioTracks().forEach((track) => {
    track.enabled = isMicOn.value
  })
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const waitForNextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const applyMagneticSnap = (targetState) => {
  const { width, height } = getWorkspaceSize()
  if (!width || !height) return
  const rightGap = width - (targetState.x + targetState.width)
  const bottomGap = height - (targetState.y + targetState.height)

  if (targetState.x <= snapDistance) targetState.x = 8
  if (targetState.y <= snapDistance) targetState.y = 8
  if (rightGap <= snapDistance) targetState.x = Math.max(8, width - targetState.width - 8)
  if (bottomGap <= snapDistance) targetState.y = Math.max(8, height - targetState.height - 8)
}

const loadLayoutState = () => {
  try {
    const raw = localStorage.getItem(layoutStorageKey)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

const saveLayoutState = () => {
  try {
    localStorage.setItem(layoutStorageKey, JSON.stringify({
      layoutFreeMode: layoutFreeMode.value,
      showVideoPanel: showVideoPanel.value,
      showInteractionPanel: showInteractionPanel.value,
      interactionCollapsed: interactionCollapsed.value,
      rightPanelWidth: rightPanelWidth.value,
      whiteboardPanelHeight: whiteboardPanelHeight.value,
      whiteboardPanelWidth: whiteboardPanelWidth.value,
      floatingVideoState: { ...floatingVideoState },
      floatingInteractionState: { ...floatingInteractionState }
    }))
  } catch (e) {}
}

const getWorkspaceSize = () => {
  const el = workspaceRef.value
  return {
    width: el?.clientWidth || 0,
    height: el?.clientHeight || 0
  }
}

const getWhiteboardResizeBounds = () => {
  const leftHeight = leftPanelRef.value?.clientHeight || 0
  const minimum = 260
  if (!leftHeight) {
    return { min: minimum, max: Math.max(minimum, whiteboardPanelHeight.value || minimum) }
  }

  const sectionGap = 16
  let occupiedHeight = 0
  let gapCount = 0

  if (!layoutFreeMode.value && showVideoPanel.value && !isWhiteboardFull.value && videoContainerRef.value) {
    occupiedHeight += videoContainerRef.value.offsetHeight || 0
    gapCount += 1
  }

  if (cameraPreviewTiles.value.length > 0 && cameraGalleryRef.value) {
    occupiedHeight += cameraGalleryRef.value.offsetHeight || 0
    gapCount += 1
  }

  const max = Math.max(minimum, leftHeight - occupiedHeight - gapCount * sectionGap)
  return { min: minimum, max }
}

const getWhiteboardWidthBounds = () => {
  const leftWidth = leftPanelRef.value?.clientWidth || 0
  const minimum = 640
  if (!leftWidth) {
    return { min: minimum, max: Math.max(minimum, whiteboardPanelWidth.value || minimum) }
  }
  return { min: minimum, max: Math.max(minimum, leftWidth - 16) }
}

const clampWhiteboardPanelHeight = () => {
  if (!whiteboardPanelHeight.value || isWhiteboardFull.value) return
  const bounds = getWhiteboardResizeBounds()
  whiteboardPanelHeight.value = clamp(whiteboardPanelHeight.value, bounds.min, bounds.max)
}

const clampWhiteboardPanelWidth = () => {
  if (!whiteboardPanelWidth.value || isWhiteboardFull.value) return
  const bounds = getWhiteboardWidthBounds()
  whiteboardPanelWidth.value = clamp(whiteboardPanelWidth.value, bounds.min, bounds.max)
}

const getWhiteboardContainerStyle = () => {
  const style = {}
  if (!isWhiteboardFull.value) {
    if (whiteboardPanelHeight.value > 0) {
      style.height = `${whiteboardPanelHeight.value}px`
      style.flex = 'none'
    }
    if (whiteboardPanelWidth.value > 0) {
      style.width = `${whiteboardPanelWidth.value}px`
      style.flex = 'none'
      style.alignSelf = 'flex-start'
    }
  }
  return style
}

const initFreeLayoutPositions = () => {
  const { width, height } = getWorkspaceSize()
  if (!width || !height) return
  const saved = loadLayoutState()
  if (saved?.floatingVideoState) {
    Object.assign(floatingVideoState, saved.floatingVideoState)
  } else {
  floatingVideoState.x = 24
  floatingVideoState.y = 24
  floatingVideoState.width = clamp(Math.floor(width * 0.28), 280, 460)
  floatingVideoState.height = clamp(Math.floor(height * 0.28), 200, 320)
  }
  if (saved?.floatingInteractionState) {
    Object.assign(floatingInteractionState, saved.floatingInteractionState)
  } else {
  floatingInteractionState.width = clamp(Math.floor(width * 0.28), 320, 420)
  floatingInteractionState.height = clamp(Math.floor(height - 32), 420, height - 24)
  floatingInteractionState.x = Math.max(24, width - floatingInteractionState.width - 24)
  floatingInteractionState.y = 16
  }
  if (saved?.rightPanelWidth) {
    rightPanelWidth.value = clamp(saved.rightPanelWidth, 280, Math.max(280, Math.floor(width * 0.45)))
  }
  if (saved?.interactionCollapsed) {
    interactionCollapsed.value = true
  }
}

const toggleLayoutMode = async () => {
  layoutFreeMode.value = !layoutFreeMode.value
  if (layoutFreeMode.value) {
    await nextTick()
    initFreeLayoutPositions()
  } else {
    rightPanelWidth.value = rightPanelWidth.value || defaultDockedRightPanelWidth
  }
  saveLayoutState()
  scheduleWhiteboardLayoutRefresh()
}

const refreshCameraDevices = async () => {
  try {
    const currentSelected = activeCameraDeviceId.value
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = devices.filter((device) => device.kind === 'videoinput')
    cameraDevices.value = videoInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `摄像头 ${index + 1}`
    }))
    if (cameraDevices.value.length === 0) {
      activeCameraDeviceId.value = ''
      return
    }
    const selectedExists = cameraDevices.value.some((item) => item.deviceId === currentSelected)
    if (selectedExists) {
      activeCameraDeviceId.value = currentSelected
      return
    }
    activeCameraDeviceId.value = cameraDevices.value[0].deviceId
  } catch (err) {
    console.warn('[LivePush] refreshCameraDevices failed:', err)
  }
}

const loadCameraPreviewPresets = () => {
  try {
    const raw = localStorage.getItem(cameraPreviewStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item?.deviceId)
      .map((item, index) => ({
        id: item.id || `preset-${index}`,
        deviceId: String(item.deviceId),
        label: String(item.label || `副机位 ${index + 1}`),
        autoPublish: !!item.autoPublish
      }))
  } catch (e) {
    return []
  }
}

const saveCameraPreviewPresets = () => {
  try {
    localStorage.setItem(cameraPreviewStorageKey, JSON.stringify(cameraPreviewPresets.value.map((item) => ({
      id: item.id,
      deviceId: item.deviceId,
      label: item.label,
      autoPublish: !!item.autoPublish
    }))))
  } catch (e) {}
}

const syncPresetOrderByTiles = () => {
  const tileOrder = cameraPreviewTiles.value.map((item) => item.deviceId)
  cameraPreviewPresets.value.sort((a, b) => {
    const ai = tileOrder.indexOf(a.deviceId)
    const bi = tileOrder.indexOf(b.deviceId)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  saveCameraPreviewPresets()
}

const upsertCameraPreviewPreset = (payload) => {
  const index = cameraPreviewPresets.value.findIndex((item) => item.deviceId === payload.deviceId)
  if (index === -1) {
    cameraPreviewPresets.value.push({
      id: payload.id || `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      deviceId: payload.deviceId,
      label: payload.label,
      autoPublish: !!payload.autoPublish
    })
  } else {
    cameraPreviewPresets.value[index] = {
      ...cameraPreviewPresets.value[index],
      label: payload.label ?? cameraPreviewPresets.value[index].label,
      autoPublish: payload.autoPublish ?? cameraPreviewPresets.value[index].autoPublish
    }
  }
  saveCameraPreviewPresets()
}

const removeCameraPreviewPreset = (deviceId) => {
  cameraPreviewPresets.value = cameraPreviewPresets.value.filter((item) => item.deviceId !== deviceId)
  saveCameraPreviewPresets()
}

const buildCameraConstraints = (deviceId, withAudio = true) => ({
  audio: withAudio,
  video: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
})

const createZegoCameraStream = async (deviceId, withAudio = true) => {
  if (!zg.value?.createStream) {
    throw new Error('ZEGO 推流引擎未就绪')
  }
  const cameraConfig = {
    video: true,
    audio: withAudio,
    videoQuality: 2,
    width: 1280,
    height: 720,
    frameRate: 15,
    bitrate: 1200
  }
  if (deviceId) {
    cameraConfig.videoInputID = deviceId
  }
  return zg.value.createStream({ camera: cameraConfig })
}

const createNativeCameraStream = async (deviceId, withAudio = true) => {
  const constraints = buildCameraConstraints(deviceId, withAudio)
  return navigator.mediaDevices.getUserMedia(constraints)
}

const createCameraStream = async (deviceId, withAudio = true, preferZego = false) => {
  if (preferZego) {
    try {
      return { stream: await createZegoCameraStream(deviceId, withAudio), provider: 'zego' }
    } catch (err) {
      console.warn('[LivePush] createZegoCameraStream failed, fallback to native:', err)
    }
  }
  return { stream: await createNativeCameraStream(deviceId, withAudio), provider: 'native' }
}

const releaseMediaStream = (stream, provider = 'native') => {
  if (!stream) return
  if (provider === 'zego') {
    try {
      zg.value?.destroyStream?.(stream)
    } catch (e) {}
  }
  try {
    stream.getTracks().forEach((track) => track.stop())
  } catch (e) {}
}

const publishMainCameraStream = async (stream, provider = 'native') => {
  const streamID = 'teacher_' + roomId
  try {
    zg.value?.stopPublishingStream?.(streamID)
  } catch (e) {}
  try {
    if (localStream.value) {
      releaseMediaStream(localStream.value, localStreamProvider.value)
      localStream.value = null
    }
  } catch (e) {}
  localStream.value = stream
  localStreamProvider.value = provider
  applyMainStreamTrackState(localStream.value)
  await renderLocalStream(localVideoRef.value, localStream.value)
  if (isLiving.value && !isScreenSharing.value) {
    await zg.value.startPublishingStream(streamID, localStream.value)
  }
}

const announceFocusedStream = async (streamID, source = 'teacher') => {
  if (!isLiving.value || !zg.value || !zegoRoomID.value || !streamID) return
  try {
    await zg.value.sendBroadcastMessage(
      zegoRoomID.value,
      JSON.stringify({ type: 'stream_focus', streamID, source })
    )
  } catch (err) {}
}

const applyScenePreset = async (preset) => {
  if (!isLiving.value) {
    ElMessage.warning('请先开始直播')
    return
  }

  const mainStreamID = `teacher_${roomId}`
  const screenStreamID = `${mainStreamID}_screen`

  if (preset === 'main') {
    if (isScreenSharing.value) {
      ElMessage.warning('当前正在屏幕共享，请先停止屏幕共享后切到主讲机位')
      return
    }
    await announceFocusedStream(mainStreamID, 'scene_main')
    ElMessage.success('已切换到主讲机位')
    return
  }

  if (preset === 'screen') {
    if (!isScreenSharing.value) {
      ElMessage.warning('当前没有屏幕共享流')
      return
    }
    await announceFocusedStream(screenStreamID, 'scene_screen')
    ElMessage.success('已切换到屏幕共享')
    return
  }

  if (preset === 'preview') {
    const publishedPreviews = cameraPreviewTiles.value.filter((item) => item.isPublishing)
    if (!publishedPreviews.length) {
      ElMessage.warning('请先开启至少一路副机位推流')
      return
    }
    const currentIndex = previewSceneIndex.value % publishedPreviews.length
    const target = publishedPreviews[currentIndex]
    previewSceneIndex.value = (currentIndex + 1) % publishedPreviews.length
    await announceFocusedStream(target.streamID, 'scene_preview')
    ElMessage.success(`已切换到副机位：${target.label}`)
  }
}

const setMainCamera = async (deviceId) => {
  if (!deviceId) {
    throw new Error('未指定摄像头设备')
  }
  const previousDeviceId = activeCameraDeviceId.value
  activeCameraDeviceId.value = deviceId
  try {
    const { stream, provider } = await createCameraStream(deviceId, true, true)
    await publishMainCameraStream(stream, provider)
    if (provider !== 'zego') {
      throw new Error('摄像头流未接入 ZEGO，请刷新后重试')
    }
    if (isLiving.value && !isScreenSharing.value) {
      await announceFocusedStream(`teacher_${roomId}`, 'main_camera')
    }
  } catch (err) {
    activeCameraDeviceId.value = previousDeviceId
    throw err
  }
}

const handleMainCameraChange = async (deviceId) => {
  if (!deviceId) return
  try {
    await setMainCamera(deviceId)
  } catch (err) {
    ElMessage.error('切换主摄像头失败：' + parseErrorMessage(err))
  }
}

const selectMainCameraFromPreview = async (deviceId) => {
  try {
    await setMainCamera(deviceId)
  } catch (err) {
    ElMessage.error('切换主摄像头失败：' + parseErrorMessage(err))
  }
}

const createCameraPreviewTile = async (deviceId, options = {}) => {
  const previewPreferZego = !!isLiving.value
  const created = await createCameraStream(deviceId, false, previewPreferZego)
  const stream = created.stream
  const deviceInfo = cameraDevices.value.find((item) => item.deviceId === deviceId)
  const id = options.id || `camera-${Date.now()}-${cameraPreviewSeq.value += 1}`
  const tile = {
    id,
    deviceId,
    label: options.label || deviceInfo?.label || `摄像头 ${cameraPreviewTiles.value.length + 1}`,
    stream,
    streamID: `teacher_${roomId}_cam_${id}`,
    isPublishing: false,
    publishing: false,
    autoPublish: !!options.autoPublish,
    streamProvider: created.provider
  }
  cameraPreviewTiles.value.push(tile)
  await nextTick()
  const container = document.getElementById(`camera-preview-${id}`)
  await renderPreviewStream(container, stream)
  upsertCameraPreviewPreset({
    id,
    deviceId: tile.deviceId,
    label: tile.label,
    autoPublish: tile.autoPublish
  })
  syncPresetOrderByTiles()
  return tile
}

const ensureCameraPreviewTile = async (deviceId, options = {}) => {
  const existing = cameraPreviewTiles.value.find((item) => item.deviceId === deviceId)
  if (existing) {
    if (options.label) existing.label = options.label
    if (typeof options.autoPublish === 'boolean') {
      existing.autoPublish = options.autoPublish
    }
    upsertCameraPreviewPreset({
      id: existing.id,
      deviceId: existing.deviceId,
      label: existing.label,
      autoPublish: existing.autoPublish
    })
    return existing
  }
  return createCameraPreviewTile(deviceId, options)
}

const addCameraPreview = async () => {
  if (cameraDevices.value.length === 0) {
    await refreshCameraDevices()
  }
  const targetDeviceId = activeCameraDeviceId.value || cameraDevices.value[0]?.deviceId
  if (!targetDeviceId) {
    ElMessage.warning('未检测到可用摄像头')
    return
  }
  if (cameraPreviewTiles.value.some((item) => item.deviceId === targetDeviceId)) {
    ElMessage.info('该摄像头已在预览列表中')
    return
  }

  try {
    await createCameraPreviewTile(targetDeviceId)
  } catch (err) {
    ElMessage.error('添加摄像头预览失败：' + parseErrorMessage(err))
  }
}

const startPreviewPublishing = async (tile) => {
  if (!tile) return
  if (tile.streamProvider !== 'zego') {
    const upgraded = await createCameraStream(tile.deviceId, false, true)
    if (upgraded.provider !== 'zego') {
      throw new Error('副机位未接入 ZEGO，无法推流')
    }
    releaseMediaStream(tile.stream, tile.streamProvider)
    tile.stream = upgraded.stream
    tile.streamProvider = upgraded.provider
    await nextTick()
    const container = document.getElementById(`camera-preview-${tile.id}`)
    await renderPreviewStream(container, tile.stream)
  }
  await zg.value.startPublishingStream(tile.streamID, tile.stream)
  tile.isPublishing = true
}

const stopPreviewPublishing = async (tile) => {
  if (!tile?.isPublishing) return
  try {
    zg.value?.stopPublishingStream?.(tile.streamID)
  } catch (e) {}
  tile.isPublishing = false
}

const togglePreviewPublishing = async (id) => {
  const tile = cameraPreviewTiles.value.find((item) => item.id === id)
  if (!tile) return
  if (!isLiving.value) {
    ElMessage.warning('请先开始直播后再推副机位')
    return
  }
  if (!zg.value) {
    ElMessage.warning('推流引擎未初始化')
    return
  }
  if (tile.publishing) return

  tile.publishing = true
  try {
    if (tile.isPublishing) {
      await stopPreviewPublishing(tile)
      ElMessage.success(`${tile.label} 已停止推流`)
    } else {
      await startPreviewPublishing(tile)
      ElMessage.success(`${tile.label} 已开始副机位推流`)
    }
  } catch (err) {
    ElMessage.error('副机位推流操作失败：' + parseErrorMessage(err))
  } finally {
    tile.publishing = false
  }
}

const setPreviewAutoPublish = (id, value) => {
  const tile = cameraPreviewTiles.value.find((item) => item.id === id)
  if (!tile) return
  tile.autoPublish = !!value
  upsertCameraPreviewPreset({
    id: tile.id,
    deviceId: tile.deviceId,
    label: tile.label,
    autoPublish: tile.autoPublish
  })
}

const renameCameraPreview = (id) => {
  const tile = cameraPreviewTiles.value.find((item) => item.id === id)
  if (!tile) return
  const nextLabel = window.prompt('请输入副机位名称', tile.label)
  if (!nextLabel) return
  tile.label = String(nextLabel).trim() || tile.label
  upsertCameraPreviewPreset({
    id: tile.id,
    deviceId: tile.deviceId,
    label: tile.label,
    autoPublish: tile.autoPublish
  })
}

const moveCameraPreview = (id, direction) => {
  const index = cameraPreviewTiles.value.findIndex((item) => item.id === id)
  if (index < 0) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= cameraPreviewTiles.value.length) return
  const copy = [...cameraPreviewTiles.value]
  const [item] = copy.splice(index, 1)
  copy.splice(targetIndex, 0, item)
  cameraPreviewTiles.value = copy
  if (previewSceneIndex.value >= cameraPreviewTiles.value.length) {
    previewSceneIndex.value = 0
  }
  syncPresetOrderByTiles()
}

const restoreCameraPreviewTiles = async () => {
  if (!cameraPreviewPresets.value.length) return
  for (const preset of cameraPreviewPresets.value) {
    const exists = cameraDevices.value.some((device) => device.deviceId === preset.deviceId)
    if (!exists) continue
    try {
      await ensureCameraPreviewTile(preset.deviceId, {
        id: preset.id,
        label: preset.label,
        autoPublish: preset.autoPublish
      })
    } catch (err) {
      console.warn('[LivePush] restoreCameraPreviewTiles failed:', err)
    }
  }
  syncPresetOrderByTiles()
}

const restoreAutoPublishCameraStreams = async () => {
  if (!isLiving.value || !zg.value) return
  for (const tile of cameraPreviewTiles.value) {
    if (!tile.autoPublish || tile.isPublishing || tile.publishing) continue
    tile.publishing = true
    try {
      await startPreviewPublishing(tile)
    } catch (err) {
      console.warn('[LivePush] auto publish preview failed:', err)
    } finally {
      tile.publishing = false
    }
  }
}

const removeCameraPreview = async (id) => {
  const index = cameraPreviewTiles.value.findIndex((item) => item.id === id)
  if (index === -1) return
  const target = cameraPreviewTiles.value[index]
  if (target?.isPublishing) {
    await stopPreviewPublishing(target)
  }
  const [removed] = cameraPreviewTiles.value.splice(index, 1)
  if (previewSceneIndex.value >= cameraPreviewTiles.value.length) {
    previewSceneIndex.value = 0
  }
  releaseMediaStream(removed?.stream, removed?.streamProvider)
  removeCameraPreviewPreset(removed?.deviceId)
}

const resetLayout = async () => {
  layoutFreeMode.value = false
  showVideoPanel.value = true
  showInteractionPanel.value = true
  interactionCollapsed.value = false
  rightPanelWidth.value = defaultDockedRightPanelWidth
  floatingVideoState.x = 24
  floatingVideoState.y = 24
  floatingVideoState.width = 360
  floatingVideoState.height = 260
  floatingInteractionState.x = 0
  floatingInteractionState.y = 16
  floatingInteractionState.width = 360
  floatingInteractionState.height = 520
  whiteboardPanelHeight.value = 0
  try {
    localStorage.removeItem(layoutStorageKey)
  } catch (e) {}
  await nextTick()
  scheduleWhiteboardLayoutRefresh()
}

const getVideoPanelStyle = () => ({
  left: `${floatingVideoState.x}px`,
  top: `${floatingVideoState.y}px`,
  width: `${floatingVideoState.width}px`,
  height: `${floatingVideoState.height}px`
})

const getInteractionPanelStyle = () => ({
  ...(layoutFreeMode.value
    ? {
        left: `${floatingInteractionState.x}px`,
        top: `${floatingInteractionState.y}px`,
        width: `${floatingInteractionState.width}px`,
        height: `${floatingInteractionState.height}px`
      }
    : {
        width: `${rightPanelWidth.value}px`
      })
})

const toggleInteractionCollapse = () => {
  interactionCollapsed.value = !interactionCollapsed.value
  if (!interactionCollapsed.value) {
    showInteractionPanel.value = true
  }
  saveLayoutState()
  scheduleWhiteboardLayoutRefresh()
}

const beginPanelDrag = (panel, event) => {
  if (!layoutFreeMode.value || event.button !== 0) return
  const targetState = panel === 'video' ? floatingVideoState : floatingInteractionState
  panelDragState.active = true
  panelDragState.panel = panel
  panelDragState.mode = 'drag'
  panelDragState.startX = event.clientX
  panelDragState.startY = event.clientY
  panelDragState.startLeft = targetState.x
  panelDragState.startTop = targetState.y
}

const beginPanelResize = (panel, event) => {
  if (!layoutFreeMode.value || event.button !== 0) return
  panelDragState.active = true
  panelDragState.panel = panel
  panelDragState.mode = 'resize'
  panelDragState.startX = event.clientX
  panelDragState.startY = event.clientY
  if (panel === 'video') {
    const targetState = floatingVideoState
    panelDragState.startWidth = targetState.width
    panelDragState.startHeight = targetState.height
  } else if (panel === 'interaction') {
    const targetState = floatingInteractionState
    panelDragState.startWidth = targetState.width
    panelDragState.startHeight = targetState.height
  } else if (panel === 'side') {
    panelDragState.startWidth = rightPanelWidth.value
  }
}

const beginWhiteboardResize = (event) => {
  if (event.button !== 0 || isWhiteboardFull.value) return
  const targetHeight = whiteboardPanelHeight.value || whiteboardContainerRef.value?.getBoundingClientRect?.().height || 0
  if (!targetHeight) return
  whiteboardResizeState.active = true
  whiteboardResizeState.mode = 'height'
  whiteboardResizeState.startY = event.clientY
  whiteboardResizeState.startHeight = targetHeight
}

const beginWhiteboardWidthResize = (event) => {
  if (event.button !== 0 || isWhiteboardFull.value) return
  const targetWidth = whiteboardPanelWidth.value || whiteboardContainerRef.value?.getBoundingClientRect?.().width || 0
  if (!targetWidth) return
  whiteboardResizeState.active = true
  whiteboardResizeState.mode = 'width'
  whiteboardResizeState.startX = event.clientX
  whiteboardResizeState.startWidth = targetWidth
}

const handlePanelMouseMove = (event) => {
  if (whiteboardResizeState.active) {
    if (whiteboardResizeState.mode === 'height') {
      const dy = event.clientY - whiteboardResizeState.startY
      const bounds = getWhiteboardResizeBounds()
      whiteboardPanelHeight.value = clamp(whiteboardResizeState.startHeight + dy, bounds.min, bounds.max)
    } else if (whiteboardResizeState.mode === 'width') {
      const dx = event.clientX - whiteboardResizeState.startX
      const bounds = getWhiteboardWidthBounds()
      whiteboardPanelWidth.value = clamp(whiteboardResizeState.startWidth + dx, bounds.min, bounds.max)
    }
    scheduleWhiteboardLayoutRefresh()
    return
  }

  if (!panelDragState.active || !layoutFreeMode.value) return
  const targetState = panelDragState.panel === 'video' ? floatingVideoState : floatingInteractionState
  const { width, height } = getWorkspaceSize()
  if (!width || !height) return

  const dx = event.clientX - panelDragState.startX
  const dy = event.clientY - panelDragState.startY

  if (panelDragState.mode === 'drag') {
    const maxLeft = Math.max(8, width - targetState.width - 8)
    const maxTop = Math.max(8, height - targetState.height - 8)
    targetState.x = clamp(panelDragState.startLeft + dx, 8, maxLeft)
    targetState.y = clamp(panelDragState.startTop + dy, 8, maxTop)
  }

  if (panelDragState.mode === 'resize') {
    if (panelDragState.panel === 'side') {
      rightPanelWidth.value = clamp(panelDragState.startWidth - dx, 280, Math.max(280, Math.floor(width * 0.5)))
    } else {
      const minWidth = panelDragState.panel === 'video' ? 280 : 320
      const minHeight = panelDragState.panel === 'video' ? 180 : 260
      const maxWidth = Math.max(minWidth, width - targetState.x - 16)
      const maxHeight = Math.max(minHeight, height - targetState.y - 16)
      targetState.width = clamp(panelDragState.startWidth + dx, minWidth, maxWidth)
      targetState.height = clamp(panelDragState.startHeight + dy, minHeight, maxHeight)
    }
  }
  scheduleWhiteboardLayoutRefresh()
}

const handlePanelMouseUp = () => {
  if (whiteboardResizeState.active) {
    whiteboardResizeState.active = false
    whiteboardResizeState.mode = ''
    saveLayoutState()
    return
  }

  if (!panelDragState.active || !layoutFreeMode.value) return
  const targetState = panelDragState.panel === 'video' ? floatingVideoState : floatingInteractionState
  applyMagneticSnap(targetState)
  const { width, height } = getWorkspaceSize()
  if (width && height) {
    targetState.x = clamp(targetState.x, 8, Math.max(8, width - targetState.width - 8))
    targetState.y = clamp(targetState.y, 8, Math.max(8, height - targetState.height - 8))
    if (targetState.x < 24) targetState.x = 8
    if (targetState.y < 24) targetState.y = 8
    if (width - (targetState.x + targetState.width) < 24) {
      targetState.x = Math.max(8, width - targetState.width - 8)
    }
    if (height - (targetState.y + targetState.height) < 24) {
      targetState.y = Math.max(8, height - targetState.height - 8)
    }
  }
  if (panelDragState.panel === 'side') {
    rightPanelWidth.value = clamp(rightPanelWidth.value, 280, Math.max(280, Math.floor(width * 0.5)))
  }
  panelDragState.active = false
  panelDragState.panel = ''
  panelDragState.mode = ''
  saveLayoutState()
}

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timer = null
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage || '操作超时'))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const isWhiteboardUserNotExistError = (err) => {
  const code = Number(err?.code || err?.errorCode || 0)
  const msg = String(err?.message || err?.msg || err || '')
  return code === 3110002 || msg.includes('用户不存在') || msg.toLowerCase().includes('user not exist')
}

const isAlreadyInRoomError = (err) => {
  const msg = String(err?.message || err?.msg || err || '').toLowerCase()
  return msg.includes('already') && msg.includes('room')
}

const isLoginRoomLimitError = (err) => {
  const msg = String(err?.message || err?.msg || err || '').toLowerCase()
  return msg.includes('login rooms exceeds the upper limit') || (msg.includes('login') && msg.includes('upper limit'))
}

const refreshWhiteboardLayout = async () => {
  if (!whiteboardReady.value && !currentSuperBoardView.value) return
  await nextTick()
  await waitForNextPaint()

  const activeSubView = currentSuperBoardView.value || (refreshCurrentSuperBoardView() ? currentSuperBoardView.value : null)
  activeSubView?.reloadView?.()
}

const scheduleWhiteboardLayoutRefresh = () => {
  if (whiteboardLayoutRefreshTimer.value) {
    clearTimeout(whiteboardLayoutRefreshTimer.value)
  }
  whiteboardLayoutRefreshTimer.value = setTimeout(() => {
    whiteboardLayoutRefreshTimer.value = null
    refreshWhiteboardLayout()
  }, 180)
}

const toggleWhiteboardFull = async () => {
  isWhiteboardFull.value = !isWhiteboardFull.value
  await refreshWhiteboardLayout()
}

const waitRoomConnected = async (timeoutMs = 12000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (String(roomState.value || '').toUpperCase() === 'CONNECTED') {
      return true
    }
    await delay(200)
  }
  throw new Error('房间连接未就绪')
}

const ensureRoomLoginForWhiteboard = async (roomID, token, userID, userName) => {
  if (!zg.value?.loginRoom) return
  if (String(roomState.value || '').toUpperCase() === 'CONNECTED') return
  try {
    await withTimeout(
      zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
      6000,
      '白板前房间保活登录超时（6秒）'
    )
    await withTimeout(waitRoomConnected(8000), 9000, '白板前房间连接未就绪')
  } catch (err) {
    if (!isAlreadyInRoomError(err)) {
      console.warn('[LivePush] ensureRoomLoginForWhiteboard ignored error:', err)
    }
  }
}

watch(isWhiteboardFull, () => {
  scheduleWhiteboardLayoutRefresh()
})

watch(layoutFreeMode, (enabled) => {
  if (enabled) {
    nextTick(() => initFreeLayoutPositions())
  }
  saveLayoutState()
})

watch(showVideoPanel, () => {
  saveLayoutState()
})

watch([layoutFreeMode, showVideoPanel, isWhiteboardFull], async () => {
  await nextTick()
  if (layoutFreeMode.value) {
    initFreeLayoutPositions()
  }
  clampWhiteboardPanelHeight()
  clampWhiteboardPanelWidth()
  if (showVideoPanel.value && !isWhiteboardFull.value && localStream.value) {
    await renderLocalStream(localVideoRef.value, localStream.value)
  }
  saveLayoutState()
  scheduleWhiteboardLayoutRefresh()
})

watch(() => cameraPreviewTiles.value.length, async () => {
  await nextTick()
  clampWhiteboardPanelHeight()
  clampWhiteboardPanelWidth()
  saveLayoutState()
  scheduleWhiteboardLayoutRefresh()
})

watch(showInteractionPanel, () => {
  saveLayoutState()
})

watch(interactionCollapsed, () => {
  saveLayoutState()
})

watch(rightPanelWidth, () => {
  saveLayoutState()
})

watch(activeCameraDeviceId, (deviceId) => {
  try {
    if (deviceId) {
      localStorage.setItem(cameraStorageKey, deviceId)
    } else {
      localStorage.removeItem(cameraStorageKey)
    }
  } catch (e) {}
})

const resetRoomSessionBeforeStart = async (roomID) => {
  if (!zg.value?.logoutRoom) return
  try {
    await zg.value.logoutRoom(roomID)
    await delay(300)
  } catch (e) {}
}

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

  zg.value.on('roomStateUpdate', (roomID, state) => {
    if (String(roomID) === String(zegoRoomID.value || '')) {
      roomState.value = String(state || '')
    }
  })

  // 监听流变化（学生连麦推流）
  zg.value.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
    if (updateType === 'ADD') {
      for (const stream of streamList) {
        if (!canPublishLive.value) {
          const teacherStreamPrefix = `teacher_${roomId}`
          const isTeacherStream = String(stream.streamID || '').startsWith(teacherStreamPrefix)
          if (!audienceMainStreamID.value && isTeacherStream) {
            await playAudienceStream(stream.streamID, { silent: true })
            scheduleAudienceWhiteboardSync('teacher_stream_add', 800)
            continue
          }
          if (audienceMainStreamID.value && stream.streamID === audienceMainStreamID.value) {
            await playAudienceStream(stream.streamID, { silent: true })
            scheduleAudienceWhiteboardSync('focused_stream_readd', 800)
            continue
          }
        }
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
        if (!canPublishLive.value && audienceMainStreamID.value && stream.streamID === audienceMainStreamID.value) {
          try {
            zg.value.stopPlayingStream(stream.streamID)
          } catch (e) {}
          audienceMainStreamID.value = ''
          if (localVideoRef.value) {
            localVideoRef.value.innerHTML = ''
          }
          await playAudienceMainStream()
          continue
        }
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
        } else if (data.type === 'stream_focus' && !canPublishLive.value && data.streamID) {
          playAudienceStream(String(data.streamID), { silent: true })
          scheduleAudienceWhiteboardSync('stream_focus', 600)
        }
      } catch (e) {}
    })
  })
}

// 获取 Token
const getZegoAuth = async () => {
  const token = localStorage.getItem('token')
  const roomID = await ensureRoomIDReady()
  const query = new URLSearchParams({
    roomID,
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

const playAudienceStream = async (streamID, options = {}) => {
  if (!zg.value || !localVideoRef.value || !streamID) return false
  const { silent = false } = options
  try {
    if (audienceMainStreamID.value) {
      try {
        zg.value.stopPlayingStream(audienceMainStreamID.value)
      } catch (e) {}
      audienceMainStreamID.value = ''
    }

    let started = false
    try {
      await zg.value.startPlayingStream(streamID, {
        video: localVideoRef.value,
        audio: true
      })
      started = true
    } catch (bindErr) {
      const remoteStream = await zg.value.startPlayingStream(streamID)
      await renderRemoteStream(localVideoRef.value, remoteStream)
      started = true
    }

    if (!started) {
      throw new Error('播放老师画面失败')
    }

    audienceMainStreamID.value = streamID
    return true
  } catch (e) {
    if (!silent) {
      ElMessage.info('已进入房间，等待老师开始推流...')
    }
    return false
  }
}

const playAudienceMainStream = async () => {
  return playAudienceStream(`teacher_${roomId}`)
}

const clearAudienceWhiteboardRetryTimer = () => {
  if (audienceWhiteboardRetryTimer.value) {
    clearTimeout(audienceWhiteboardRetryTimer.value)
    audienceWhiteboardRetryTimer.value = null
  }
}

const clearAudienceRoomStatusRetryTimer = () => {
  if (audienceRoomStatusRetryTimer.value) {
    clearTimeout(audienceRoomStatusRetryTimer.value)
    audienceRoomStatusRetryTimer.value = null
  }
  audienceRoomStatusRetryCount.value = 0
}

const syncAudienceRoomStatus = async () => {
  if (canPublishLive.value) return
  try {
    const res = await getLiveRoomDetail(roomId)
    roomInfo.value = res
    const nextRoomID = normalizeRoomID(res?.zegoRoomId)
    if (nextRoomID) {
      zegoRoomID.value = nextRoomID
    }
    const liveNow = ['living', 'paused'].includes(String(res.status || ''))
    if (liveNow) {
      isLiving.value = true
      wbStageText.value = wbStageText.value || '白板同步中...'
      clearAudienceRoomStatusRetryTimer()
      const authInfo = liveIdentity.value || zegoAuthInfo.value || (await getZegoAuth())
      if (!audienceAutoJoinStarted.value && authInfo?.token && authInfo?.userId) {
        if (!zg.value) {
          await initZego()
        }
        audienceAutoJoinStarted.value = true
        try {
          await startAudienceSession(authInfo)
        } catch (err) {
          audienceAutoJoinStarted.value = false
          wbStageText.value = '听课连接失败，正在重试...'
        }
      }
      return
    }
    if (audienceRoomStatusRetryCount.value < 6) {
      audienceRoomStatusRetryCount.value += 1
      audienceRoomStatusRetryTimer.value = setTimeout(() => {
        audienceRoomStatusRetryTimer.value = null
        syncAudienceRoomStatus()
      }, 2000)
    }
  } catch (err) {
    if (audienceRoomStatusRetryCount.value < 6) {
      audienceRoomStatusRetryCount.value += 1
      audienceRoomStatusRetryTimer.value = setTimeout(() => {
        audienceRoomStatusRetryTimer.value = null
        syncAudienceRoomStatus()
      }, 2000)
    }
  }
}

const shouldSyncAudienceWhiteboard = () => {
  return !canPublishLive.value && isLiving.value && !!zg.value && !!zegoRoomID.value
}

const scheduleAudienceWhiteboardSync = (reason = 'unknown', delayMs = 4000) => {
  if (!shouldSyncAudienceWhiteboard()) return
  if (whiteboardReady.value && (currentSuperBoardView.value || refreshCurrentSuperBoardView())) return

  if (audienceWhiteboardRetryTimer.value) {
    clearTimeout(audienceWhiteboardRetryTimer.value)
  }

  audienceWhiteboardRetryTimer.value = setTimeout(async () => {
    audienceWhiteboardRetryTimer.value = null
    if (!shouldSyncAudienceWhiteboard() || audienceWhiteboardSyncing.value) return
    if (whiteboardReady.value && (currentSuperBoardView.value || refreshCurrentSuperBoardView())) return

    audienceWhiteboardSyncing.value = true
    try {
      const authInfo = liveIdentity.value || zegoAuthInfo.value || (await getZegoAuth())
      const token = authInfo?.token
      const userID = authInfo?.userId
      const userName = authInfo?.userName
      if (!token || !userID) {
        throw new Error('白板鉴权信息缺失')
      }

      await initWhiteboard(zegoRoomID.value, token, userID, userName, { viewerOnly: true })
      wbStageText.value = '白板已同步'
    } catch (err) {
      wbStageText.value = '等待老师共享白板...'
      scheduleAudienceWhiteboardSync(reason, 4500)
    } finally {
      audienceWhiteboardSyncing.value = false
    }
  }, Math.max(300, Number(delayMs) || 0))
}

const startAudienceSession = async (authInfo) => {
  const userID = authInfo.userId
  const userName = authInfo.userName
  const token = authInfo.token
  const roomID = await ensureRoomIDReady()
  liveIdentity.value = { userId: userID, userName, token }
  isLiving.value = true
  wbStageText.value = '白板同步中...'

  await resetRoomSessionBeforeStart(roomID)
  roomState.value = 'DISCONNECTED'

  try {
    await withTimeout(
      zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
      8000,
      '登录房间超时（8秒）'
    )
  } catch (loginErr) {
    if (!isLoginRoomLimitError(loginErr)) {
      throw loginErr
    }

    // 房间登录上限异常时重建引擎并重试一次，避免页面卡死在听课空白。
    try {
      zg.value?.destroyEngine?.()
    } catch (e) {}
    zg.value = null
    roomState.value = 'DISCONNECTED'
    await initZego()

    await withTimeout(
      zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
      8000,
      '重试登录房间超时（8秒）'
    )
  }

  await withTimeout(waitRoomConnected(12000), 13000, '房间连接未就绪')
  try {
    await initWhiteboard(roomID, token, userID, userName, { viewerOnly: true })
    wbStageText.value = '白板已同步'
  } catch (err) {
    wbStageText.value = '等待老师共享白板...'
    scheduleAudienceWhiteboardSync('audience_session_start', 1500)
  }
  await playAudienceMainStream()
  scheduleAudienceWhiteboardSync('audience_after_play', 1000)
  ElMessage.success('已进入听课房间')
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
    const isAssistantUser = audienceMode || userStore.userInfo?.role === 'assistant'
    const authInfo = await ensureZegoReady()
    const roomID = await ensureRoomIDReady()
    canPublishLive.value = !!authInfo.canPublish && !isAssistantUser
    if (!canPublishLive.value) {
      await startAudienceSession(authInfo)
      return
    }
    const userID = authInfo.userId
    const userName = authInfo.userName
    const token = authInfo.token
    liveIdentity.value = { userId: userID, userName, token }

    // 清理可能残留的旧会话，再按官方推荐顺序初始化：先 SuperBoard，再登录房间。
    await resetRoomSessionBeforeStart(roomID)
    roomState.value = 'DISCONNECTED'

    try {
      whiteboardReady.value = false
      currentSuperBoardView.value = null
      wbStageText.value = '白板初始化中...'
      // 1) 先初始化 SuperBoard SDK
      zegoSuperBoard.value = ZegoSuperBoardManager.getInstance()
      zegoSuperBoard.value.off?.('error')
      zegoSuperBoard.value.on?.('error', (error) => {
        console.error('[LivePush] SuperBoard error:', error)
      })
      await withTimeout(
        zegoSuperBoard.value.init(zg.value, {
          parentDomID: whiteboardDomId,
          appID: ZEGO_CONFIG.appID,
          token,
          roomID,
          userID,
          userName: userName || userID,
          isTestEnv: false
        }),
        10000,
        '白板服务初始化超时（10秒）'
      )

      // 2) 再登录房间
      await withTimeout(
        zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
        8000,
        '登录房间超时（8秒）'
      )

      // 3) 连接成功后创建/挂载白板
      await withTimeout(waitRoomConnected(12000), 13000, '房间连接未就绪，无法创建白板')
      await initWhiteboard(roomID, token, userID, userName)
      wbStageText.value = '白板就绪'
    } catch (wbErr) {
      whiteboardReady.value = false
      wbStageText.value = '白板未就绪：' + parseErrorMessage(wbErr)
      const wbCode = wbErr?.code || wbErr?.errorCode
      ElMessage.warning('白板初始化失败' + (wbCode ? `（${wbCode}）` : '') + '：' + parseErrorMessage(wbErr))
    }

    await refreshCameraDevices()
    await setMainCamera(activeCameraDeviceId.value || cameraDevices.value[0]?.deviceId)

    const streamID = 'teacher_' + roomId
    if (localStream.value) {
      await zg.value.startPublishingStream(streamID, localStream.value)
    }
    const roomAlreadyLiving = ['living', 'paused'].includes(String(roomInfo.value?.status || ''))
    if (!roomAlreadyLiving) {
      try {
        await startLive(roomId, { pushUrl: streamID })
      } catch (startErr) {
        console.warn('[LivePush] startLive sync failed:', startErr)
      }
    }
    roomInfo.value = {
      ...(roomInfo.value || {}),
      status: 'living',
      actualStartTime: roomInfo.value?.actualStartTime || new Date().toISOString()
    }
    isLiving.value = true
    await announceFocusedStream(streamID, 'live_start')
    await restoreCameraPreviewTiles()
    await restoreAutoPublishCameraStreams()
    ElMessage.success(roomAlreadyLiving ? '已恢复直播会话' : '直播已开始')
  } catch (err) {
    ElMessage.error('开始直播失败: ' + parseErrorMessage(err))
  }
}

const teardownSessionWithoutEndingLive = async () => {
  const streamID = 'teacher_' + roomId
  try {
    if (canPublishLive.value) {
      zg.value?.stopPublishingStream?.(streamID)
      zg.value?.stopPublishingStream?.(streamID + '_screen')
    } else if (audienceMainStreamID.value) {
      zg.value?.stopPlayingStream?.(audienceMainStreamID.value)
      audienceMainStreamID.value = ''
    }
  } catch (e) {}

  try {
    coHostStreams.value.forEach((s) => {
      try {
        zg.value?.stopPlayingStream?.(s.streamID)
      } catch (e) {}
    })
    coHostStreams.value = []
  } catch (e) {}

  try {
    if (screenStream.value) {
      zg.value?.destroyStream?.(screenStream.value)
      screenStream.value = null
    }
  } catch (e) {}

  try {
    if (localStream.value) {
      releaseMediaStream(localStream.value, localStreamProvider.value)
      localStream.value = null
      localStreamProvider.value = 'native'
    }
  } catch (e) {}

  for (const tile of cameraPreviewTiles.value) {
    try {
      if (tile.isPublishing) {
        zg.value?.stopPublishingStream?.(tile.streamID)
      }
    } catch (e) {}
    tile.isPublishing = false
    releaseMediaStream(tile.stream, tile.streamProvider)
  }
  cameraPreviewTiles.value = []

  try {
    await zg.value?.logoutRoom?.(zegoRoomID.value)
  } catch (e) {}

  try {
    zegoSuperBoard.value?.destroy?.()
  } catch (e) {}
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
  const directUniqueID = directView?.getModel?.()?.uniqueID || null
  const uniqueID = directUniqueID || result?.uniqueID || result?.model?.uniqueID || null

  if (directView) {
    currentSuperBoardView.value = directView
    totalPage.value = directView.getPageCount?.() || 1
    currentPage.value = directView.getCurrentPage?.() || 1
  }

  if (!uniqueID) {
    refreshCurrentSuperBoardView()
    return
  }

  const boardView = zegoSuperBoard.value?.getSuperBoardView?.()
  if (!boardView?.switchSuperBoardSubView) {
    refreshCurrentSuperBoardView()
    return
  }

  await withTimeout(
    boardView.switchSuperBoardSubView(uniqueID),
    8000,
    '切换课件白板超时（8秒）'
  )
  refreshCurrentSuperBoardView()
}

const waitAndFindFileSubView = async (fileID, fileName, maxRetry = 45, interval = 1000) => {
  for (let retry = 0; retry < maxRetry; retry += 1) {
    const subViewList = await withTimeout(
      zegoSuperBoard.value.querySuperBoardSubViewList(),
      5000,
      '查询白板子视图超时（5秒）'
    )
    const targetSubView = subViewList.find((item) => item.fileID === fileID || item.name === fileName)
    if (targetSubView?.uniqueID) {
      return targetSubView
    }
    await delay(interval)
  }
  return null
}

const handleEndLive = () => {
  endDialogVisible.value = true
}

const confirmEndLive = async () => {
  try {
    const streamID = 'teacher_' + roomId
    if (canPublishLive.value) {
      try {
        zg.value.stopPublishingStream(streamID)
      } catch (e) {}
    } else if (audienceMainStreamID.value) {
      try {
        zg.value.stopPlayingStream(audienceMainStreamID.value)
      } catch (e) {}
      audienceMainStreamID.value = ''
    }

    try {
      if (localStream.value) {
        releaseMediaStream(localStream.value, localStreamProvider.value)
        localStream.value = null
        localStreamProvider.value = 'native'
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
    if (canPublishLive.value) {
      try {
        await endLive(roomId)
      } catch (err) {
        stopError = err
      }
    }

    try {
      await zg.value.logoutRoom(zegoRoomID.value)
      roomState.value = 'DISCONNECTED'
    } catch (e) {}

    try {
      if (zegoSuperBoard.value) {
        zegoSuperBoard.value.destroy()
      }
    } catch (e) {}

    whiteboardReady.value = false
    currentSuperBoardView.value = null
    liveIdentity.value = null
    clearAudienceWhiteboardRetryTimer()
    audienceWhiteboardSyncing.value = false
    for (const tile of cameraPreviewTiles.value) {
      if (tile.isPublishing) {
        try {
          zg.value?.stopPublishingStream?.(tile.streamID)
        } catch (e) {}
        tile.isPublishing = false
      }
      releaseMediaStream(tile.stream, tile.streamProvider)
    }
    cameraPreviewTiles.value = []

    if (stopError) {
      throw stopError
    }

    isLiving.value = false
    endDialogVisible.value = false
    onlineCount.value = 0
    ElMessage.success(canPublishLive.value ? '直播已结束，回放生成中...' : '已退出听课房间')
  } catch (err) {
    ElMessage.error((canPublishLive.value ? '结束直播失败：' : '退出听课失败：') + parseErrorMessage(err))
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
    await announceFocusedStream(streamID, 'screen_share_stop')
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
      await announceFocusedStream(screenStreamID, 'screen_share_start')
    } catch (err) {
      ElMessage.warning('屏幕共享已取消')
    }
  }
}

const switchCamera = async () => {
  await refreshCameraDevices()
  if (cameraDevices.value.length <= 1) {
    ElMessage.info('当前仅检测到一个摄像头')
    return
  }
  const currentIndex = cameraDevices.value.findIndex((item) => item.deviceId === activeCameraDeviceId.value)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % cameraDevices.value.length
  try {
    await setMainCamera(cameraDevices.value[nextIndex].deviceId)
  } catch (err) {
    ElMessage.error('切换主摄像头失败：' + parseErrorMessage(err))
  }
}

// ==================== 白板 ====================
const initWhiteboard = async (roomID, token, userID, userName, options = {}) => {
  const { viewerOnly = false } = options
  await nextTick()

  if (!whiteboardRef.value || !whiteboardRef.value.offsetWidth || !whiteboardRef.value.offsetHeight) {
    throw new Error('白板容器未就绪，请稍后重试')
  }

  zegoSuperBoard.value = ZegoSuperBoardManager.getInstance()
  zegoSuperBoard.value.off?.('error')
  zegoSuperBoard.value.on?.('error', (error) => {
    console.error('[LivePush] SuperBoard error:', error)
  })
  
  let lastError = null
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await ensureRoomLoginForWhiteboard(roomID, token, userID, userName)

      if (attempt > 0) {
        try {
          zegoSuperBoard.value.destroy?.()
        } catch (e) {}
        await delay(500)
      }

      await withTimeout(
        zegoSuperBoard.value.init(zg.value, {
          parentDomID: whiteboardDomId,
          appID: ZEGO_CONFIG.appID,
          token: token,
          roomID: roomID,
          userID: userID,
          userName: userName || userID,
          isTestEnv: false
        }),
        10000,
        '白板服务初始化超时（10秒）'
      )

      await delay(300)

      if (currentSuperBoardView.value || refreshCurrentSuperBoardView()) {
        whiteboardReady.value = true
        return
      }

      if (viewerOnly) {
        const subViewList = await withTimeout(
          zegoSuperBoard.value.querySuperBoardSubViewList(),
          8000,
          '查询白板子视图超时（8秒）'
        )
        const firstSubView = Array.isArray(subViewList)
          ? subViewList.find((item) => item?.uniqueID)
          : null

        if (firstSubView?.uniqueID) {
          await switchToCreatedSubView({ uniqueID: firstSubView.uniqueID })
          if (currentSuperBoardView.value || refreshCurrentSuperBoardView()) {
            whiteboardReady.value = true
            return
          }
        }

        throw new Error('当前暂无老师共享白板')
      }

      const result = await withTimeout(
        zegoSuperBoard.value.createWhiteboardView({
          name: '课件白板', perPageWidth: 1600, perPageHeight: 900, pageCount: 5
        }),
        12000,
        '创建基础白板超时（12秒）'
      )

      await switchToCreatedSubView(result)
      if (!currentSuperBoardView.value) {
        refreshCurrentSuperBoardView()
      }

      if (!currentSuperBoardView.value) {
        throw new Error('基础白板创建后未激活')
      }

      whiteboardReady.value = true
      return
    } catch (err) {
      lastError = err
      if (isWhiteboardUserNotExistError(err) && attempt < 9) {
        wbStageText.value = `白板用户同步中...(${attempt + 1}/10) user=${userID}`
        console.warn('[LivePush] whiteboard user not exist, retrying', {
          attempt: attempt + 1,
          roomID,
          userID,
          err
        })

        // 开播前阶段允许强制重建房间会话，提升白板识别用户成功率。
        if (!isLiving.value || !localStream.value) {
          await resetRoomSessionBeforeStart(roomID)
          await ensureRoomLoginForWhiteboard(roomID, token, userID, userName)
        }

        await delay(1500)
        continue
      }

      if (attempt < 9) {
        await delay(500)
        continue
      }

      break
    }
  }

  throw lastError || new Error('白板初始化失败')
}

const ensureWhiteboardReadyForUpload = async () => {
  if (whiteboardReady.value && (currentSuperBoardView.value || refreshCurrentSuperBoardView())) {
    return true
  }

  const authInfo = liveIdentity.value || zegoAuthInfo.value || (await getZegoAuth())
  const token = authInfo?.token
  const userID = authInfo?.userId
  const userName = authInfo?.userName

  if (!token || !userID) {
    throw new Error('白板鉴权信息缺失，请重新开始直播')
  }

  whiteboardReady.value = false
  currentSuperBoardView.value = null
  await initWhiteboard(zegoRoomID.value, token, userID, userName)

  if (!currentSuperBoardView.value) {
    refreshCurrentSuperBoardView()
  }

  if (!whiteboardReady.value) {
    throw new Error('白板初始化未完成')
  }

  return true
}

const setWbTool = (tool) => {
  if (wbToolbarLocked.value || wbClassProtectMode.value) {
    ElMessage.warning('工具栏已锁定，按 K 可解锁')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    ElMessage.warning('白板未就绪')
    return
  }

  const toolEnum = ZegoSuperBoardWeb?.ZegoSuperBoardTool || {}
  const fallbackToolEnum = {
    Pen: 1,
    Text: 2,
    Line: 4,
    Rect: 8,
    Ellipse: 16,
    Selector: 32,
    Eraser: 64
  }
  const toolMap = {
    selector: Number.isFinite(toolEnum.Selector) ? toolEnum.Selector : fallbackToolEnum.Selector,
    pen: Number.isFinite(toolEnum.Pen) ? toolEnum.Pen : fallbackToolEnum.Pen,
    text: Number.isFinite(toolEnum.Text) ? toolEnum.Text : fallbackToolEnum.Text,
    line: Number.isFinite(toolEnum.Line) ? toolEnum.Line : fallbackToolEnum.Line,
    rect: Number.isFinite(toolEnum.Rect) ? toolEnum.Rect : fallbackToolEnum.Rect,
    ellipse: Number.isFinite(toolEnum.Ellipse) ? toolEnum.Ellipse : fallbackToolEnum.Ellipse,
    eraser: Number.isFinite(toolEnum.Eraser) ? toolEnum.Eraser : fallbackToolEnum.Eraser
  }
  const targetTool = Number.isFinite(toolMap[tool]) ? toolMap[tool] : null
  if (targetTool === null) {
    ElMessage.warning('当前白板不支持该工具')
    return
  }

  try {
    // 进入绘制模式后，工具切换才会生效。
    const modeEnum = ZegoSuperBoardWeb?.ZegoSuperBoardOperationMode || {}
    const drawMode = Number.isFinite(modeEnum.Draw) ? modeEnum.Draw : 4
    zegoSuperBoard.value.setOperationMode?.(drawMode)
    wbOperationMode.value = 'draw'
    const ok = zegoSuperBoard.value.setToolType?.(targetTool)
    if (ok === false) {
      ElMessage.warning('当前白板不支持该工具')
    } else {
      if (tool !== wbActiveTool.value) {
        wbPrevTool.value = wbActiveTool.value
      }
      wbActiveTool.value = tool
      wbToolPicker.value = tool
      // 工具变化后重应用绘图风格，保证图形工具参数不丢失。
      applyWbDrawStyle({ silent: true })
    }
  } catch (e) {
    ElMessage.warning('当前白板不支持该工具')
  }
}

const trySetWbProperty = (candidates) => {
  const board = zegoSuperBoard.value
  if (!board) return null
  let hadMethod = false
  for (const item of candidates) {
    const method = board?.[item.name]
    if (typeof method !== 'function') continue
    hadMethod = true
    try {
      const result = method.call(board, ...(item.args || []))
      if (result !== false) return true
    } catch (e) {}
  }
  return hadMethod ? false : null
}

const setWbLineStyle = (style, options = {}) => {
  if (!options.force && (wbToolbarLocked.value || wbClassProtectMode.value)) {
    if (!options.silent) ElMessage.warning('当前模式不允许修改线型')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    if (!options.silent) ElMessage.warning('白板未就绪')
    return
  }

  const normalizedStyle = style === 'dashed' ? 'dashed' : 'solid'
  wbLineStyle.value = normalizedStyle
  const lineStyleEnum = ZegoSuperBoardWeb?.ZegoSuperBoardLineStyle || {}
  const enumValue = normalizedStyle === 'dashed'
    ? [lineStyleEnum.Dash, lineStyleEnum.Dashed].find((value) => Number.isFinite(value))
    : lineStyleEnum.Solid

  const result = trySetWbProperty([
    { name: 'setLineStyle', args: [enumValue] },
    { name: 'setLineStyle', args: [normalizedStyle] },
    { name: 'setBrushLineStyle', args: [enumValue] },
    { name: 'setBrushLineStyle', args: [normalizedStyle] },
    { name: 'setPenLineStyle', args: [enumValue] },
    { name: 'setPenLineStyle', args: [normalizedStyle] },
    { name: 'setBrushDashed', args: [normalizedStyle === 'dashed'] },
    { name: 'setDashed', args: [normalizedStyle === 'dashed'] }
  ])

  if (result === false && !options.silent) {
    ElMessage.warning('当前白板不支持线型设置')
  }
}

const setWbShapeFilled = (filled, options = {}) => {
  if (!options.force && (wbToolbarLocked.value || wbClassProtectMode.value)) {
    if (!options.silent) ElMessage.warning('当前模式不允许修改填充')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    if (!options.silent) ElMessage.warning('白板未就绪')
    return
  }

  const normalizedFilled = !!filled
  wbShapeFilled.value = normalizedFilled
  const fillModeEnum = ZegoSuperBoardWeb?.ZegoSuperBoardFillMode || {}
  const enumValue = normalizedFilled
    ? [fillModeEnum.Fill, fillModeEnum.Filled].find((value) => Number.isFinite(value))
    : [fillModeEnum.Hollow, fillModeEnum.Stroke].find((value) => Number.isFinite(value))

  const result = trySetWbProperty([
    { name: 'setFillMode', args: [enumValue] },
    { name: 'setShapeFillMode', args: [enumValue] },
    { name: 'setShapeFilled', args: [normalizedFilled] },
    { name: 'setGraphicFilled', args: [normalizedFilled] },
    { name: 'setBrushFilled', args: [normalizedFilled] }
  ])

  if (result === false && !options.silent) {
    ElMessage.warning('当前白板不支持填充设置')
  }
}

const setWbAlpha = (alpha, options = {}) => {
  if (!options.force && (wbToolbarLocked.value || wbClassProtectMode.value)) {
    if (!options.silent) ElMessage.warning('当前模式不允许修改透明度')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    if (!options.silent) ElMessage.warning('白板未就绪')
    return
  }

  const normalizedAlpha = Math.max(1, Math.min(100, Number(alpha) || 100))
  wbAlpha.value = normalizedAlpha
  const alphaRate = normalizedAlpha / 100

  const result = trySetWbProperty([
    { name: 'setBrushAlpha', args: [alphaRate] },
    { name: 'setBrushAlpha', args: [normalizedAlpha] },
    { name: 'setBrushOpacity', args: [alphaRate] },
    { name: 'setBrushOpacity', args: [normalizedAlpha] },
    { name: 'setPenAlpha', args: [alphaRate] },
    { name: 'setPenAlpha', args: [normalizedAlpha] },
    { name: 'setPenOpacity', args: [alphaRate] },
    { name: 'setPenOpacity', args: [normalizedAlpha] },
    { name: 'setGraphicAlpha', args: [alphaRate] },
    { name: 'setGraphicOpacity', args: [alphaRate] }
  ])

  if (result === false && !options.silent) {
    ElMessage.warning('当前白板不支持透明度设置')
  }
}

const applyWbDrawStyle = (options = {}) => {
  setWbLineStyle(wbLineStyle.value, options)
  setWbShapeFilled(wbShapeFilled.value, options)
  setWbAlpha(wbAlpha.value, options)
}

const setWbOperationMode = (mode, options = {}) => {
  if (!options.force && (wbToolbarLocked.value || wbClassProtectMode.value)) {
    if (!options.silent) ElMessage.warning('工具栏已锁定，按 K 可解锁')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    if (!options.silent) ElMessage.warning('白板未就绪')
    return
  }
  const modeEnum = ZegoSuperBoardWeb?.ZegoSuperBoardOperationMode || {}
  const modeMap = {
    none: Number.isFinite(modeEnum.None) ? modeEnum.None : 1,
    scroll: Number.isFinite(modeEnum.Scroll) ? modeEnum.Scroll : 2,
    draw: Number.isFinite(modeEnum.Draw) ? modeEnum.Draw : 4,
    zoom: Number.isFinite(modeEnum.Zoom) ? modeEnum.Zoom : 8
  }
  const targetMode = modeMap[mode]
  if (!Number.isFinite(targetMode)) return
  try {
    zegoSuperBoard.value.setOperationMode?.(targetMode)
    wbOperationMode.value = mode
    wbToolPicker.value = mode === 'scroll' ? 'scroll' : wbActiveTool.value
  } catch (e) {}
}

const selectWbToolFromPicker = (tool) => {
  if (tool === 'scroll') {
    setWbOperationMode('scroll')
    return
  }
  setWbTool(tool)
}

const switchWbPrevTool = () => {
  const previousTool = wbPrevTool.value || 'selector'
  if (previousTool === wbActiveTool.value) return
  setWbTool(previousTool)
}

const toggleWbToolbarCompact = () => {
  wbToolbarCompact.value = !wbToolbarCompact.value
}

const toggleWbToolbarLock = () => {
  wbToolbarLocked.value = !wbToolbarLocked.value
  if (wbToolbarLocked.value) {
    ElMessage.info('白板工具栏已锁定（按 K 可解锁）')
  } else {
    ElMessage.success('白板工具栏已解锁')
  }
}

const toggleWbClassProtectMode = () => {
  wbClassProtectMode.value = !wbClassProtectMode.value
  if (wbClassProtectMode.value) {
    wbToolbarLocked.value = true
    wbToolbarCompact.value = true
    ElMessage.info('已进入课堂保护模式（按 G 可退出）')
  } else {
    wbToolbarLocked.value = false
    ElMessage.success('已退出课堂保护模式')
  }
}

const setWbColor = (color) => {
  if (wbToolbarLocked.value || wbClassProtectMode.value) {
    ElMessage.warning('当前模式不允许修改颜色')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    ElMessage.warning('白板未就绪')
    return
  }

  try {
    const ok = zegoSuperBoard.value.setBrushColor?.(color)
    if (ok === false) {
      ElMessage.warning('当前白板不支持颜色设置')
    }
  } catch (e) {}
}

const setWbBrushSize = (size) => {
  if (wbToolbarLocked.value || wbClassProtectMode.value) {
    ElMessage.warning('当前模式不允许修改线宽')
    return
  }
  if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView())) {
    ElMessage.warning('白板未就绪')
    return
  }
  const target = Number(size)
  if (!Number.isFinite(target) || target <= 0) return
  wbBrushSize.value = target
  try {
    const ok = zegoSuperBoard.value.setBrushSize?.(target)
    if (ok === false) {
      ElMessage.warning('当前白板不支持线宽设置')
    }
  } catch (e) {}
}

const undoWb = () => {
  if (!currentSuperBoardView.value && !refreshCurrentSuperBoardView()) {
    ElMessage.warning('白板未就绪')
    return
  }
  try {
    currentSuperBoardView.value?.undo?.()
  } catch (e) {
    ElMessage.warning('当前白板不支持撤销')
  }
}

const redoWb = () => {
  if (!currentSuperBoardView.value && !refreshCurrentSuperBoardView()) {
    ElMessage.warning('白板未就绪')
    return
  }
  try {
    currentSuperBoardView.value?.redo?.()
  } catch (e) {
    ElMessage.warning('当前白板不支持重做')
  }
}

const handleWbShortcutKeydown = (event) => {
  const target = event.target
  const tagName = String(target?.tagName || '').toLowerCase()
  const editable = !!target?.isContentEditable || ['input', 'textarea', 'select'].includes(tagName)
  if (editable) return

  const key = String(event.key || '').toLowerCase()
  const ctrlOrMeta = event.ctrlKey || event.metaKey

  if (!ctrlOrMeta && !event.altKey && key === 'k') {
    event.preventDefault()
    toggleWbToolbarLock()
    return
  }

  if (!ctrlOrMeta && !event.altKey && key === 'm') {
    event.preventDefault()
    toggleWbToolbarCompact()
    return
  }

  if (!ctrlOrMeta && !event.altKey && key === 'g') {
    event.preventDefault()
    toggleWbClassProtectMode()
    return
  }

  if (wbClassProtectMode.value) {
    if (ctrlOrMeta && key === 'z') {
      event.preventDefault()
      undoWb()
      return
    }
    return
  }

  if (wbToolbarLocked.value) {
    return
  }

  if (!ctrlOrMeta && !event.altKey && key === ' ') {
    event.preventDefault()
    if (!wbHotkeyPanActive.value && !event.repeat) {
      wbOperationModeBeforePan.value = wbOperationMode.value
      wbHotkeyPanActive.value = true
      setWbOperationMode('scroll', { silent: true, force: true })
    }
    return
  }

  if (!ctrlOrMeta && !event.altKey && key === 'tab') {
    event.preventDefault()
    switchWbPrevTool()
    return
  }

  if (ctrlOrMeta && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redoWb()
    } else {
      undoWb()
    }
    return
  }

  if (ctrlOrMeta && key === 'y') {
    event.preventDefault()
    redoWb()
    return
  }

  if (ctrlOrMeta || event.altKey) {
    return
  }

  const toolHotkeyMap = {
    v: 'selector',
    p: 'pen',
    b: 'pen',
    t: 'text',
    l: 'line',
    r: 'rect',
    o: 'ellipse',
    e: 'eraser'
  }

  const targetTool = toolHotkeyMap[key]
  if (targetTool) {
    event.preventDefault()
    setWbTool(targetTool)
    return
  }

  if (key === 'h') {
    event.preventDefault()
    setWbOperationMode('scroll')
    return
  }

  if (key === 'f') {
    event.preventDefault()
    setWbShapeFilled(!wbShapeFilled.value)
    return
  }

  if (key === 'd') {
    event.preventDefault()
    setWbLineStyle(wbLineStyle.value === 'solid' ? 'dashed' : 'solid')
    return
  }

  if (key === '[' || key === ']') {
    const currentIndex = wbBrushSizeOptions.indexOf(wbBrushSize.value)
    const safeIndex = currentIndex < 0 ? wbBrushSizeOptions.indexOf(6) : currentIndex
    const nextIndex = key === '['
      ? Math.max(0, safeIndex - 1)
      : Math.min(wbBrushSizeOptions.length - 1, safeIndex + 1)
    const nextSize = wbBrushSizeOptions[nextIndex]
    if (nextSize !== wbBrushSize.value) {
      event.preventDefault()
      setWbBrushSize(nextSize)
    }
  }
}

const handleWbShortcutKeyup = (event) => {
  const key = String(event.key || '').toLowerCase()
  if (key !== ' ') return
  if (!wbHotkeyPanActive.value) return
  event.preventDefault()
  wbHotkeyPanActive.value = false
  setWbOperationMode(wbOperationModeBeforePan.value || 'draw', { silent: true, force: true })
}

const clearWb = () => {
  if (!currentSuperBoardView.value && !refreshCurrentSuperBoardView()) {
    ElMessage.warning('白板未就绪')
    return
  }
  const subView = currentSuperBoardView.value

  try {
    if (subView?.clearCurrentPage) {
      subView.clearCurrentPage()
      return
    }
  } catch (e) {}

  try {
    if (subView?.clearAllPage) {
      subView.clearAllPage()
      return
    }
  } catch (e) {}

  ElMessage.warning('当前白板不支持清空操作')
}

const uploadPPT = async () => {
  if (!isLiving.value) {
    ElMessage.warning('请先开始直播后再上传 PPT')
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.ppt,.pptx,.pdf'
  input.style.display = 'none'
  input.value = ''
  document.body.appendChild(input)
  input.onchange = async (e) => {
    let loadingMsg = null
    try {
      const file = e?.target?.files?.[0]
      if (!file) {
        ElMessage.info('未选择文件')
        return
      }

      ElMessage.info(`已选择文件：${file.name}`)

      const lowerName = String(file.name || '').toLowerCase()
      const isPdf = lowerName.endsWith('.pdf')
      const isPpt = lowerName.endsWith('.ppt') || lowerName.endsWith('.pptx')
      if (!isPdf && !isPpt) {
        ElMessage.warning('仅支持 .ppt / .pptx / .pdf 文件')
        return
      }

      loadingMsg = ElMessage({
        type: 'info',
        duration: 0,
        showClose: true,
        message: '正在准备白板和课件，请稍候（通常 10-60 秒）...'
      })
      wbStageText.value = '准备中...'

      if (!zegoSuperBoard.value || (!currentSuperBoardView.value && !refreshCurrentSuperBoardView()) || !whiteboardReady.value) {
        ElMessage.info('步骤 1/3：正在准备白板环境...')
        wbStageText.value = '步骤 1/3：准备白板环境'
        try {
          await withTimeout(
            ensureWhiteboardReadyForUpload(),
            20000,
            '白板初始化超时（20秒），请结束直播后重开再试'
          )
        } catch (err) {
          ElMessage.warning('白板尚未就绪：' + parseErrorMessage(err))
          return
        }
      }
      
      ElMessage.info('步骤 2/3：PPT 上传中...')
      wbStageText.value = '步骤 2/3：上传课件'
      // SDK 在不同打包形态下可能拿不到枚举对象，这里使用固定数值更稳定：
      // IMG = 2, DynamicPPTH5 = 6, VectorAndIMG = 3
      const primaryRenderType = isPdf ? 2 : 6
      const fallbackRenderType = 3
      let fileID = ''

      try {
        fileID = await withTimeout(
          zegoSuperBoard.value.uploadFile(
            file,
            primaryRenderType,
            () => {},
            { renderImgType: 1 }
          ),
          120000,
          '课件上传或转码启动超时（120秒）'
        )
      } catch (primaryErr) {
        if (isPdf) throw primaryErr
        // 动态PPT不可用时自动回退到通用模式，保证可展示
        fileID = await withTimeout(
          zegoSuperBoard.value.uploadFile(
            file,
            fallbackRenderType,
            () => {},
            { renderImgType: 1 }
          ),
          120000,
          '课件上传或转码启动超时（120秒）'
        )
      }

      if (!fileID) {
        throw new Error('上传未返回 fileID，无法创建课件视图')
      }

      ElMessage.info('步骤 3/3：正在创建并切换课件视图...')
      wbStageText.value = '步骤 3/3：创建并切换课件视图'

      let wbResult = null
      let createFileViewError = null
      try {
        wbResult = await withTimeout(
          zegoSuperBoard.value.createFileView({ fileID }),
          30000,
          '创建课件视图超时（30秒）'
        )
      } catch (createErr) {
        createFileViewError = createErr
        console.warn('[LivePush] createFileView failed, will try current active subview:', createErr)
      }

      let switched = false
      if (wbResult) {
        await switchToCreatedSubView(wbResult)
        switched = !!(currentSuperBoardView.value || refreshCurrentSuperBoardView())
      }

      if (!switched) {
        await delay(300)
        switched = !!(currentSuperBoardView.value || refreshCurrentSuperBoardView())
      }

      if (!switched && createFileViewError) {
        throw new Error('创建课件视图失败：' + parseErrorMessage(createFileViewError))
      }

      if (!switched) {
        const active = zegoSuperBoard.value?.getSuperBoardView?.()?.getCurrentSuperBoardSubView?.()
        if (active) {
          currentSuperBoardView.value = active
          totalPage.value = active.getPageCount?.() || 1
          currentPage.value = active.getCurrentPage?.() || 1
          switched = true
        }
      }

      if (!switched) {
        throw new Error('已上传课件，但未切换到课件白板')
      }

      wbStageText.value = '课件已显示'
      ElMessage.success('PPT 加载成功')
    } catch (err) {
      wbStageText.value = '失败：' + parseErrorMessage(err, '未知错误')
      ElMessage.error('PPT 上传失败: ' + parseErrorMessage(err, '请检查白板转码配置'))
      console.error('[LivePush] PPT 上传流程异常:', err)
    } finally {
      loadingMsg?.close?.()
      input.value = ''
      input.remove()
    }
  }
  input.addEventListener('cancel', () => {
    input.value = ''
    input.remove()
  })
  setTimeout(() => {
    if (document.body.contains(input)) {
      input.value = ''
      input.remove()
    }
  }, 60000)
  // 必须保持同步触发，避免浏览器因异步流程拦截文件选择弹窗
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
  const isAssistantUser = audienceMode || userStore.userInfo?.role === 'assistant'
  try {
    const res = await getLiveRoomDetail(roomId)
    roomInfo.value = res
    zegoRoomID.value = normalizeRoomID(res?.zegoRoomId)
    const roomAlreadyLiving = ['living', 'paused'].includes(String(res.status || ''))
    isLiving.value = isAssistantUser ? roomAlreadyLiving : false
    if (!isAssistantUser && roomAlreadyLiving) {
      wbStageText.value = '检测到未结束直播，正在恢复会话...'
    }
    cameraPreviewPresets.value = loadCameraPreviewPresets()
    try {
      const savedCameraDeviceId = localStorage.getItem(cameraStorageKey)
      if (savedCameraDeviceId) {
        activeCameraDeviceId.value = savedCameraDeviceId
      }
    } catch (e) {}
    const savedLayout = loadLayoutState()
    if (savedLayout) {
      layoutFreeMode.value = !!savedLayout.layoutFreeMode
      showVideoPanel.value = savedLayout.showVideoPanel !== false
      showInteractionPanel.value = savedLayout.showInteractionPanel !== false
      interactionCollapsed.value = !!savedLayout.interactionCollapsed
      if (savedLayout.rightPanelWidth) {
        rightPanelWidth.value = savedLayout.rightPanelWidth
      }
      if (savedLayout.whiteboardPanelHeight) {
        whiteboardPanelHeight.value = Number(savedLayout.whiteboardPanelHeight) || 0
      }
      if (savedLayout.whiteboardPanelWidth) {
        whiteboardPanelWidth.value = Number(savedLayout.whiteboardPanelWidth) || 0
      }
      if (savedLayout.floatingVideoState) {
        Object.assign(floatingVideoState, savedLayout.floatingVideoState)
      }
      if (savedLayout.floatingInteractionState) {
        Object.assign(floatingInteractionState, savedLayout.floatingInteractionState)
      }
    }
    initFreeLayoutPositions()
    await nextTick()
    clampWhiteboardPanelHeight()
    clampWhiteboardPanelWidth()
    if (isAssistantUser && !zg.value) {
      try {
        await initZego()
      } catch (e) {}
    }
    try {
      const authInfo = await getZegoAuth()
      canPublishLive.value = !!authInfo?.canPublish && !isAssistantUser
      if ((isAssistantUser || !authInfo?.canPublish) && !audienceAutoJoinStarted.value) {
        if (!zg.value) {
          await initZego()
        }
        audienceAutoJoinStarted.value = true
        try {
          await startAudienceSession(authInfo)
        } catch (audErr) {
          audienceAutoJoinStarted.value = false
          wbStageText.value = '听课连接失败，正在重试...'
          console.error('[LivePush] audience session start failed:', audErr)
        }
      }
      if (!isAssistantUser && canPublishLive.value && roomAlreadyLiving && !teacherAutoResumeStarted.value) {
        teacherAutoResumeStarted.value = true
        await handleStartLive()
      }
      if (isAssistantUser || !authInfo?.canPublish) {
        syncAudienceRoomStatus()
      }
    } catch (err) {
      if (isAssistantUser) {
        canPublishLive.value = false
        wbStageText.value = '听课初始化失败，正在重试...'
        syncAudienceRoomStatus()
      }
      console.error('[LivePush] auth/init failed:', err)
    }
    await refreshCameraDevices()
    await restoreCameraPreviewTiles()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshCameraDevices)
    document.addEventListener('mousemove', handlePanelMouseMove)
    document.addEventListener('mouseup', handlePanelMouseUp)
    document.addEventListener('keydown', handleWbShortcutKeydown)
    document.addEventListener('keyup', handleWbShortcutKeyup)
  } catch (mountErr) {
    console.error('[LivePush] mount failed:', mountErr)
    wbStageText.value = '页面初始化失败：' + parseErrorMessage(mountErr)
    ElMessage.error('直播页面初始化失败：' + parseErrorMessage(mountErr))
  }
})

onBeforeUnmount(() => {
  if (whiteboardLayoutRefreshTimer.value) {
    clearTimeout(whiteboardLayoutRefreshTimer.value)
    whiteboardLayoutRefreshTimer.value = null
  }
  clearAudienceWhiteboardRetryTimer()
  clearAudienceRoomStatusRetryTimer()
  audienceWhiteboardSyncing.value = false
  cameraPreviewTiles.value.forEach((tile) => {
    if (tile.isPublishing) {
      try {
        zg.value?.stopPublishingStream?.(tile.streamID)
      } catch (e) {}
      tile.isPublishing = false
    }
    releaseMediaStream(tile.stream, tile.streamProvider)
  })
  cameraPreviewTiles.value = []
  navigator.mediaDevices?.removeEventListener?.('devicechange', refreshCameraDevices)
  document.removeEventListener('mousemove', handlePanelMouseMove)
  document.removeEventListener('mouseup', handlePanelMouseUp)
  document.removeEventListener('keydown', handleWbShortcutKeydown)
  document.removeEventListener('keyup', handleWbShortcutKeyup)
  teardownSessionWithoutEndingLive()
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

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-width: 0;
}

.main-area.free-layout {
  position: relative;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  overflow: hidden;
  min-width: 0;
}

.main-area.free-layout .left-panel {
  position: relative;
}

.video-container {
  height: 40%;
  min-height: 240px;
  background: #0f0f23;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}

.video-container.floating-video {
  position: absolute;
  z-index: 20;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  min-width: 280px;
  min-height: 180px;
}

.restore-tab {
  position: absolute;
  z-index: 18;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.9);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

.restore-video {
  left: 24px;
  top: 24px;
}

.restore-interaction {
  right: 24px;
  top: 24px;
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

.floating-handle,
.floating-panel-header {
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(17, 24, 39, 0.92);
  color: #fff;
  cursor: move;
  user-select: none;
}

.floating-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.floating-controls {
  bottom: 12px;
}

.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: se-resize;
  z-index: 5;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.28) 50%);
}

.whiteboard-container {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  min-width: 0;
  min-height: 0;
  
  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    border-radius: 0;
    width: 100vw;
    height: 100vh;
  }
}

.wb-splitter {
  height: 10px;
  margin: -6px 8px -2px;
  border-radius: 999px;
  cursor: row-resize;
  background: linear-gradient(90deg, transparent 0%, rgba(64, 158, 255, 0.25) 50%, transparent 100%);
  flex: none;
}

.wb-splitter-right {
  position: absolute;
  top: 44px;
  right: 0;
  width: 10px;
  height: calc(100% - 44px);
  margin: 0;
  cursor: ew-resize;
  z-index: 6;
  background: linear-gradient(180deg, transparent 0%, rgba(64, 158, 255, 0.25) 50%, transparent 100%);
}

.wb-toolbar {
  min-height: 44px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid #ddd;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: thin;
  
  .page-info {
    color: #333;
    font-size: 14px;
    min-width: 60px;
    text-align: center;
  }

  .wb-stage {
    max-width: 360px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    color: #666;
  }

  .wb-shortcut-tip {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
    flex-shrink: 0;
  }
}

.whiteboard {
  flex: 1;
  position: relative;
  min-width: 0;
  min-height: 0;
  
  :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
  }
}

.camera-gallery {
  border-radius: 12px;
  background: #101427;
  border: 1px solid rgba(64, 158, 255, 0.2);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.camera-gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #b8c5e3;
}

.camera-gallery-summary {
  display: flex;
  align-items: center;
  gap: 8px;
}

.camera-scene-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.camera-gallery-count {
  color: #8aa2d6;
}

.camera-gallery-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.camera-gallery-item {
  background: #0b1120;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

.camera-gallery-item-head {
  min-height: 36px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 52, 96, 0.42);
  gap: 8px;
}

.camera-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.camera-gallery-title {
  font-size: 12px;
  color: #d6e1ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.camera-stream-state {
  font-size: 11px;
  color: #7a8bb5;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(122, 139, 181, 0.2);
  white-space: nowrap;
}

.camera-stream-state.publishing {
  color: #d7ffe6;
  background: rgba(25, 173, 86, 0.28);
}

.camera-preview-video {
  width: 100%;
  height: 130px;
  background: #000;
}

.camera-preview-video :deep(video) {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.right-panel.docked {
  position: relative;
  flex: none;
  width: 340px;
  min-width: 280px;
}

.right-panel.collapsed {
  width: 52px !important;
  min-width: 52px !important;
  padding: 0;
  overflow: hidden;
}

.dock-panel-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: #16213e;
  color: #fff;
  border-bottom: 1px solid #0f3460;
}

.panel-collapsed-rail {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 2px;
  cursor: pointer;
  user-select: none;
  color: #fff;
  background: linear-gradient(180deg, #16213e 0%, #0f3460 100%);
}

.interaction-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.right-panel.docked .dock-resize-handle {
  position: absolute;
  left: -6px;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: ew-resize;
  z-index: 40;
  background: linear-gradient(90deg, transparent 0%, rgba(64, 158, 255, 0.25) 50%, transparent 100%);
}

.right-panel.floating {
  position: absolute;
  z-index: 30;
  top: 16px;
  bottom: 16px;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  background: #16213e;
  padding: 0 12px 24px;
  gap: 12px;
}

.right-panel.floating :deep(.panel-card) {
  margin-top: 12px;
}

.right-panel.floating .resize-handle {
  right: 0;
  bottom: 0;
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
