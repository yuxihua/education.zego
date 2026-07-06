<template>
  <div class="distribution-assignment-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>销售与学员归属</span>
          <el-button type="primary" @click="openCreateSales">新增销售账号</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="assignForm" class="search-form">
        <el-form-item label="学员">
          <el-select
            v-model="assignForm.studentId"
            placeholder="按姓名/手机号搜索学员"
            filterable
            remote
            clearable
            reserve-keyword
            style="width: 320px"
            :remote-method="searchStudents"
            @visible-change="handleStudentSelectorVisible"
          >
            <el-option v-for="s in studentOptions" :key="s.id" :label="s.label" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="销售">
          <el-select v-model="assignForm.salesUserId" placeholder="选择销售" filterable style="width: 220px">
            <el-option v-for="s in salesList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="分销层级">
          <el-select v-model="assignForm.salesLevel" placeholder="选择层级" style="width: 130px">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitAssign">保存归属</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <div class="card-header">
          <span>销售账号列表</span>
          <el-button @click="loadSales">刷新</el-button>
        </div>
      </template>

      <el-table :data="salesList" border>
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="name" label="姓名" width="140" />
        <el-table-column prop="username" label="账号" width="160" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column prop="salesLevel" label="层级" width="100" />
        <el-table-column prop="parentSalesUserId" label="上级销售ID" width="120" />
      </el-table>
    </el-card>

    <el-dialog v-model="createSalesVisible" title="新增销售账号" width="520px">
      <el-form :model="createSalesForm" label-width="100px">
        <el-form-item label="登录账号"><el-input v-model="createSalesForm.username" /></el-form-item>
        <el-form-item label="登录密码"><el-input v-model="createSalesForm.password" type="password" show-password /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="createSalesForm.nickname" /></el-form-item>
        <el-form-item label="销售层级">
          <el-select v-model="createSalesForm.salesLevel" style="width: 100%" @change="onSalesLevelChange">
            <el-option label="一级" :value="1" />
            <el-option label="二级" :value="2" />
            <el-option label="三级" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="上级销售" v-if="createSalesForm.salesLevel > 1">
          <el-select v-model="createSalesForm.parentSalesUserId" placeholder="请选择上级销售" style="width: 100%" filterable>
            <el-option
              v-for="s in parentSalesOptions"
              :key="s.id"
              :label="`${s.name}（${s.username}）`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号"><el-input v-model="createSalesForm.phone" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createSalesVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateSales">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  assignStudentSales,
  createSalesUser,
  getSalesList,
  searchDistributionStudents
} from '@/api/distribution'

const salesList = ref([])
const studentOptions = ref([])
const assignForm = reactive({ studentId: null, salesUserId: null, salesLevel: 1 })

const createSalesVisible = ref(false)
const createSalesForm = reactive({ username: '', password: '', nickname: '', phone: '', salesLevel: 1, parentSalesUserId: null })

const parentSalesOptions = computed(() => {
  const parentLevel = Number(createSalesForm.salesLevel || 1) - 1
  if (parentLevel < 1) return []
  return (salesList.value || []).filter((item) => Number(item.salesLevel || 0) === parentLevel)
})

const loadSales = async () => {
  salesList.value = await getSalesList({})
}

const searchStudents = async (keyword = '') => {
  studentOptions.value = await searchDistributionStudents({ keyword })
}

const handleStudentSelectorVisible = (visible) => {
  if (!visible) return
  if (!studentOptions.value.length) {
    searchStudents('')
  }
}

const submitAssign = async () => {
  if (!assignForm.studentId || !assignForm.salesUserId || !assignForm.salesLevel) {
    ElMessage.warning('请填写完整归属信息')
    return
  }
  await assignStudentSales(assignForm)
  ElMessage.success('学员分销归属已设置')
}

const onSalesLevelChange = () => {
  if (Number(createSalesForm.salesLevel || 1) <= 1) {
    createSalesForm.parentSalesUserId = null
  }
}

const openCreateSales = () => {
  Object.assign(createSalesForm, {
    username: '',
    password: '',
    nickname: '',
    phone: '',
    salesLevel: 1,
    parentSalesUserId: null
  })
  createSalesVisible.value = true
}

const submitCreateSales = async () => {
  if (Number(createSalesForm.salesLevel || 1) > 1 && !createSalesForm.parentSalesUserId) {
    ElMessage.warning('二级/三级销售必须选择上级销售')
    return
  }
  await createSalesUser(createSalesForm)
  ElMessage.success('销售账号创建成功')
  createSalesVisible.value = false
  await loadSales()
}

onMounted(async () => {
  await loadSales()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-form {
  margin-bottom: 12px;
}
</style>
