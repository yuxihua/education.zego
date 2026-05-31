/**
 * 角色权限定义
 */

const PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    name: '数据大盘',
    items: [{ key: 'dashboard.view', name: '查看数据大盘' }]
  },
  {
    key: 'course',
    name: '课程管理',
    items: [{ key: 'course.manage', name: '课程管理' }]
  },
  {
    key: 'live',
    name: '直播管理',
    items: [{ key: 'live.manage', name: '直播管理' }]
  },
  {
    key: 'question',
    name: '题库管理',
    items: [{ key: 'question.manage', name: '题库管理' }]
  },
  {
    key: 'homework',
    name: '作业管理',
    items: [{ key: 'homework.manage', name: '作业管理' }]
  },
  {
    key: 'student',
    name: '学员管理',
    items: [{ key: 'student.manage', name: '学员管理' }]
  },
  {
    key: 'order',
    name: '订单财务',
    items: [{ key: 'order.manage', name: '订单财务' }]
  },
  {
    key: 'checkin',
    name: '打卡管理',
    items: [{ key: 'checkin.manage', name: '打卡管理' }]
  },
  {
    key: 'distribution',
    name: '分销管理',
    items: [
      { key: 'distribution.orders.view', name: '分销订单结算' },
      { key: 'distribution.config.manage', name: '分销提成配置' },
      { key: 'distribution.hierarchy.view', name: '分销层级关系' },
      { key: 'distribution.assignment.manage', name: '分销归属管理' }
    ]
  },
  {
    key: 'platform',
    name: '平台管理',
    items: [
      { key: 'platform.institution.manage', name: '机构管理' },
      { key: 'platform.audit.manage', name: '审核中心' },
      { key: 'platform.resource.manage', name: '教室/讲师管理' }
    ]
  },
  {
    key: 'system',
    name: '系统管理',
    items: [
      { key: 'system.account.manage', name: '系统账号管理' },
      { key: 'system.log.view', name: '系统操作日志' },
      { key: 'system.permission.manage', name: '角色权限管理' }
    ]
  }
];

const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

const ROLE_DEFAULT_PERMISSIONS = {
  superadmin: ALL_PERMISSION_KEYS,
  admin: [
    'dashboard.view',
    'course.manage',
    'live.manage',
    'question.manage',
    'homework.manage',
    'student.manage',
    'order.manage',
    'checkin.manage',
    'distribution.orders.view',
    'distribution.config.manage',
    'distribution.hierarchy.view',
    'distribution.assignment.manage',
    'platform.resource.manage',
    'system.account.manage',
    'system.log.view',
    'system.permission.manage'
  ],
  teacher: ['dashboard.view', 'course.manage', 'live.manage', 'question.manage', 'homework.manage'],
  assistant: ['dashboard.view', 'student.manage', 'homework.manage', 'checkin.manage'],
  sales: ['dashboard.view', 'distribution.orders.view', 'distribution.hierarchy.view', 'order.manage']
};

module.exports = {
  PERMISSION_GROUPS,
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS
};
