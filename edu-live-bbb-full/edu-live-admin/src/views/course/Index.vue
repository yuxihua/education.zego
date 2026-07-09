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
        <el-form-item label="机构ID" v-if="userStore.isPlatformAdmin">
          <el-input-number v-model="searchForm.institutionId" :min="0" controls-position="right" />
        </el-form-item>
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
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="cover" label="封面" width="100">
          <template #default="{ row }">
            <el-image :src="resolveCoverUrl(row.cover)" style="width: 60px; height: 40px; border-radius: 4px" fit="cover">
              <template #error>
                <div class="cover-placeholder">无封面</div>
              </template>
            </el-image>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="课程名称" min-width="200" />
        <el-table-column prop="teacherName" label="讲师" width="120" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.type === 'record'" type="warning">录播</el-tag>
            <el-tag v-else-if="row.type === 'hybrid'" type="success">混合</el-tag>
            <el-tag v-else type="info">直播</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="价格" width="100">
          <template #default="{ row }">¥{{ row.price }}</template>
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
            <el-button
              v-if="userStore.isInstitutionAdmin && row.status !== 'published'"
              link
              type="success"
              @click="handlePublish(row)"
            >
              上架
            </el-button>
            <el-button
              v-if="userStore.isInstitutionAdmin && row.status === 'published'"
              link
              type="warning"
              @click="handleArchive(row)"
            >
              下架
            </el-button>
            <el-button link type="primary" @click="openRecordingDialog(row)">录播视频</el-button>
            <el-button link type="primary" @click="handleManagePPT(row)">课件</el-button>
            <el-button v-if="userStore.isInstitutionAdmin" link type="danger" @click="handleDelete(row)">删除</el-button>
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
          <div class="cover-editor">
            <el-upload
              action="/api/upload/image"
              :headers="{ Authorization: 'Bearer ' + userStore.token }"
              :on-success="handleUploadSuccess"
              :on-error="handleUploadError"
              :show-file-list="false"
            >
              <el-image v-if="form.cover" :src="resolveCoverUrl(form.cover)" style="width: 200px; height: 120px" fit="cover">
                <template #error>
                  <div class="cover-placeholder large">加载失败</div>
                </template>
              </el-image>
              <el-button v-else type="primary">上传封面</el-button>
            </el-upload>
            <el-button style="margin-top: 8px" @click="openImagePicker">从已上传选择</el-button>
          </div>
        </el-form-item>
        <el-form-item label="所属讲师" prop="teacherId">
          <el-select v-model="form.teacherId" placeholder="选择讲师" style="width: 260px">
            <el-option v-for="t in teacherList" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
          <el-button link type="primary" @click="openTeacherDialog" style="margin-left: 8px">新增讲师</el-button>
        </el-form-item>
        <el-form-item label="课程类型" prop="type">
          <el-select v-model="form.type" style="width: 260px">
            <el-option label="直播课" value="live" />
            <el-option label="录播课" value="record" />
            <el-option label="混合课" value="hybrid" />
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

    <el-dialog v-model="teacherDialogVisible" title="新增讲师" width="500px">
      <el-form :model="teacherForm" :rules="teacherRules" ref="teacherFormRef" label-width="90px">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="teacherForm.username" placeholder="4-20位字母或数字" />
        </el-form-item>
        <el-form-item label="讲师姓名" prop="nickname">
          <el-input v-model="teacherForm.nickname" placeholder="请输入讲师姓名" />
        </el-form-item>
        <el-form-item label="登录密码" prop="password">
          <el-input v-model="teacherForm.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="teacherForm.phone" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="teacherDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTeacher">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="imagePickerVisible" title="选择已上传图片" width="760px">
      <el-skeleton :rows="6" animated v-if="imageLoading" />
      <div v-else>
        <el-empty v-if="uploadedImageList.length === 0" description="暂无已上传图片" />
        <div v-else class="image-grid">
          <div
            v-for="item in uploadedImageList"
            :key="item.url"
            class="image-item"
            :class="{ active: selectedImageUrl === item.url }"
            @click="selectUploadedImage(item.url)"
          >
            <el-image :src="item.url" fit="cover" class="image-item-preview">
              <template #error>
                <div class="cover-placeholder">加载失败</div>
              </template>
            </el-image>
          </div>
        </div>

        <el-pagination
          v-model:current-page="imagePagination.page"
          v-model:page-size="imagePagination.size"
          :page-sizes="[12, 24, 48]"
          :total="imagePagination.total"
          layout="total, sizes, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
          @change="loadUploadedImages"
        />
      </div>
      <template #footer>
        <el-button @click="imagePickerVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSelectedImage">使用该图片</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordingDialogVisible" :title="`录播视频管理 - ${recordingCourseTitle}`" width="900px">
      <div class="recording-toolbar">
        <el-button type="primary" @click="handleAddRecordingRow">+ 新增视频</el-button>
        <el-button @click="openVideoPicker">从已上传视频选择</el-button>
      </div>

      <el-table :data="recordingList" border max-height="420">
        <el-table-column label="排序" width="80">
          <template #default="{ row }">
            <el-input-number v-model="row.sort" :min="1" :max="999" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="标题" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.title" placeholder="例如：第1节 线性方程" />
          </template>
        </el-table-column>
        <el-table-column label="视频地址" min-width="280">
          <template #default="{ row }">
            <el-input v-model="row.url" placeholder="可上传或粘贴地址" />
          </template>
        </el-table-column>
        <el-table-column label="封面" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.cover" placeholder="可选：封面URL" />
          </template>
        </el-table-column>
        <el-table-column label="时长(秒)" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.duration" :min="0" :max="86400" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="试看(秒)" width="120">
          <template #default="{ row }">
            <el-input-number v-model="row.trialDuration" :min="0" :max="36000" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-select v-model="row.status">
              <el-option label="发布" value="published" />
              <el-option label="草稿" value="draft" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row, $index }">
            <el-upload
              action="/api/upload/video"
              :headers="{ Authorization: 'Bearer ' + userStore.token }"
              :show-file-list="false"
              :on-success="(res) => handleVideoUploadSuccess(res, row)"
              :on-error="handleVideoUploadError"
              style="display: inline-block; margin-right: 8px"
            >
              <el-button link type="primary">上传</el-button>
            </el-upload>
            <el-button link type="danger" @click="handleRemoveRecordingRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!recordingList.length" description="暂无录播视频，请新增或上传" />

      <template #footer>
        <el-button @click="recordingDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="recordingSaving" @click="handleSaveRecordings">保存录播视频</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="videoPickerVisible" title="选择已上传视频" width="860px">
      <el-skeleton :rows="6" animated v-if="videoLoading" />
      <div v-else>
        <el-empty v-if="uploadedVideoList.length === 0" description="暂无已上传视频" />
        <el-table v-else :data="uploadedVideoList" border max-height="420">
          <el-table-column prop="name" label="文件名" min-width="260" />
          <el-table-column prop="size" label="大小" width="120">
            <template #default="{ row }">{{ formatBytes(row.size) }}</template>
          </el-table-column>
          <el-table-column prop="updatedAt" label="更新时间" width="180" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="selectUploadedVideo(row)">选用</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="videoPagination.page"
          v-model:page-size="videoPagination.size"
          :page-sizes="[12, 24, 48]"
          :total="videoPagination.total"
          layout="total, sizes, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
          @change="loadUploadedVideos"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getCourseList, createCourse, updateCourse, deleteCourse, publishCourse, archiveCourse, getTeacherList, createTeacher, listUploadedImages, listUploadedVideos, getCourseRecordings, updateCourseRecordings } from '@/api/course'

const userStore = useUserStore()
const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ keyword: '', status: '', institutionId: null })
const pagination = reactive({ page: 1, size: 10, total: 0 })

const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = reactive({ id: null, title: '', cover: '', teacherId: null, price: 0, description: '', type: 'live' })
const formRules = {
  title: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  teacherId: [{ required: true, message: '请选择讲师', trigger: 'change' }],
  type: [{ required: true, message: '请选择课程类型', trigger: 'change' }]
}
const teacherList = ref([])
const teacherDialogVisible = ref(false)
const teacherFormRef = ref()
const teacherForm = reactive({ username: '', nickname: '', password: '', phone: '' })
const imagePickerVisible = ref(false)
const imageLoading = ref(false)
const uploadedImageList = ref([])
const selectedImageUrl = ref('')
const imagePagination = reactive({ page: 1, size: 12, total: 0 })

const recordingDialogVisible = ref(false)
const recordingCourseId = ref(0)
const recordingCourseTitle = ref('')
const recordingList = ref([])
const recordingSaving = ref(false)

const videoPickerVisible = ref(false)
const videoLoading = ref(false)
const uploadedVideoList = ref([])
const videoPagination = reactive({ page: 1, size: 12, total: 0 })
const teacherRules = {
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入讲师姓名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }]
}

const loadTeacherList = async () => {
  teacherList.value = await getTeacherList()
}

const loadData = async () => {
  loading.value = true
  const params = { ...searchForm, ...pagination }
  if (!userStore.isPlatformAdmin || params.institutionId === null || params.institutionId === undefined) {
    delete params.institutionId
  }
  const res = await getCourseList(params)
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
}

const handleReset = () => {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.institutionId = null
  pagination.page = 1
  loadData()
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, { id: null, title: '', cover: '', teacherId: null, price: 0, description: '', type: 'live' })
  dialogVisible.value = true
  loadTeacherList()
}

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, { ...row, type: row.type || 'live' })
  dialogVisible.value = true
  loadTeacherList()
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

const handlePublish = async (row) => {
  await ElMessageBox.confirm(`确认上架课程【${row.title}】？`, '提示', { type: 'warning' })
  await publishCourse(row.id)
  ElMessage.success('课程已上架')
  loadData()
}

const handleArchive = async (row) => {
  await ElMessageBox.confirm(`确认下架课程【${row.title}】？`, '提示', { type: 'warning' })
  await archiveCourse(row.id)
  ElMessage.success('课程已下架')
  loadData()
}

const loadUploadedImages = async () => {
  imageLoading.value = true
  try {
    const res = await listUploadedImages({ page: imagePagination.page, size: imagePagination.size })
    uploadedImageList.value = (res?.list || []).map(item => ({
      ...item,
      url: resolveCoverUrl(item.url)
    }))
    imagePagination.total = res?.total || 0
  } catch (err) {
    ElMessage.error('加载已上传图片失败')
  } finally {
    imageLoading.value = false
  }
}

const openImagePicker = async () => {
  imagePickerVisible.value = true
  selectedImageUrl.value = resolveCoverUrl(form.cover)
  if (!uploadedImageList.value.length) {
    imagePagination.page = 1
    await loadUploadedImages()
  }
}

const selectUploadedImage = (url) => {
  selectedImageUrl.value = url
}

const confirmSelectedImage = () => {
  if (!selectedImageUrl.value) {
    ElMessage.warning('请先选择一张图片')
    return
  }
  form.cover = selectedImageUrl.value
  imagePickerVisible.value = false
}

const resolveCoverUrl = (cover) => {
  if (!cover) return ''
  if (/^https?:\/\//i.test(cover)) return cover
  if (cover.startsWith('/api/uploads/')) return cover
  if (cover.startsWith('/uploads/')) return `/api${cover}`
  if (cover.startsWith('/')) return cover
  return `/${cover.replace(/^\/+/, '')}`
}

const handleUploadSuccess = (res) => {
  const url = res?.data?.url || res?.url
  if (!url) {
    ElMessage.error('上传返回异常，未获取到图片地址')
    return
  }
  form.cover = resolveCoverUrl(url)
}

const handleUploadError = () => {
  ElMessage.error('封面上传失败，请重试')
}

const createEmptyRecordingRow = () => ({
  id: '',
  title: '',
  url: '',
  cover: '',
  duration: 0,
  trialDuration: 0,
  sort: recordingList.value.length + 1,
  status: 'published'
})

const openRecordingDialog = async (row) => {
  recordingCourseId.value = Number(row?.id || 0)
  recordingCourseTitle.value = row?.title || ''
  recordingDialogVisible.value = true
  const res = await getCourseRecordings(recordingCourseId.value)
  recordingList.value = Array.isArray(res?.list) ? res.list : []
}

const handleAddRecordingRow = () => {
  recordingList.value.push(createEmptyRecordingRow())
}

const handleRemoveRecordingRow = (index) => {
  recordingList.value.splice(index, 1)
}

const handleVideoUploadSuccess = (res, row) => {
  const url = res?.data?.url || res?.url
  if (!url) {
    ElMessage.error('上传返回异常，未获取到视频地址')
    return
  }
  row.url = resolveCoverUrl(url)
  if (!row.title) {
    row.title = `第${Math.max(1, Number(row.sort || 1))}节`
  }
}

const handleVideoUploadError = () => {
  ElMessage.error('视频上传失败，请重试')
}

const handleSaveRecordings = async () => {
  if (!recordingCourseId.value) {
    ElMessage.warning('未找到课程信息')
    return
  }

  const invalid = recordingList.value.find((item) => String(item.url || '').trim() === '')
  if (invalid) {
    ElMessage.warning('请填写完整视频地址后再保存')
    return
  }

  recordingSaving.value = true
  try {
    await updateCourseRecordings(recordingCourseId.value, recordingList.value)
    ElMessage.success('录播视频已保存')
    recordingDialogVisible.value = false
  } finally {
    recordingSaving.value = false
  }
}

const loadUploadedVideos = async () => {
  videoLoading.value = true
  try {
    const res = await listUploadedVideos({ page: videoPagination.page, size: videoPagination.size })
    uploadedVideoList.value = (res?.list || []).map(item => ({
      ...item,
      url: resolveCoverUrl(item.url)
    }))
    videoPagination.total = res?.total || 0
  } catch (err) {
    ElMessage.error('加载已上传视频失败')
  } finally {
    videoLoading.value = false
  }
}

const openVideoPicker = async () => {
  videoPickerVisible.value = true
  if (!uploadedVideoList.value.length) {
    videoPagination.page = 1
    await loadUploadedVideos()
  }
}

const selectUploadedVideo = (item) => {
  const firstEmpty = recordingList.value.find(row => !String(row.url || '').trim())
  if (firstEmpty) {
    firstEmpty.url = item.url
    if (!firstEmpty.title) firstEmpty.title = item.name || ''
  } else {
    recordingList.value.push({
      ...createEmptyRecordingRow(),
      title: item.name || '',
      url: item.url
    })
  }
  videoPickerVisible.value = false
}

const formatBytes = (size) => {
  const bytes = Number(size || 0)
  if (!bytes) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

const handleManagePPT = (row) => {
  ElMessage.info(`管理课程【${row.title}】的课件`)
}

const openTeacherDialog = () => {
  Object.assign(teacherForm, { username: '', nickname: '', password: '', phone: '' })
  teacherDialogVisible.value = true
}

const handleCreateTeacher = async () => {
  await teacherFormRef.value.validate()
  const teacher = await createTeacher(teacherForm)
  ElMessage.success('讲师创建成功')
  teacherDialogVisible.value = false
  await loadTeacherList()
  form.teacherId = teacher.id
}

onMounted(async () => {
  await loadData()
  await loadTeacherList()
})
</script>

<style scoped>
.card-header { display: flex; justify-content: space-between; align-items: center; }
.search-form { margin-bottom: 20px; }
.cover-editor {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.cover-placeholder {
  width: 60px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #909399;
  font-size: 12px;
  border-radius: 4px;
}
.cover-placeholder.large {
  width: 200px;
  height: 120px;
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.image-item {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}
.image-item.active {
  border-color: #409eff;
  box-shadow: 0 0 0 1px #409eff inset;
}
.image-item-preview {
  width: 100%;
  height: 72px;
}
.recording-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
</style>
