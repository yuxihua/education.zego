<template>
  <div class="student-center">
    <div class="header">
      <div>
        <h2>学员中心</h2>
        <div class="meta">{{ profile.nickname || '学员' }} · {{ profile.phone || '-' }}</div>
      </div>
      <div>
        <el-button @click="refreshAll">刷新</el-button>
        <el-button type="danger" plain @click="handleLogout">退出</el-button>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col :span="14">
        <el-card>
          <template #header><span>可选课程（已上架）</span></template>
          <el-table :data="courseList" v-loading="courseLoading" border>
            <el-table-column prop="title" label="课程" min-width="220" />
            <el-table-column prop="teacherName" label="讲师" width="120" />
            <el-table-column prop="price" label="价格" width="100">
              <template #default="{ row }">¥{{ row.price }}</template>
            </el-table-column>
            <el-table-column label="操作" width="170">
              <template #default="{ row }">
                <el-button type="primary" link @click="buyByAlipay(row)">支付宝下单</el-button>
                <el-button type="success" link @click="previewRecording(row)">试听录播</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card>
          <template #header><span>我的已购课程</span></template>
          <el-table :data="myCourses" v-loading="myCourseLoading" border>
            <el-table-column label="课程" min-width="150">
              <template #default="{ row }">{{ row.course?.title || '-' }}</template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="90">
              <template #default="{ row }">¥{{ row.amount }}</template>
            </el-table-column>
            <el-table-column prop="payTime" label="支付时间" width="160" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="primary" link @click="enterLive(row)">进入直播</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top: 16px">
      <template #header><span>录播学习</span></template>
      <el-table :data="recordings" v-loading="recordingLoading" border>
        <el-table-column prop="courseTitle" label="课程" min-width="180" />
        <el-table-column prop="roomTitle" label="录播场次" min-width="180" />
        <el-table-column label="来源" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.sourceType === 'manual-upload'" type="success">手工上传</el-tag>
            <el-tag v-else type="info">直播回放</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="teacherName" label="讲师" width="120" />
        <el-table-column label="时长" width="110">
          <template #default="{ row }">{{ formatDuration(row.replayDuration) }}</template>
        </el-table-column>
        <el-table-column label="进度" width="120">
          <template #default="{ row }">{{ Number(row.progressPercent || 0) }}%</template>
        </el-table-column>
        <el-table-column prop="endTime" label="结束时间" width="170" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link @click="startLearning(row)">{{ Number(row.progressPercent || 0) > 0 ? '继续学习' : '开始学习' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!recordingLoading && !recordings.length" description="暂无可学习录播" />
    </el-card>

    <el-dialog v-model="previewDialogVisible" :title="`录播章节试听 - ${previewCourseTitle}`" width="820px">
      <el-skeleton v-if="previewLoading" :rows="6" animated />
      <el-empty v-else-if="!previewRecordings.length" description="该课程暂无可试听录播" />
      <el-table v-else :data="previewRecordings" border max-height="420">
        <el-table-column prop="title" label="章节" min-width="220" />
        <el-table-column label="时长" width="120">
          <template #default="{ row }">{{ formatDuration(row.replayDuration) }}</template>
        </el-table-column>
        <el-table-column label="试看" width="120">
          <template #default="{ row }">{{ row.trialDuration ? formatDuration(row.trialDuration) : '不限' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="startPreviewLearning(row)">开始</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
        <el-button v-if="!previewIsPurchased && previewCourseId" type="success" @click="buyPreviewCourse">购买本课程</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  studentTokenKey,
  studentProfile,
  studentLogout,
  studentMyCourses,
  studentMyRecordings,
  studentCourseRecordings,
  studentCourseList,
  studentCreateAlipayOrder
} from '@/api/studentPortal'

const router = useRouter()
const route = useRoute()
const studentInstitutionKey = 'student_institution_id'

const profile = ref({})
const courseList = ref([])
const myCourses = ref([])
const recordings = ref([])
const previewDialogVisible = ref(false)
const previewLoading = ref(false)
const previewCourseId = ref(0)
const previewCourseTitle = ref('')
const previewIsPurchased = ref(false)
const previewRecordings = ref([])

const courseLoading = ref(false)
const myCourseLoading = ref(false)
const recordingLoading = ref(false)

const loadProfile = async () => {
  profile.value = await studentProfile()

  if (profile.value?.institutionId !== undefined && profile.value?.institutionId !== null) {
    localStorage.setItem(studentInstitutionKey, String(profile.value.institutionId))
  }
}

const loadCourseList = async () => {
  courseLoading.value = true
  try {
    const queryInstitutionId = Number(route.query.institutionId)
    const cachedInstitutionId = Number(localStorage.getItem(studentInstitutionKey))
    const profileInstitutionId = Number(profile.value?.institutionId)
    const institutionId = Number.isFinite(queryInstitutionId)
      ? queryInstitutionId
      : (Number.isFinite(profileInstitutionId) ? profileInstitutionId : cachedInstitutionId)

    const params = { page: 1, size: 50, status: 'published' }
    if (Number.isFinite(institutionId)) {
      params.institutionId = institutionId
      localStorage.setItem(studentInstitutionKey, String(institutionId))
    }

    const res = await studentCourseList(params)
    courseList.value = res.list || []
  } finally {
    courseLoading.value = false
  }
}

const loadMyCourses = async () => {
  myCourseLoading.value = true
  try {
    const res = await studentMyCourses({ page: 1, size: 50 })
    myCourses.value = res.list || []
  } finally {
    myCourseLoading.value = false
  }
}

const loadMyRecordings = async () => {
  recordingLoading.value = true
  try {
    const res = await studentMyRecordings({ page: 1, size: 100 })
    recordings.value = res.list || []
  } finally {
    recordingLoading.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([loadProfile(), loadCourseList(), loadMyCourses(), loadMyRecordings()])
}

const enterLive = (courseRow) => {
  const courseId = courseRow?.course?.id
  if (!courseId) {
    ElMessage.warning('未找到课程信息，暂时无法进入直播')
    return
  }
  router.push(`/student-live/${courseId}`)
}

const formatDuration = (seconds) => {
  const total = Number(seconds || 0)
  if (!total) return '-'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

const startLearning = (row) => {
  const replayUrl = String(row?.replayUrl || '').trim()
  if (!replayUrl) {
    ElMessage.warning('该录播地址不可用，请联系管理员')
    return
  }
  router.push({
    path: '/student-recording-player',
    query: {
      courseId: row.courseId,
      videoId: row.videoId || `course-${row.courseId}-${row.roomId || 'manual'}`,
      title: row.roomTitle || row.courseTitle || '录播学习',
      replayUrl,
      videoCover: row.videoCover || row.courseCover || '',
      trialDuration: Number(row.trialDuration || 0),
      isPurchased: 1
    }
  })
}

const previewRecording = async (courseRow) => {
  const courseId = Number(courseRow?.id || 0)
  if (!courseId) {
    ElMessage.warning('课程信息无效，无法试听')
    return
  }

  previewCourseId.value = courseId
  previewCourseTitle.value = String(courseRow?.title || '')
  previewDialogVisible.value = true
  previewLoading.value = true
  try {
    const res = await studentCourseRecordings(courseId)
    previewIsPurchased.value = Boolean(res?.isPurchased)
    previewRecordings.value = Array.isArray(res?.list) ? res.list : []
    if (!previewRecordings.value.length) {
      ElMessage.info('该课程暂无可试听录播')
    }
  } finally {
    previewLoading.value = false
  }
}

const startPreviewLearning = (row) => {
  const replayUrl = String(row?.replayUrl || '').trim()
  if (!replayUrl) {
    ElMessage.warning('该录播地址不可用，请联系管理员')
    return
  }

  router.push({
    path: '/student-recording-player',
    query: {
      courseId: row.courseId,
      videoId: row.videoId,
      title: row.title || row.courseTitle || '录播学习',
      replayUrl,
      videoCover: row.videoCover || row.courseCover || '',
      trialDuration: Number(row.trialDuration || 0),
      isPurchased: row.isPurchased ? 1 : 0
    }
  })
}

const buyPreviewCourse = async () => {
  if (!previewCourseId.value) return
  await buyByAlipay({ id: previewCourseId.value })
}

const buyByAlipay = async (course) => {
  const res = await studentCreateAlipayOrder(course.id)
  if (!res.formHtml) {
    ElMessage.error('下单失败：未获取支付表单')
    return
  }

  // 支付宝返回的是自动提交表单，插入后会跳转收银台。
  const container = document.createElement('div')
  container.style.display = 'none'
  container.innerHTML = res.formHtml
  document.body.appendChild(container)
  const form = container.querySelector('form')
  if (form) {
    form.submit()
  } else {
    ElMessage.error('支付表单解析失败')
  }
}

const handleLogout = async () => {
  try {
    await studentLogout()
  } catch (e) {}
  localStorage.removeItem(studentTokenKey)
  router.push('/student-login')
}

onMounted(refreshAll)
</script>

<style scoped>
.student-center {
  padding: 20px;
}

.header {
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meta {
  color: #666;
}
</style>