-- 角色权限管理表

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '机构ID',
  `role` VARCHAR(30) NOT NULL COMMENT '角色',
  `permissions` JSON NOT NULL COMMENT '权限点集合',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_role_permissions` (`institution_id`, `role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色权限配置';
