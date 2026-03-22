-- Add device_id to auth_tokens for iOS cross-context login
ALTER TABLE auth_tokens ADD COLUMN device_id TEXT;
