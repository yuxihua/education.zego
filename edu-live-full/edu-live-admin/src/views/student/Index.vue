<template>
  <div class="student-page">
    <el-card>
      <template #header><span>学员管理</span></template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="手机号">
          <el-input v-model="searchForm.phone" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="searchForm.nickname" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="avatar" label="头像" width="80">
          <template #default="{ row }">
            <el-avatar :size="40" :src="row.avatar" />
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="courseCount" label="已购课程" width="100" />
        <el-table-column prop="studyDuration" label="学习时长" width="120" />
        <el-table-column prop="lastStudyTime" label="最近学习" width="160" />
        <el-table-column prop="createTime" label="注册时间" width="160" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleDetail(row)">详情</el-button>
            <el-button link type="primary" @click="handleRecord(row)">学习记录</el-button>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getStudentList } from '@/api/student'

const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ phone: '', nickname: '' })
const pagination = reactive({ page: 1, size: 10, total: 0 })

const loadData = async () => {
  loading.value = true
  const res = await getStudentList({ ...searchForm, ...pagination })
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
}

const handleDetail = (row) => {
  console.log('学员详情', row)
}

const handleRecord = (row) => {
  console.log('学习记录', row)
}

onMounted(loadData)
</script>
