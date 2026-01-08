-- AlterTable
ALTER TABLE `compliance_violations` MODIFY COLUMN `violation_type` ENUM('missing_entry', 'bulk_logging', 'late_entry', 'round_numbers', 'stale_task', 'overrun_task', 'partial_entry') NOT NULL;

