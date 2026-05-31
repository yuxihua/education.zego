<template>
  <div class="resource-page">
    <el-card v-if="userStore.isPlatformAdmin" style="margin-bottom: 16px">
      <el-form inline>
        <el-form-item label="机构">
          <el-select v-model="currentInstitutionId" filterable placeholder="请选择机构" style="width: 280px" @change="reloadAll">
            <el-option v-for="item in institutionOptions" :key="item.id" :label="item.institutionName || item.nickname || item.username" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>固定教室管理</span>
              <el-button type="primary" size="small" @click="openClassroomDialog()">新增</el-button>
            </div>
          </template>

          <el-input v-model="classroomKeyword" placeholder="搜索教室名称/地址" clearable style="margin-bottom: 12px" @keyup.enter="loadClassrooms" />
          <el-table :data="classrooms" size="small" v-loading="classroomLoading" border>
            <el-table-column prop="name" label="教室" min-width="120" />
            <el-table-column prop="capacity" label="容量" width="70" />
            <el-table-column prop="status" label="状态" width="70">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button link type="primary" @click="openClassroomDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="handleDeleteClassroom(row)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>讲师管理</span>
              <el-button type="primary" size="small" @click="openTeacherDialog()">新增</el-button>
            </div>
          </template>

          <el-input v-model="teacherKeyword" placeholder="搜索讲师账号/姓名/手机号" clearable style="margin-bottom: 12px" @keyup.enter="loadTeachers" />
          <el-table :data="teachers" size="small" v-loading="teacherLoading" border>
            <el-table-column prop="nickname" label="姓名" min-width="110" />
            <el-table-column prop="username" label="账号" min-width="110" />
            <el-table-column prop="status" label="状态" width="70">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button link type="primary" @click="openTeacherDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="handleDeleteTeacher(row)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>排课安排</span>
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
                <el-button size="small" @click="handleCopyPrevToCurrent">上周复制到本周</el-button>
                <el-button size="small" @click="handleCopyCurrentToNext">本周复制到下周</el-button>
                <el-button size="small" type="success" @click="handleExportSchedules">导出CSV</el-button>
                <el-button type="primary" size="small" @click="openScheduleDialog()">新增</el-button>
              </div>
            </div>
          </template>

          <el-form :inline="true" :model="scheduleSearch" class="search-form">
            <el-form-item label="教室">
              <el-select v-model="scheduleSearch.classroomId" clearable placeholder="全部" style="width: 130px">
                <el-option v-for="room in classrooms" :key="room.id" :label="room.name" :value="room.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="讲师">
              <el-select v-model="scheduleSearch.teacherId" clearable placeholder="全部" style="width: 130px">
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
            <div class="week-drag-tips">拖拽课程到指定日期栏的“上午/下午/晚间”分区，可同时调整日期和时间段。</div>
            <div class="week-grid">
              <div class="week-day" v-for="day in weekGridDays" :key="day.key">
                <div class="week-day-head">
                  <div class="week-day-name">{{ day.label }}</div>
                  <div class="week-day-date">{{ day.dateText }}</div>
                </div>
                <div class="week-day-body">
                  <div class="week-lane" v-for="lane in timeLanes" :key="`${day.key}_${lane.key}`" @dragover.prevent @drop="handleLaneDrop(day, lane)">
                    <div class="week-lane-title">{{ lane.label }}</div>
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
                      <div class="week-slot-meta">{{ item.classroom?.name || '-' }} · {{ item.teacher?.nickname || item.teacher?.username || '-' }}</div>
                    </div>
                    <div class="week-slot-empty" v-if="!getLaneItems(day, lane).length">暂无排课</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <el-table :data="schedules" size="small" v-loading="scheduleLoading" border>
            <el-table-column prop="courseName" label="课程" min-width="120" />
            <el-table-column label="时间" min-width="180">
              <template #default="{ row }">{{ formatRange(row.startTime, row.endTime) }}</template>
            </el-table-column>
            <el-table-column label="教室" min-width="100">
              <template #default="{ row }">{{ row.classroom?.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="讲师" min-width="100">
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
      </el-col>
    </el-row>

    <el-dialog v-model="classroomDialogVisible" :title="classroomForm.id ? '编辑教室' : '新增教室'" width="520px">
      <el-form :model="classroomForm" label-width="100px">
        <el-form-item label="教室名称"><el-input v-model="classroomForm.name" /></el-form-item>
        <el-form-item label="所在位置"><el-input v-model="classroomForm.location" /></el-form-item>
        <el-form-item label="容量"><el-input-number v-model="classroomForm.capacity" :min="0" controls-position="right" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="classroomForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="classroomForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classroomDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveClassroom">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="teacherDialogVisible" :title="teacherForm.id ? '编辑讲师' : '新增讲师'" width="560px">
      <el-form :model="teacherForm" label-width="100px">
        <el-form-item label="账号"><el-input v-model="teacherForm.username" /></el-form-item>
        <el-form-item v-if="!teacherForm.id" label="密码"><el-input v-model="teacherForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="teacherForm.nickname" /></el-form-item>
        <el-form-item label="手机号"><el-input v-model="teacherForm.phone" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="teacherForm.email" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="teacherForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teacherDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTeacher">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="scheduleDialogVisible" :title="scheduleForm.id ? '编辑排课' : '新增排课'" width="620px">
      <el-form :model="scheduleForm" label-width="100px">
        <el-form-item label="教室"><el-select v-model="scheduleForm.classroomId" filterable style="width: 100%"><el-option v-for="room in classrooms" :key="room.id" :label="room.name" :value="room.id" /></el-select></el-form-item>
        <el-form-item label="讲师"><el-select v-model="scheduleForm.teacherId" filterable style="width: 100%"><el-option v-for="teacher in teachers" :key="teacher.id" :label="teacher.nickname || teacher.username" :value="teacher.id" /></el-select></el-form-item>
        <el-form-item label="课程名称"><el-input v-model="scheduleForm.courseName" /></el-form-item>
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
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getInstitutionList } from '@/api/platform'
import {
  createClassroom,
  copyWeekSchedules,
  createSchedule,
  createTeacher,
  deleteClassroom,
  deleteSchedule,
  deleteTeacher,
  exportSchedules,
  getClassrooms,
  getSchedules,
  getTeachers,
  updateClassroom,
  updateSchedule,
  updateTeacher
} from '@/api/resource'

const userStore = useUserStore()
const classrooms = ref([])
const teachers = ref([])
const schedules = ref([])
const institutionOptions = ref([])
const currentInstitutionId = ref(userStore.currentInstitutionId || null)
const classroomLoading = ref(false)
const teacherLoading = ref(false)
const scheduleLoading = ref(false)
const classroomKeyword = ref('')
const teacherKeyword = ref('')
const scheduleSearch = reactive({ classroomId: null, teacherId: null, startDate: '', endDate: '' })
const scheduleViewMode = ref('week')
const scheduleColorMode = ref('teacher')

const classroomDialogVisible = ref(false)
const classroomForm = reactive({ id: null, name: '', location: '', capacity: 0, description: '', status: 1 })

const teacherDialogVisible = ref(false)
const teacherForm = reactive({ id: null, username: '', password: '', nickname: '', phone: '', email: '', status: 1 })

const scheduleDialogVisible = ref(false)
const scheduleForm = reactive({ id: null, classroomId: null, teacherId: null, courseName: '', startTime: '', endTime: '', remarks: '', status: 1 })
const copyResultVisible = ref(false)
const copyResult = reactive({ copiedCount: 0, skippedCount: 0, skipped: [] })
const draggingSlot = ref(null)
const lastScheduleMove = ref(null)

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

const TIME_LANES = [
  { key: 'morning', label: '上午', startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
  { key: 'afternoon', label: '下午', startHour: 13, startMinute: 30, endHour: 17, endMinute: 30 },
  { key: 'evening', label: '晚间', startHour: 19, startMinute: 0, endHour: 22, endMinute: 0 }
]

const timeLanes = computed(() => TIME_LANES)

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
        : (item.classroom?.name || '未知教室'),
      theme: map[key]
    })
  }
  return items
})

const formatRange = (start, end) => {
  const fmt = (value) => value ? String(value).replace('T', ' ').slice(0, 16) : '-'
  return `${fmt(start)} ~ ${fmt(end)}`
}

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

const toApiDateTime = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
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
  draggingSlot.value = {
    id: item.id,
    dayKey: day.key,
    startTime: item.startTime,
    endTime: item.endTime
  }
}

const handleSlotDragEnd = () => {
  draggingSlot.value = null
}

const handleLaneDrop = async (targetDay, targetLane) => {
  const drag = draggingSlot.value
  if (!drag || !targetDay?.key || !targetLane) return

  const srcDay = new Date(`${drag.dayKey}T00:00:00`)
  const dstDay = new Date(`${targetDay.key}T00:00:00`)
  if (Number.isNaN(srcDay.getTime()) || Number.isNaN(dstDay.getTime())) {
    draggingSlot.value = null
    return
  }

  const start = new Date(String(drag.startTime).replace(' ', 'T'))
  const end = new Date(String(drag.endTime).replace(' ', 'T'))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    draggingSlot.value = null
    return
  }

  const durationMs = end.getTime() - start.getTime()
  const nextStart = new Date(dstDay)
  nextStart.setHours(targetLane.startHour, targetLane.startMinute, 0, 0)
  const nextEnd = new Date(nextStart.getTime() + durationMs)

  if (nextStart.getTime() === start.getTime() && nextEnd.getTime() === end.getTime()) {
    draggingSlot.value = null
    return
  }

  const payload = {
    startTime: toApiDateTime(nextStart),
    endTime: toApiDateTime(nextEnd)
  }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }

  try {
    await updateSchedule(drag.id, payload)
    lastScheduleMove.value = {
      id: drag.id,
      oldStartTime: drag.startTime,
      oldEndTime: drag.endTime,
      newStartTime: payload.startTime,
      newEndTime: payload.endTime
    }
    ElMessage.success('已调整到新日期')
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
    await loadSchedules()
  } catch (err) {
    ElMessage.error('撤销失败')
  }
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

const buildCommonParams = () => {
  const params = {}
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    params.institutionId = currentInstitutionId.value
  }
  return params
}

const loadClassrooms = async () => {
  classroomLoading.value = true
  try {
    classrooms.value = await getClassrooms({ ...buildCommonParams(), keyword: classroomKeyword.value })
  } finally {
    classroomLoading.value = false
  }
}

const loadTeachers = async () => {
  teacherLoading.value = true
  try {
    teachers.value = await getTeachers({ ...buildCommonParams(), keyword: teacherKeyword.value })
  } finally {
    teacherLoading.value = false
  }
}

const loadSchedules = async () => {
  scheduleLoading.value = true
  try {
    schedules.value = await getSchedules({ ...buildCommonParams(), ...scheduleSearch })
  } finally {
    scheduleLoading.value = false
  }
}

const loadInstitutions = async () => {
  if (!userStore.isPlatformAdmin) return
  const res = await getInstitutionList({ page: 1, size: 1000 })
  institutionOptions.value = res.list || []
  if (!currentInstitutionId.value && institutionOptions.value.length) {
    currentInstitutionId.value = institutionOptions.value[0].id
  }
}

const reloadAll = async () => {
  await loadClassrooms()
  await loadTeachers()
  await loadSchedules()
}

const openClassroomDialog = (row = null) => {
  Object.assign(classroomForm, row ? { ...row } : { id: null, name: '', location: '', capacity: 0, description: '', status: 1 })
  classroomDialogVisible.value = true
}

const saveClassroom = async () => {
  const payload = { ...classroomForm }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }
  if (payload.id) await updateClassroom(payload.id, payload)
  else await createClassroom(payload)
  ElMessage.success('教室已保存')
  classroomDialogVisible.value = false
  await loadClassrooms()
  await loadSchedules()
}

const handleDeleteClassroom = async (row) => {
  await ElMessageBox.confirm(`确认删除教室【${row.name}】吗？`, '提示', { type: 'warning' })
  await deleteClassroom(row.id, buildCommonParams())
  ElMessage.success('教室已删除')
  await loadClassrooms()
  await loadSchedules()
}

const openTeacherDialog = (row = null) => {
  Object.assign(teacherForm, row ? { ...row, password: '' } : { id: null, username: '', password: '', nickname: '', phone: '', email: '', status: 1 })
  teacherDialogVisible.value = true
}

const saveTeacher = async () => {
  const payload = { ...teacherForm }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }
  if (!payload.id && !payload.password) {
    ElMessage.warning('新增讲师必须填写密码')
    return
  }
  if (payload.id) await updateTeacher(payload.id, payload)
  else await createTeacher(payload)
  ElMessage.success('讲师已保存')
  teacherDialogVisible.value = false
  await loadTeachers()
  await loadSchedules()
}

const handleDeleteTeacher = async (row) => {
  await ElMessageBox.confirm(`确认删除讲师【${row.nickname || row.username}】吗？`, '提示', { type: 'warning' })
  await deleteTeacher(row.id, buildCommonParams())
  ElMessage.success('讲师已删除')
  await loadTeachers()
  await loadSchedules()
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

const handleExportSchedules = async () => {
  const params = { ...buildCommonParams(), ...scheduleSearch }
  const { blob, filename } = await exportSchedules(params)
  downloadBlob(blob, filename)
  ElMessage.success('导出成功')
}

const handleDeleteSchedule = async (row) => {
  await ElMessageBox.confirm(`确认删除排课【${row.courseName}】吗？`, '提示', { type: 'warning' })
  await deleteSchedule(row.id, buildCommonParams())
  ElMessage.success('排课已删除')
  await loadSchedules()
}

onMounted(async () => {
  await loadInstitutions()
  await loadClassrooms()
  await loadTeachers()
  await applyScheduleViewRange()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 12px;
}

.schedule-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.week-lane-title {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  margin-bottom: 6px;
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