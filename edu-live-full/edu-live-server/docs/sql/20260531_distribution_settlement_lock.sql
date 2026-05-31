-- 分销月度结算锁定快照表

CREATE TABLE IF NOT EXISTS `distribution_settlements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `institution_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '机构ID',
  `month_key` VARCHAR(7) NOT NULL COMMENT '结算月份，格式 YYYY-MM',
  `is_locked` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否锁定',
  `lock_by_user_id` BIGINT UNSIGNED NULL COMMENT '锁定操作人ID',
  `lock_at` DATETIME NULL COMMENT '锁定时间',
  `snapshot_data` JSON NULL COMMENT '锁定时的明细快照',
  `summary_data` JSON NULL COMMENT '锁定时的汇总快照',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_distribution_settlement_month` (`institution_id`, `month_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分销月度结算锁定';
