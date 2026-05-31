<template>
  <div class="resource-classroom-page">
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
              <span>教学楼管理</span>
              <el-button type="primary" size="small" @click="openBuildingDialog()">新增</el-button>
            </div>
          </template>

          <el-input v-model="buildingKeyword" placeholder="搜索教学楼" clearable style="margin-bottom: 12px" @keyup.enter="loadBuildings" />
          <el-table :data="buildings" size="small" v-loading="buildingLoading" border>
            <el-table-column prop="name" label="教学楼" min-width="140" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button link type="primary" @click="openBuildingDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="handleDeleteBuilding(row)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>固定教室管理</span>
              <el-button type="primary" size="small" @click="openClassroomDialog()">新增</el-button>
            </div>
          </template>

          <el-form :inline="true" class="search-form">
            <el-form-item>
              <el-input v-model="classroomKeyword" placeholder="搜索教室" clearable style="width: 220px" @keyup.enter="loadClassrooms" />
            </el-form-item>
            <el-form-item label="教学楼">
              <el-select v-model="classroomBuildingId" clearable placeholder="全部" style="width: 180px" @change="loadClassrooms">
                <el-option v-for="item in buildings" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadClassrooms">查询</el-button>
            </el-form-item>
          </el-form>

          <el-table :data="classrooms" size="small" v-loading="classroomLoading" border>
            <el-table-column prop="name" label="教室" min-width="140" />
            <el-table-column label="教学楼" min-width="120">
              <template #default="{ row }">{{ row.location || '-' }}</template>
            </el-table-column>
            <el-table-column prop="capacity" label="容量" width="80" />
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" @click="openClassroomDialog(row)">编辑</el-button>
                <el-button link type="danger" @click="handleDeleteClassroom(row)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog v-model="buildingDialogVisible" :title="buildingForm.id ? '编辑教学楼' : '新增教学楼'" width="520px">
      <el-form :model="buildingForm" label-width="100px">
        <el-form-item label="教学楼名称"><el-input v-model="buildingForm.name" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="buildingForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="buildingForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="buildingDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveBuilding">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="classroomDialogVisible" :title="classroomForm.id ? '编辑教室' : '新增教室'" width="560px">
      <el-form :model="classroomForm" label-width="100px">
        <el-form-item label="教学楼">
          <el-select v-model="classroomForm.buildingId" filterable placeholder="请选择教学楼" style="width: 100%">
            <el-option v-for="item in buildings" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="教室名称"><el-input v-model="classroomForm.name" /></el-form-item>
        <el-form-item label="容量"><el-input-number v-model="classroomForm.capacity" :min="0" controls-position="right" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="classroomForm.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="classroomForm.status" :active-value="1" :inactive-value="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="classroomDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveClassroom">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { getInstitutionList } from '@/api/platform'
import {
  createBuilding,
  createClassroom,
  deleteBuilding,
  deleteClassroom,
  getBuildings,
  getClassrooms,
  updateBuilding,
  updateClassroom
} from '@/api/resource'

const userStore = useUserStore()
const institutionOptions = ref([])
const currentInstitutionId = ref(userStore.currentInstitutionId || null)

const buildingLoading = ref(false)
const buildings = ref([])
const buildingKeyword = ref('')
const buildingDialogVisible = ref(false)
const buildingForm = reactive({ id: null, name: '', description: '', status: 1 })

const classroomLoading = ref(false)
const classrooms = ref([])
const classroomKeyword = ref('')
const classroomBuildingId = ref(null)
const classroomDialogVisible = ref(false)
const classroomForm = reactive({ id: null, buildingId: null, name: '', capacity: 0, description: '', status: 1 })

const buildingMap = computed(() => {
  const map = {}
  ;(buildings.value || []).forEach((item) => {
    map[item.name] = item.id
  })
  return map
})

const buildCommonParams = () => {
  const params = {}
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    params.institutionId = currentInstitutionId.value
  }
  return params
}

const loadInstitutions = async () => {
  if (!userStore.isPlatformAdmin) return
  const res = await getInstitutionList({ page: 1, size: 1000 })
  institutionOptions.value = res.list || []
  if (!currentInstitutionId.value && institutionOptions.value.length) {
    currentInstitutionId.value = institutionOptions.value[0].id
  }
}

const loadBuildings = async () => {
  buildingLoading.value = true
  try {
    buildings.value = await getBuildings({ ...buildCommonParams(), keyword: buildingKeyword.value })
  } finally {
    buildingLoading.value = false
  }
}

const loadClassrooms = async () => {
  classroomLoading.value = true
  try {
    classrooms.value = await getClassrooms({
      ...buildCommonParams(),
      keyword: classroomKeyword.value,
      buildingId: classroomBuildingId.value || undefined
    })
  } finally {
    classroomLoading.value = false
  }
}

const reloadAll = async () => {
  await loadBuildings()
  await loadClassrooms()
}

const openBuildingDialog = (row = null) => {
  Object.assign(buildingForm, row ? { ...row } : { id: null, name: '', description: '', status: 1 })
  buildingDialogVisible.value = true
}

const saveBuilding = async () => {
  const payload = { ...buildingForm }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }
  if (payload.id) await updateBuilding(payload.id, payload)
  else await createBuilding(payload)
  ElMessage.success('教学楼已保存')
  buildingDialogVisible.value = false
  await loadBuildings()
  await loadClassrooms()
}

const handleDeleteBuilding = async (row) => {
  await ElMessageBox.confirm(`确认删除教学楼【${row.name}】吗？`, '提示', { type: 'warning' })
  await deleteBuilding(row.id, buildCommonParams())
  ElMessage.success('教学楼已删除')
  if (classroomBuildingId.value === row.id) classroomBuildingId.value = null
  await loadBuildings()
  await loadClassrooms()
}

const openClassroomDialog = (row = null) => {
  Object.assign(classroomForm, row
    ? {
      id: row.id,
      buildingId: buildingMap.value[row.location] || null,
      name: row.name,
      capacity: row.capacity || 0,
      description: row.description || '',
      status: row.status
    }
    : { id: null, buildingId: null, name: '', capacity: 0, description: '', status: 1 })
  classroomDialogVisible.value = true
}

const saveClassroom = async () => {
  if (!classroomForm.buildingId) {
    ElMessage.warning('请选择教学楼')
    return
  }
  const payload = { ...classroomForm }
  if (userStore.isPlatformAdmin && currentInstitutionId.value) {
    payload.institutionId = currentInstitutionId.value
  }
  if (payload.id) await updateClassroom(payload.id, payload)
  else await createClassroom(payload)
  ElMessage.success('教室已保存')
  classroomDialogVisible.value = false
  await loadClassrooms()
}

const handleDeleteClassroom = async (row) => {
  await ElMessageBox.confirm(`确认删除教室【${row.name}】吗？`, '提示', { type: 'warning' })
  await deleteClassroom(row.id, buildCommonParams())
  ElMessage.success('教室已删除')
  await loadClassrooms()
}

onMounted(async () => {
  await loadInstitutions()
  await loadBuildings()
  await loadClassrooms()
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
