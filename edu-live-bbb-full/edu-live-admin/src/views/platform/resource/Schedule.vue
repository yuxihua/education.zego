<template>
  <div class="resource-schedule-page">
    <el-card v-if="userStore.isPlatformAdmin" style="margin-bottom: 16px">
      <el-form inline>
        <el-form-item label="机构">
          <el-select v-model="currentInstitutionId" filterable placeholder="请选择机构" style="width: 280px" @change="reloadAll">
            <el-option v-for="item in institutionOptions" :key="item.id" :label="item.institutionName || item.nickname || item.username" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>排课管理</span>
          <div class="schedule-header-actions">
            <el-radio-group v-model="scheduleViewMode" size="small" @change="applyScheduleViewRange">
              <el-radio-button label="week">周视图</el-radio-button>
              <el-radio-button label="month">月视图</el-radio-button>
            </el-radio-group>
            <template v-if="scheduleViewMode === 'week'">
              <el-button size="small" @click="moveWeek(-1)">上一周</el-button>
              <el-button size="small" @click="moveWeek(1)">下一周</el-button>
              <el-button size="small" :disabled="!lastScheduleMove" @click="undoLastMove">撤销上次拖拽</el-button>
            </template>
            <el-button size="small" @click="openTimeLaneDialog">时段设置</el-button>
            <el-button size="small" @click="handleCopyPrevToCurrent">上周复制到本周</el-button>
            <el-button size="small" @click="handleCopyCurrentToNext">本周复制到下周</el-button>
            <el-button size="small" type="success" @click="handleExportSchedules">导出CSV</el-button>
            <el-button type="primary" size="small" @click="openScheduleDialog()">新增</el-button>
          </div>
        </div>
      </template>

      <el-form :inline="true" class="search-form">
        <el-form-item label="教室">
          <el-select v-model="scheduleSearch.classroomId" clearable placeholder="全部" style="width: 300px">
            <el-option v-for="room in classrooms" :key="room.id" :label="`${room.location || '-'} / ${room.name}`" :value="room.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="讲师">
          <el-select v-model="scheduleSearch.teacherId" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="teacher in teachers" :key="teacher.id" :label="teacher.nickname || teacher.username" :value="teacher.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadSchedules">查询</el-button>
        </el-form-item>
        <el-form-item>
          <el-button @click="applyScheduleViewRange">按{{ scheduleViewMode === 'week' ? '本周' : '本月' }}刷新</el-button>
        </el-form-item>
      </el-form>

      <div v-if="scheduleViewMode === 'week'" class="week-board">
        <div class="week-board-header">
          <div class="week-board-header-left">
            <span class="week-board-title">周课表</span>
            <span class="week-board-range">{{ weekRangeText }}</span>
          </div>
          <div class="week-board-header-right">
            <el-select v-model="scheduleColorMode" size="small" style="width: 130px">
              <el-option label="无着色" value="none" />
              <el-option label="按讲师" value="teacher" />
              <el-option label="按教室" value="classroom" />
            </el-select>
          </div>
        </div>
        <div class="week-legend" v-if="weekLegendItems.length">
          <div class="week-legend-item" v-for="item in weekLegendItems" :key="item.key">
            <span class="week-legend-dot" :style="{ backgroundColor: item.theme.bg, borderColor: item.theme.border }"></span>
            <span class="week-legend-text">{{ item.label }}</span>
          </div>
        </div>
        <div class="week-drag-tips">拖拽课程到指定日期栏分区，可同时调整日期和时间段。当前时段：{{ timeLaneTipsText }}</div>
        <div class="quick-undo-bar" v-if="quickUndoVisible">
          <span class="quick-undo-text">已完成拖拽改期，可在 {{ quickUndoSeconds }}s 内快速撤销。</span>
          <el-button link type="warning" @click="undoLastMove">立即撤销</el-button>
          <el-button link @click="dismissQuickUndo">关闭</el-button>
        </div>
        <div class="week-grid">
          <div class="week-day" v-for="day in weekGridDays" :key="day.key">
            <div class="week-day-head">
              <div class="week-day-name">{{ day.label }}</div>
              <div class="week-day-date">{{ day.dateText }}</div>
            </div>
            <div class="week-day-body">
              <div
                :class="[
                  'week-lane',
                  {
                    'is-drop-target': dragHoverLaneKey === getLaneKey(day, lane),
                    'is-recommended-target': laneRecommendMap[getLaneKey(day, lane)] && !laneConflictMap[getLaneKey(day, lane)],
                    'is-conflict-target': laneConflictMap[getLaneKey(day, lane)]
                  }
                ]"
                v-for="lane in timeLanes"
                :key="`${day.key}_${lane.key}`"
                @dragenter.prevent="handleLaneDragEnter(day, lane)"
                @dragover.prevent="handleLaneDragOver(day, lane)"
                @dragleave="handleLaneDragLeave(day, lane)"
                @drop="handleLaneDrop(day, lane)"
              >
                <div class="week-lane-title-row">
                  <div class="week-lane-title">{{ lane.label }}（{{ lane.start }}-{{ lane.end }}）</div>
                  <el-tooltip
                    v-if="getLaneConflict(day, lane)"
                    placement="top"
                    effect="light"
                    :content="formatLaneConflictText(getLaneConflict(day, lane))"
                  >
                    <span class="week-lane-conflict-tag">冲突</span>
                  </el-tooltip>
                </div>
                <div
                  class="week-slot"
                  v-for="item in getLaneItems(day, lane)"
                  :key="item.id"
                  draggable="true"
                  :style="getSlotStyle(item)"
                  @dragstart="handleSlotDragStart(item, day)"
                  @dragend="handleSlotDragEnd"
                  @click="openScheduleDialog(item)"
                >
                  <div class="week-slot-time">{{ slotTimeText(item) }}</div>
                  <div class="week-slot-course">{{ item.courseName }}</div>
                  <div class="week-slot-meta">{{ item.classroom?.location || '-' }} / {{ item.classroom?.name || '-' }} · {{ item.teacher?.nickname || item.teacher?.username || '-' }}</div>
                </div>
                <div class="week-slot-empty" v-if="!getLaneItems(day, lane).length">暂无排课</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <el-table :data="schedules" size="small" v-loading="scheduleLoading" border>
        <el-table-column prop="courseName" label="课程" min-width="140" />
        <el-table-column label="时间" min-width="180">
          <template #default="{ row }">{{ formatRange(row.startTime, row.endTime) }}</template>
        </el-table-column>
        <el-table-column label="教室" min-width="180">
          <template #default="{ row }">{{ row.classroom?.location || '-' }} / {{ row.classroom?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="讲师" min-width="120">
          <template #default="{ row }">{{ row.teacher?.nickname || row.teacher?.username || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="openScheduleDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDeleteSchedule(row)">删</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="scheduleDialogVisible" :title="scheduleForm.id ? '编辑排课' : '新增排课'" width="620px">
      <el-form :model="scheduleForm" label-width="100px">
        <el-form-item label="教室">
          <el-select v-model="scheduleForm.classroomId" filterable style="width: 100%">
            <el-option v-for="room in classrooms" :key="room.id" :label="`${room.location || '-'} / ${room.name}`" :value="room.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="讲师">
          <el-select v-model="scheduleForm.teacherId" filterable style="width: 100%">
            <el-option v-for="teacher in teachers" :key="teacher.id" :label="teacher.nickname || teacher.username" :value="teacher.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程名称">
          <el-select
            v-model="scheduleForm.courseName"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="请选择课程名称"
            style="width: 100%"
          >
            <el-option v-for="name in courseOptions" :key="name" :label="name" :value="name" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间"><el-date-picker v-model="scheduleForm.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
        <el-form-item label="结束时间"><el-date-picker v-model="scheduleForm.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="scheduleForm.remarks" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="scheduleForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="scheduleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSchedule">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="copyResultVisible" title="复制结果" width="760px">
      <el-alert
        :title="`成功 ${copyResult.copiedCount || 0} 条，跳过 ${copyResult.skippedCount || 0} 条`"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-table :data="copyResult.skipped || []" size="small" border>
        <el-table-column prop="courseName" label="课程" min-width="120" />
        <el-table-column prop="targetTimeRange" label="目标时间" min-width="180" />
        <el-table-column prop="reason" label="原因" min-width="120" />
        <el-table-column prop="conflictCourseName" label="冲突课程" min-width="120" />
        <el-table-column prop="conflictTimeRange" label="冲突时间" min-width="180" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="timeLaneDialogVisible" title="时段设置" width="560px">
      <el-alert title="设置上午/下午/晚间的具体时间段后，周视图分区和拖拽改期将按新规则生效。" type="info" :closable="false" style="margin-bottom: 12px" />
      <el-form label-width="90px">
        <el-row v-for="item in timeLaneDraft" :key="item.key" :gutter="12" style="margin-bottom: 8px">
          <el-col :span="6">
            <el-form-item :label="item.label">
              <el-input :model-value="item.label" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="9">
            <el-form-item label="开始">
              <el-time-picker
                v-model="item.start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="9">
            <el-form-item label="结束">
              <el-time-picker
                v-model="item.end"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="resetTimeLanesToDefault">恢复默认</el-button>
        <el-button @click="timeLaneDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTimeLaneSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getInstitutionList } from '@/api/platform'
import { getCourseList } from '@/api/course'
import {
  checkScheduleConflict,
  copyWeekSchedules,
  createSchedule,
  deleteSchedule,
  exportSchedules,
  getClassrooms,
  getSchedules,
  getTeachers,
  getTimeLanes,
  saveTimeLanes,
  updateSchedule
} from '@/api/resource'

const userStore = useUserStore()
const institutionOptions = ref([])
const currentInstitutionId = ref(userStore.currentInstitutionId || null)

const classrooms = ref([])
const teachers = ref([])
const courseOptions = ref([])
const schedules = ref([])
const scheduleLoading = ref(false)
const scheduleViewMode = ref('week')
const scheduleColorMode = ref('teacher')
const scheduleSearch = reactive({ classroomId: null, teacherId: null, startDate: '', endDate: '' })

const scheduleDialogVisible = ref(false)
const scheduleForm = reactive({ id: null, classroomId: null, teacherId: null, courseName: '', startTime: '', endTime: '', remarks: '', status: 1 })
const copyResultVisible = ref(false)
const copyResult = reactive({ copiedCount: 0, skippedCount: 0, skipped: [] })
const timeLaneDialogVisible = ref(false)
const draggingSlot = ref(null)
const dragHoverLaneKey = ref('')
const laneConflictMap = reactive({})
const laneRecommendMap = reactive({})
const currentRecommendDayKey = ref('')
const lanePrecheckTimer = ref(null)
const quickUndoSeconds = ref(0)
const quickUndoTimer = ref(null)
const lastScheduleMove = ref(null)
const quickUndoVisible = computed(() => !!lastScheduleMove.value && quickUndoSeconds.value > 0)

const SLOT_THEMES = [
  { bg: '#ecf5ff', border: '#91caff', text: '#1d39c4' },
  { bg: '#f6ffed', border: '#b7eb8f', text: '#237804' },
  { bg: '#fff7e6', border: '#ffd591', text: '#ad6800' },
  { bg: '#fff0f6', border: '#ffadd2', text: '#c41d7f' },
  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab' },
  { bg: '#e6fffb', border: '#87e8de', text: '#006d75' },
  { bg: '#fff1f0', border: '#ffa39e', text: '#a8071a' },
  { bg: '#fcffe6', border: '#d3f261', text: '#5b8c00' }
]

const DEFAULT_TIME_LANE_SETTINGS = [
  { key: 'morning', label: '上午', start: '09:00', end: '12:00' },
  { key: 'afternoon', label: '下午', start: '13:30', end: '17:30' },
  { key: 'evening', label: '晚间', start: '19:00', end: '22:00' }
]

const cloneTimeLanes = (list = []) => (list || []).map((item) => ({ ...item }))
const timeLaneSettings = ref(cloneTimeLanes(DEFAULT_TIME_LANE_SETTINGS))
const timeLaneDraft = ref(cloneTimeLanes(DEFAULT_TIME_LANE_SETTINGS))

const parseHmToMinute = (value) => {
  if (!value || typeof value !== 'string' || !value.includes(':')) return null
  const [hh, mm] = value.split(':').map((x) => Number(x))
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

const minuteToParts = (minute = 0) => {
  const hour = Math.floor(minute / 60)
  const mins = minute % 60
  return { hour, minute: mins }
}

const normalizeTimeLanes = (list = []) => {
  const baseMap = new Map(DEFAULT_TIME_LANE_SETTINGS.map((item) => [item.key, item]))
  return DEFAULT_TIME_LANE_SETTINGS.map((base) => {
    const target = (list || []).find((item) => item?.key === base.key) || {}
    const start = typeof target.start === 'string' ? target.start : base.start
    const end = typeof target.end === 'string' ? target.end : base.end
    return { ...baseMap.get(base.key), start, end }
  })
}

const validateTimeLanes = (list = []) => {
  const ranges = []
  for (const lane of list) {
    const startMinute = parseHmToMinute(lane.start)
    const endMinute = parseHmToMinute(lane.end)
    if (startMinute === null || endMinute === null) {
      return { ok: false, message: `${lane.label} 时间格式不正确` }
    }
    if (startMinute >= endMinute) {
      return { ok: false, message: `${lane.label} 的开始时间必须早于结束时间` }
    }
    ranges.push({ ...lane, startMinute, endMinute })
  }

  for (let i = 1; i < ranges.length; i += 1) {
    if (ranges[i].startMinute < ranges[i - 1].endMinute) {
      return { ok: false, message: `${ranges[i - 1].label} 与 ${ranges[i].label} 时间段重叠，请调整` }
    }
  }
  return { ok: true }
}

const loadTimeLaneSettings = async () => {
  try {
    const res = await getTimeLanes(buildCommonParams())
    const normalized = normalizeTimeLanes(Array.isArray(res) ? res : [])
    const check = validateTimeLanes(normalized)
    timeLaneSettings.value = check.ok ? normalized : cloneTimeLanes(DEFAULT_TIME_LANE_SETTINGS)
  } catch (err) {
    timeLaneSettings.value = cloneTimeLanes(DEFAULT_TIME_LANE_SETTINGS)
  }
}

const persistTimeLaneSettings = (list = []) => {
  return saveTimeLanes({ lanes: list, ...(buildCommonParams() || {}) })
}

const openTimeLaneDialog = () => {
  timeLaneDraft.value = cloneTimeLanes(timeLaneSettings.value)
  timeLaneDialogVisible.value = true
}

const saveTimeLaneSettings = async () => {
  const normalized = normalizeTimeLanes(timeLaneDraft.value)
  const check = validateTimeLanes(normalized)
  if (!check.ok) {
    ElMessage.warning(check.message)
    return
  }
  try {
    await persistTimeLaneSettings(normalized)
    timeLaneSettings.value = cloneTimeLanes(normalized)
    clearLanePreviewMaps()
    timeLaneDialogVisible.value = false
    ElMessage.success('时段设置已保存')
  } catch (err) {
    ElMessage.error('保存时段设置失败')
  }
}

const resetTimeLanesToDefault = () => {
  timeLaneDraft.value = cloneTimeLanes(DEFAULT_TIME_LANE_SETTINGS)
}

const timeLanes = computed(() => {
  return (timeLaneSettings.value || []).map((lane) => {
    const startMinute = parseHmToMinute(lane.start) || 0
    const endMinute = parseHmToMinute(lane.end) || 0
    const startParts = minuteToParts(startMinute)
    const endParts = minuteToParts(endMinute)
    return {
      ...lane,
      startHour: startParts.hour,
      startMinute: startParts.minute,
      endHour: endParts.hour,
      endMinute: endParts.minute
    }
  })
})

const timeLaneTipsText = computed(() => (timeLanes.value || []).map((lane) => `${lane.label} ${lane.start}-${lane.end}`).join('，'))

const buildCommonParams = () => {
  const params = {}
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    params.institutionId = currentInstitutionId.value
  }
  return params
}

const formatRange = (start, end) => {
  const fmt = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : '-'
  return `${fmt(start)} ~ ${fmt(end)}`
}

const weekRangeText = computed(() => {
  if (!scheduleSearch.startDate || !scheduleSearch.endDate) return '-'
  return `${String(scheduleSearch.startDate).slice(0, 10)} ~ ${String(scheduleSearch.endDate).slice(0, 10)}`
})

const weekGridDays = computed(() => {
  if (scheduleViewMode.value !== 'week' || !scheduleSearch.startDate) return []
  const start = new Date(scheduleSearch.startDate)
  if (Number.isNaN(start.getTime())) return []

  const names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(start)
    date.setDate(start.getDate() + idx)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${d}`
    return {
      key,
      label: names[idx],
      dateText: `${m}-${d}`,
      items: []
    }
  })

  for (const item of schedules.value || []) {
    const dt = new Date(item.startTime)
    if (Number.isNaN(dt.getTime())) continue
    const y = dt.getFullYear()
    const m = String(dt.getMonth() + 1).padStart(2, '0')
    const d = String(dt.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${d}`
    const day = days.find((x) => x.key === key)
    if (!day) continue
    day.items.push(item)
  }

  days.forEach((day) => {
    day.items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  })
  return days
})

function buildThemeMap(keys) {
  const map = {}
  keys.forEach((key, idx) => {
    map[key] = SLOT_THEMES[idx % SLOT_THEMES.length]
  })
  return map
}

const teacherThemeMap = computed(() => {
  const keys = [...new Set((schedules.value || []).map((item) => `t_${item.teacherId || 0}`).filter((x) => x !== 't_0'))]
  return buildThemeMap(keys)
})

const classroomThemeMap = computed(() => {
  const keys = [...new Set((schedules.value || []).map((item) => `c_${item.classroomId || 0}`).filter((x) => x !== 'c_0'))]
  return buildThemeMap(keys)
})

const weekLegendItems = computed(() => {
  if (scheduleColorMode.value === 'none') return []
  const map = scheduleColorMode.value === 'teacher' ? teacherThemeMap.value : classroomThemeMap.value
  const items = []
  const visited = new Set()
  for (const item of schedules.value || []) {
    const key = scheduleColorMode.value === 'teacher' ? `t_${item.teacherId || 0}` : `c_${item.classroomId || 0}`
    if (key.endsWith('_0') || visited.has(key) || !map[key]) continue
    visited.add(key)
    items.push({
      key,
      label: scheduleColorMode.value === 'teacher'
        ? (item.teacher?.nickname || item.teacher?.username || '未知讲师')
        : (`${item.classroom?.location || '-'} / ${item.classroom?.name || '未知教室'}`),
      theme: map[key]
    })
  }
  return items
})

const slotTimeText = (item) => {
  const s = String(item?.startTime || '').slice(11, 16)
  const e = String(item?.endTime || '').slice(11, 16)
  if (!s || !e) return '-'
  return `${s}-${e}`
}

const getLaneItems = (day, lane) => {
  return (day?.items || []).filter((item) => {
    const dt = new Date(item.startTime)
    if (Number.isNaN(dt.getTime())) return false
    const minute = dt.getHours() * 60 + dt.getMinutes()
    const laneStart = lane.startHour * 60 + lane.startMinute
    const laneEnd = lane.endHour * 60 + lane.endMinute
    return minute >= laneStart && minute < laneEnd
  })
}

const getLaneKey = (day, lane) => `${day?.key || ''}_${lane?.key || ''}`

const getLaneConflict = (day, lane) => {
  const value = laneConflictMap[getLaneKey(day, lane)]
  if (!value || value === true) return null
  return value
}

const formatLaneConflictText = (conflict) => {
  if (!conflict) return '该时段存在冲突'
  const course = conflict.courseName || '-'
  const classroom = conflict.classroomName || '-'
  const teacher = conflict.teacherName || '-'
  const time = conflict.timeRangeText || '-'
  return `冲突课程：${course}；教室：${classroom}；讲师：${teacher}；时间：${time}`
}

const clearLaneConflictMap = () => {
  Object.keys(laneConflictMap).forEach((k) => {
    delete laneConflictMap[k]
  })
}

const clearLaneRecommendMap = () => {
  Object.keys(laneRecommendMap).forEach((k) => {
    delete laneRecommendMap[k]
  })
  currentRecommendDayKey.value = ''
}

const clearLanePreviewMaps = () => {
  clearLaneConflictMap()
  clearLaneRecommendMap()
}

const clearLanePrecheckTimer = () => {
  if (lanePrecheckTimer.value) {
    clearTimeout(lanePrecheckTimer.value)
    lanePrecheckTimer.value = null
  }
}

const buildDropPayload = (drag, targetDay, targetLane) => {
  const srcDay = new Date(`${drag.dayKey}T00:00:00`)
  const dstDay = new Date(`${targetDay.key}T00:00:00`)
  if (Number.isNaN(srcDay.getTime()) || Number.isNaN(dstDay.getTime())) {
    return null
  }

  const start = new Date(String(drag.startTime).replace(' ', 'T'))
  const end = new Date(String(drag.endTime).replace(' ', 'T'))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null
  }

  const durationMs = end.getTime() - start.getTime()
  const nextStart = new Date(dstDay)
  nextStart.setHours(targetLane.startHour, targetLane.startMinute, 0, 0)
  const nextEnd = new Date(nextStart.getTime() + durationMs)

  return {
    nextStart,
    nextEnd,
    sameTime: nextStart.getTime() === start.getTime() && nextEnd.getTime() === end.getTime()
  }
}

const toApiDateTime = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const precheckLaneConflict = (day, lane) => {
  const drag = draggingSlot.value
  if (!drag || !day?.key || !lane) return

  clearLanePrecheckTimer()
  lanePrecheckTimer.value = setTimeout(async () => {
    if (currentRecommendDayKey.value !== day.key) {
      clearLanePreviewMaps()
      currentRecommendDayKey.value = day.key
    }

    const checks = await Promise.all((timeLanes.value || []).map(async (laneItem) => {
      const laneKey = getLaneKey(day, laneItem)
      const next = buildDropPayload(drag, day, laneItem)
      if (!next || next.sameTime) {
        return { laneKey, conflict: null, recommended: false }
      }

      const payload = {
        scheduleId: drag.id,
        classroomId: drag.classroomId,
        teacherId: drag.teacherId,
        startTime: toApiDateTime(next.nextStart),
        endTime: toApiDateTime(next.nextEnd)
      }
      if (userStore.isPlatformAdmin && currentInstitutionId.value) {
        payload.institutionId = currentInstitutionId.value
      }

      try {
        const res = await checkScheduleConflict(payload)
        if (res?.hasConflict) {
          return {
            laneKey,
            conflict: res.conflict || {
              courseName: '未知课程',
              classroomName: '-',
              teacherName: '-',
              timeRangeText: '-'
            },
            recommended: false
          }
        }
        return { laneKey, conflict: null, recommended: true }
      } catch (err) {
        return { laneKey, conflict: null, recommended: false }
      }
    }))

    checks.forEach((item) => {
      laneConflictMap[item.laneKey] = item.conflict
      laneRecommendMap[item.laneKey] = item.recommended
    })
  }, 180)
}

const startQuickUndoCountdown = () => {
  if (quickUndoTimer.value) {
    clearInterval(quickUndoTimer.value)
    quickUndoTimer.value = null
  }
  quickUndoSeconds.value = 8
  quickUndoTimer.value = setInterval(() => {
    quickUndoSeconds.value -= 1
    if (quickUndoSeconds.value <= 0) {
      quickUndoSeconds.value = 0
      clearInterval(quickUndoTimer.value)
      quickUndoTimer.value = null
    }
  }, 1000)
}

const dismissQuickUndo = () => {
  if (quickUndoTimer.value) {
    clearInterval(quickUndoTimer.value)
    quickUndoTimer.value = null
  }
  quickUndoSeconds.value = 0
}

const getSlotStyle = (item) => {
  if (scheduleColorMode.value === 'none') return {}
  const key = scheduleColorMode.value === 'teacher' ? `t_${item.teacherId || 0}` : `c_${item.classroomId || 0}`
  const map = scheduleColorMode.value === 'teacher' ? teacherThemeMap.value : classroomThemeMap.value
  const theme = map[key]
  if (!theme) return {}
  return {
    backgroundColor: theme.bg,
    borderColor: theme.border,
    color: theme.text
  }
}

const toDateString = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} 00:00:00`
}

const startOfWeek = (date) => {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

const loadInstitutions = async () => {
  if (!userStore.isPlatformAdmin) return
  const res = await getInstitutionList({ page: 1, size: 1000 })
  institutionOptions.value = res.list || []
  if (!currentInstitutionId.value && institutionOptions.value.length) {
    currentInstitutionId.value = institutionOptions.value[0].id
  }
}

const loadBaseData = async () => {
  const [roomList, teacherList, courseRes] = await Promise.all([
    getClassrooms(buildCommonParams()),
    getTeachers(buildCommonParams()),
    getCourseList({ page: 1, size: 1000, ...buildCommonParams() })
  ])
  classrooms.value = roomList || []
  teachers.value = teacherList || []
  courseOptions.value = [...new Set((courseRes?.list || []).map((item) => item.title).filter(Boolean))]
}

const loadSchedules = async () => {
  scheduleLoading.value = true
  try {
    schedules.value = await getSchedules({ ...buildCommonParams(), ...scheduleSearch })
  } finally {
    scheduleLoading.value = false
  }
}

const applyScheduleViewRange = async () => {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (scheduleViewMode.value === 'week') {
    const day = now.getDay() || 7
    start.setDate(now.getDate() - (day - 1))
    end.setDate(start.getDate() + 7)
  } else {
    start.setDate(1)
    end.setMonth(now.getMonth() + 1, 1)
  }

  scheduleSearch.startDate = toDateString(start)
  scheduleSearch.endDate = toDateString(end)
  await loadSchedules()
}

const moveWeek = async (step) => {
  if (scheduleViewMode.value !== 'week') return
  const start = new Date(scheduleSearch.startDate)
  const end = new Date(scheduleSearch.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    await applyScheduleViewRange()
    return
  }
  start.setDate(start.getDate() + step * 7)
  end.setDate(end.getDate() + step * 7)
  scheduleSearch.startDate = toDateString(start)
  scheduleSearch.endDate = toDateString(end)
  await loadSchedules()
}

const handleSlotDragStart = (item, day) => {
  clearLanePreviewMaps()
  draggingSlot.value = {
    id: item.id,
    dayKey: day.key,
    classroomId: item.classroomId,
    teacherId: item.teacherId,
    startTime: item.startTime,
    endTime: item.endTime
  }
}

const handleSlotDragEnd = () => {
  draggingSlot.value = null
  dragHoverLaneKey.value = ''
  clearLanePreviewMaps()
}

const handleLaneDragEnter = (day, lane) => {
  if (!draggingSlot.value) return
  dragHoverLaneKey.value = getLaneKey(day, lane)
  precheckLaneConflict(day, lane)
}

const handleLaneDragOver = (day, lane) => {
  if (!draggingSlot.value) return
  dragHoverLaneKey.value = getLaneKey(day, lane)
  precheckLaneConflict(day, lane)
}

const handleLaneDragLeave = (day, lane) => {
  const current = getLaneKey(day, lane)
  if (dragHoverLaneKey.value === current) {
    dragHoverLaneKey.value = ''
  }
}

const handleLaneDrop = async (targetDay, targetLane) => {
  const drag = draggingSlot.value
  if (!drag || !targetDay?.key || !targetLane) return
  dragHoverLaneKey.value = ''
  clearLanePrecheckTimer()

  const next = buildDropPayload(drag, targetDay, targetLane)
  if (!next) {
    draggingSlot.value = null
    dragHoverLaneKey.value = ''
    clearLanePreviewMaps()
    return
  }

  if (next.sameTime) {
    draggingSlot.value = null
    dragHoverLaneKey.value = ''
    clearLanePreviewMaps()
    return
  }

  const payload = {
    startTime: toApiDateTime(next.nextStart),
    endTime: toApiDateTime(next.nextEnd)
  }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }

  try {
    const precheckPayload = {
      scheduleId: drag.id,
      classroomId: drag.classroomId,
      teacherId: drag.teacherId,
      startTime: payload.startTime,
      endTime: payload.endTime
    }
    if (userStore.isPlatformAdmin && currentInstitutionId.value) {
      precheckPayload.institutionId = currentInstitutionId.value
    }

    const precheck = await checkScheduleConflict(precheckPayload)
    if (precheck?.hasConflict && precheck?.conflict) {
      const conflict = precheck.conflict
      ElMessageBox.alert(
        `冲突排课：${conflict.courseName || '-'}\n教室：${conflict.classroomName || '-'}\n讲师：${conflict.teacherName || '-'}\n时间：${conflict.timeRangeText || '-'}`,
        '拖拽冲突预警',
        { type: 'warning' }
      )
      return
    }

    await updateSchedule(drag.id, payload)
    lastScheduleMove.value = {
      id: drag.id,
      oldStartTime: drag.startTime,
      oldEndTime: drag.endTime,
      newStartTime: payload.startTime,
      newEndTime: payload.endTime
    }
    ElMessage.success('已调整到新时段')
    startQuickUndoCountdown()
    await loadSchedules()
  } catch (err) {
    const conflict = err?.data
    if (err?.code === 409 && conflict) {
      ElMessageBox.alert(
        `冲突排课：${conflict.courseName || '-'}\n教室：${conflict.classroomName || '-'}\n讲师：${conflict.teacherName || '-'}\n时间：${conflict.timeRangeText || '-'}`,
        '拖拽改期失败',
        { type: 'warning' }
      )
    } else {
      ElMessage.error('拖拽改期失败')
    }
  } finally {
    draggingSlot.value = null
    dragHoverLaneKey.value = ''
    clearLanePreviewMaps()
  }
}

const undoLastMove = async () => {
  const move = lastScheduleMove.value
  if (!move) return
  const payload = {
    startTime: move.oldStartTime,
    endTime: move.oldEndTime
  }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }
  try {
    await updateSchedule(move.id, payload)
    ElMessage.success('已撤销上次拖拽')
    lastScheduleMove.value = null
    dismissQuickUndo()
    await loadSchedules()
  } catch (err) {
    ElMessage.error('撤销失败')
  }
}

const openScheduleDialog = (row = null) => {
  Object.assign(scheduleForm, row ? {
    id: row.id,
    classroomId: row.classroomId,
    teacherId: row.teacherId,
    courseName: row.courseName,
    startTime: row.startTime,
    endTime: row.endTime,
    remarks: row.remarks || '',
    status: row.status
  } : { id: null, classroomId: null, teacherId: null, courseName: '', startTime: '', endTime: '', remarks: '', status: 1 })
  scheduleDialogVisible.value = true
}

const saveSchedule = async () => {
  const payload = { ...scheduleForm }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }

  try {
    if (payload.id) await updateSchedule(payload.id, payload)
    else await createSchedule(payload)
  } catch (err) {
    const conflict = err?.data
    if (err?.code === 409 && conflict) {
      ElMessageBox.alert(
        `冲突排课：${conflict.courseName || '-'}\n教室：${conflict.classroomName || '-'}\n讲师：${conflict.teacherName || '-'}\n时间：${conflict.timeRangeText || '-'}`,
        '排课冲突',
        { type: 'warning' }
      )
      return
    }
    throw err
  }

  ElMessage.success('排课已保存')
  scheduleDialogVisible.value = false
  await loadSchedules()
}

const handleDeleteSchedule = async (row) => {
  await ElMessageBox.confirm(`确认删除排课【${row.courseName}】吗？`, '提示', { type: 'warning' })
  await deleteSchedule(row.id, buildCommonParams())
  ElMessage.success('排课已删除')
  await loadSchedules()
}

const copyWeekWithOffset = async (offsetDays) => {
  const base = startOfWeek(new Date())
  const source = new Date(base)
  source.setDate(source.getDate() + (offsetDays < 0 ? -7 : 0))
  const target = new Date(source)
  target.setDate(target.getDate() + 7)

  const payload = {
    sourceWeekStart: toDateString(offsetDays < 0 ? source : base),
    targetWeekStart: toDateString(offsetDays < 0 ? base : target)
  }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }

  const res = await copyWeekSchedules(payload)
  copyResult.copiedCount = Number(res.copiedCount || 0)
  copyResult.skippedCount = Number(res.skippedCount || 0)
  copyResult.skipped = Array.isArray(res.skipped) ? res.skipped : []
  copyResultVisible.value = true
  ElMessage.success(`复制完成：成功${copyResult.copiedCount}条，跳过${copyResult.skippedCount}条`)
  await loadSchedules()
}

const handleCopyPrevToCurrent = async () => {
  await ElMessageBox.confirm('确认复制上周排课到本周吗？如有冲突会自动跳过。', '提示', { type: 'warning' })
  await copyWeekWithOffset(-7)
}

const handleCopyCurrentToNext = async () => {
  await ElMessageBox.confirm('确认复制本周排课到下周吗？如有冲突会自动跳过。', '提示', { type: 'warning' })
  await copyWeekWithOffset(7)
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const handleExportSchedules = async () => {
  const params = { ...buildCommonParams(), ...scheduleSearch }
  const { blob, filename } = await exportSchedules(params)
  downloadBlob(blob, filename)
  ElMessage.success('导出成功')
}

const reloadAll = async () => {
  await loadTimeLaneSettings()
  await loadBaseData()
  await applyScheduleViewRange()
}

onMounted(async () => {
  await loadInstitutions()
  await loadTimeLaneSettings()
  await loadBaseData()
  await applyScheduleViewRange()
})

onBeforeUnmount(() => {
  clearLanePrecheckTimer()
  clearLaneRecommendMap()
  dismissQuickUndo()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.schedule-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-form {
  margin-bottom: 12px;
}

.week-board {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  margin-bottom: 12px;
}

.week-board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f2f5;
}

.week-board-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.week-board-header-right {
  display: flex;
  align-items: center;
}

.week-board-title {
  font-weight: 600;
}

.week-board-range {
  color: #909399;
  font-size: 12px;
}

.week-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px dashed #ebeef5;
}

.week-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 2px 8px;
}

.week-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid #dcdfe6;
}

.week-legend-text {
  font-size: 12px;
  color: #606266;
}

.week-drag-tips {
  padding: 6px 12px;
  font-size: 12px;
  color: #909399;
  border-bottom: 1px dashed #ebeef5;
}

.quick-undo-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #fff7e6;
  border-bottom: 1px dashed #ffd591;
}

.quick-undo-text {
  font-size: 12px;
  color: #ad6800;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
}

.week-day {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  min-height: 220px;
}

.week-day-head {
  padding: 8px;
  background: #f7f9fc;
  border-bottom: 1px solid #f0f2f5;
}

.week-day-name {
  font-weight: 600;
  font-size: 13px;
}

.week-day-date {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.week-day-body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.week-lane {
  border: 1px dashed #e4e7ed;
  border-radius: 6px;
  padding: 6px;
}

.week-lane.is-drop-target {
  border-color: #409eff;
  background: #f0f9ff;
}

.week-lane.is-recommended-target {
  border-color: #52c41a;
  background: #f6ffed;
}

.week-lane.is-conflict-target {
  border-color: #ff4d4f;
  background: #fff1f0;
}

.week-lane-title {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 6px;
}

.week-lane-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}

.week-lane-conflict-tag {
  font-size: 11px;
  line-height: 1;
  color: #cf1322;
  border: 1px solid #ffccc7;
  border-radius: 10px;
  background: #fff1f0;
  padding: 3px 6px;
  cursor: help;
}

.week-slot {
  border: 1px solid #d9ecff;
  background: #ecf5ff;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
}

.week-slot:hover {
  border-color: #79bbff;
}

.week-slot:active {
  opacity: 0.8;
}

.week-slot-time {
  font-size: 12px;
  color: #409eff;
  font-weight: 600;
}

.week-slot-course {
  font-size: 13px;
  margin-top: 2px;
  font-weight: 600;
}

.week-slot-meta {
  margin-top: 2px;
  font-size: 12px;
  color: #606266;
}

.week-slot-empty {
  color: #c0c4cc;
  font-size: 12px;
  text-align: center;
  padding: 14px 0;
}

@media (max-width: 1400px) {
  .week-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .week-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
