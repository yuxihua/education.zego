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
            <el-table-column label="操作" width="130">
              <template #default="{ row }">
                <el-button type="primary" link @click="buyByAlipay(row)">支付宝下单</el-button>
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
          </el-table>
        </el-card>
      </el-col>
    </el-row>
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
  studentCourseList,
  studentCreateAlipayOrder
} from '@/api/studentPortal'

const router = useRouter()
const route = useRoute()
const studentInstitutionKey = 'student_institution_id'

const profile = ref({})
const courseList = ref([])
const myCourses = ref([])

const courseLoading = ref(false)
const myCourseLoading = ref(false)

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

const refreshAll = async () => {
  await Promise.all([loadProfile(), loadCourseList(), loadMyCourses()])
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