-- AlterTable
-- Add must_change_password column to track if user needs to change password on next login
ALTER TABLE `users` ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false;
