-- Migration: Add OAuth columns for Google and Microsoft login
-- Date: 2025-12-22

-- Add Google OAuth ID column
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- Add Microsoft OAuth ID column
ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255) UNIQUE;

-- Create indexes for faster OAuth lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_microsoft_id ON users(microsoft_id) WHERE microsoft_id IS NOT NULL;
