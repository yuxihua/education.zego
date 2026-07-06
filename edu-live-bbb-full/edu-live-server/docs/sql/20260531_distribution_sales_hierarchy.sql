-- 分销销售上下级关系与固定三级字段

ALTER TABLE `users`
  ADD COLUMN `sales_level` TINYINT UNSIGNED NULL COMMENT '销售层级：1/2/3' AFTER `institution_name`,
  ADD COLUMN `parent_sales_user_id` BIGINT UNSIGNED NULL COMMENT '上级销售用户ID' AFTER `sales_level`;

CREATE INDEX `idx_users_sales_level` ON `users` (`sales_level`);
CREATE INDEX `idx_users_parent_sales_user_id` ON `users` (`parent_sales_user_id`);

-- 可选：把现存销售账号默认归到一级（按需执行）
-- UPDATE `users` SET `sales_level` = 1 WHERE `role` = 'sales' AND `sales_level` IS NULL;
