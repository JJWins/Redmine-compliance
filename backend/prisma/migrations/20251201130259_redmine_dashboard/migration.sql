-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `redmine_user_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `manager_id` VARCHAR(191) NULL,
    `role` ENUM('user', 'manager', 'admin') NOT NULL DEFAULT 'user',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_synced_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_redmine_user_id_key`(`redmine_user_id`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_redmine_user_id_idx`(`redmine_user_id`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_manager_id_idx`(`manager_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projects` (
    `id` VARCHAR(191) NOT NULL,
    `redmine_project_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `manager_id` VARCHAR(191) NULL,
    `status` ENUM('active', 'archived', 'closed') NOT NULL DEFAULT 'active',
    `estimated_hours` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_synced_at` DATETIME(3) NULL,

    UNIQUE INDEX `projects_redmine_project_id_key`(`redmine_project_id`),
    INDEX `projects_redmine_project_id_idx`(`redmine_project_id`),
    INDEX `projects_parent_id_idx`(`parent_id`),
    INDEX `projects_manager_id_idx`(`manager_id`),
    INDEX `projects_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issues` (
    `id` VARCHAR(191) NOT NULL,
    `redmine_issue_id` INTEGER NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `assigned_to_id` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `estimated_hours` DECIMAL(10, 2) NULL,
    `due_date` DATE NULL,
    `status` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_synced_at` DATETIME(3) NULL,

    UNIQUE INDEX `issues_redmine_issue_id_key`(`redmine_issue_id`),
    INDEX `issues_redmine_issue_id_idx`(`redmine_issue_id`),
    INDEX `issues_project_id_idx`(`project_id`),
    INDEX `issues_assigned_to_id_idx`(`assigned_to_id`),
    INDEX `issues_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_entries` (
    `id` VARCHAR(191) NOT NULL,
    `redmine_time_entry_id` INTEGER NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `issue_id` VARCHAR(191) NULL,
    `hours` DECIMAL(10, 2) NOT NULL,
    `spent_on` DATE NOT NULL,
    `created_on` DATETIME(3) NOT NULL,
    `comments` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `time_entries_redmine_time_entry_id_key`(`redmine_time_entry_id`),
    INDEX `time_entries_redmine_time_entry_id_idx`(`redmine_time_entry_id`),
    INDEX `time_entries_user_id_idx`(`user_id`),
    INDEX `time_entries_project_id_idx`(`project_id`),
    INDEX `time_entries_issue_id_idx`(`issue_id`),
    INDEX `time_entries_spent_on_idx`(`spent_on`),
    INDEX `time_entries_created_on_idx`(`created_on`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compliance_violations` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `violation_type` ENUM('missing_entry', 'bulk_logging', 'late_entry', 'round_numbers', 'stale_task', 'overrun_task') NOT NULL,
    `date` DATE NOT NULL,
    `severity` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    `status` ENUM('open', 'resolved', 'ignored') NOT NULL DEFAULT 'open',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,

    INDEX `compliance_violations_user_id_idx`(`user_id`),
    INDEX `compliance_violations_date_idx`(`date`),
    INDEX `compliance_violations_violation_type_idx`(`violation_type`),
    INDEX `compliance_violations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manager_scorecards` (
    `id` VARCHAR(191) NOT NULL,
    `manager_id` VARCHAR(191) NOT NULL,
    `period` DATE NOT NULL,
    `compliance_rate` DECIMAL(5, 2) NOT NULL,
    `health_score` DECIMAL(5, 2) NOT NULL,
    `team_size` INTEGER NOT NULL,
    `violations_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `manager_scorecards_manager_id_idx`(`manager_id`),
    INDEX `manager_scorecards_period_idx`(`period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_config` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(191) NULL,

    UNIQUE INDEX `system_config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` VARCHAR(191) NOT NULL,
    `sync_type` ENUM('full', 'incremental') NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `records_synced` INTEGER NOT NULL,
    `status` ENUM('success', 'failed', 'partial') NOT NULL,
    `error_message` TEXT NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `sync_logs_sync_type_idx`(`sync_type`),
    INDEX `sync_logs_entity_type_idx`(`entity_type`),
    INDEX `sync_logs_status_idx`(`status`),
    INDEX `sync_logs_started_at_idx`(`started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_state` (
    `id` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `last_sync_at` DATETIME(3) NOT NULL,
    `last_full_sync_at` DATETIME(3) NULL,
    `last_record_id` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sync_state_entity_type_key`(`entity_type`),
    INDEX `sync_state_entity_type_idx`(`entity_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `projects` ADD CONSTRAINT `projects_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issues` ADD CONSTRAINT `issues_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_issue_id_fkey` FOREIGN KEY (`issue_id`) REFERENCES `issues`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compliance_violations` ADD CONSTRAINT `compliance_violations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manager_scorecards` ADD CONSTRAINT `manager_scorecards_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
