/*
  # Fix Incidents Table Policies for Anonymous Access

  1. Changes
    - Drop existing restrictive policies that use app.current_client_id
    - Add simple anonymous access policies for all operations
    - Allow anonymous users to read, insert, update, and delete incidents

  2. Security
    - Enable RLS on incidents table
    - Add policies for anonymous access to support the application
*/

-- Drop existing policies
DROP POLICY IF EXISTS "incidents_select_policy" ON incidents;
DROP POLICY IF EXISTS "incidents_insert_policy" ON incidents;
DROP POLICY IF EXISTS "incidents_update_policy" ON incidents;
DROP POLICY IF EXISTS "incidents_delete_policy" ON incidents;

-- Allow anonymous read access
CREATE POLICY "Allow anonymous read access to incidents"
  ON incidents FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous insert
CREATE POLICY "Allow anonymous insert to incidents"
  ON incidents FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous update
CREATE POLICY "Allow anonymous update to incidents"
  ON incidents FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous delete
CREATE POLICY "Allow anonymous delete from incidents"
  ON incidents FOR DELETE
  TO anon
  USING (true);
