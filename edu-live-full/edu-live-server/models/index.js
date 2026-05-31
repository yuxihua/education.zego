/**
 * 数据库模型入口
 * 统一导出所有模型和 Sequelize 实例
 */
const sequelize = require('../config/database');

// 导入模型
const User = require('./User');
const Student = require('./Student');
const Course = require('./Course');
const Order = require('./Order');
const LiveRoom = require('./LiveRoom');
const PPTFile = require('./PPTFile');
const Homework = require('./Homework');
const Question = require('./Question');
const DistributionConfig = require('./DistributionConfig');
const DistributionSettlement = require('./DistributionSettlement');
const OperationLog = require('./OperationLog');

// ========== 定义模型关联关系 ==========

// 用户（机构）- 课程：一对多
User.hasMany(Course, { foreignKey: 'institutionId', as: 'courses' });
Course.belongsTo(User, { foreignKey: 'institutionId', as: 'institution' });

// 课程 - 直播间：一对一
Course.hasOne(LiveRoom, { foreignKey: 'courseId', as: 'liveRoom' });
LiveRoom.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// 学生 - 课程：多对多（通过订单）
Student.belongsToMany(Course, { 
  through: Order, 
  foreignKey: 'studentId', 
  otherKey: 'courseId',
  as: 'purchasedCourses' 
});
Course.belongsToMany(Student, { 
  through: Order, 
  foreignKey: 'courseId', 
  otherKey: 'studentId',
  as: 'students' 
});

// 学生 - 订单：一对多
Student.hasMany(Order, { foreignKey: 'studentId', as: 'orders' });
Order.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// 课程 - 订单：一对多
Course.hasMany(Order, { foreignKey: 'courseId', as: 'orders' });
Order.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// 直播间 - PPT文件：一对多
LiveRoom.hasMany(PPTFile, { foreignKey: 'roomId', as: 'pptFiles' });
PPTFile.belongsTo(LiveRoom, { foreignKey: 'roomId', as: 'room' });

// 课程 - 作业：一对多
Course.hasMany(Homework, { foreignKey: 'courseId', as: 'homeworks' });
Homework.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// 学生 - 作业：一对多（提交记录）
Student.hasMany(Homework, { foreignKey: 'studentId', as: 'submissions' });
Homework.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// 销售 - 学员：一对多
User.hasMany(Student, { foreignKey: 'salesUserId', as: 'salesStudents' });
Student.belongsTo(User, { foreignKey: 'salesUserId', as: 'salesUser' });

// 用户 - 操作日志：一对多
User.hasMany(OperationLog, { foreignKey: 'userId', as: 'operationLogs' });
OperationLog.belongsTo(User, { foreignKey: 'userId', as: 'operator' });

// 题库：独立模块


// 同步数据库（开发环境使用）
// sequelize.sync({ alter: true });

module.exports = {
  sequelize,
  User,
  Student,
  Course,
  Order,
  LiveRoom,
  PPTFile,
  Homework,
  Question,
  DistributionConfig,
  DistributionSettlement,
  OperationLog
};
