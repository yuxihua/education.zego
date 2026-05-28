<template>
  <div class="question-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>题库管理</span>
          <el-button type="primary" @click="handleAdd">+ 新增题目</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="题型">
          <el-select v-model="searchForm.type" placeholder="全部" clearable>
            <el-option label="单选题" value="single" />
            <el-option label="多选题" value="multiple" />
            <el-option label="判断题" value="judge" />
            <el-option label="简答题" value="essay" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="题目内容" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="content" label="题目内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="type" label="题型" width="100">
          <template #default="{ row }">
            {{ { single: '单选', multiple: '多选', judge: '判断', essay: '简答' }[row.type] }}
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" width="120" />
        <el-table-column prop="difficulty" label="难度" width="100">
          <template #default="{ row }">
            <el-rate v-model="row.difficulty" disabled :max="3" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" @click="handleView(row)">预览</el-button>
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑题目' : '新增题目'" width="700px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="题目类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio-button label="single">单选</el-radio-button>
            <el-radio-button label="multiple">多选</el-radio-button>
            <el-radio-button label="judge">判断</el-radio-button>
            <el-radio-button label="essay">简答</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="题目内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="选项" v-if="['single', 'multiple'].includes(form.type)">
          <div v-for="(opt, idx) in form.options" :key="idx" style="display: flex; gap: 10px; margin-bottom: 10px">
            <el-input v-model="opt.label" placeholder="选项标识" style="width: 80px" />
            <el-input v-model="opt.content" placeholder="选项内容" style="flex: 1" />
            <el-checkbox v-model="opt.isCorrect">正确答案</el-checkbox>
            <el-button link type="danger" @click="form.options.splice(idx, 1)">删除</el-button>
          </div>
          <el-button type="primary" link @click="form.options.push({ label: '', content: '', isCorrect: false })">+ 添加选项</el-button>
        </el-form-item>
        <el-form-item label="正确答案" prop="answer" v-if="form.type === 'judge'">
          <el-radio-group v-model="form.answer">
            <el-radio label="true">正确</el-radio>
            <el-radio label="false">错误</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="参考答案" prop="answer" v-if="form.type === 'essay'">
          <el-input v-model="form.answer" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="解析">
          <el-input v-model="form.analysis" type="textarea" :rows="3" placeholder="选填，答案解析" />
        </el-form-item>
        <el-form-item label="难度">
          <el-rate v-model="form.difficulty" :max="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getQuestionList, createQuestion, updateQuestion, deleteQuestion } from '@/api/question'

const loading = ref(false)
const tableData = ref([])
const searchForm = reactive({ type: '', keyword: '' })
const pagination = reactive({ page: 1, size: 10, total: 0 })

const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const form = reactive({
  id: null, type: 'single', content: '', options: [], answer: '', analysis: '', difficulty: 1
})
const rules = {
  type: [{ required: true }],
  content: [{ required: true, message: '请输入题目内容', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  const res = await getQuestionList({ ...searchForm, ...pagination })
  tableData.value = res.list
  pagination.total = res.total
  loading.value = false
}

const handleAdd = () => {
  isEdit.value = false
  Object.assign(form, { id: null, type: 'single', content: '', options: [], answer: '', analysis: '', difficulty: 1 })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  isEdit.value = true
  Object.assign(form, JSON.parse(JSON.stringify(row)))
  dialogVisible.value = true
}

const handleSubmit = async () => {
  await formRef.value.validate()
  if (isEdit.value) {
    await updateQuestion(form)
  } else {
    await createQuestion(form)
  }
  ElMessage.success('保存成功')
  dialogVisible.value = false
  loadData()
}

const handleDelete = async (row) => {
  await ElMessageBox.confirm('确认删除该题目？', '提示', { type: 'warning' })
  await deleteQuestion(row.id)
  ElMessage.success('删除成功')
  loadData()
}

const handleView = (row) => {
  ElMessage.info(`预览题目 ID: ${row.id}`)
}

onMounted(loadData)
</script>
