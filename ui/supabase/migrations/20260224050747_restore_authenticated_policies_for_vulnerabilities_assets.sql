/*
  # Restore authenticated policies for vulnerabilities and assets

  Restores the authenticated user policies for vulnerabilities and assets
  tables that were accidentally removed.

  1. Policies Added
    - Vulnerabilities: SELECT, INSERT, UPDATE policies for authenticated users
    - Assets: SELECT, INSERT, UPDATE policies for authenticated users
*/

CREATE POLICY "Users can view vulnerabilities for their client"
  ON vulnerabilities FOR SELECT
  TO authenticated
  USING (is_admin() OR (client_id = get_user_client_id()));

CREATE POLICY "Users can insert vulnerabilities for their client"
  ON vulnerabilities FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() OR (client_id = get_user_client_id()));

CREATE POLICY "Users can update vulnerabilities for their client"
  ON vulnerabilities FOR UPDATE
  TO authenticated
  USING (is_admin() OR (client_id = get_user_client_id()))
  WITH CHECK (is_admin() OR (client_id = get_user_client_id()));

CREATE POLICY "Users can view assets for their client"
  ON assets FOR SELECT
  TO authenticated
  USING (is_admin() OR (client_id = get_user_client_id()));

CREATE POLICY "Users can insert assets for their client"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() OR (client_id = get_user_client_id()));

CREATE POLICY "Users can update assets for their client"
  ON assets FOR UPDATE
  TO authenticated
  USING (is_admin() OR (client_id = get_user_client_id()))
  WITH CHECK (is_admin() OR (client_id = get_user_client_id()));