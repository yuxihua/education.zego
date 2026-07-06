-- 学员密码登录 + 后台手工新增学员订单
-- 执行时间：2026-05-31

ALTER TABLE `students`
  ADD COLUMN IF NOT EXISTS `password` varchar(255) NULL COMMENT '学员登录密码（加密）' AFTER `phone`;

