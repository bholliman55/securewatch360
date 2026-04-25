/*
  # Add Anonymous Read Policies for Scans, Vulnerabilities, and Assets
  
  1. Security Changes
    - Add SELECT policies for anonymous users on scans, vulnerabilities, and assets
    - This allows the dashboard to read data from n8n workflows without authentication
    - Makes policies consistent with other tables (monitoring, compliance, training, incidents)
  
  Note: Write operations still require authentication for these tables.
*/

-- Scans table
CREATE POLICY "Anonymous users can view all scans"
  ON scans FOR SELECT
  TO anon
  USING (true);

-- Vulnerabilities table
CREATE POLICY "Anonymous users can view all vulnerabilities"
  ON vulnerabilities FOR SELECT
  TO anon
  USING (true);

-- Assets table
CREATE POLICY "Anonymous users can view all assets"
  ON assets FOR SELECT
  TO anon
  USING (true);