-- 分销体系数据库变更

-- 1) users 角色枚举增加 sales
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('superadmin','admin','teacher','assistant','sales') NOT NULL DEFAULT 'admin' COMMENT '角色：超管/机构管理员/讲师/助教/销售';

-- 2) students 增加销售归属字段
ALTER TABLE `students`
  ADD COLUMN `sales_user_id` BIGINT UNSIGNED NULL COMMENT '所属销售人员ID' AFTER `institution_id`,
  ADD COLUMN `sales_level` TINYINT UNSIGNED NULL COMMENT '销售层级：1/2/3' AFTER `sales_user_id`;

CREATE INDEX `idx_students_sales_user_id` ON `students` (`sales_user_id`);
CREATE INDEX `idx_students_sales_level` ON `students` (`sales_level`);

-- 3) 分销提成配置表
CREATE TABLE IF NOT EXISTS `distribution_configs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '机构ID',
  `level` TINYINT UNSIGNED NOT NULL COMMENT '分销层级：1/2/3',
  `tier_threshold` INT UNSIGNED NOT NULL DEFAULT 30 COMMENT '月新增订单阈值（两档分界）',
  `rate_tier1` DECIMAL(5,4) NOT NULL DEFAULT 0.0500 COMMENT '第一档提成比例（0-1）',
  `rate_tier2` DECIMAL(5,4) NOT NULL DEFAULT 0.0800 COMMENT '第二档提成比例（0-1）',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_distribution_institution_level` (`institution_id`,`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分销提成配置';
