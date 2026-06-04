<template>
  <div class="teacher-live-room">
    <!-- 顶部工具栏 -->
    <div class="top-bar">
      <div class="room-info">
        <el-tag type="success" effect="dark" v-if="isLiving && !canPublishLive">● 听课中</el-tag>
        <el-tag type="danger" effect="dark" v-else-if="isLiving">● 直播中</el-tag>
        <el-tag type="info" v-else>未开始</el-tag>
        <el-tag v-if="canPublishLive && isLiving" :type="isScreenSharing ? 'success' : 'info'" effect="dark">
          {{ isScreenSharing ? '屏幕共享中' : '未共享屏幕' }}
        </el-tag>
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
        <el-select
          v-if="canPublishLive || isAssistantAudienceUser()"
          v-model="activeMicrophoneDeviceId"
          placeholder="麦克风"
          size="large"
          filterable
          clearable
          style="width: 220px"
        >
          <el-option
            v-for="device in microphoneDevices"
            :key="device.deviceId"
            :label="device.label"
            :value="device.deviceId"
          />
        </el-select>
        <el-select
          v-if="supportsOutputDeviceSelection"
          v-model="activeSpeakerDeviceId"
          placeholder="扬声器"
          size="large"
          filterable
          clearable
          style="width: 220px"
        >
          <el-option
            v-for="device in speakerDevices"
            :key="device.deviceId"
            :label="device.label"
            :value="device.deviceId"
          />
        </el-select>
        <div v-if="canPublishLive || isAssistantAudienceUser()" class="audio-gain-control">
          <span class="audio-gain-label">麦克风 {{ micGainPercent }}%</span>
          <el-slider
            v-model="micGainPercent"
            :min="0"
            :max="200"
            :step="5"
            :show-tooltip="false"
            style="width: 140px"
          />
          <div class="audio-level-meter" :class="{ muted: !isCurrentMicEnabled }">
            <div class="audio-level-meter-fill" :style="{ width: `${micLevelPercent}%` }"></div>
          </div>
        </div>
        <el-button
          v-if="canPublishLive || isAssistantAudienceUser()"
          :type="isMicTestActive ? 'success' : 'info'"
          size="large"
          @click="toggleMicTest"
        >
          {{ isMicTestActive ? '停止试音' : '麦克风试音' }}
        </el-button>
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
        <!-- 视频区域（自由布局） -->
        <div
          v-if="layoutFreeMode && showVideoPanel && !isStageFull"
          class="video-container floating-video"
          :style="getVideoPanelStyle()"
        >
          <div class="floating-handle" @mousedown.prevent="beginPanelDrag('video', $event)">
            <span>摄像头</span>
            <div class="floating-actions">
              <el-button text size="small" @click.stop="showVideoPanel = false">隐藏</el-button>
            </div>
          </div>
          <div class="local-video main-camera-video" ref="localVideoRef">
            <div class="main-video-host"></div>
            <span class="cohost-badge">主摄像头</span>
            <div class="cohost-toolbar">
              <el-button :type="isCameraOn ? 'primary' : 'info'" circle size="small" @click="toggleCamera">
                <el-icon><VideoCamera /></el-icon>
              </el-button>
              <div class="mic-button-wrap">
                <el-button :type="isMicOn ? 'primary' : 'info'" circle size="small" @click="toggleMic">
                  <el-icon><Microphone /></el-icon>
                </el-button>
                <span class="mic-level-chip" :class="getMicLevelChipClass(isMicOn)">{{ isMicOn ? micLevelPercent : 0 }}%</span>
              </div>
              <el-tooltip
                :content="getScreenShareTooltip()"
                :disabled="isScreenShareTooltipDisabled()"
                placement="top"
              >
                <span>
                  <el-button :type="isScreenSharing ? 'danger' : 'info'" :disabled="!canPublishLive || !isLiving" circle size="small" @click="toggleScreenShare">
                    <el-icon><Monitor /></el-icon>
                  </el-button>
                </span>
              </el-tooltip>
              <el-button type="info" circle size="small" @click="switchCamera">
                <el-icon><Switch /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="resize-handle" @mousedown.prevent="beginPanelResize('video', $event)"></div>
        </div>

        <!-- 授课展示区 -->
        <div
          class="stage-container"
          :class="{ fullscreen: isStageFull }"
          :style="getStageContainerStyle()"
          ref="stageContainerRef"
        >
          <div class="stage-canvas" ref="stageCanvasRef" @dblclick="toggleStageFull">
            <div class="stage-screen-host" ref="stageScreenHostRef"></div>
            <div v-if="!hasStageScreenContent" class="stage-screen-placeholder">屏幕共享画面将显示在此区域</div>
          </div>
          <div
            v-if="!isStageFull"
            class="stage-splitter stage-splitter-right"
            title="拖动调整展示区宽度"
            @mousedown.prevent="beginStageWidthResize"
          ></div>
        </div>

        <div
          v-if="!isStageFull"
          class="stage-splitter"
          title="拖动调整展示区高度"
          @mousedown.prevent="beginStageResize"
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
          <div v-if="!layoutFreeMode && showVideoPanel && !isStageFull" class="video-container right-side-video" ref="videoContainerRef">
            <div class="local-video main-camera-video" ref="localVideoRef">
              <div class="main-video-host"></div>
              <span class="cohost-badge">主摄像头</span>
              <div class="cohost-toolbar">
                <el-button :type="isCameraOn ? 'primary' : 'info'" circle size="small" @click="toggleCamera">
                  <el-icon><VideoCamera /></el-icon>
                </el-button>
                <div class="mic-button-wrap">
                  <el-button :type="isMicOn ? 'primary' : 'info'" circle size="small" @click="toggleMic">
                    <el-icon><Microphone /></el-icon>
                  </el-button>
                  <span class="mic-level-chip" :class="getMicLevelChipClass(isMicOn)">{{ isMicOn ? micLevelPercent : 0 }}%</span>
                </div>
                <el-tooltip
                  :content="getScreenShareTooltip()"
                  :disabled="isScreenShareTooltipDisabled()"
                  placement="top"
                >
                  <span>
                    <el-button
                      :type="isScreenSharing ? 'danger' : 'info'"
                      :disabled="!canPublishLive || !isLiving"
                      circle
                      size="small"
                      @click="toggleScreenShare"
                    >
                      <el-icon><Monitor /></el-icon>
                    </el-button>
                  </span>
                </el-tooltip>
                <el-button type="info" circle size="small" @click="switchCamera">
                  <el-icon><Switch /></el-icon>
                </el-button>
              </div>
            </div>
          </div>

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

          <!-- 助教摄像头（固定独立区域） -->
          <el-card class="panel-card assistant-card" v-if="isLiving">
            <template #header><span>助教摄像头</span></template>
            <div class="assistant-slot">
              <template v-if="canPublishLive">
                <div v-if="assistantCohostStream" class="cohost-item self assistant-item">
                  <div :id="'cohost-' + assistantCohostStream.streamID" class="cohost-video assistant-video">
                    <div class="cohost-video-host"></div>
                    <span class="cohost-badge">{{ assistantCohostStream.userName || '助教' }}</span>
                    <div class="cohost-toolbar">
                      <el-button
                        circle
                        size="small"
                        :type="assistantCohostStream.micEnabled ? 'primary' : 'info'"
                        @click="toggleAssistantMic(assistantCohostStream)"
                      >
                        <el-icon><Microphone /></el-icon>
                      </el-button>
                      <el-button circle size="small" type="danger" @click="kickCoHost(assistantCohostStream)">
                        <el-icon><Close /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-else class="assistant-placeholder">{{ assistantTeacherPlaceholderText }}</div>
              </template>
              <template v-else>
                <div v-if="isAssistantAudienceUser() && showAssistantSelfPreview" class="cohost-item self assistant-item">
                  <div id="assistant-self-preview" class="cohost-video assistant-video">
                    <div class="cohost-video-host"></div>
                    <span class="cohost-badge">我的摄像头</span>
                    <div class="cohost-toolbar">
                      <div class="mic-button-wrap">
                        <el-button
                          circle
                          size="small"
                          :type="assistantMicEnabled ? 'primary' : 'info'"
                          @click="toggleAssistantSelfMic"
                        >
                          <el-icon><Microphone /></el-icon>
                        </el-button>
                        <span class="mic-level-chip" :class="getMicLevelChipClass(assistantMicEnabled)">{{ assistantMicEnabled ? micLevelPercent : 0 }}%</span>
                      </div>
                      <el-button circle size="small" type="info" @click="switchAssistantCamera">
                        <el-icon><Switch /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </div>
                <div v-else class="assistant-placeholder">{{ assistantAudiencePlaceholderText }}</div>
              </template>
            </div>
            <div class="assistant-status-line">{{ assistantStatusLine }}</div>
          </el-card>

          <!-- 连麦学生 -->
          <el-card class="panel-card" v-if="studentCoHostStreams.length > 0">
            <template #header><span>连麦学生</span></template>
            <div class="cohost-grid">
              <div v-for="stream in studentCoHostStreams" :key="stream.streamID" class="cohost-item">
                <div :id="'cohost-' + stream.streamID" class="cohost-video">
                  <div class="cohost-video-host"></div>
                  <span class="cohost-badge">{{ stream.userName }}</span>
                </div>
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
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { ZegoExpressEngine } from 'zego-express-engine-webrtc'
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
const isStageFull = ref(false)
const stageStatusText = ref('')
const hasStageScreenContent = computed(() => {
  if (canPublishLive.value) return isScreenSharing.value
  return Boolean(audienceStageStreamID.value)
})
const showAssistantSelfPreview = computed(() => {
  return !canPublishLive.value && isAssistantAudienceUser() && Boolean(assistantPublishStream.value)
})
const assistantCohostStream = computed(() => {
  return coHostStreams.value.find((item) => item.isAssistant) || null
})
const studentCoHostStreams = computed(() => {
  return coHostStreams.value.filter((item) => !item.isAssistant)
})
const assistantTeacherPlaceholderText = computed(() => {
  if (!isLiving.value) return '直播未开始'
  return '助教暂未接入摄像头'
})
const assistantAudiencePlaceholderText = computed(() => {
  if (!isAssistantAudienceUser()) return '仅助教端显示本地摄像头预览'
  if (!isLiving.value) return '听课未开始'
  if (assistantPublishError.value) return assistantPublishError.value
  return '正在启动助教摄像头...'
})
const assistantStatusLine = computed(() => {
  if (canPublishLive.value) {
    if (!isLiving.value) return '状态：直播未开始'
    if (assistantCohostStream.value) return '状态：助教已接入'
    return '状态：等待助教推流'
  }

  if (!isAssistantAudienceUser()) return '状态：当前为听课视角'
  if (!isLiving.value) return '状态：听课未开始'
  if (showAssistantSelfPreview.value) {
    return `状态：助教推流中（${assistantMicEnabled.value ? '麦克风开启' : '麦克风关闭'}）`
  }
  if (assistantPublishError.value) return `状态：${assistantPublishError.value}`
  return '状态：正在启动助教摄像头'
})
const isCurrentMicEnabled = computed(() => (canPublishLive.value ? isMicOn.value : assistantMicEnabled.value))
const getMicLevelChipClass = (enabled) => {
  if (!enabled) return 'is-muted'
  const value = Number(micLevelPercent.value) || 0
  if (value >= 75) return 'is-high'
  if (value >= 35) return 'is-mid'
  return 'is-low'
}

// 连麦
const handUpList = ref([])
const coHostStreams = ref([])

// 聊天
const messages = ref([])
const chatText = ref('')
const chatScrollRef = ref(null)
const localVideoRef = ref(null)
const workspaceRef = ref(null)
const leftPanelRef = ref(null)
const stageContainerRef = ref(null)
const stageCanvasRef = ref(null)
const stageScreenHostRef = ref(null)
const cameraGalleryRef = ref(null)
const videoContainerRef = ref(null)
const zegoAuthInfo = ref(null)
const liveIdentity = ref(null)
const roomState = ref('DISCONNECTED')
const engineAppID = ref(0)
const currentRoomLoginRoomID = ref('')
const currentRoomLoginUserID = ref('')
const canPublishLive = ref(true)
const audienceMainStreamID = ref('')
const audienceStageStreamID = ref('')
const audienceMainRemoteStream = ref(null)
const audienceStageRemoteStream = ref(null)
const audiencePlayRetryCount = ref(0)
const audiencePlayRetryTimer = ref(null)
const audienceRoomStatusRetryCount = ref(0)
const audienceRoomStatusRetryTimer = ref(null)
const layoutFreeMode = ref(false)
const showVideoPanel = ref(true)
const showInteractionPanel = ref(true)
const cameraDevices = ref([])
const activeCameraDeviceId = ref('')
const microphoneDevices = ref([])
const activeMicrophoneDeviceId = ref('')
const speakerDevices = ref([])
const activeSpeakerDeviceId = ref('')
const micGainPercent = ref(100)
const micLevelPercent = ref(0)
const isMicTestActive = ref(false)
const cameraPreviewTiles = ref([])
const cameraPreviewSeq = ref(0)
const cameraPreviewPresets = ref([])
const previewSceneIndex = ref(0)
const localStreamProvider = ref('native')
const audienceAutoJoinStarted = ref(false)
const teacherAutoResumeStarted = ref(false)
const interactionCollapsed = ref(false)
const panelDragState = reactive({ active: false, panel: '', mode: '', startX: 0, startY: 0, startLeft: 0, startTop: 0, startWidth: 0, startHeight: 0 })
const stageResizeState = reactive({ active: false, mode: '', startX: 0, startY: 0, startWidth: 0, startHeight: 0 })
const stagePanelHeight = ref(0)
const stagePanelWidth = ref(0)
const floatingVideoState = reactive({ x: 24, y: 24, width: 360, height: 260 })
const floatingInteractionState = reactive({ x: 0, y: 16, width: 360, height: 520 })
const layoutStorageKey = `teacher_live_push_layout_${roomId}`
const layoutVersion = 2
const cameraStorageKey = `teacher_live_push_camera_${roomId}`
const microphoneStorageKey = `teacher_live_push_microphone_${roomId}`
const speakerStorageKey = `teacher_live_push_speaker_${roomId}`
const micGainStorageKey = `teacher_live_push_mic_gain_${roomId}`
const cameraPreviewStorageKey = `teacher_live_push_camera_previews_${roomId}`
const snapDistance = 24
const defaultDockedRightPanelWidth = 280
const rightPanelWidth = ref(defaultDockedRightPanelWidth)
const assistantPublishStream = ref(null)
const assistantPublishStreamProvider = ref('native')
const assistantPublishStreamID = ref('')
const assistantMicEnabled = ref(true)
const assistantPublishError = ref('')
const stageLayoutRefreshTimer = ref(null)
const audioContextRef = ref(null)
const micLevelAnimationFrame = ref(0)
const micTestAudioEl = ref(null)
const micTestBundleRef = ref(null)
const streamAudioBundleMap = new WeakMap()
const supportsOutputDeviceSelection = ref(typeof HTMLMediaElement !== 'undefined' && typeof HTMLMediaElement.prototype?.setSinkId === 'function')

// 结束直播弹窗
const endDialogVisible = ref(false)

const isAssistantAudienceUser = () => audienceMode || userStore.userInfo?.role === 'assistant'
const buildAssistantStreamID = (userID) => `assistant_${roomId}_${String(userID || '').trim() || 'unknown'}`

const parseErrorMessage = (err, fallback = '未知错误') => {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err?.errorData?.msg) return String(err.errorData.msg)
  if (err?.errorData?.message) return String(err.errorData.message)
  if (err?.err?.msg) return String(err.err.msg)
  if (err?.err?.message) return String(err.err.message)
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
const getFallbackRoomID = () => normalizeRoomID(`room_${roomId}`)

const ensureAudioContext = async () => {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextCtor) return null
  if (!audioContextRef.value) {
    audioContextRef.value = new AudioContextCtor()
  }
  if (audioContextRef.value.state === 'suspended') {
    try {
      await audioContextRef.value.resume()
    } catch (e) {}
  }
  return audioContextRef.value
}

const buildMicrophoneConstraints = (deviceId) => ({
  audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: false
})

const applyAudioBundleGain = (bundle) => {
  if (!bundle?.gainNode) return
  bundle.gainNode.gain.value = clamp(micGainPercent.value / 100, 0, 2)
}

const getMonitoredAudioBundle = () => {
  if (canPublishLive.value && localStream.value) {
    return streamAudioBundleMap.get(localStream.value) || null
  }
  if (!canPublishLive.value && assistantPublishStream.value) {
    return streamAudioBundleMap.get(assistantPublishStream.value) || null
  }
  if (micTestBundleRef.value) {
    return micTestBundleRef.value
  }
  return null
}

const getPrimaryLiveAudioBundle = () => {
  if (canPublishLive.value && localStream.value) {
    return streamAudioBundleMap.get(localStream.value) || null
  }
  if (!canPublishLive.value && assistantPublishStream.value) {
    return streamAudioBundleMap.get(assistantPublishStream.value) || null
  }
  return null
}

const applyOutputDeviceToMediaEl = async (mediaEl) => {
  if (!mediaEl || !supportsOutputDeviceSelection.value) return
  const sinkId = String(activeSpeakerDeviceId.value || '').trim()
  if (!sinkId) return
  if (typeof mediaEl.setSinkId !== 'function') return
  try {
    await mediaEl.setSinkId(sinkId)
  } catch (err) {
    console.warn('[LivePush] apply output device failed:', err)
  }
}

const applyOutputDeviceToCurrentMediaElements = async () => {
  if (!supportsOutputDeviceSelection.value) return
  const mediaNodes = Array.from(document.querySelectorAll('video, audio'))
  for (const node of mediaNodes) {
    await applyOutputDeviceToMediaEl(node)
  }
}

const stopMicLevelMonitor = () => {
  if (micLevelAnimationFrame.value) {
    cancelAnimationFrame(micLevelAnimationFrame.value)
    micLevelAnimationFrame.value = 0
  }
  micLevelPercent.value = 0
}

const updateMicLevelMeter = () => {
  const bundle = getMonitoredAudioBundle()
  const analyserNode = bundle?.analyserNode
  const analyserData = bundle?.analyserData

  if (!isCurrentMicEnabled.value || !analyserNode || !analyserData) {
    micLevelPercent.value = 0
  } else {
    analyserNode.getByteTimeDomainData(analyserData)
    let peak = 0
    for (let index = 0; index < analyserData.length; index += 1) {
      const normalized = Math.abs((analyserData[index] - 128) / 128)
      if (normalized > peak) peak = normalized
    }
    micLevelPercent.value = clamp(Math.round(peak * 180), 0, 100)
  }

  micLevelAnimationFrame.value = requestAnimationFrame(updateMicLevelMeter)
}

const ensureMicLevelMonitor = () => {
  if (micLevelAnimationFrame.value) return
  micLevelAnimationFrame.value = requestAnimationFrame(updateMicLevelMeter)
}

const releaseStreamAudioBundle = (stream) => {
  const bundle = stream ? streamAudioBundleMap.get(stream) : null
  if (!bundle) return
  try {
    bundle.sourceNode?.disconnect?.()
  } catch (e) {}
  try {
    bundle.gainNode?.disconnect?.()
  } catch (e) {}
  try {
    bundle.analyserNode?.disconnect?.()
  } catch (e) {}
  try {
    bundle.destination?.stream?.getTracks?.().forEach((track) => track.stop())
  } catch (e) {}
  try {
    bundle.sourceStream?.getTracks?.().forEach((track) => track.stop())
  } catch (e) {}
  streamAudioBundleMap.delete(stream)
}

const createProcessedAudioBundle = async (deviceId, enabled = true) => {
  const sourceStream = await navigator.mediaDevices.getUserMedia(buildMicrophoneConstraints(deviceId))
  const context = await ensureAudioContext()
  if (!context) {
    const processedTrack = sourceStream.getAudioTracks()[0] || null
    if (processedTrack) {
      processedTrack.enabled = !!enabled
    }
    return {
      sourceStream,
      sourceNode: null,
      gainNode: null,
      destination: null,
      processedTrack
    }
  }

  const sourceNode = context.createMediaStreamSource(sourceStream)
  const gainNode = context.createGain()
  const analyserNode = context.createAnalyser()
  const destination = context.createMediaStreamDestination()
  sourceNode.connect(gainNode)
  gainNode.connect(destination)
  gainNode.connect(analyserNode)
  analyserNode.fftSize = 256
  analyserNode.smoothingTimeConstant = 0.72
  const processedTrack = destination.stream.getAudioTracks()[0] || null
  if (processedTrack) {
    processedTrack.enabled = !!enabled
  }
  const bundle = {
    sourceStream,
    sourceNode,
    gainNode,
    analyserNode,
    analyserData: new Uint8Array(analyserNode.frequencyBinCount),
    destination,
    processedTrack
  }
  applyAudioBundleGain(bundle)
  return bundle
}

const attachProcessedAudioToStream = async (stream, options = {}) => {
  if (!stream) return
  const { deviceId = activeMicrophoneDeviceId.value, enabled = true } = options
  releaseStreamAudioBundle(stream)
  try {
    stream.getAudioTracks().forEach((track) => {
      try {
        stream.removeTrack(track)
      } catch (e) {}
      try {
        track.stop?.()
      } catch (e) {}
    })
  } catch (e) {}

  const bundle = await createProcessedAudioBundle(deviceId, enabled)
  if (!bundle?.processedTrack) return
  stream.addTrack(bundle.processedTrack)
  streamAudioBundleMap.set(stream, bundle)
  ensureMicLevelMonitor()
}

const updateLiveAudioGain = () => {
  if (localStream.value) {
    applyAudioBundleGain(streamAudioBundleMap.get(localStream.value))
  }
  if (assistantPublishStream.value) {
    applyAudioBundleGain(streamAudioBundleMap.get(assistantPublishStream.value))
  }
  if (micTestBundleRef.value) {
    applyAudioBundleGain(micTestBundleRef.value)
  }
}

const stopMicTest = () => {
  isMicTestActive.value = false
  if (micTestAudioEl.value) {
    try {
      micTestAudioEl.value.pause()
    } catch (e) {}
    micTestAudioEl.value.srcObject = null
  }
  if (micTestBundleRef.value) {
    try {
      micTestBundleRef.value.sourceNode?.disconnect?.()
    } catch (e) {}
    try {
      micTestBundleRef.value.gainNode?.disconnect?.()
    } catch (e) {}
    try {
      micTestBundleRef.value.analyserNode?.disconnect?.()
    } catch (e) {}
    try {
      micTestBundleRef.value.destination?.stream?.getTracks?.().forEach((track) => track.stop())
    } catch (e) {}
    try {
      micTestBundleRef.value.sourceStream?.getTracks?.().forEach((track) => track.stop())
    } catch (e) {}
    micTestBundleRef.value = null
  }
}

const ensureMicTestAudioEl = () => {
  if (micTestAudioEl.value) return micTestAudioEl.value
  const audioEl = document.createElement('audio')
  audioEl.autoplay = true
  audioEl.controls = false
  audioEl.muted = false
  audioEl.volume = 1
  micTestAudioEl.value = audioEl
  return audioEl
}

const startMicTest = async () => {
  const existingBundle = getPrimaryLiveAudioBundle()
  const bundle = existingBundle || await createProcessedAudioBundle(activeMicrophoneDeviceId.value, isCurrentMicEnabled.value)
  if (!existingBundle) {
    micTestBundleRef.value = bundle
    ensureMicLevelMonitor()
  }
  const targetStream = bundle?.destination?.stream || bundle?.sourceStream || null
  if (!targetStream) {
    throw new Error('当前麦克风不可用于试音')
  }
  const audioEl = ensureMicTestAudioEl()
  audioEl.srcObject = targetStream
  await applyOutputDeviceToMediaEl(audioEl)
  await audioEl.play()
  isMicTestActive.value = true
}

const toggleMicTest = async () => {
  if (isMicTestActive.value) {
    stopMicTest()
    ElMessage.success('已停止麦克风试音')
    return
  }
  try {
    await startMicTest()
    ElMessage.success('已开始麦克风试音')
  } catch (err) {
    stopMicTest()
    ElMessage.error('麦克风试音失败：' + parseErrorMessage(err))
  }
}

const republishTeacherStreamIfNeeded = async () => {
  if (!canPublishLive.value || !isLiving.value || !localStream.value || !zg.value || isScreenSharing.value) return
  const streamID = `teacher_${roomId}`
  try {
    zg.value?.stopPublishingStream?.(streamID)
  } catch (e) {}
  await zg.value.startPublishingStream(streamID, localStream.value)
}

const republishAssistantStreamIfNeeded = async () => {
  if (canPublishLive.value || !isLiving.value || !assistantPublishStream.value || !assistantPublishStreamID.value || !zg.value) return
  try {
    zg.value?.stopPublishingStream?.(assistantPublishStreamID.value)
  } catch (e) {}
  await zg.value.startPublishingStream(assistantPublishStreamID.value, assistantPublishStream.value)
}

const rebindLocalMicrophoneStream = async () => {
  if (canPublishLive.value) {
    if (!localStream.value) return
    await attachProcessedAudioToStream(localStream.value, {
      deviceId: activeMicrophoneDeviceId.value,
      enabled: isMicOn.value
    })
    await republishTeacherStreamIfNeeded()
    return
  }

  if (!assistantPublishStream.value) return
  await attachProcessedAudioToStream(assistantPublishStream.value, {
    deviceId: activeMicrophoneDeviceId.value,
    enabled: assistantMicEnabled.value
  })
  await republishAssistantStreamIfNeeded()
  await renderAssistantSelfPreview()
}

const markCurrentRoomLogin = (roomID, userID) => {
  currentRoomLoginRoomID.value = normalizeRoomID(roomID)
  currentRoomLoginUserID.value = String(userID || '').trim()
}

const clearCurrentRoomLogin = () => {
  currentRoomLoginRoomID.value = ''
  currentRoomLoginUserID.value = ''
}

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
    roomID = getFallbackRoomID()
    console.warn('[LivePush] roomID missing from room detail, fallback to:', roomID)
  }
  zegoRoomID.value = roomID
  return roomID
}

const renderLocalStream = async (container, stream) => {
  if (!container || !stream) return
  const host = container.querySelector?.('.main-video-host') || container
  host.innerHTML = ''
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.muted = true
  videoEl.playsInline = true
  videoEl.srcObject = stream
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  videoEl.style.objectFit = 'cover'
  host.appendChild(videoEl)
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

const renderRemoteStream = async (container, stream, muted = false) => {
  if (!container || !stream) return
  const host = container.querySelector?.('.main-video-host') || container
  host.innerHTML = ''
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.muted = !!muted
  videoEl.playsInline = true
  videoEl.srcObject = stream
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  videoEl.style.objectFit = 'cover'
  await applyOutputDeviceToMediaEl(videoEl)
  host.appendChild(videoEl)
  try {
    await videoEl.play()
  } catch (e) {}
}

const renderCohostStream = async (container, stream, muted = false) => {
  if (!container || !stream) return
  const host = container.querySelector?.('.cohost-video-host') || container
  host.innerHTML = ''
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.muted = !!muted
  videoEl.playsInline = true
  videoEl.srcObject = stream
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  videoEl.style.objectFit = 'cover'
  await applyOutputDeviceToMediaEl(videoEl)
  host.appendChild(videoEl)
  try {
    await videoEl.play()
  } catch (e) {}
}

const renderAssistantSelfPreview = async () => {
  if (!showAssistantSelfPreview.value || !assistantPublishStream.value) return
  await nextTick()
  const container = document.getElementById('assistant-self-preview')
  await renderCohostStream(container, assistantPublishStream.value, true)
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

const clearStageCanvas = () => {
  if (!stageScreenHostRef.value) return
  stageScreenHostRef.value.innerHTML = ''
}

const isScreenShareStreamID = (streamID) => String(streamID || '').endsWith('_screen')
const isAssistantStreamID = (streamID) => String(streamID || '').startsWith(`assistant_${roomId}_`)

const renderStageScreenStream = async (stream) => {
  if (!stageScreenHostRef.value || !stream) return
  clearStageCanvas()
  const videoEl = document.createElement('video')
  videoEl.autoplay = true
  videoEl.muted = true
  videoEl.playsInline = true
  videoEl.srcObject = stream
  videoEl.style.width = '100%'
  videoEl.style.height = '100%'
  videoEl.style.objectFit = 'contain'
  videoEl.style.pointerEvents = 'none'
  stageScreenHostRef.value.appendChild(videoEl)
  try {
    await videoEl.play()
  } catch (e) {}
}

const clearAudienceStageStream = () => {
  if (audienceStageStreamID.value) {
    try {
      zg.value?.stopPlayingStream?.(audienceStageStreamID.value)
    } catch (e) {}
    audienceStageStreamID.value = ''
  }
  audienceStageRemoteStream.value = null
  clearStageCanvas()
}

const restoreAudiencePlaybackViews = async () => {
  if (canPublishLive.value || !isLiving.value || !zg.value) return

  if (showVideoPanel.value && !isStageFull.value && audienceMainStreamID.value) {
    if (localVideoRef.value && audienceMainRemoteStream.value) {
      await renderRemoteStream(localVideoRef.value, audienceMainRemoteStream.value)
    } else {
      await playAudienceStream(audienceMainStreamID.value, { silent: true })
    }
  }

  if (audienceStageStreamID.value) {
    if (audienceStageRemoteStream.value) {
      await renderStageScreenStream(audienceStageRemoteStream.value)
    } else {
      await playAudienceStageStream(audienceStageStreamID.value, { silent: true })
    }
  }
}

const saveLayoutState = () => {
  try {
    localStorage.setItem(layoutStorageKey, JSON.stringify({
      layoutVersion,
      layoutFreeMode: layoutFreeMode.value,
      showVideoPanel: showVideoPanel.value,
      showInteractionPanel: showInteractionPanel.value,
      interactionCollapsed: interactionCollapsed.value,
      rightPanelWidth: rightPanelWidth.value,
      stagePanelHeight: stagePanelHeight.value,
      stagePanelWidth: stagePanelWidth.value,
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

const getStageResizeBounds = () => {
  const leftHeight = leftPanelRef.value?.clientHeight || 0
  const minimum = 260
  if (!leftHeight) {
    return { min: minimum, max: Math.max(minimum, stagePanelHeight.value || minimum) }
  }

  const sectionGap = 16
  let occupiedHeight = 0
  let gapCount = 0

  if (cameraPreviewTiles.value.length > 0 && cameraGalleryRef.value) {
    occupiedHeight += cameraGalleryRef.value.offsetHeight || 0
    gapCount += 1
  }

  const max = Math.max(minimum, leftHeight - occupiedHeight - gapCount * sectionGap)
  return { min: minimum, max }
}

const getStageWidthBounds = () => {
  const leftWidth = leftPanelRef.value?.clientWidth || 0
  const minimum = 640
  if (!leftWidth) {
    return { min: minimum, max: Math.max(minimum, stagePanelWidth.value || minimum) }
  }
  return { min: minimum, max: Math.max(minimum, leftWidth - 16) }
}

const clampStagePanelHeight = () => {
  if (!stagePanelHeight.value || isStageFull.value) return
  const bounds = getStageResizeBounds()
  stagePanelHeight.value = clamp(stagePanelHeight.value, bounds.min, bounds.max)
}

const clampStagePanelWidth = () => {
  if (!stagePanelWidth.value || isStageFull.value) return
  const bounds = getStageWidthBounds()
  stagePanelWidth.value = clamp(stagePanelWidth.value, bounds.min, bounds.max)
}

const getStageContainerStyle = () => {
  const style = {}
  if (!isStageFull.value) {
    if (stagePanelHeight.value > 0) {
      style.height = `${stagePanelHeight.value}px`
      style.flex = 'none'
    }
    if (stagePanelWidth.value > 0) {
      style.width = `${stagePanelWidth.value}px`
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
  const canUseSavedLayout = saved && Number(saved.layoutVersion || 1) >= layoutVersion
  if (canUseSavedLayout && saved?.floatingVideoState) {
    Object.assign(floatingVideoState, saved.floatingVideoState)
  } else {
  floatingVideoState.x = 24
  floatingVideoState.y = 24
  floatingVideoState.width = clamp(Math.floor(width * 0.28), 280, 460)
  floatingVideoState.height = clamp(Math.floor(height * 0.28), 200, 320)
  }
  if (canUseSavedLayout && saved?.floatingInteractionState) {
    Object.assign(floatingInteractionState, saved.floatingInteractionState)
  } else {
  floatingInteractionState.width = clamp(Math.floor(width * 0.28), 320, 420)
  floatingInteractionState.height = clamp(Math.floor(height - 32), 420, height - 24)
  floatingInteractionState.x = Math.max(24, width - floatingInteractionState.width - 24)
  floatingInteractionState.y = 16
  }
  if (canUseSavedLayout && saved?.rightPanelWidth) {
    rightPanelWidth.value = clamp(saved.rightPanelWidth, 240, Math.max(240, Math.floor(width * 0.42)))
  }
  if (canUseSavedLayout && saved?.interactionCollapsed) {
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
  scheduleStageLayoutRefresh()
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

const refreshMicrophoneDevices = async () => {
  try {
    const currentSelected = activeMicrophoneDeviceId.value
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter((device) => device.kind === 'audioinput')
    microphoneDevices.value = audioInputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `麦克风 ${index + 1}`
    }))
    if (microphoneDevices.value.length === 0) {
      activeMicrophoneDeviceId.value = ''
      return
    }
    const selectedExists = microphoneDevices.value.some((item) => item.deviceId === currentSelected)
    if (selectedExists) {
      activeMicrophoneDeviceId.value = currentSelected
      return
    }
    activeMicrophoneDeviceId.value = microphoneDevices.value[0].deviceId
  } catch (err) {
    console.warn('[LivePush] refreshMicrophoneDevices failed:', err)
  }
}

const refreshSpeakerDevices = async () => {
  if (!supportsOutputDeviceSelection.value) {
    speakerDevices.value = []
    activeSpeakerDeviceId.value = ''
    return
  }
  try {
    const currentSelected = activeSpeakerDeviceId.value
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioOutputs = devices.filter((device) => device.kind === 'audiooutput')
    speakerDevices.value = audioOutputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `扬声器 ${index + 1}`
    }))
    if (speakerDevices.value.length === 0) {
      activeSpeakerDeviceId.value = ''
      return
    }
    const selectedExists = speakerDevices.value.some((item) => item.deviceId === currentSelected)
    if (selectedExists) {
      activeSpeakerDeviceId.value = currentSelected
      return
    }
    activeSpeakerDeviceId.value = speakerDevices.value[0].deviceId
  } catch (err) {
    console.warn('[LivePush] refreshSpeakerDevices failed:', err)
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
  audio: false,
  video: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
})

const createZegoCameraStream = async (deviceId, withAudio = true, options = {}) => {
  if (!zg.value?.createStream) {
    throw new Error('ZEGO 推流引擎未就绪')
  }
  const { microphoneDeviceId = activeMicrophoneDeviceId.value, micEnabled = true } = options
  const cameraConfig = {
    video: true,
    audio: false,
    videoQuality: 2,
    width: 1280,
    height: 720,
    frameRate: 15,
    bitrate: 1200
  }
  if (deviceId) {
    cameraConfig.videoInputID = deviceId
  }
  const stream = await zg.value.createStream({ camera: cameraConfig })
  if (withAudio) {
    await attachProcessedAudioToStream(stream, {
      deviceId: microphoneDeviceId,
      enabled: micEnabled
    })
  }
  return stream
}

const createNativeCameraStream = async (deviceId, withAudio = true, options = {}) => {
  const constraints = buildCameraConstraints(deviceId, withAudio)
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  if (withAudio) {
    await attachProcessedAudioToStream(stream, {
      deviceId: options.microphoneDeviceId,
      enabled: options.micEnabled
    })
  }
  return stream
}

const createCameraStream = async (deviceId, withAudio = true, preferZego = false, options = {}) => {
  if (preferZego) {
    try {
      return { stream: await createZegoCameraStream(deviceId, withAudio, options), provider: 'zego' }
    } catch (err) {
      console.warn('[LivePush] createZegoCameraStream failed, fallback to native:', err)
    }
  }
  return { stream: await createNativeCameraStream(deviceId, withAudio, options), provider: 'native' }
}

const releaseMediaStream = (stream, provider = 'native') => {
  if (!stream) return
  releaseStreamAudioBundle(stream)
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

const applyAssistantMicState = (enabled) => {
  assistantMicEnabled.value = !!enabled
  if (!assistantPublishStream.value) return
  try {
    assistantPublishStream.value.getAudioTracks().forEach((track) => {
      track.enabled = assistantMicEnabled.value
    })
  } catch (e) {}
}

const startAssistantPublishing = async (authInfo) => {
  if (canPublishLive.value || !isAssistantAudienceUser() || !zg.value || !isLiving.value) return false
  if (assistantPublishStream.value && assistantPublishStreamID.value) {
    assistantPublishError.value = ''
    await renderAssistantSelfPreview()
    return true
  }

  const nextStreamID = buildAssistantStreamID(authInfo?.userId || currentRoomLoginUserID.value)
  assistantPublishError.value = ''
  try {
    // Prefer ZEGO camera stream, but gracefully fallback to native stream
    // so assistant preview/publish still works on browsers with createStream quirks.
    const selectedCameraDeviceId = activeCameraDeviceId.value || cameraDevices.value[0]?.deviceId || ''
    const { stream, provider } = await createCameraStream(selectedCameraDeviceId, true, true, {
      microphoneDeviceId: activeMicrophoneDeviceId.value,
      micEnabled: assistantMicEnabled.value
    })
    assistantPublishStream.value = stream
    assistantPublishStreamProvider.value = provider
    assistantPublishStreamID.value = nextStreamID
    applyAssistantMicState(true)
    await zg.value.startPublishingStream(nextStreamID, stream)
    await renderAssistantSelfPreview()
    assistantPublishError.value = ''
    return true
  } catch (err) {
    console.warn('[LivePush] startAssistantPublishing failed:', err)
    assistantPublishError.value = parseErrorMessage(err, '助教摄像头启动失败，请检查摄像头权限后重试')
    ElMessage.warning(assistantPublishError.value)
    if (assistantPublishStream.value) {
      releaseMediaStream(assistantPublishStream.value, assistantPublishStreamProvider.value)
      assistantPublishStream.value = null
    }
    assistantPublishStreamProvider.value = 'native'
    assistantPublishStreamID.value = ''
    return false
  }
}

const stopAssistantPublishing = async () => {
  try {
    if (assistantPublishStreamID.value) {
      zg.value?.stopPublishingStream?.(assistantPublishStreamID.value)
    }
  } catch (e) {}
  if (assistantPublishStream.value) {
    releaseMediaStream(assistantPublishStream.value, assistantPublishStreamProvider.value)
    assistantPublishStream.value = null
  }
  assistantPublishStreamProvider.value = 'native'
  assistantPublishStreamID.value = ''
  assistantMicEnabled.value = true
  assistantPublishError.value = ''
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

const trySwitchMainCameraInPlace = async (deviceId) => {
  if (!zg.value?.useVideoDevice) return false
  if (!localStream.value || localStreamProvider.value !== 'zego') return false
  try {
    await zg.value.useVideoDevice(localStream.value, deviceId)
    applyMainStreamTrackState(localStream.value)
    await renderLocalStream(localVideoRef.value, localStream.value)
    return true
  } catch (err) {
    console.warn('[LivePush] useVideoDevice failed, fallback to recreate stream:', err)
    return false
  }
}

const trySwitchAssistantCameraInPlace = async (deviceId) => {
  if (!zg.value?.useVideoDevice) return false
  if (!assistantPublishStream.value || assistantPublishStreamProvider.value !== 'zego') return false
  try {
    await zg.value.useVideoDevice(assistantPublishStream.value, deviceId)
    applyAssistantMicState(assistantMicEnabled.value)
    await renderAssistantSelfPreview()
    return true
  } catch (err) {
    console.warn('[LivePush] switch assistant camera in place failed, fallback to recreate stream:', err)
    return false
  }
}

const setAssistantCamera = async (deviceId) => {
  if (!deviceId) {
    throw new Error('未指定摄像头设备')
  }
  if (canPublishLive.value || !isAssistantAudienceUser()) {
    return
  }

  const previousDeviceId = activeCameraDeviceId.value
  activeCameraDeviceId.value = deviceId
  try {
    const switched = await trySwitchAssistantCameraInPlace(deviceId)
    if (switched) {
      return
    }

    const { stream, provider } = await createCameraStream(deviceId, true, true, {
      microphoneDeviceId: activeMicrophoneDeviceId.value,
      micEnabled: assistantMicEnabled.value
    })

    const previousStream = assistantPublishStream.value
    const previousProvider = assistantPublishStreamProvider.value
    assistantPublishStream.value = stream
    assistantPublishStreamProvider.value = provider
    applyAssistantMicState(assistantMicEnabled.value)

    if (isLiving.value && assistantPublishStreamID.value) {
      try {
        zg.value?.stopPublishingStream?.(assistantPublishStreamID.value)
      } catch (e) {}
      await zg.value.startPublishingStream(assistantPublishStreamID.value, stream)
    }

    if (previousStream) {
      releaseMediaStream(previousStream, previousProvider)
    }
    await renderAssistantSelfPreview()
  } catch (err) {
    activeCameraDeviceId.value = previousDeviceId
    throw err
  }
}

const setMainCamera = async (deviceId) => {
  if (!deviceId) {
    throw new Error('未指定摄像头设备')
  }
  const previousDeviceId = activeCameraDeviceId.value
  activeCameraDeviceId.value = deviceId
  try {
    const switched = await trySwitchMainCameraInPlace(deviceId)
    if (switched) {
      if (isLiving.value && !isScreenSharing.value) {
        await announceFocusedStream(`teacher_${roomId}`, 'main_camera')
      }
      return
    }

    // 主摄像头用于正式推流，必须使用 ZEGO 创建的流。
    const stream = await createZegoCameraStream(deviceId, true, {
      microphoneDeviceId: activeMicrophoneDeviceId.value,
      micEnabled: isMicOn.value
    })
    await publishMainCameraStream(stream, 'zego')
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
  stagePanelHeight.value = 0
  stagePanelWidth.value = 0
  try {
    localStorage.removeItem(layoutStorageKey)
  } catch (e) {}
  await nextTick()
  scheduleStageLayoutRefresh()
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
  scheduleStageLayoutRefresh()
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

const beginStageResize = (event) => {
  if (event.button !== 0 || isStageFull.value) return
  const targetHeight = stagePanelHeight.value || stageContainerRef.value?.getBoundingClientRect?.().height || 0
  if (!targetHeight) return
  stageResizeState.active = true
  stageResizeState.mode = 'height'
  stageResizeState.startY = event.clientY
  stageResizeState.startHeight = targetHeight
}

const beginStageWidthResize = (event) => {
  if (event.button !== 0 || isStageFull.value) return
  const targetWidth = stagePanelWidth.value || stageContainerRef.value?.getBoundingClientRect?.().width || 0
  if (!targetWidth) return
  stageResizeState.active = true
  stageResizeState.mode = 'width'
  stageResizeState.startX = event.clientX
  stageResizeState.startWidth = targetWidth
}

const handlePanelMouseMove = (event) => {
  if (stageResizeState.active) {
    if (stageResizeState.mode === 'height') {
      const dy = event.clientY - stageResizeState.startY
      const bounds = getStageResizeBounds()
      stagePanelHeight.value = clamp(stageResizeState.startHeight + dy, bounds.min, bounds.max)
    } else if (stageResizeState.mode === 'width') {
      const dx = event.clientX - stageResizeState.startX
      const bounds = getStageWidthBounds()
      stagePanelWidth.value = clamp(stageResizeState.startWidth + dx, bounds.min, bounds.max)
    }
    scheduleStageLayoutRefresh()
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
      rightPanelWidth.value = clamp(panelDragState.startWidth - dx, 240, Math.max(240, Math.floor(width * 0.42)))
    } else {
      const minWidth = panelDragState.panel === 'video' ? 280 : 320
      const minHeight = panelDragState.panel === 'video' ? 180 : 260
      const maxWidth = Math.max(minWidth, width - targetState.x - 16)
      const maxHeight = Math.max(minHeight, height - targetState.y - 16)
      targetState.width = clamp(panelDragState.startWidth + dx, minWidth, maxWidth)
      targetState.height = clamp(panelDragState.startHeight + dy, minHeight, maxHeight)
    }
  }
  scheduleStageLayoutRefresh()
}

const handlePanelMouseUp = () => {
  if (stageResizeState.active) {
    stageResizeState.active = false
    stageResizeState.mode = ''
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
    rightPanelWidth.value = clamp(rightPanelWidth.value, 240, Math.max(240, Math.floor(width * 0.42)))
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

const isLoginRoomLimitError = (err) => {
  const msg = String(err?.message || err?.msg || err || '').toLowerCase()
  return msg.includes('login rooms exceeds the upper limit') || (msg.includes('login') && msg.includes('upper limit'))
}

const handleUnhandledRejection = (event) => {
  return
}

const refreshStageLayout = async () => {
  await nextTick()
}

const scheduleStageLayoutRefresh = () => {
  if (stageLayoutRefreshTimer.value) {
    clearTimeout(stageLayoutRefreshTimer.value)
  }
  stageLayoutRefreshTimer.value = setTimeout(() => {
    stageLayoutRefreshTimer.value = null
    refreshStageLayout()
  }, 180)
}

const toggleStageFull = async () => {
  isStageFull.value = !isStageFull.value
  await refreshStageLayout()
  if (canPublishLive.value && isScreenSharing.value && screenStream.value) {
    await renderStageScreenStream(screenStream.value)
  }
  if (!canPublishLive.value) {
    await restoreAudiencePlaybackViews()
  }
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

watch(isStageFull, () => {
  scheduleStageLayoutRefresh()
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

watch([layoutFreeMode, showVideoPanel, isStageFull], async () => {
  await nextTick()
  if (layoutFreeMode.value) {
    initFreeLayoutPositions()
  }
  clampStagePanelHeight()
  clampStagePanelWidth()
  if (showVideoPanel.value && !isStageFull.value && localStream.value) {
    await renderLocalStream(localVideoRef.value, localStream.value)
  }

  if (!canPublishLive.value) {
    await restoreAudiencePlaybackViews()
  }

  saveLayoutState()
  scheduleStageLayoutRefresh()
})

watch([localVideoRef, stageScreenHostRef], async () => {
  if (canPublishLive.value || !isLiving.value) return
  await nextTick()
  await restoreAudiencePlaybackViews()
})

watch([showAssistantSelfPreview, showInteractionPanel], async () => {
  if (!showAssistantSelfPreview.value) return
  await renderAssistantSelfPreview()
})

watch(() => cameraPreviewTiles.value.length, async () => {
  await nextTick()
  clampStagePanelHeight()
  clampStagePanelWidth()
  saveLayoutState()
  scheduleStageLayoutRefresh()
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

watch(activeMicrophoneDeviceId, async (deviceId, previousDeviceId) => {
  try {
    if (deviceId) {
      localStorage.setItem(microphoneStorageKey, deviceId)
    } else {
      localStorage.removeItem(microphoneStorageKey)
    }
  } catch (e) {}

  if (!previousDeviceId || previousDeviceId === deviceId) return
  if (isMicTestActive.value) {
    stopMicTest()
  }
  try {
    await rebindLocalMicrophoneStream()
    ElMessage.success('麦克风已切换')
  } catch (err) {
    ElMessage.error('切换麦克风失败：' + parseErrorMessage(err))
  }
})

watch(activeSpeakerDeviceId, async (deviceId) => {
  try {
    if (deviceId) {
      localStorage.setItem(speakerStorageKey, deviceId)
    } else {
      localStorage.removeItem(speakerStorageKey)
    }
  } catch (e) {}
  await applyOutputDeviceToCurrentMediaElements()
})

watch(micGainPercent, (value) => {
  const nextValue = clamp(Number(value) || 0, 0, 200)
  if (nextValue !== value) {
    micGainPercent.value = nextValue
    return
  }
  updateLiveAudioGain()
  try {
    localStorage.setItem(micGainStorageKey, String(nextValue))
  } catch (e) {}
})

const resetRoomSessionBeforeStart = async (roomID) => {
  if (!zg.value?.logoutRoom) return
  try {
    await zg.value.logoutRoom(roomID)
    await delay(300)
  } catch (e) {}
  clearCurrentRoomLogin()
}

// ==================== 初始化 ZEGO ====================
const initZego = async () => {
  zg.value = ZEGO_CONFIG.server
    ? new ZegoExpressEngine(ZEGO_CONFIG.appID, ZEGO_CONFIG.server)
    : new ZegoExpressEngine(ZEGO_CONFIG.appID)
  engineAppID.value = Number(ZEGO_CONFIG.appID || 0)
  
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
      if (String(state || '').toUpperCase() !== 'CONNECTED') {
        clearCurrentRoomLogin()
      }
    }
  })

  // 监听流变化（学生连麦推流）
  zg.value.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
    if (updateType === 'ADD') {
      for (const stream of streamList) {
        if (!canPublishLive.value) {
          const teacherStreamPrefix = `teacher_${roomId}`
          const isTeacherStream = String(stream.streamID || '').startsWith(teacherStreamPrefix)
          const isTeacherScreenStream = isScreenShareStreamID(stream.streamID)
          const currentUserID = String(liveIdentity.value?.userId || currentRoomLoginUserID.value || '').trim()
          const isCurrentAssistantStream = isAssistantStreamID(stream.streamID) && currentUserID && String(stream.userID || '').trim() === currentUserID
          if (isCurrentAssistantStream) {
            await renderAssistantSelfPreview()
            continue
          }
          if (isTeacherScreenStream) {
            await playAudienceStageStream(stream.streamID, { silent: true })
            continue
          }
          if (!audienceMainStreamID.value && isTeacherStream) {
            const started = await playAudienceStream(stream.streamID, { silent: true })
            if (!started) {
              scheduleAudienceMainStreamRetry('room_stream_add', 800)
            }
            continue
          }
          if (audienceMainStreamID.value && stream.streamID === audienceMainStreamID.value) {
            await playAudienceStream(stream.streamID, { silent: true })
            continue
          }
        }
        if (!stream.streamID.includes('screen')) {
          const assistantStream = isAssistantStreamID(stream.streamID)
          const existingIndex = coHostStreams.value.findIndex((item) => item.streamID === stream.streamID)
          const streamRecord = {
            streamID: stream.streamID,
            userID: stream.userID,
            userName: stream.userName || (assistantStream ? '助教' : '学生'),
            isAssistant: assistantStream,
            micEnabled: assistantStream ? true : false
          }
          if (existingIndex === -1) {
            coHostStreams.value.push(streamRecord)
          } else {
            coHostStreams.value[existingIndex] = {
              ...coHostStreams.value[existingIndex],
              ...streamRecord
            }
          }
          await nextTick()
          try {
            const remoteStream = await zg.value.startPlayingStream(stream.streamID)
            const videoContainer = document.getElementById('cohost-' + stream.streamID)
            await renderCohostStream(videoContainer, remoteStream, false)
          } catch (playErr) {
            console.warn('[LivePush] play cohost stream failed', {
              streamID: stream.streamID,
              error: parseErrorMessage(playErr)
            })
          }
        }
      }
    } else {
      for (const stream of streamList) {
        if (!canPublishLive.value && audienceStageStreamID.value && stream.streamID === audienceStageStreamID.value) {
          clearAudienceStageStream()
          continue
        }
        if (!canPublishLive.value && audienceMainStreamID.value && stream.streamID === audienceMainStreamID.value) {
          try {
            zg.value.stopPlayingStream(stream.streamID)
          } catch (e) {}
          audienceMainStreamID.value = ''
          audienceMainRemoteStream.value = null
          if (localVideoRef.value) {
            localVideoRef.value.innerHTML = ''
          }
          const restarted = await playAudienceMainStream()
          if (!restarted) {
            scheduleAudienceMainStreamRetry('focused_stream_removed', 1000)
          }
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
          const targetStreamID = String(data.streamID)
          if (isScreenShareStreamID(targetStreamID)) {
            playAudienceStageStream(targetStreamID, { silent: true })
          } else {
            playAudienceStream(targetStreamID, { silent: true }).then((ok) => {
              if (!ok) {
                scheduleAudienceMainStreamRetry('stream_focus', 700)
              }
            })
          }
        } else if (data.type === 'assistant_mic_control' && !canPublishLive.value && isAssistantAudienceUser()) {
          const targetUserID = String(data.targetUserID || '').trim()
          const targetStreamID = String(data.targetStreamID || '').trim()
          const currentUserID = String(liveIdentity.value?.userId || currentRoomLoginUserID.value || '').trim()
          const currentStreamID = String(assistantPublishStreamID.value || '').trim()
          const matchedByStreamID = targetStreamID && currentStreamID && targetStreamID === currentStreamID
          const matchedByUserID = targetUserID && currentUserID && targetUserID === currentUserID
          if (matchedByStreamID || matchedByUserID) {
            applyAssistantMicState(data.enabled !== false)
            if (zg.value && zegoRoomID.value) {
              try {
                zg.value.sendBroadcastMessage(
                  zegoRoomID.value,
                  JSON.stringify({ type: 'assistant_mic_state', streamID: currentStreamID || targetStreamID, enabled: assistantMicEnabled.value })
                )
              } catch (e) {}
            }
          }
        } else if (data.type === 'assistant_mic_state' && canPublishLive.value && data.streamID) {
          const targetStreamID = String(data.streamID)
          const index = coHostStreams.value.findIndex((item) => item.streamID === targetStreamID)
          if (index !== -1) {
            coHostStreams.value[index] = {
              ...coHostStreams.value[index],
              micEnabled: data.enabled !== false
            }
          }
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
  const normalizedAuthInfo = {
    ...authInfo,
    roomId: normalizeRoomID(authInfo?.roomId || roomID)
  }
  const nextAppID = Number(normalizedAuthInfo.appId || 0)
  ZEGO_CONFIG.appID = nextAppID
  ZEGO_CONFIG.server = normalizedAuthInfo.server || null
  if (zg.value && engineAppID.value && nextAppID && engineAppID.value !== nextAppID) {
    try {
      zg.value.destroyEngine?.()
    } catch (e) {}
    zg.value = null
    engineAppID.value = 0
    roomState.value = 'DISCONNECTED'
  }
  zegoAuthInfo.value = normalizedAuthInfo
  return normalizedAuthInfo
}

const getAuthInfoForRoom = async (roomID = '') => {
  const targetRoomID = normalizeRoomID(roomID) || (await ensureRoomIDReady())
  const fromLiveIdentity = liveIdentity.value
  if (
    fromLiveIdentity?.token &&
    fromLiveIdentity?.userId &&
    normalizeRoomID(fromLiveIdentity?.roomId) === targetRoomID
  ) {
    return fromLiveIdentity
  }

  const fromAuthCache = zegoAuthInfo.value
  if (
    fromAuthCache?.token &&
    fromAuthCache?.userId &&
    normalizeRoomID(fromAuthCache?.roomId) === targetRoomID
  ) {
    return fromAuthCache
  }

  return getZegoAuth()
}

const playAudienceStream = async (streamID, options = {}) => {
  if (!zg.value || !localVideoRef.value || !streamID) return false
  const { silent = false } = options
  try {
    if (audienceMainStreamID.value && audienceMainStreamID.value === streamID && audienceMainRemoteStream.value) {
      await renderRemoteStream(localVideoRef.value, audienceMainRemoteStream.value)
      return true
    }

    if (audienceMainStreamID.value) {
      try {
        zg.value.stopPlayingStream(audienceMainStreamID.value)
      } catch (e) {}
      audienceMainStreamID.value = ''
      audienceMainRemoteStream.value = null
    }

    const remoteStream = await zg.value.startPlayingStream(streamID)
    await renderRemoteStream(localVideoRef.value, remoteStream)

    audienceMainStreamID.value = streamID
    audienceMainRemoteStream.value = remoteStream
    return true
  } catch (e) {
    console.warn('[LivePush] playAudienceStream failed', {
      streamID,
      error: parseErrorMessage(e)
    })
    if (!silent) {
      ElMessage.info('已进入房间，等待老师开始推流...')
    }
    return false
  }
}

const playAudienceStageStream = async (streamID, options = {}) => {
  if (!zg.value || !stageScreenHostRef.value || !streamID) return false
  const { silent = false } = options
  try {
    if (audienceStageStreamID.value && audienceStageStreamID.value === streamID && audienceStageRemoteStream.value) {
      await renderStageScreenStream(audienceStageRemoteStream.value)
      return true
    }

    if (audienceStageStreamID.value && audienceStageStreamID.value !== streamID) {
      try {
        zg.value.stopPlayingStream(audienceStageStreamID.value)
      } catch (e) {}
      audienceStageStreamID.value = ''
      audienceStageRemoteStream.value = null
    }

    const remoteStream = await zg.value.startPlayingStream(streamID)
    await renderStageScreenStream(remoteStream)

    audienceStageStreamID.value = streamID
    audienceStageRemoteStream.value = remoteStream
    return true
  } catch (e) {
    console.warn('[LivePush] playAudienceStageStream failed', {
      streamID,
      error: parseErrorMessage(e)
    })
    if (!silent) {
      ElMessage.info('屏幕共享暂未就绪，正在等待老师开启共享...')
    }
    return false
  }
}

const playAudienceMainStream = async () => {
  return playAudienceStream(`teacher_${roomId}`)
}

const clearAudiencePlayRetryTimer = () => {
  if (audiencePlayRetryTimer.value) {
    clearTimeout(audiencePlayRetryTimer.value)
    audiencePlayRetryTimer.value = null
  }
  audiencePlayRetryCount.value = 0
}

const scheduleAudienceMainStreamRetry = (reason = 'unknown', delayMs = 1200) => {
  if (canPublishLive.value || !isLiving.value) return
  if (audienceMainStreamID.value) return
  if (audiencePlayRetryCount.value >= 20) return

  if (audiencePlayRetryTimer.value) {
    clearTimeout(audiencePlayRetryTimer.value)
  }

  audiencePlayRetryTimer.value = setTimeout(async () => {
    audiencePlayRetryTimer.value = null
    if (canPublishLive.value || !isLiving.value || audienceMainStreamID.value) return
    audiencePlayRetryCount.value += 1
    const started = await playAudienceMainStream()
    if (!started) {
      console.warn('[LivePush] audience stream retry failed', {
        reason,
        retry: audiencePlayRetryCount.value,
        target: `teacher_${roomId}`
      })
      scheduleAudienceMainStreamRetry(reason, 1400)
    }
  }, Math.max(200, Number(delayMs) || 0))
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
      if (normalizeRoomID(liveIdentity.value?.roomId) && normalizeRoomID(liveIdentity.value?.roomId) !== nextRoomID) {
        liveIdentity.value = null
      }
      zegoRoomID.value = nextRoomID
    }
    const liveNow = ['living', 'paused'].includes(String(res.status || ''))
    if (liveNow) {
      isLiving.value = true
      stageStatusText.value = stageStatusText.value || '已切换为屏幕共享授课模式'
      clearAudienceRoomStatusRetryTimer()
      const authInfo = await getAuthInfoForRoom(zegoRoomID.value)
      if (!audienceAutoJoinStarted.value && authInfo?.token && authInfo?.userId) {
        if (!zg.value) {
          await initZego()
        }
        audienceAutoJoinStarted.value = true
        try {
          await startAudienceSession(authInfo)
        } catch (err) {
          audienceAutoJoinStarted.value = false
          stageStatusText.value = '听课连接失败，正在重试...'
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

const startAudienceSession = async (authInfo) => {
  const userID = authInfo.userId
  const userName = authInfo.userName
  const token = authInfo.token
  const roomID = await ensureRoomIDReady()
  zegoRoomID.value = roomID
  liveIdentity.value = { userId: userID, userName, token, roomId: roomID }
  isLiving.value = true
  stageStatusText.value = '已切换为屏幕共享授课模式，请等待老师开启屏幕共享'

  await resetRoomSessionBeforeStart(roomID)
  roomState.value = 'DISCONNECTED'

  try {
    await withTimeout(
      zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
      8000,
      '登录房间超时（8秒）'
    )
    markCurrentRoomLogin(roomID, userID)
  } catch (loginErr) {
    if (!isLoginRoomLimitError(loginErr)) {
      throw loginErr
    }

    // 房间登录上限异常时重建引擎并重试一次，避免页面卡死在听课空白。
    try {
      zg.value?.destroyEngine?.()
    } catch (e) {}
    zg.value = null
    engineAppID.value = 0
    roomState.value = 'DISCONNECTED'
    await initZego()

    await withTimeout(
      zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
      8000,
      '重试登录房间超时（8秒）'
    )
    markCurrentRoomLogin(roomID, userID)
  }

  await withTimeout(waitRoomConnected(12000), 13000, '房间连接未就绪')
  await playAudienceMainStream()
  if (!audienceMainStreamID.value) {
    scheduleAudienceMainStreamRetry('audience_session_start', 900)
  } else {
    clearAudiencePlayRetryTimer()
  }
  await startAssistantPublishing(authInfo)
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
    liveIdentity.value = { userId: userID, userName, token, roomId: roomID }

    // 清理可能残留的旧会话，统一走 loginRoom 的单路径初始化。
    await resetRoomSessionBeforeStart(roomID)
    roomState.value = 'DISCONNECTED'
    stageStatusText.value = '已切换为屏幕共享授课模式'

    await withTimeout(
      zg.value.loginRoom(roomID, token, { userID, userName }, { userUpdate: true }),
      8000,
      '登录房间超时（8秒）'
    )
    markCurrentRoomLogin(roomID, userID)
    await withTimeout(waitRoomConnected(12000), 13000, '房间连接未就绪')

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
  clearAudiencePlayRetryTimer()
  await stopAssistantPublishing()
  const streamID = 'teacher_' + roomId
  try {
    if (canPublishLive.value) {
      zg.value?.stopPublishingStream?.(streamID)
      zg.value?.stopPublishingStream?.(streamID + '_screen')
    } else if (audienceMainStreamID.value) {
      zg.value?.stopPlayingStream?.(audienceMainStreamID.value)
      audienceMainStreamID.value = ''
      audienceMainRemoteStream.value = null
    }
  } catch (e) {}
  if (!canPublishLive.value) {
    clearAudienceStageStream()
  }

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
  isScreenSharing.value = false
  clearStageCanvas()

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
}

const handleEndLive = () => {
  endDialogVisible.value = true
}

const confirmEndLive = async () => {
  try {
    await stopAssistantPublishing()
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
      audienceMainRemoteStream.value = null
    }

    try {
      if (localStream.value) {
    if (!canPublishLive.value) {
      clearAudienceStageStream()
    }
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
    isScreenSharing.value = false
    clearStageCanvas()

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

    liveIdentity.value = null
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

const getScreenShareTooltip = () => {
  if (isScreenSharing.value) return '点击停止屏幕共享'
  if (!canPublishLive.value) return '仅老师可开启屏幕共享'
  if (!isLiving.value) return '请先开始直播后再开启屏幕共享'
  return ''
}

const getScreenShareStateText = () => {
  return isScreenSharing.value ? '共享中' : '未共享'
}

const isScreenShareTooltipDisabled = () => {
  return !isScreenSharing.value && canPublishLive.value && isLiving.value
}

const toggleScreenShare = async () => {
  if (!canPublishLive.value) {
    ElMessage.warning('仅老师可开启屏幕共享')
    return
  }
  if (!isLiving.value) {
    ElMessage.warning('请先开始直播后再开启屏幕共享')
    return
  }
  if (!zg.value) {
    ElMessage.error('直播引擎未就绪，请稍后重试')
    return
  }

  if (isScreenSharing.value) {
    const screenStreamID = 'teacher_' + roomId + '_screen'
    try {
      zg.value.stopPublishingStream(screenStreamID)
    } catch (e) {}
    try {
      if (screenStream.value) {
        zg.value.destroyStream(screenStream.value)
      }
    } catch (e) {}
    screenStream.value = null
    isScreenSharing.value = false
    clearStageCanvas()
    const streamID = 'teacher_' + roomId
    await announceFocusedStream(streamID, 'screen_share_stop')
  } else {
    try {
      screenStream.value = await zg.value.createStream({
        screen: { audio: true, videoQuality: 2, width: 1920, height: 1080, frameRate: 15, bitrate: 1500 }
      })
      await renderStageScreenStream(screenStream.value)
      const screenTrack = screenStream.value?.getVideoTracks?.()?.[0]
      if (screenTrack) {
        screenTrack.onended = async () => {
          if (!isScreenSharing.value) return
          try {
            await toggleScreenShare()
          } catch (e) {}
        }
      }
      const streamID = 'teacher_' + roomId
      const screenStreamID = streamID + '_screen'
      await zg.value.startPublishingStream(screenStreamID, screenStream.value)
      isScreenSharing.value = true
      await announceFocusedStream(screenStreamID, 'screen_share_start')
    } catch (err) {
      clearStageCanvas()
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

const switchAssistantCamera = async () => {
  if (canPublishLive.value || !isAssistantAudienceUser()) return
  await refreshCameraDevices()
  if (cameraDevices.value.length <= 1) {
    ElMessage.info('当前仅检测到一个摄像头')
    return
  }
  const currentIndex = cameraDevices.value.findIndex((item) => item.deviceId === activeCameraDeviceId.value)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % cameraDevices.value.length
  try {
    await setAssistantCamera(cameraDevices.value[nextIndex].deviceId)
    ElMessage.success('已切换助教摄像头')
  } catch (err) {
    ElMessage.error('切换助教摄像头失败：' + parseErrorMessage(err))
  }
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

const toggleAssistantMic = async (stream) => {
  if (!canPublishLive.value || !stream?.isAssistant || !zg.value || !zegoRoomID.value) return
  const nextEnabled = !stream.micEnabled
  const targetUserID = String(stream.userID || '').trim()
  const targetStreamID = String(stream.streamID || '').trim()
  await zg.value.sendBroadcastMessage(
    zegoRoomID.value,
    JSON.stringify({
      type: 'assistant_mic_control',
      targetUserID: targetUserID || undefined,
      targetStreamID,
      enabled: nextEnabled
    })
  )

  const index = coHostStreams.value.findIndex((item) => item.streamID === stream.streamID)
  if (index !== -1) {
    coHostStreams.value[index] = {
      ...coHostStreams.value[index],
      micEnabled: nextEnabled
    }
  }
  ElMessage.success(nextEnabled ? '已打开助教麦克风' : '已关闭助教麦克风')
}

const toggleAssistantSelfMic = async () => {
  if (canPublishLive.value || !isAssistantAudienceUser() || !assistantPublishStream.value || !zg.value || !zegoRoomID.value) return
  const nextEnabled = !assistantMicEnabled.value
  applyAssistantMicState(nextEnabled)
  await renderAssistantSelfPreview()
  try {
    await zg.value.sendBroadcastMessage(
      zegoRoomID.value,
      JSON.stringify({
        type: 'assistant_mic_state',
        streamID: assistantPublishStreamID.value,
        enabled: nextEnabled
      })
    )
  } catch (e) {}
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
    const mountedRoomID = normalizeRoomID(res?.zegoRoomId) || zegoRoomID.value || getFallbackRoomID()
    zegoRoomID.value = mountedRoomID
    if (!normalizeRoomID(res?.zegoRoomId)) {
      console.warn('[LivePush] mount room detail missing zegoRoomId, keep/fallback roomID:', mountedRoomID)
    }
    const roomAlreadyLiving = ['living', 'paused'].includes(String(res.status || ''))
    isLiving.value = isAssistantUser ? roomAlreadyLiving : false
    stageStatusText.value = '已切换为屏幕共享授课模式'
    cameraPreviewPresets.value = loadCameraPreviewPresets()
    try {
      const savedCameraDeviceId = localStorage.getItem(cameraStorageKey)
      if (savedCameraDeviceId) {
        activeCameraDeviceId.value = savedCameraDeviceId
      }
      const savedMicrophoneDeviceId = localStorage.getItem(microphoneStorageKey)
      if (savedMicrophoneDeviceId) {
        activeMicrophoneDeviceId.value = savedMicrophoneDeviceId
      }
      const savedMicGain = Number(localStorage.getItem(micGainStorageKey))
      if (!Number.isNaN(savedMicGain) && savedMicGain >= 0) {
        micGainPercent.value = clamp(savedMicGain, 0, 200)
      }
      const savedSpeakerDeviceId = localStorage.getItem(speakerStorageKey)
      if (savedSpeakerDeviceId) {
        activeSpeakerDeviceId.value = savedSpeakerDeviceId
      }
    } catch (e) {}
    const savedLayout = loadLayoutState()
    if (savedLayout && Number(savedLayout.layoutVersion || 1) >= layoutVersion) {
      layoutFreeMode.value = !!savedLayout.layoutFreeMode
      showVideoPanel.value = savedLayout.showVideoPanel !== false
      showInteractionPanel.value = savedLayout.showInteractionPanel !== false
      interactionCollapsed.value = !!savedLayout.interactionCollapsed
      if (savedLayout.rightPanelWidth) {
        rightPanelWidth.value = savedLayout.rightPanelWidth
      }
      const savedStagePanelHeight = savedLayout.stagePanelHeight ?? savedLayout.whiteboardPanelHeight
      if (savedStagePanelHeight) {
        stagePanelHeight.value = Number(savedStagePanelHeight) || 0
      }
      const savedStagePanelWidth = savedLayout.stagePanelWidth ?? savedLayout.whiteboardPanelWidth
      if (savedStagePanelWidth) {
        stagePanelWidth.value = Number(savedStagePanelWidth) || 0
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
    clampStagePanelHeight()
    clampStagePanelWidth()
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
          stageStatusText.value = '听课连接失败，正在重试...'
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
        stageStatusText.value = '听课初始化失败，正在重试...'
        syncAudienceRoomStatus()
      }
      console.error('[LivePush] auth/init failed:', err)
    }
    await refreshCameraDevices()
    await refreshMicrophoneDevices()
    await refreshSpeakerDevices()
    await restoreCameraPreviewTiles()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshCameraDevices)
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshMicrophoneDevices)
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshSpeakerDevices)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    document.addEventListener('mousemove', handlePanelMouseMove)
    document.addEventListener('mouseup', handlePanelMouseUp)
  } catch (mountErr) {
    console.error('[LivePush] mount failed:', mountErr)
    stageStatusText.value = '页面初始化失败：' + parseErrorMessage(mountErr)
    ElMessage.error('直播页面初始化失败：' + parseErrorMessage(mountErr))
  }
})

onBeforeUnmount(() => {
  stopMicTest()
  stopMicLevelMonitor()
  if (stageLayoutRefreshTimer.value) {
    clearTimeout(stageLayoutRefreshTimer.value)
    stageLayoutRefreshTimer.value = null
  }
  clearAudienceRoomStatusRetryTimer()
  clearAudiencePlayRetryTimer()
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
  navigator.mediaDevices?.removeEventListener?.('devicechange', refreshMicrophoneDevices)
  navigator.mediaDevices?.removeEventListener?.('devicechange', refreshSpeakerDevices)
  try {
    audioContextRef.value?.close?.()
  } catch (e) {}
  audioContextRef.value = null
  window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  document.removeEventListener('mousemove', handlePanelMouseMove)
  document.removeEventListener('mouseup', handlePanelMouseUp)
  teardownSessionWithoutEndingLive()
})
</script>

<style scoped lang="scss">
.teacher-live-room {
  --space-1: 8px;
  --space-2: 12px;
  --space-3: 16px;
  --surface-border: rgba(64, 158, 255, 0.22);
  --surface-border-strong: rgba(64, 158, 255, 0.32);
  --panel-header-height: 36px;
  --panel-body-padding: var(--space-2);
  --panel-radius: 10px;
  --toolbar-surface: rgba(15, 23, 42, 0.64);
  --action-height: 34px;
  --action-radius: 8px;
  --ui-motion-duration: 0.16s;
  --ui-motion-easing: ease;
  --ui-shadow-hover: 0 8px 18px rgba(0, 0, 0, 0.24);
  --ui-card-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  --ui-card-shadow-hover: 0 16px 36px rgba(0, 0, 0, 0.28);
  --ui-border-hover: rgba(64, 158, 255, 0.36);
  --title-size-lg: 16px;
  --title-size-md: 14px;
  --text-size-sm: 12px;
  --text-size-md: 13px;
  --line-height-tight: 1.2;
  --line-height-base: 1.45;
  --stack-gap-sm: 8px;
  --stack-gap-md: var(--space-2);
  --row-padding-y: 8px;
  --panel-content-gap: 8px;
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
  padding: 0 var(--space-3);
  border-bottom: 1px solid #0f3460;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.room-title {
  font-size: var(--title-size-lg);
  line-height: var(--line-height-tight);
  font-weight: 600;
  letter-spacing: 0.01em;
}

.online-count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #aaa;
  font-size: var(--text-size-md);
  line-height: var(--line-height-tight);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.actions :deep(.el-button) {
  height: var(--action-height);
  border-radius: var(--action-radius);
  padding: 0 12px;
  font-size: 13px;
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), filter var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing);
}

.actions :deep(.el-button:hover) {
  transform: translateY(-1px);
  filter: brightness(1.04);
  box-shadow: var(--ui-shadow-hover);
}

.actions :deep(.el-button:active) {
  transform: translateY(0);
  filter: brightness(0.98);
  box-shadow: none;
}

.actions :deep(.el-select .el-select__wrapper) {
  min-height: var(--action-height);
  border-radius: var(--action-radius);
}

.audio-gain-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--action-height);
  padding: 0 12px;
  border-radius: var(--action-radius);
  background: rgba(255, 255, 255, 0.06);
}

.audio-gain-label {
  color: #dbe5ff;
  font-size: 12px;
  white-space: nowrap;
}

.audio-gain-control :deep(.el-slider) {
  --el-slider-main-bg-color: #67c23a;
  --el-slider-runway-bg-color: rgba(255, 255, 255, 0.18);
}

.audio-gain-control :deep(.el-slider__runway) {
  margin: 0;
}

.audio-level-meter {
  position: relative;
  width: 56px;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.audio-level-meter-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e 0%, #f59e0b 72%, #ef4444 100%);
  transition: width 80ms linear;
}

.audio-level-meter.muted .audio-level-meter-fill {
  width: 0 !important;
}

.audio-gain-control + :deep(.el-button) {
  flex: none;
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
  padding: var(--space-3);
  gap: var(--space-3);
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
  padding: var(--space-1) var(--space-2);
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
  position: relative;

  .main-video-host {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }

  .main-video-host :deep(video),
  .main-video-host video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  :deep(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.screen-share-state {
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1;
  min-width: 44px;
  text-align: center;
  user-select: none;
}

.screen-share-state.active {
  color: #34d399;
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
  font-size: var(--title-size-md);
  line-height: var(--line-height-tight);
  font-weight: 500;
}

.floating-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.floating-actions :deep(.el-button:not(.is-circle)) {
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12px;
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), filter var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing);
}

.floating-actions :deep(.el-button:not(.is-circle):hover) {
  transform: translateY(-1px);
  filter: brightness(1.04);
  box-shadow: var(--ui-shadow-hover);
}

.floating-actions :deep(.el-button:not(.is-circle):active) {
  transform: translateY(0);
  filter: brightness(0.98);
  box-shadow: none;
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

.stage-container {
  flex: 1;
  background: #fff;
  border: 1px solid var(--surface-border);
  border-radius: 12px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.2);
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

.stage-splitter {
  height: 10px;
  margin: -6px 8px -2px;
  border-radius: 999px;
  cursor: row-resize;
  background: linear-gradient(90deg, transparent 0%, rgba(64, 158, 255, 0.25) 50%, transparent 100%);
  flex: none;
}

.stage-splitter-right {
  position: absolute;
  top: 0;
  right: 0;
  width: 10px;
  height: 100%;
  margin: 0;
  cursor: ew-resize;
  z-index: 6;
  background: linear-gradient(180deg, transparent 0%, rgba(64, 158, 255, 0.25) 50%, transparent 100%);
}

.stage-canvas {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  min-width: 0;
  min-height: 0;

  .stage-screen-host {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .stage-screen-placeholder {
    position: relative;
    z-index: 1;
    color: rgba(255, 255, 255, 0.75);
    font-size: 14px;
    user-select: none;
    pointer-events: none;
  }

  :deep(video) {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain;
    background: #000;
    pointer-events: none;
  }
  
  :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
  }
}

.camera-gallery {
  border-radius: 12px;
  background: #101427;
  border: 1px solid var(--surface-border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.camera-gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: var(--text-size-md);
  line-height: var(--line-height-tight);
  font-weight: 500;
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
  gap: var(--space-1);
}

.camera-gallery-item {
  background: #0b1120;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing), border-color var(--ui-motion-duration) var(--ui-motion-easing);
}

.camera-gallery-item:hover {
  transform: translateY(-1px);
  border-color: var(--ui-border-hover);
  box-shadow: var(--ui-shadow-hover);
}

.camera-gallery-item-head {
  min-height: 36px;
  padding: 0 var(--space-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 52, 96, 0.42);
  gap: var(--space-1);
}

.camera-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.camera-gallery-title {
  font-size: var(--text-size-sm);
  line-height: var(--line-height-tight);
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
  width: 280px;
  background: #16213e;
  border-left: 1px solid var(--surface-border-strong);
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap-md);
  padding: var(--space-3);
  overflow: hidden;
}

.right-panel.docked {
  position: relative;
  flex: none;
  width: 280px;
  min-width: 240px;
}

.right-side-video {
  flex: none;
  height: 180px;
  min-height: 160px;
  border: 1px solid var(--surface-border);
  background: #0b1120;
  border-radius: var(--panel-radius);
  overflow: hidden;
  box-shadow: var(--ui-card-shadow);
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing), border-color var(--ui-motion-duration) var(--ui-motion-easing);
}

.right-side-video:hover {
  transform: translateY(-1px);
  box-shadow: var(--ui-card-shadow-hover);
  border-color: var(--ui-border-hover);
}

.main-camera-video {
  position: relative;
}

.main-camera-video .cohost-badge {
  top: 10px;
}

.main-camera-video .cohost-toolbar {
  left: 10px;
  bottom: 10px;
}

.right-panel.collapsed {
  width: 52px !important;
  min-width: 52px !important;
  padding: 0;
  overflow: hidden;
}

.dock-panel-header {
  height: var(--panel-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: #16213e;
  color: #fff;
  border-bottom: 1px solid #0f3460;
  font-size: var(--title-size-md);
  line-height: var(--line-height-tight);
  font-weight: 500;
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
  font-size: var(--text-size-sm);
  font-weight: 500;
}

.interaction-body {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap-sm);
  min-height: 0;
  flex: 1;
  overflow: hidden;
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
  padding: 0 var(--space-2) var(--space-3);
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
  border: 1px solid var(--surface-border);
  transition: border-color var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing);
  
  :deep(.el-card__header) {
    min-height: var(--panel-header-height);
    display: flex;
    align-items: center;
    background: #16213e;
    color: #fff;
    border-bottom: 1px solid #0f3460;
    padding: 0 12px;
    font-size: var(--title-size-md);
    line-height: var(--line-height-tight);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  :deep(.el-card__header > *) {
    display: inline-flex;
    align-items: center;
    min-height: calc(var(--panel-header-height) - 2px);
    line-height: var(--line-height-tight);
  }
  
  :deep(.el-card__body) {
    padding: var(--panel-body-padding);
    color: #ddd;
  }
}

.panel-card:hover {
  border-color: var(--ui-border-hover);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.panel-card:not(.chat-card) :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  gap: var(--panel-content-gap);
}

.panel-card :deep(.el-button--small:not(.is-circle)) {
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12px;
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), filter var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing);
}

.panel-card :deep(.el-button--small:not(.is-circle):hover) {
  transform: translateY(-1px);
  filter: brightness(1.04);
  box-shadow: var(--ui-shadow-hover);
}

.panel-card :deep(.el-button--small:not(.is-circle):active) {
  transform: translateY(0);
  filter: brightness(0.98);
  box-shadow: none;
}

.handup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--row-padding-y) 0;
  border-bottom: 1px solid #333;

  > div {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  
  &:last-child {
    border-bottom: none;
  }
}

.cohost-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 2px;
}

.assistant-slot {
  min-height: 148px;
}

.assistant-item {
  margin: 0;
}

.assistant-video {
  height: 188px;
}

.assistant-placeholder {
  min-height: 148px;
  border: 1px dashed var(--surface-border-strong);
  border-radius: var(--panel-radius);
  background: rgba(15, 23, 42, 0.55);
  color: #9db0d8;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 10px;
}

.assistant-status-line {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #8fa4d1;
}

.cohost-item {
  position: relative;
  background: #0b1120;
  border: 1px solid var(--surface-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
  text-align: center;
  padding-bottom: 0;
  box-shadow: var(--ui-card-shadow);
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing), border-color var(--ui-motion-duration) var(--ui-motion-easing);
}

.cohost-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--ui-card-shadow-hover);
  border-color: var(--ui-border-hover);
}

.cohost-item.self {
  grid-column: 1 / -1;
}

.cohost-video {
  width: 100%;
  height: 146px;
  background: #000;
  position: relative;

  .cohost-video-host {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }

  .cohost-video-host :deep(video),
  .cohost-video-host video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  :deep(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.cohost-item.self .cohost-video {
  height: 208px;
}

.cohost-toolbar {
  position: absolute;
  left: 10px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 999px;
  background: var(--toolbar-surface);
  backdrop-filter: blur(8px);
  z-index: 2;
}

.mic-button-wrap {
  position: relative;
  display: inline-flex;
}

.mic-level-chip {
  position: absolute;
  right: -10px;
  bottom: -6px;
  min-width: 34px;
  height: 14px;
  padding: 0 4px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.82);
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.24);
  pointer-events: none;
}

.mic-level-chip.is-muted {
  background: rgba(100, 116, 139, 0.78);
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.22);
}

.mic-level-chip.is-low {
  background: rgba(34, 197, 94, 0.84);
  box-shadow: 0 0 0 1px rgba(74, 222, 128, 0.28);
}

.mic-level-chip.is-mid {
  background: rgba(245, 158, 11, 0.86);
  box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.28);
}

.mic-level-chip.is-high {
  background: rgba(239, 68, 68, 0.88);
  box-shadow: 0 0 0 1px rgba(248, 113, 113, 0.32);
}

.cohost-toolbar :deep(.el-button) {
  width: 28px;
  height: 28px;
  padding: 0;
  transition: transform var(--ui-motion-duration) var(--ui-motion-easing), filter var(--ui-motion-duration) var(--ui-motion-easing), box-shadow var(--ui-motion-duration) var(--ui-motion-easing);
}

.cohost-toolbar :deep(.el-button .el-icon) {
  font-size: 14px;
}

.cohost-toolbar :deep(.el-button:hover) {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: var(--ui-shadow-hover);
}

.cohost-toolbar :deep(.el-button:active) {
  transform: translateY(0);
  filter: brightness(0.98);
  box-shadow: none;
}

.cohost-badge {
  position: absolute;
  left: 10px;
  top: 10px;
  z-index: 2;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  color: #fff;
  background: var(--toolbar-surface);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

@media (max-width: 1360px) {
  .right-panel,
  .right-panel.docked {
    width: 252px;
    min-width: 228px;
  }

  .right-side-video {
    height: 168px;
    min-height: 150px;
  }

  .cohost-video {
    height: 132px;
  }

  .cohost-item.self .cohost-video {
    height: 188px;
  }

  .cohost-grid {
    gap: 8px;
  }

  .actions {
    gap: 8px;
  }

  .actions :deep(.el-button) {
    height: 32px;
    font-size: 12px;
    padding: 0 10px;
  }

  .actions :deep(.el-select .el-select__wrapper) {
    min-height: 32px;
  }

  .audio-gain-control {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 1200px) {
  .teacher-live-room {
    --title-size-lg: 15px;
    --title-size-md: 13px;
    --text-size-md: 12px;
    --row-padding-y: 7px;
    --panel-content-gap: 7px;
  }

  .top-bar {
    height: auto;
    min-height: 56px;
    padding: var(--space-1) var(--space-2);
    flex-wrap: wrap;
    gap: 8px;
    align-content: center;
  }

  .room-info {
    gap: var(--space-2);
  }

  .actions {
    width: 100%;
    justify-content: flex-start;
    gap: 6px;
  }

  .actions :deep(.el-button) {
    height: 30px;
    padding: 0 8px;
    font-size: 12px;
  }

  .actions :deep(.el-select .el-select__wrapper) {
    min-height: 30px;
  }

  .audio-gain-control {
    width: 100%;
    justify-content: space-between;
  }
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
  padding: var(--panel-body-padding);
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap-sm);
}

.chat-msg {
  .msg-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 4px;
    font-size: var(--text-size-sm);
    line-height: var(--line-height-tight);
  }
  
  .msg-name {
    color: #409EFF;
    font-weight: 600;
  }
  
  .msg-time {
    color: #666;
    font-variant-numeric: tabular-nums;
  }
  
  .msg-content {
    background: #0f3460;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: var(--text-size-md);
    line-height: var(--line-height-base);
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
  padding: var(--space-2);
  border-top: 1px solid #0f3460;
}

.chat-input :deep(.el-input__wrapper) {
  min-height: 34px;
  border-radius: 8px;
}

.chat-input :deep(.el-input-group__append .el-button) {
  height: 34px;
  border-radius: 0 8px 8px 0;
  padding: 0 12px;
}
</style>
