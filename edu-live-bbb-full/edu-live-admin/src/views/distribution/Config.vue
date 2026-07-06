<template>
  <div class="distribution-config-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>三级提成配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-table :data="configList" border v-loading="loading">
        <el-table-column prop="level" label="层级" width="90">
          <template #default="{ row }">{{ row.level }}级</template>
        </el-table-column>
        <el-table-column label="阈值（团队月销量）" width="220">
          <template #default="{ row }">
            <el-input-number v-model="row.tierThreshold" :min="0" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="第一档比例" width="200">
          <template #default="{ row }">
            <el-input-number v-model="row.rateTier1" :min="0" :max="1" :step="0.001" :precision="4" controls-position="right" />
          </template>
        </el-table-column>
        <el-table-column label="第二档比例" width="200">
          <template #default="{ row }">
            <el-input-number v-model="row.rateTier2" :min="0" :max="1" :step="0.001" :precision="4" controls-position="right" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getDistributionConfig, saveDistributionConfig } from '@/api/distribution'

const loading = ref(false)
const configList = ref([])

const loadConfig = async () => {
  loading.value = true
  try {
    configList.value = await getDistributionConfig({})
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  await saveDistributionConfig({ configs: configList.value })
  ElMessage.success('分销提成配置已保存')
  await loadConfig()
}

onMounted(loadConfig)
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
