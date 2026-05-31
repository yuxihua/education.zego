-- 题库多租户字段迁移（MySQL）
-- 执行前请先备份数据库

ALTER TABLE `questions`
  ADD COLUMN `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '所属机构ID' AFTER `category_name`;

CREATE INDEX `idx_questions_institution_id` ON `questions` (`institution_id`);

-- 可选：将历史题目归属到默认机构（0），如需批量归属到指定机构可按需执行
-- UPDATE `questions` SET `institution_id` = 1 WHERE `institution_id` = 0;
