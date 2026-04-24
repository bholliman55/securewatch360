/*
  # Fix Scanner Table Policies for Anonymous Access

  1. Changes
    - Drop existing restrictive policies from scanner tables
    - Add simple anonymous access policies

  2. Tables Updated
    - vulnerabilities, scan_targets, scan_results
    - scan_findings_detail, vulnerability_scan_history, vulnerability_control_mappings
*/

-- Vulnerabilities
DROP POLICY IF EXISTS "Users can view vulnerabilities for their client" ON vulnerabilities;
DROP POLICY IF EXISTS "Users can insert vulnerabilities for their client" ON vulnerabilities;
DROP POLICY IF EXISTS "Users can update vulnerabilities for their client" ON vulnerabilities;
DROP POLICY IF EXISTS "Users can delete vulnerabilities for their client" ON vulnerabilities;

CREATE POLICY "Allow anon read vulnerabilities" ON vulnerabilities FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert vulnerabilities" ON vulnerabilities FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update vulnerabilities" ON vulnerabilities FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete vulnerabilities" ON vulnerabilities FOR DELETE TO anon USING (true);

-- Scan targets
CREATE POLICY "Allow anon read scan_targets" ON scan_targets FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert scan_targets" ON scan_targets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update scan_targets" ON scan_targets FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete scan_targets" ON scan_targets FOR DELETE TO anon USING (true);

-- Scan results
CREATE POLICY "Allow anon read scan_results" ON scan_results FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert scan_results" ON scan_results FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update scan_results" ON scan_results FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete scan_results" ON scan_results FOR DELETE TO anon USING (true);

-- Scan findings detail
CREATE POLICY "Allow anon read scan_findings_detail" ON scan_findings_detail FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert scan_findings_detail" ON scan_findings_detail FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update scan_findings_detail" ON scan_findings_detail FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete scan_findings_detail" ON scan_findings_detail FOR DELETE TO anon USING (true);

-- Vulnerability scan history
CREATE POLICY "Allow anon read vulnerability_scan_history" ON vulnerability_scan_history FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert vulnerability_scan_history" ON vulnerability_scan_history FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update vulnerability_scan_history" ON vulnerability_scan_history FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete vulnerability_scan_history" ON vulnerability_scan_history FOR DELETE TO anon USING (true);

-- Vulnerability control mappings
CREATE POLICY "Allow anon read vulnerability_control_mappings" ON vulnerability_control_mappings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert vulnerability_control_mappings" ON vulnerability_control_mappings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update vulnerability_control_mappings" ON vulnerability_control_mappings FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete vulnerability_control_mappings" ON vulnerability_control_mappings FOR DELETE TO anon USING (true);
