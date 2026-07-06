<template>
  <div class="permission-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>角色权限管理</span>
          <el-button @click="loadData">刷新</el-button>
        </div>
      </template>

      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="角色">
          <el-select v-model="searchForm.role" placeholder="请选择" style="width: 180px">
            <el-option label="admin" value="admin" />
            <el-option label="teacher" value="teacher" />
            <el-option label="assistant" value="assistant" />
            <el-option label="sales" value="sales" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveRolePermissions">保存当前角色权限</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        title="说明：此配置按机构生效，修改后该角色重新登录即可按新权限控制菜单可见范围。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 12px"
      />

      <el-tree
        ref="permissionTreeRef"
        :data="treeData"
        node-key="key"
        show-checkbox
        default-expand-all
        :props="treeProps"
      />
    </el-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getRolePermissions, updateRolePermissions } from '@/api/permission'

const searchForm = reactive({ role: 'admin' })
const loading = ref(false)
const permissionTreeRef = ref()
const groups = ref([])
const rolePermissions = ref([])

const treeProps = { label: 'name', children: 'children' }

const treeData = computed(() => {
  return (groups.value || []).map((g) => ({
    key: `group:${g.key}`,
    name: g.name,
    children: (g.items || []).map((item) => ({
      key: item.key,
      name: item.name
    }))
  }))
})

const currentRolePermissionKeys = computed(() => {
  const row = (rolePermissions.value || []).find((r) => r.role === searchForm.role)
  return row?.permissions || []
})

const syncTreeChecked = async () => {
  await nextTick()
  permissionTreeRef.value?.setCheckedKeys(currentRolePermissionKeys.value)
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getRolePermissions({})
    groups.value = res.groups || []
    rolePermissions.value = res.rolePermissions || []
    await syncTreeChecked()
  } finally {
    loading.value = false
  }
}

const saveRolePermissions = async () => {
  const checked = permissionTreeRef.value?.getCheckedKeys(false) || []
  const permissionKeys = checked.filter((k) => typeof k === 'string' && !k.startsWith('group:'))
  await updateRolePermissions(searchForm.role, { permissions: permissionKeys })
  ElMessage.success('角色权限已保存')
  await loadData()
}

watch(() => searchForm.role, () => {
  syncTreeChecked()
})

onMounted(loadData)
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
