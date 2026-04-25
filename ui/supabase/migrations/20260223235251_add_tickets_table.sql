/*
  # Add Tickets Table

  1. New Tables
    - `tickets`
      - `ticket_id` (uuid, primary key)
      - `incident_id` (uuid) - reference to incidents
      - `client_id` (integer) - for multi-tenancy
      - `title` (text)
      - `description` (text)
      - `status` (text)
      - `priority` (text)
      - `assigned_to` (text)
      - `created_by` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on tickets
    - Add policies for anonymous and authenticated access
*/

CREATE TABLE IF NOT EXISTS tickets (
  ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid,
  client_id integer,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to tickets"
  ON tickets FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to tickets"
  ON tickets FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read access to tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);
