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
    path: '/student-login',
    name: 'StudentLogin',
    component: () => import('@/views/student-portal/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/student-center',
    name: 'StudentCenter',
    component: () => import('@/views/student-portal/Center.vue'),
    meta: { public: true, studentAuth: true }
  },
  {
    path: '/pay/result',
    name: 'StudentPayResult',
    component: () => import('@/views/student-portal/PayResult.vue'),
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
        meta: { title: '数据大盘', icon: 'Odometer', permission: 'dashboard.view' }
      },
      {
        path: 'course',
        name: 'Course',
        component: () => import('@/views/course/Index.vue'),
        meta: { title: '课程管理', icon: 'Reading', permission: 'course.manage' }
      },
      {
        path: 'live',
        name: 'Live',
        component: () => import('@/views/live/Index.vue'),
        meta: { title: '直播管理', icon: 'VideoCamera', permission: 'live.manage' }
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
        meta: { title: '题库管理', icon: 'Collection', permission: 'question.manage' }
      },
      {
        path: 'homework',
        name: 'Homework',
        component: () => import('@/views/homework/Index.vue'),
        meta: { title: '作业管理', icon: 'DocumentChecked', permission: 'homework.manage' }
      },
      {
        path: 'student',
        name: 'Student',
        component: () => import('@/views/student/Index.vue'),
        meta: { title: '学员管理', icon: 'User', permission: 'student.manage' }
      },
      {
        path: 'order',
        name: 'Order',
        component: () => import('@/views/order/Index.vue'),
        meta: { title: '订单财务', icon: 'Money', permission: 'order.manage' }
      },
      {
        path: 'distribution',
        redirect: '/distribution/orders',
        meta: { hidden: true }
      },
      {
        path: 'distribution/orders',
        name: 'DistributionOrders',
        component: () => import('@/views/distribution/Orders.vue'),
        meta: { title: '分销订单结算', icon: 'Money', roles: ['superadmin', 'admin', 'sales'], permission: 'distribution.orders.view' }
      },
      {
        path: 'distribution/config',
        name: 'DistributionConfig',
        component: () => import('@/views/distribution/Config.vue'),
        meta: { title: '分销提成配置', icon: 'Setting', roles: ['superadmin', 'admin'], permission: 'distribution.config.manage' }
      },
      {
        path: 'distribution/hierarchy',
        name: 'DistributionHierarchy',
        component: () => import('@/views/distribution/Hierarchy.vue'),
        meta: { title: '分销层级关系', icon: 'Connection', roles: ['superadmin', 'admin', 'sales'], permission: 'distribution.hierarchy.view' }
      },
      {
        path: 'distribution/assignment',
        name: 'DistributionAssignment',
        component: () => import('@/views/distribution/Assignment.vue'),
        meta: { title: '分销归属管理', icon: 'UserFilled', roles: ['superadmin', 'admin'], permission: 'distribution.assignment.manage' }
      },
      {
        path: 'checkin',
        name: 'Checkin',
        component: () => import('@/views/checkin/Index.vue'),
        meta: { title: '打卡管理', icon: 'Calendar', permission: 'checkin.manage' }
      },
      {
        path: 'platform/institution',
        name: 'Institution',
        component: () => import('@/views/platform/Institution.vue'),
        meta: { title: '机构管理', icon: 'OfficeBuilding', platformOnly: true, permission: 'platform.institution.manage' }
      },
      {
        path: 'platform/audit',
        name: 'Audit',
        component: () => import('@/views/platform/Audit.vue'),
        meta: { title: '审核中心', icon: 'Stamp', platformOnly: true, permission: 'platform.audit.manage' }
      },
      {
        path: 'platform/resource/classroom',
        name: 'PlatformResourceClassroom',
        component: () => import('@/views/platform/resource/Classroom.vue'),
        meta: { title: '教学楼/教室', icon: 'School', permission: 'platform.resource.manage' }
      },
      {
        path: 'platform/resource/teacher',
        name: 'PlatformResourceTeacher',
        component: () => import('@/views/platform/resource/Teacher.vue'),
        meta: { title: '讲师管理', icon: 'UserFilled', permission: 'platform.resource.manage' }
      },
      {
        path: 'platform/resource/schedule',
        name: 'PlatformResourceSchedule',
        component: () => import('@/views/platform/resource/Schedule.vue'),
        meta: { title: '排课管理', icon: 'Calendar', permission: 'platform.resource.manage' }
      },
      {
        path: 'system/account',
        name: 'SystemAccount',
        component: () => import('@/views/system/Account.vue'),
        meta: { title: '系统账号', icon: 'UserFilled', roles: ['superadmin', 'admin'], permission: 'system.account.manage' }
      },
      {
        path: 'system/operation-log',
        name: 'SystemOperationLog',
        component: () => import('@/views/system/OperationLog.vue'),
        meta: { title: '操作日志', icon: 'Document', roles: ['superadmin', 'admin'], permission: 'system.log.view' }
      },
      {
        path: 'system/permission',
        name: 'SystemPermission',
        component: () => import('@/views/system/Permission.vue'),
        meta: { title: '角色权限', icon: 'Lock', roles: ['superadmin', 'admin'], permission: 'system.permission.manage' }
      }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const studentToken = localStorage.getItem('student_token')

  if (to.meta.studentAuth && !studentToken) {
    next('/student-login')
    return
  }

  if (!to.meta.public && !userStore.token) {
    next('/login')
  } else {
    if (!to.meta.public && !to.meta.studentAuth && to.meta.permission) {
      if (!userStore.permissions?.includes(to.meta.permission)) {
        next('/dashboard')
        return
      }
    }
    next()
  }
})

export default router
