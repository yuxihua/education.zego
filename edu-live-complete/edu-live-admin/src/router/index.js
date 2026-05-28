import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

export const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Index.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/Index.vue'),
        meta: { title: '数据大盘', icon: 'Odometer' }
      },
      {
        path: 'course',
        name: 'Course',
        component: () => import('@/views/course/Index.vue'),
        meta: { title: '课程管理', icon: 'Reading' }
      },
      {
        path: 'live',
        name: 'Live',
        component: () => import('@/views/live/Index.vue'),
        meta: { title: '直播管理', icon: 'VideoCamera' }
      },
      {
        path: 'live/room/:id',
        name: 'LiveRoom',
        component: () => import('@/views/live/Room.vue'),
        meta: { title: '直播间详情', hidden: true }
      },
      {
        path: 'teacher/live-push/:id',
        name: 'LivePush',
        component: () => import('@/views/teacher/LivePush.vue'),
        meta: { title: '老师端直播', hidden: true }
      },
      {
        path: 'question',
        name: 'Question',
        component: () => import('@/views/question/Index.vue'),
        meta: { title: '题库管理', icon: 'Collection' }
      },
      {
        path: 'homework',
        name: 'Homework',
        component: () => import('@/views/homework/Index.vue'),
        meta: { title: '作业管理', icon: 'DocumentChecked' }
      },
      {
        path: 'student',
        name: 'Student',
        component: () => import('@/views/student/Index.vue'),
        meta: { title: '学员管理', icon: 'User' }
      },
      {
        path: 'order',
        name: 'Order',
        component: () => import('@/views/order/Index.vue'),
        meta: { title: '订单财务', icon: 'Money' }
      },
      {
        path: 'checkin',
        name: 'Checkin',
        component: () => import('@/views/checkin/Index.vue'),
        meta: { title: '打卡管理', icon: 'Calendar' }
      },
      {
        path: 'platform/institution',
        name: 'Institution',
        component: () => import('@/views/platform/Institution.vue'),
        meta: { title: '机构管理', icon: 'OfficeBuilding', platformOnly: true }
      },
      {
        path: 'platform/audit',
        name: 'Audit',
        component: () => import('@/views/platform/Audit.vue'),
        meta: { title: '审核中心', icon: 'Stamp', platformOnly: true }
      }
    ]
  },
  {
    path: '/watch/:id',
    name: 'WatchLive',
    component: () => import('@/views/student/WatchLive.vue'),
    meta: { public: true, title: '观看直播' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  // 页面刷新后 Pinia 重置，从 localStorage 恢复 token
  if (!userStore.token) {
    const token = localStorage.getItem('token')
    if (token) {
      userStore.setToken(token)
      try {
        await userStore.fetchUserInfo()
      } catch (e) {
        userStore.logout()
      }
    }
  }
  if (!to.meta.public && !userStore.token) {
    next('/login')
  } else {
    next()
  }
})

export default router
