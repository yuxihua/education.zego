-- 系统账号管理与操作日志 SQL

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '机构ID',
  `user_id` BIGINT UNSIGNED NULL COMMENT '操作人ID',
  `username` VARCHAR(50) NULL COMMENT '操作人账号',
  `role` VARCHAR(20) NULL COMMENT '操作人角色',
  `method` VARCHAR(10) NOT NULL COMMENT 'HTTP方法',
  `path` VARCHAR(255) NOT NULL COMMENT '请求路径',
  `ip` VARCHAR(64) NULL COMMENT '请求IP',
  `user_agent` VARCHAR(255) NULL COMMENT '用户代理',
  `request_body` JSON NULL COMMENT '请求参数（脱敏）',
  `status_code` INT UNSIGNED NOT NULL COMMENT '响应状态码',
  `success` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否成功',
  `message` VARCHAR(255) NULL COMMENT '响应消息',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_operation_logs_institution_id` (`institution_id`),
  KEY `idx_operation_logs_user_id` (`user_id`),
  KEY `idx_operation_logs_path` (`path`),
  KEY `idx_operation_logs_method` (`method`),
  KEY `idx_operation_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统操作日志';

-- users 表已在历史脚本中增加 sales 角色，如未执行可参考：20260531_distribution_schema.sql
