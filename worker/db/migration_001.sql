-- Migration: add soft-delete columns to messages
ALTER TABLE messages ADD COLUMN deleted_by_sender INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN deleted_by_receiver INTEGER NOT NULL DEFAULT 0;
