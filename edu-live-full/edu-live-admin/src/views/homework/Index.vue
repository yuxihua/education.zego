<template>
  <div class="homework-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>作业管理</span>
          <el-button type="primary" @click="handlePublish">+ 布置作业</el-button>
        </div>
      </template>

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
import { getHomeworkList, getHomeworkSubmissions, gradeHomework } from '@/api/homework'

const loading = ref(false)
const tableData = ref([])

const submissionVisible = ref(false)
const submissionList = ref([])
const currentHomeworkId = ref(null)

const gradeVisible = ref(false)
const currentSubmission = ref(null)
const gradeForm = reactive({ score: 0, comment: '' })

const loadData = async () => {
  loading.value = true
  const res = await getHomeworkList({ page: 1, size: 20 })
  tableData.value = res.list
  loading.value = false
}

const handlePublish = () => {
  ElMessage.info('打开布置作业弹窗')
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

onMounted(loadData)
</script>
