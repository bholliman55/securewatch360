/*
  # Add Multi-Tenancy Support with Client-Based Data Filtering

  1. Changes to Users Table
    - Add `client_id` column to users table (defaults to 1)
    - Client ID 99 represents admin users who can see all data across all clients
    - All other client IDs represent regular users who can only see their client's data

  2. Helper Functions
    - `get_user_client_id()` - Returns the current user's client_id
    - `is_admin()` - Returns true if user has client_id = 99

  3. Updated RLS Policies
    - Update all existing tables to filter by client_id
    - Admin users (client_id = 99) can view all data
    - Regular users can only view data for their assigned client
    - Tables affected: assets, vulnerabilities, scan_results, monitoring_checks, 
      compliance_audits, training_modules, incidents

  4. Security
    - Maintain existing authentication requirements
    - Add client-based data isolation
    - Ensure admins have full visibility
*/

-- Add client_id to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE users ADD COLUMN client_id integer DEFAULT 1 NOT NULL;
  END IF;
END $$;

-- Create helper function to get current user's client_id
CREATE OR REPLACE FUNCTION public.get_user_client_id()
RETURNS integer AS $$
  SELECT client_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create helper function to check if user is admin (client_id = 99)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE((SELECT client_id = 99 FROM public.users WHERE id = auth.uid()), false);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop existing policies and create new client-filtered policies for assets
DROP POLICY IF EXISTS "Authenticated users can view all assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can insert assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can update assets" ON assets;
DROP POLICY IF EXISTS "Authenticated users can delete assets" ON assets;

CREATE POLICY "Users can view assets for their client"
  ON assets
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert assets for their client"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update assets for their client"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can delete assets for their client"
  ON assets
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

-- Drop existing policies and create new client-filtered policies for vulnerabilities
DROP POLICY IF EXISTS "Authenticated users can view all vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Authenticated users can insert vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Authenticated users can update vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Authenticated users can delete vulnerabilities" ON vulnerabilities;

CREATE POLICY "Users can view vulnerabilities for their client"
  ON vulnerabilities
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert vulnerabilities for their client"
  ON vulnerabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update vulnerabilities for their client"
  ON vulnerabilities
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can delete vulnerabilities for their client"
  ON vulnerabilities
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

-- Add client_id to monitoring_checks, compliance_audits, training_modules, incidents if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitoring_checks' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE monitoring_checks ADD COLUMN client_id integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_audits' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE compliance_audits ADD COLUMN client_id integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_modules' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE training_modules ADD COLUMN client_id integer DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidents' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE incidents ADD COLUMN client_id integer DEFAULT 1;
  END IF;
END $$;

-- Create client-filtered policies for monitoring_checks
CREATE POLICY "Users can view monitoring checks for their client"
  ON monitoring_checks
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert monitoring checks for their client"
  ON monitoring_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update monitoring checks for their client"
  ON monitoring_checks
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

-- Create client-filtered policies for compliance_audits
CREATE POLICY "Users can view compliance audits for their client"
  ON compliance_audits
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert compliance audits for their client"
  ON compliance_audits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update compliance audits for their client"
  ON compliance_audits
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

-- Create client-filtered policies for training_modules
CREATE POLICY "Users can view training modules for their client"
  ON training_modules
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert training modules for their client"
  ON training_modules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update training modules for their client"
  ON training_modules
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

-- Create client-filtered policies for incidents
CREATE POLICY "Users can view incidents for their client"
  ON incidents
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert incidents for their client"
  ON incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update incidents for their client"
  ON incidents
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

-- Drop and recreate policies for scan_results
DROP POLICY IF EXISTS "Allow authenticated read access to scan_results" ON scan_results;
DROP POLICY IF EXISTS "Allow authenticated insert access to scan_results" ON scan_results;
DROP POLICY IF EXISTS "Allow authenticated update access to scan_results" ON scan_results;

CREATE POLICY "Users can view scan results for their client"
  ON scan_results
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can insert scan results for their client"
  ON scan_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

CREATE POLICY "Users can update scan results for their client"
  ON scan_results
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR client_id = get_user_client_id()
  )
  WITH CHECK (
    is_admin() OR client_id = get_user_client_id()
  );

-- Update the handle_new_user function to set default client_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, client_id)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    COALESCE((new.raw_user_meta_data->>'client_id')::integer, 1)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
