/*
  # Update Airtable Credentials for Anonymous Use

  1. Changes
    - Drop existing RLS policies that require authentication
    - Make user_id nullable to support anonymous usage
    - Add new permissive policies for demo purposes
    - Create a default config row for single-user demo

  2. Security Notes
    - This is a simplified approach for demo/development
    - In production, proper authentication should be implemented
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own credentials" ON airtable_credentials;
DROP POLICY IF EXISTS "Users can update own credentials" ON airtable_credentials;
DROP POLICY IF EXISTS "Users can insert own credentials" ON airtable_credentials;
DROP POLICY IF EXISTS "Users can delete own credentials" ON airtable_credentials;

-- Make user_id nullable for anonymous use
ALTER TABLE airtable_credentials ALTER COLUMN user_id DROP NOT NULL;

-- Create permissive policies for demo use
CREATE POLICY "Allow all reads"
  ON airtable_credentials
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all updates"
  ON airtable_credentials
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all inserts"
  ON airtable_credentials
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all deletes"
  ON airtable_credentials
  FOR DELETE
  USING (true);

-- Insert a default row for single-user demo (if not exists)
INSERT INTO airtable_credentials (id, user_id, base_id, api_key, is_connected)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  NULL,
  '',
  '',
  false
)
ON CONFLICT (id) DO NOTHING;
