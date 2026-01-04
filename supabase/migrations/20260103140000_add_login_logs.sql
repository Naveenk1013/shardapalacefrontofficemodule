-- Login Audit Logs Table
-- Run this migration to add login tracking

-- Create the login_logs table
CREATE TABLE IF NOT EXISTS login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_login_logs_login_time ON login_logs(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);

-- Enable Row Level Security
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view login logs
CREATE POLICY "All users can view login logs"
  ON login_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: System can insert login logs (using service role or authenticated)
CREATE POLICY "Authenticated users can insert login logs"
  ON login_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE login_logs IS 'Tracks all user logins to the PMS for accountability';
