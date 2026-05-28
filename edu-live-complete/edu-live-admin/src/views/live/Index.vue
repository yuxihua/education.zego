<template>
  <div class="live-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>直播管理</span>
          <el-button type="primary" @click="handleCreate">+ 创建直播间</el-button>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="房间ID" width="100" />
        <el-table-column prop="title" label="直播标题" min-width="200" />
        <el-table-column prop="courseName" label="关联课程" width="180" />
        <el-table-column prop="teacherName" label="讲师" width="120" />
        <el-table-column prop="startTime" label="开播时间" width="160" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'living' ? 'danger' : row.status === 'upcoming' ? 'primary' : 'info'">
              {{ { living: '直播中', upcoming: '未开始', ended: '已结束' }[row.status] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="onlineCount" label="在线人数" width="100" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'living'" link type="danger" @click="handleEnd(row)">结束直播</el-button>
            <el-button link type="primary" @click="handleReplay(row)">回放管理</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        layout="total, prev, pager, next"
        style="margin-top: 20px; justify-content: flex-end"
        @change="loadData"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" title="创建直播间" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="直播标题" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="关联课程" prop="courseId">
          <el-select v-model="form.courseId" placeholder="选择课程">
            <el-option v-for="c in courseList" :key="c.id" :label="c.title" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="讲师" prop="teacherId">
          <el-select v-model="form.teacherId" placeholder="选择讲师">
            <el-option v-for="t in teacherList" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开播时间" prop="startTime">
          <el-date-picker v-model="form.startTime" type="datetime" placeholder="选择时间" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getLiveList, createLiveRoom, endLive } from '@/api/live'

const router = useRouter()
const loading = ref(false)
const tableData = ref([])
const pagination = reactive({ page: 1, size: 10, total: 0 })

const dialogVisible = ref(false)
const formRef = ref()
const form = reactive({ title: '', courseId: null, teacherId: null, startTime: '' })
const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  courseId: [{ required: true, message: '请选择课程', trigger: 'change' }],
  teacherId: [{ required: true, message: '请选择讲师', trigger: 'change' }]
}
const courseList = ref([])
const teacherList = ref([])

const loadData = async () => {
  loading.value = true
  const res = await getLiveList({ ...pagination })
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
}

const handleCreate = () => {
  Object.assign(form, { title: '', courseId: null, teacherId: null, startTime: '' })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value.validate()
  await createLiveRoom(form)
  ElMessage.success('直播间创建成功')
  dialogVisible.value = false
  loadData()
}

const goDetail = (row) => {
  router.push(`/live/room/${row.id}`)
}

const handleEnd = async (row) => {
  await ElMessageBox.confirm('确认结束该直播？', '提示', { type: 'warning' })
  await endLive(row.id)
  ElMessage.success('直播已结束')
  loadData()
}

const handleReplay = (row) => {
  ElMessage.info(`管理【${row.title}】的回放视频`)
}

onMounted(loadData)
</script>
