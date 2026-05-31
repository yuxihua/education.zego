<template>
  <div class="homework-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>作业管理</span>
          <el-button type="primary" @click="handlePublish">+ 布置作业</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="机构" v-if="userStore.isPlatformAdmin">
          <el-select v-model="searchForm.institutionId" placeholder="全部机构" clearable filterable style="width: 240px">
            <el-option
              v-for="item in institutionOptions"
              :key="item.id"
              :label="`${item.institutionName || item.nickname || item.username}（ID:${item.id}）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="作业标题" min-width="200" />
        <el-table-column prop="courseName" label="关联课程" width="180" />
        <el-table-column prop="deadline" label="截止时间" width="160" />
        <el-table-column prop="submitCount" label="提交/总人数" width="120">
          <template #default="{ row }">{{ row.submitCount }}/{{ row.totalCount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ongoing' ? 'primary' : 'info'">
              {{ row.status === 'ongoing' ? '进行中' : '已截止' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleSubmissions(row)">查看提交</el-button>
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="publishVisible" :title="isEditHomework ? '编辑作业' : '布置作业'" width="560px">
      <el-form ref="publishFormRef" :model="publishForm" :rules="publishRules" label-width="100px">
        <el-form-item label="关联课程" prop="courseId">
          <el-select v-model="publishForm.courseId" :disabled="isEditHomework" placeholder="请选择课程" style="width: 100%">
            <el-option v-for="c in courseList" :key="c.id" :label="c.title" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="作业标题" prop="title">
          <el-input v-model="publishForm.title" placeholder="请输入作业标题" />
        </el-form-item>
        <el-form-item label="作业内容" prop="content">
          <el-input v-model="publishForm.content" type="textarea" :rows="4" placeholder="请输入作业说明" />
        </el-form-item>
        <el-form-item label="截止时间" prop="deadline">
          <el-date-picker
            v-model="publishForm.deadline"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择截止时间"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" :loading="publishing" @click="submitPublish">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="submissionVisible" title="作业提交列表" width="900px">
      <el-table :data="submissionList" border size="small">
        <el-table-column prop="studentName" label="学员" width="120" />
        <el-table-column prop="submitTime" label="提交时间" width="160" />
        <el-table-column prop="content" label="作答内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="score" label="得分" width="100">
          <template #default="{ row }">
            <span :style="{ color: row.score !== null ? '#67C23A' : '#999' }">
              {{ row.score !== null ? row.score + '分' : '未批改' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleGrade(row)">批改</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="gradeVisible" title="批改作业" width="500px">
      <p style="margin-bottom: 15px"><strong>学员：</strong>{{ currentSubmission?.studentName }}</p>
      <p style="margin-bottom: 15px"><strong>作答：</strong>{{ currentSubmission?.content }}</p>
      <el-form :model="gradeForm" label-width="80px">
        <el-form-item label="得分">
          <el-input-number v-model="gradeForm.score" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="评语">
          <el-input v-model="gradeForm.comment" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gradeVisible = false">取消</el-button>
        <el-button type="primary" @click="submitGrade">提交批改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getHomeworkList, createHomework, updateHomework, getHomeworkSubmissions, gradeHomework } from '@/api/homework'
import { getCourseList } from '@/api/course'
import { getInstitutionList } from '@/api/platform'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ institutionId: null })

const submissionVisible = ref(false)
const submissionList = ref([])
const currentHomeworkId = ref(null)
const institutionOptions = ref([])

const publishVisible = ref(false)
const isEditHomework = ref(false)
const editingHomeworkId = ref(null)
const publishFormRef = ref()
const publishing = ref(false)
const publishForm = reactive({ courseId: null, title: '', content: '', deadline: '' })
const publishRules = {
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  title: [{ required: true, message: '请输入作业标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入作业内容', trigger: 'blur' }]
}
const courseList = ref([])

const gradeVisible = ref(false)
const currentSubmission = ref(null)
const gradeForm = reactive({ score: 0, comment: '' })

const loadData = async () => {
  loading.value = true
  const params = { page: 1, size: 20, ...searchForm }
  if (!userStore.isPlatformAdmin || params.institutionId === null || params.institutionId === undefined) {
    delete params.institutionId
  }

  const res = await getHomeworkList(params)
  tableData.value = (res.list || []).map((item) => {
    const row = { ...item }
    const submitted = ['submitted', 'graded', 'returned'].includes(row.status)
    return {
      ...row,
      courseName: row.course?.title || '-',
      submitCount: submitted ? 1 : 0,
      totalCount: 1,
      status: row.deadline && new Date(row.deadline) < new Date() ? 'ended' : 'ongoing'
    }
  })
  loading.value = false
}

const loadInstitutionOptions = async () => {
  if (!userStore.isPlatformAdmin) return
  const res = await getInstitutionList({ page: 1, size: 1000 })
  institutionOptions.value = res.list || []
}

const loadCourseOptions = async () => {
  const params = { page: 1, size: 1000 }
  if (userStore.isPlatformAdmin && searchForm.institutionId !== null && searchForm.institutionId !== undefined) {
    params.institutionId = searchForm.institutionId
  }
  const res = await getCourseList(params)
  courseList.value = res.list || []
}

const handleSearch = () => {
  loadData()
}

const handleReset = () => {
  searchForm.institutionId = null
  loadData()
}

const handlePublish = () => {
  if (userStore.isPlatformAdmin && (searchForm.institutionId === null || searchForm.institutionId === undefined)) {
    ElMessage.warning('请先选择机构后再布置作业')
    return
  }

  isEditHomework.value = false
  editingHomeworkId.value = null
  Object.assign(publishForm, { courseId: null, title: '', content: '', deadline: '' })
  publishVisible.value = true
  loadCourseOptions()
}

const handleSubmissions = async (row) => {
  currentHomeworkId.value = row.id
  const res = await getHomeworkSubmissions({ homeworkId: row.id })
  submissionList.value = res.list
  submissionVisible.value = true
}

const handleGrade = (row) => {
  currentSubmission.value = row
  gradeForm.score = row.score || 0
  gradeForm.comment = row.comment || ''
  gradeVisible.value = true
}

const submitGrade = async () => {
  await gradeHomework({
    homeworkId: currentHomeworkId.value,
    studentId: currentSubmission.value.studentId,
    ...gradeForm
  })
  ElMessage.success('批改成功')
  gradeVisible.value = false
  const res = await getHomeworkSubmissions({ homeworkId: currentHomeworkId.value })
  submissionList.value = res.list
}

const submitPublish = async () => {
  await publishFormRef.value.validate()
  publishing.value = true
  try {
    if (isEditHomework.value && editingHomeworkId.value) {
      await updateHomework(editingHomeworkId.value, publishForm)
      ElMessage.success('作业更新成功')
    } else {
      await createHomework(publishForm)
      ElMessage.success('作业布置成功')
    }
    publishVisible.value = false
    await loadData()
  } finally {
    publishing.value = false
  }
}

const handleEdit = async (row) => {
  if (userStore.isPlatformAdmin && (searchForm.institutionId === null || searchForm.institutionId === undefined)) {
    ElMessage.warning('请先选择机构后再编辑作业')
    return
  }

  isEditHomework.value = true
  editingHomeworkId.value = row.id
  await loadCourseOptions()
  Object.assign(publishForm, {
    courseId: row.courseId,
    title: row.title,
    content: row.content || '',
    deadline: row.deadline || ''
  })
  publishVisible.value = true
}

onMounted(async () => {
  await Promise.all([loadData(), loadInstitutionOptions()])
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
</style>
