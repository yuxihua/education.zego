/**
 * 订单模型
 */
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true
  },
  // 订单号
  orderNo: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    comment: '商户订单号 E(微信)/A(支付宝)开头'
  },
  // 学员ID
  studentId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '学员ID'
  },
  // 课程ID
  courseId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '课程ID'
  },
  // 机构ID
  institutionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    defaultValue: 0,
    comment: '机构ID'
  },
  // 订单金额
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '订单金额（元）'
  },
  // 支付类型
  payType: {
    type: DataTypes.ENUM('wxpay', 'alipay', 'free'),
    allowNull: false,
    comment: '支付方式：微信/支付宝/免费'
  },
  // 订单状态
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'refunding', 'refunded', 'cancelled', 'expired'),
    defaultValue: 'pending',
    comment: '状态：待支付/已支付/退款中/已退款/已取消/已过期'
  },
  // 微信/支付宝交易号
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '第三方支付流水号'
  },
  // 支付时间
  payTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '支付完成时间'
  },
  // 退款金额
  refundAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00,
    comment: '退款金额'
  },
  // 退款原因
  refundReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '退款原因'
  },
  // 退款时间
  refundTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '退款时间'
  },
  // 过期时间
  expireTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '订单过期时间'
  },
  // 用户备注
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '用户备注'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  indexes: [
    { fields: ['studentId'] },
    { fields: ['courseId'] },
    { fields: ['orderNo'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Order;
