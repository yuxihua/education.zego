<template>
  <el-container class="admin-layout">
    <el-aside v-if="!isImmersivePage" width="220px" class="sidebar">
      <div class="logo">
        <el-icon size="28" color="#fff"><School /></el-icon>
        <span>教培直播后台</span>
      </div>
      <Sidebar />
    </el-aside>
    <el-container>
      <el-header v-if="!isImmersivePage" class="header">
        <div class="header-left">
          <breadcrumb />
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              {{ userStore.userInfo?.nickname || userStore.userInfo?.username }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content" :class="{ immersive: isImmersivePage }">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import Sidebar from '@/components/Sidebar.vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const isImmersivePage = computed(() => route.path.startsWith('/teacher/live-push/'))

const handleCommand = (cmd) => {
  if (cmd === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped lang="scss">
.admin-layout { height: 100vh; }
.sidebar { background: #001529; color: #fff; }
.logo { height: 64px; display: flex; align-items: center; padding: 0 20px; gap: 12px; font-size: 18px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1); }
.header { background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: space-between; z-index: 10; }
.user-info { cursor: pointer; display: flex; align-items: center; gap: 6px; }
.main-content { padding: 20px; overflow-y: auto; }
.main-content.immersive { padding: 0; overflow: hidden; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
