-- 教学楼管理表
CREATE TABLE IF NOT EXISTS `teaching_buildings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL COMMENT '教学楼名称',
  `description` varchar(500) DEFAULT NULL COMMENT '说明',
  `institution_id` bigint unsigned NOT NULL DEFAULT '0' COMMENT '机构ID',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '0禁用 1启用',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_building_institution_name` (`institution_id`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教学楼';
