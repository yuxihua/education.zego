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
              <span class="week-board-title">周课表</span>
              <span class="week-board-range">{{ weekRangeText }}</span>
            </div>
            <div class="week-grid">
              <div class="week-day" v-for="day in weekGridDays" :key="day.key">
                <div class="week-day-head">
                  <div class="week-day-name">{{ day.label }}</div>
                  <div class="week-day-date">{{ day.dateText }}</div>
                </div>
                <div class="week-day-body">
                  <div
                    class="week-slot"
                    v-for="item in day.items"
                    :key="item.id"
                    @click="openScheduleDialog(item)"
                  >
                    <div class="week-slot-time">{{ slotTimeText(item) }}</div>
                    <div class="week-slot-course">{{ item.courseName }}</div>
                    <div class="week-slot-meta">{{ item.classroom?.name || '-' }} · {{ item.teacher?.nickname || item.teacher?.username || '-' }}</div>
                  </div>
                  <div class="week-slot-empty" v-if="!day.items.length">暂无排课</div>
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

const classroomDialogVisible = ref(false)
const classroomForm = reactive({ id: null, name: '', location: '', capacity: 0, description: '', status: 1 })

const teacherDialogVisible = ref(false)
const teacherForm = reactive({ id: null, username: '', password: '', nickname: '', phone: '', email: '', status: 1 })

const scheduleDialogVisible = ref(false)
const scheduleForm = reactive({ id: null, classroomId: null, teacherId: null, courseName: '', startTime: '', endTime: '', remarks: '', status: 1 })
const copyResultVisible = ref(false)
const copyResult = reactive({ copiedCount: 0, skippedCount: 0, skipped: [] })

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

.week-board-title {
  font-weight: 600;
}

.week-board-range {
  color: #909399;
  font-size: 12px;
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