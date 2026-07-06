-- 固定教室、讲师与排课管理 SQL

CREATE TABLE IF NOT EXISTS `classrooms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '教室名称',
  `location` VARCHAR(200) NULL COMMENT '所在位置',
  `capacity` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '容纳人数',
  `description` VARCHAR(500) NULL COMMENT '教室说明',
  `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属机构ID',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0禁用 1启用',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_classrooms_institution_id` (`institution_id`),
  KEY `idx_classrooms_status` (`status`),
  KEY `idx_classrooms_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='固定教室表';

CREATE TABLE IF NOT EXISTS `teaching_schedules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属机构ID',
  `classroom_id` BIGINT UNSIGNED NOT NULL COMMENT '教室ID',
  `teacher_id` BIGINT UNSIGNED NOT NULL COMMENT '讲师ID',
  `course_name` VARCHAR(200) NOT NULL COMMENT '排课课程名称',
  `start_time` DATETIME NOT NULL COMMENT '开始时间',
  `end_time` DATETIME NOT NULL COMMENT '结束时间',
  `remarks` VARCHAR(500) NULL COMMENT '备注',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0取消 1启用',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_teaching_schedules_institution_id` (`institution_id`),
  KEY `idx_teaching_schedules_classroom_id` (`classroom_id`),
  KEY `idx_teaching_schedules_teacher_id` (`teacher_id`),
  KEY `idx_teaching_schedules_start_time` (`start_time`),
  KEY `idx_teaching_schedules_end_time` (`end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='教室讲师排课表';
