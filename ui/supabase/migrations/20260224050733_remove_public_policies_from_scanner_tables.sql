/*
  # Remove conflicting public role policies

  Removes duplicate policies that were created for the public role,
  keeping only authenticated user policies. Public users should not
  have access to scanner data.

  1. Removed Policies
    - All `public` role policies from `scan_results`, `vulnerabilities`, and `assets`
  
  2. Security Impact
    - Only authenticated users can access scanner tables
    - Eliminates policy conflicts that were preventing queries
*/

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view scan_results for their client or if admin" ON scan_results;
  DROP POLICY IF EXISTS "Users can update scan_results for their client or if admin" ON scan_results;
  DROP POLICY IF EXISTS "Users can delete scan_results for their client or if admin" ON scan_results;
  DROP POLICY IF EXISTS "Users can insert scan_results for their client" ON scan_results;
  
  DROP POLICY IF EXISTS "Users can view vulnerabilities for their client or if admin" ON vulnerabilities;
  DROP POLICY IF EXISTS "Users can update vulnerabilities for their client or if admin" ON vulnerabilities;
  DROP POLICY IF EXISTS "Users can delete vulnerabilities for their client or if admin" ON vulnerabilities;
  DROP POLICY IF EXISTS "Users can insert vulnerabilities for their client" ON vulnerabilities;
  
  DROP POLICY IF EXISTS "Users can view assets for their client" ON assets;
  DROP POLICY IF EXISTS "Users can update assets for their client" ON assets;
  DROP POLICY IF EXISTS "Users can delete assets for their client" ON assets;
  DROP POLICY IF EXISTS "Users can insert assets for their client" ON assets;
END $$;