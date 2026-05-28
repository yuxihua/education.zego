<template>
  <div class="course-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程管理</span>
          <el-button type="primary" @click="handleAdd">+ 新建课程</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="课程名称">
          <el-input v-model="searchForm.keyword" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable>
            <el-option label="上架" value="published" />
            <el-option label="下架" value="draft" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="searchForm = {}">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="cover" label="封面" width="100">
          <template #default="{ row }">
            <el-image :src="row.cover" style="width: 60px; height: 40px; border-radius: 4px" fit="cover" />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="课程名称" min-width="200" />
        <el-table-column prop="teacherName" label="讲师" width="120" />
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">\u00A5{{ row.price }}</template>
        </el-table-column>
        <el-table-column prop="studentCount" label="学员数" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'published' ? 'success' : 'info'">
              {{ row.status === 'published' ? '上架' : '下架' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="handleManagePPT(row)">课件</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑课程' : '新建课程'" width="600px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="课程名称" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="课程封面">
          <el-upload
            action="/api/upload/image"
            :headers="{ Authorization: 'Bearer ' + userStore.token }"
            :on-success="handleUploadSuccess"
            :show-file-list="false"
          >
            <el-image v-if="form.cover" :src="form.cover" style="width: 200px; height: 120px" fit="cover" />
            <el-button v-else type="primary">上传封面</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="所属讲师" prop="teacherId">
          <el-select v-model="form.teacherId" placeholder="选择讲师">
            <el-option v-for="t in teacherList" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程价格" prop="price">
          <el-input-number v-model="form.price" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="课程简介">
          <el-input v-model="form.description" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getCourseList, createCourse, updateCourse, deleteCourse } from '@/api/course'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ keyword: '', status: '' })
const pagination = reactive({ page: 1, size: 10, total: 0 })

const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = reactive({ id: null, title: '', cover: '', teacherId: null, price: 0, description: '' })
const formRules = {
  title: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  teacherId: [{ required: true, message: '请选择讲师', trigger: 'change' }]
}
const teacherList = ref([])

const loadData = async () => {
  loading.value = true
  const res = await getCourseList({ ...searchForm, ...pagination })
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, { id: null, title: '', cover: '', teacherId: null, price: 0, description: '' })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, row)
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value.validate()
  if (isEdit.value) {
    await updateCourse(form)
    ElMessage.success('更新成功')
  } else {
    await createCourse(form)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  loadData()
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确认删除该课程？', '提示', { type: 'warning' })
  await deleteCourse(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const handleUploadSuccess = (res) => {
  form.cover = res.url
}

const handleManagePPT = (row) => {
  ElMessage.info(`管理课程【${row.title}】的课件`)
}

onMounted(loadData)
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.search-form { margin-bottom: 20px; }
</style>
