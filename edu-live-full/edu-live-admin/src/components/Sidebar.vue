<template>
  <el-menu
    :default-active="route.path"
    router
    background-color="#001529"
    text-color="#bfcbd9"
    active-text-color="#409EFF"
    :collapse-transition="false"
  >
    <template v-for="item in menuList" :key="item.path">
      <el-menu-item :index="item.path" v-if="!item.meta?.hidden">
        <el-icon><component :is="item.meta?.icon" /></el-icon>
        <template #title>{{ item.meta?.title }}</template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { routes } from '@/router'

const route = useRoute()
const userStore = useUserStore()

const menuList = computed(() => {
  const adminRoutes = routes.find(r => r.path === '/')?.children || []
  return adminRoutes.filter(r => {
    if (r.meta?.hidden) return false
    if (r.meta?.platformOnly && !userStore.isPlatformAdmin) return false
    if (r.meta?.roles?.length && !r.meta.roles.includes(userStore.userInfo?.role)) return false
    return true
  })
})
</script>

<style scoped>
.el-menu { border-right: none; }
</style>
