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
          <div class="header-actions">
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

      <el-form :inline="true" class="search-form">
        <el-form-item label="教室">
          <el-select v-model="scheduleSearch.classroomId" clearable placeholder="全部" style="width: 140px">
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getInstitutionList } from '@/api/platform'
import {
  copyWeekSchedules,
  createSchedule,
  deleteSchedule,
  exportSchedules,
  getClassrooms,
  getSchedules,
  getTeachers,
  updateSchedule
} from '@/api/resource'

const userStore = useUserStore()
const institutionOptions = ref([])
const currentInstitutionId = ref(userStore.currentInstitutionId || null)

const classrooms = ref([])
const teachers = ref([])
const schedules = ref([])
const scheduleLoading = ref(false)
const scheduleViewMode = ref('week')
const scheduleSearch = reactive({ classroomId: null, teacherId: null, startDate: '', endDate: '' })

const scheduleDialogVisible = ref(false)
const scheduleForm = reactive({ id: null, classroomId: null, teacherId: null, courseName: '', startTime: '', endTime: '', remarks: '', status: 1 })
const copyResultVisible = ref(false)
const copyResult = reactive({ copiedCount: 0, skippedCount: 0, skipped: [] })

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
  const [roomList, teacherList] = await Promise.all([
    getClassrooms(buildCommonParams()),
    getTeachers(buildCommonParams())
  ])
  classrooms.value = roomList || []
  teachers.value = teacherList || []
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
  await loadBaseData()
  await applyScheduleViewRange()
}

onMounted(async () => {
  await loadInstitutions()
  await loadBaseData()
  await applyScheduleViewRange()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-form {
  margin-bottom: 12px;
}
</style>
