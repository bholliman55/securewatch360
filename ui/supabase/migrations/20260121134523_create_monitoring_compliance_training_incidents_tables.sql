/*
  # Create Monitoring, Compliance, Training, and Incidents Tables

  ## New Tables

  ### 1. monitoring_checks
  - `id` (uuid, primary key)
  - `check_name` (text) - Name of the monitoring check
  - `check_type` (text) - Type: uptime, performance, security, logs
  - `target` (text) - What is being monitored
  - `status` (text) - Status: healthy, warning, critical, unknown
  - `last_check` (timestamptz) - When the check last ran
  - `response_time` (int) - Response time in milliseconds
  - `uptime_percentage` (numeric) - Uptime percentage
  - `details` (jsonb) - Additional check details
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. compliance_audits
  - `id` (uuid, primary key)
  - `framework` (text) - Compliance framework
  - `requirement` (text) - Specific requirement
  - `status` (text) - Status
  - `score` (numeric) - Compliance score
  - `evidence` (text) - Evidence
  - `last_audit` (timestamptz) - Last audit date
  - `next_audit` (timestamptz) - Next audit date
  - `owner` (text) - Responsible person
  - `notes` (text) - Notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. training_modules
  - `id` (uuid, primary key)
  - `title` (text) - Title
  - `category` (text) - Category
  - `description` (text) - Description
  - `duration_minutes` (int) - Duration
  - `completion_rate` (numeric) - Completion rate
  - `passing_score` (numeric) - Passing score
  - `status` (text) - Status
  - `total_enrolled` (int) - Total enrolled
  - `total_completed` (int) - Total completed
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. incidents
  - `id` (uuid, primary key)
  - `title` (text) - Title
  - `severity` (text) - Severity
  - `status` (text) - Status
  - `category` (text) - Category
  - `description` (text) - Description
  - `affected_systems` (text[]) - Affected systems
  - `detected_at` (timestamptz) - Detection time
  - `resolved_at` (timestamptz) - Resolution time
  - `assigned_to` (text) - Assignee
  - `impact` (text) - Impact
  - `response_actions` (text) - Actions taken
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Add policies for anonymous read access
*/

CREATE TABLE IF NOT EXISTS monitoring_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_name text NOT NULL,
  check_type text NOT NULL,
  target text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  last_check timestamptz DEFAULT now(),
  response_time int DEFAULT 0,
  uptime_percentage numeric(5,2) DEFAULT 100.00,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework text NOT NULL,
  requirement text NOT NULL,
  status text NOT NULL DEFAULT 'not_applicable',
  score numeric(5,2) DEFAULT 0,
  evidence text DEFAULT '',
  last_audit timestamptz DEFAULT now(),
  next_audit timestamptz,
  owner text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  description text DEFAULT '',
  duration_minutes int DEFAULT 0,
  completion_rate numeric(5,2) DEFAULT 0,
  passing_score numeric(5,2) DEFAULT 80.00,
  status text NOT NULL DEFAULT 'active',
  total_enrolled int DEFAULT 0,
  total_completed int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  category text NOT NULL,
  description text DEFAULT '',
  affected_systems text[] DEFAULT ARRAY[]::text[],
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  assigned_to text DEFAULT '',
  impact text DEFAULT '',
  response_actions text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE monitoring_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read access to monitoring_checks"
  ON monitoring_checks FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to monitoring_checks"
  ON monitoring_checks FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to compliance_audits"
  ON compliance_audits FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to compliance_audits"
  ON compliance_audits FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to training_modules"
  ON training_modules FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to training_modules"
  ON training_modules FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous read access to incidents"
  ON incidents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous insert to incidents"
  ON incidents FOR INSERT
  TO anon
  WITH CHECK (true);