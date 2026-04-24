/*
  # Implement Multi-Tenant RLS Policies

  1. Changes
    - Create helper functions to get current user's client_id and check if admin
    - Update RLS policies for all tables to enforce multi-tenancy
    - Allow admins to see all data, regular users only see their client's data

  2. Helper Functions
    - get_user_client_id(): Returns the current user's client_id from users table
    - is_user_admin(): Returns true if the current user has 'admin' role

  3. Tables Updated
    - incidents, vulnerabilities, scan_targets, scan_results
    - scan_findings_detail, vulnerability_scan_history, vulnerability_control_mappings
    - monitoring_checks, compliance_audits, training_modules
*/

-- Create helper function to get user's client_id
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT client_id FROM public.users WHERE id = auth.uid();
$$;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.users WHERE id = auth.uid()), false);
$$;

-- Drop existing anonymous policies for incidents
DROP POLICY IF EXISTS "Allow anonymous read access to incidents" ON incidents;
DROP POLICY IF EXISTS "Allow anonymous insert to incidents" ON incidents;
DROP POLICY IF EXISTS "Allow anonymous update to incidents" ON incidents;
DROP POLICY IF EXISTS "Allow anonymous delete from incidents" ON incidents;

-- Create multi-tenant policies for incidents
CREATE POLICY "Users can view incidents for their client or if admin"
  ON incidents FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert incidents for their client"
  ON incidents FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update incidents for their client or if admin"
  ON incidents FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete incidents for their client or if admin"
  ON incidents FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Drop existing anonymous policies for vulnerabilities
DROP POLICY IF EXISTS "Allow anon read vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Allow anon insert vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Allow anon update vulnerabilities" ON vulnerabilities;
DROP POLICY IF EXISTS "Allow anon delete vulnerabilities" ON vulnerabilities;

-- Create multi-tenant policies for vulnerabilities
CREATE POLICY "Users can view vulnerabilities for their client or if admin"
  ON vulnerabilities FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert vulnerabilities for their client"
  ON vulnerabilities FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update vulnerabilities for their client or if admin"
  ON vulnerabilities FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete vulnerabilities for their client or if admin"
  ON vulnerabilities FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Drop existing anonymous policies for scan_targets
DROP POLICY IF EXISTS "Allow anon read scan_targets" ON scan_targets;
DROP POLICY IF EXISTS "Allow anon insert scan_targets" ON scan_targets;
DROP POLICY IF EXISTS "Allow anon update scan_targets" ON scan_targets;
DROP POLICY IF EXISTS "Allow anon delete scan_targets" ON scan_targets;

-- Create multi-tenant policies for scan_targets
CREATE POLICY "Users can view scan_targets for their client or if admin"
  ON scan_targets FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert scan_targets for their client"
  ON scan_targets FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update scan_targets for their client or if admin"
  ON scan_targets FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete scan_targets for their client or if admin"
  ON scan_targets FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Drop existing anonymous policies for scan_results
DROP POLICY IF EXISTS "Allow anon read scan_results" ON scan_results;
DROP POLICY IF EXISTS "Allow anon insert scan_results" ON scan_results;
DROP POLICY IF EXISTS "Allow anon update scan_results" ON scan_results;
DROP POLICY IF EXISTS "Allow anon delete scan_results" ON scan_results;

-- Create multi-tenant policies for scan_results
CREATE POLICY "Users can view scan_results for their client or if admin"
  ON scan_results FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert scan_results for their client"
  ON scan_results FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update scan_results for their client or if admin"
  ON scan_results FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete scan_results for their client or if admin"
  ON scan_results FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Drop existing anonymous policies for scan_findings_detail
DROP POLICY IF EXISTS "Allow anon read scan_findings_detail" ON scan_findings_detail;
DROP POLICY IF EXISTS "Allow anon insert scan_findings_detail" ON scan_findings_detail;
DROP POLICY IF EXISTS "Allow anon update scan_findings_detail" ON scan_findings_detail;
DROP POLICY IF EXISTS "Allow anon delete scan_findings_detail" ON scan_findings_detail;

-- Create multi-tenant policies for scan_findings_detail
CREATE POLICY "Users can view scan_findings_detail for their client or if admin"
  ON scan_findings_detail FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert scan_findings_detail for their client"
  ON scan_findings_detail FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update scan_findings_detail for their client or if admin"
  ON scan_findings_detail FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete scan_findings_detail for their client or if admin"
  ON scan_findings_detail FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Drop existing anonymous policies for vulnerability_scan_history
DROP POLICY IF EXISTS "Allow anon read vulnerability_scan_history" ON vulnerability_scan_history;
DROP POLICY IF EXISTS "Allow anon insert vulnerability_scan_history" ON vulnerability_scan_history;
DROP POLICY IF EXISTS "Allow anon update vulnerability_scan_history" ON vulnerability_scan_history;
DROP POLICY IF EXISTS "Allow anon delete vulnerability_scan_history" ON vulnerability_scan_history;

-- Create multi-tenant policies for vulnerability_scan_history (uses text client_id)
CREATE POLICY "Users can view vulnerability_scan_history for their client or if admin"
  ON vulnerability_scan_history FOR SELECT
  USING (
    client_id::integer = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert vulnerability_scan_history for their client"
  ON vulnerability_scan_history FOR INSERT
  WITH CHECK (
    client_id::integer = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update vulnerability_scan_history for their client or if admin"
  ON vulnerability_scan_history FOR UPDATE
  USING (
    client_id::integer = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id::integer = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete vulnerability_scan_history for their client or if admin"
  ON vulnerability_scan_history FOR DELETE
  USING (
    client_id::integer = get_user_client_id() OR is_user_admin()
  );

-- Drop existing anonymous policies for vulnerability_control_mappings
DROP POLICY IF EXISTS "Allow anon read vulnerability_control_mappings" ON vulnerability_control_mappings;
DROP POLICY IF EXISTS "Allow anon insert vulnerability_control_mappings" ON vulnerability_control_mappings;
DROP POLICY IF EXISTS "Allow anon update vulnerability_control_mappings" ON vulnerability_control_mappings;
DROP POLICY IF EXISTS "Allow anon delete vulnerability_control_mappings" ON vulnerability_control_mappings;

-- vulnerability_control_mappings doesn't have client_id, use vulnerability's client_id
CREATE POLICY "Users can view vulnerability_control_mappings for their client or if admin"
  ON vulnerability_control_mappings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vulnerabilities v 
      WHERE v.vulnerability_id = vulnerability_control_mappings.vulnerability_id 
      AND (v.client_id = get_user_client_id() OR is_user_admin())
    )
  );

CREATE POLICY "Users can insert vulnerability_control_mappings for their client"
  ON vulnerability_control_mappings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vulnerabilities v 
      WHERE v.vulnerability_id = vulnerability_control_mappings.vulnerability_id 
      AND (v.client_id = get_user_client_id() OR is_user_admin())
    )
  );

CREATE POLICY "Users can update vulnerability_control_mappings for their client or if admin"
  ON vulnerability_control_mappings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vulnerabilities v 
      WHERE v.vulnerability_id = vulnerability_control_mappings.vulnerability_id 
      AND (v.client_id = get_user_client_id() OR is_user_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vulnerabilities v 
      WHERE v.vulnerability_id = vulnerability_control_mappings.vulnerability_id 
      AND (v.client_id = get_user_client_id() OR is_user_admin())
    )
  );

CREATE POLICY "Users can delete vulnerability_control_mappings for their client or if admin"
  ON vulnerability_control_mappings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM vulnerabilities v 
      WHERE v.vulnerability_id = vulnerability_control_mappings.vulnerability_id 
      AND (v.client_id = get_user_client_id() OR is_user_admin())
    )
  );

-- Add policies for monitoring_checks
CREATE POLICY "Users can view monitoring_checks for their client or if admin"
  ON monitoring_checks FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert monitoring_checks for their client"
  ON monitoring_checks FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update monitoring_checks for their client or if admin"
  ON monitoring_checks FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete monitoring_checks for their client or if admin"
  ON monitoring_checks FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Add policies for compliance_audits
CREATE POLICY "Users can view compliance_audits for their client or if admin"
  ON compliance_audits FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert compliance_audits for their client"
  ON compliance_audits FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update compliance_audits for their client or if admin"
  ON compliance_audits FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete compliance_audits for their client or if admin"
  ON compliance_audits FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

-- Add policies for training_modules
CREATE POLICY "Users can view training_modules for their client or if admin"
  ON training_modules FOR SELECT
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can insert training_modules for their client"
  ON training_modules FOR INSERT
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can update training_modules for their client or if admin"
  ON training_modules FOR UPDATE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  )
  WITH CHECK (
    client_id = get_user_client_id() OR is_user_admin()
  );

CREATE POLICY "Users can delete training_modules for their client or if admin"
  ON training_modules FOR DELETE
  USING (
    client_id = get_user_client_id() OR is_user_admin()
  );
