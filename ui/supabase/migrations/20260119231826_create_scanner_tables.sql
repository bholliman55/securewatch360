/*
  # Create Scanner Agent Tables

  ## Overview
  This migration creates tables to support the Scanner Agent functionality,
  including scans, vulnerabilities, and assets management.

  ## New Tables
  
  ### `scans`
  Stores individual scan runs with their metadata and results
  - `id` (uuid, primary key) - Unique scan identifier
  - `scan_type` (text) - Type of scan (vulnerability, compliance, network, etc.)
  - `target` (text) - Target being scanned (IP, domain, asset name)
  - `status` (text) - Scan status (running, completed, failed)
  - `severity_summary` (jsonb) - Count of issues by severity
  - `vulnerabilities_found` (integer) - Total vulnerabilities found
  - `assets_scanned` (integer) - Number of assets scanned
  - `started_at` (timestamptz) - When scan started
  - `completed_at` (timestamptz) - When scan completed
  - `duration_seconds` (integer) - Scan duration
  - `created_at` (timestamptz) - Record creation timestamp
  
  ### `vulnerabilities`
  Stores individual vulnerabilities discovered during scans
  - `id` (uuid, primary key) - Unique vulnerability identifier
  - `scan_id` (uuid, foreign key) - Reference to parent scan
  - `cve_id` (text) - CVE identifier if applicable
  - `title` (text) - Vulnerability title
  - `description` (text) - Detailed description
  - `severity` (text) - Severity level (critical, high, medium, low, info)
  - `cvss_score` (numeric) - CVSS score (0-10)
  - `affected_asset` (text) - Asset affected by this vulnerability
  - `port` (integer) - Port number if applicable
  - `service` (text) - Service name if applicable
  - `remediation` (text) - Remediation guidance
  - `status` (text) - Vulnerability status (open, in_progress, resolved, ignored)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### `assets`
  Stores information about assets being monitored and scanned
  - `id` (uuid, primary key) - Unique asset identifier
  - `name` (text) - Asset name
  - `type` (text) - Asset type (server, workstation, network_device, application)
  - `ip_address` (text) - IP address
  - `hostname` (text) - Hostname/domain
  - `operating_system` (text) - OS information
  - `location` (text) - Physical or logical location
  - `criticality` (text) - Business criticality (critical, high, medium, low)
  - `last_scan_at` (timestamptz) - Last scan timestamp
  - `vulnerability_count` (integer) - Current open vulnerability count
  - `status` (text) - Asset status (active, inactive, retired)
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  
  1. Row Level Security (RLS)
    - Enable RLS on all tables
    - Allow authenticated users to read all scanner data
    - Allow authenticated users to insert/update scanner data
    - Production systems should implement more granular permissions

  2. Indexes
    - Index on scan status for filtering active scans
    - Index on vulnerability severity for quick filtering
    - Index on asset types and status
    - Index on foreign keys for join performance
*/

-- Create scans table
CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type text NOT NULL DEFAULT 'vulnerability',
  target text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  severity_summary jsonb DEFAULT '{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}'::jsonb,
  vulnerabilities_found integer DEFAULT 0,
  assets_scanned integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

-- Create vulnerabilities table
CREATE TABLE IF NOT EXISTS vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid REFERENCES scans(id) ON DELETE CASCADE,
  cve_id text,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  cvss_score numeric(3,1) CHECK (cvss_score >= 0 AND cvss_score <= 10),
  affected_asset text NOT NULL,
  port integer,
  service text,
  remediation text,
  status text DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'server',
  ip_address text,
  hostname text,
  operating_system text,
  location text,
  criticality text DEFAULT 'medium',
  last_scan_at timestamptz,
  vulnerability_count integer DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan_id ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_criticality ON assets(criticality);

-- Enable Row Level Security
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scans
CREATE POLICY "Authenticated users can view all scans"
  ON scans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert scans"
  ON scans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scans"
  ON scans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete scans"
  ON scans FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS policies for vulnerabilities
CREATE POLICY "Authenticated users can view all vulnerabilities"
  ON vulnerabilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert vulnerabilities"
  ON vulnerabilities FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update vulnerabilities"
  ON vulnerabilities FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete vulnerabilities"
  ON vulnerabilities FOR DELETE
  TO authenticated
  USING (true);

-- Create RLS policies for assets
CREATE POLICY "Authenticated users can view all assets"
  ON assets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete assets"
  ON assets FOR DELETE
  TO authenticated
  USING (true);

-- Insert sample data for demonstration
INSERT INTO assets (name, type, ip_address, hostname, operating_system, location, criticality, vulnerability_count, status)
VALUES
  ('Web Server 01', 'server', '192.168.1.100', 'web-01.company.com', 'Ubuntu 22.04 LTS', 'US-East DC', 'critical', 3, 'active'),
  ('Database Server', 'server', '192.168.1.101', 'db-primary.company.com', 'Ubuntu 20.04 LTS', 'US-East DC', 'critical', 1, 'active'),
  ('App Server 01', 'server', '192.168.1.102', 'app-01.company.com', 'CentOS 8', 'US-West DC', 'high', 5, 'active'),
  ('Load Balancer', 'network_device', '192.168.1.10', 'lb-01.company.com', 'Nginx Plus', 'US-East DC', 'critical', 0, 'active'),
  ('Dev Workstation', 'workstation', '192.168.2.50', 'dev-ws-01', 'Windows 11', 'Office', 'low', 2, 'active'),
  ('API Gateway', 'application', '192.168.1.105', 'api.company.com', 'Ubuntu 22.04 LTS', 'US-East DC', 'high', 1, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO scans (scan_type, target, status, severity_summary, vulnerabilities_found, assets_scanned, started_at, completed_at, duration_seconds)
VALUES
  ('vulnerability', 'Full Network Scan', 'completed', '{"critical": 2, "high": 5, "medium": 8, "low": 12, "info": 3}'::jsonb, 30, 6, now() - interval '2 hours', now() - interval '1.5 hours', 1800),
  ('compliance', 'PCI-DSS Audit', 'completed', '{"critical": 0, "high": 1, "medium": 3, "low": 2, "info": 5}'::jsonb, 11, 4, now() - interval '6 hours', now() - interval '5.5 hours', 1200),
  ('network', '192.168.1.0/24', 'completed', '{"critical": 1, "high": 2, "medium": 4, "low": 3, "info": 1}'::jsonb, 11, 6, now() - interval '12 hours', now() - interval '11.5 hours', 900),
  ('vulnerability', 'Web Application Scan', 'running', '{"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}'::jsonb, 0, 0, now() - interval '15 minutes', null, null),
  ('compliance', 'SOC 2 Assessment', 'completed', '{"critical": 0, "high": 2, "medium": 5, "low": 8, "info": 12}'::jsonb, 27, 6, now() - interval '1 day', now() - interval '23 hours', 2400)
ON CONFLICT DO NOTHING;

INSERT INTO vulnerabilities (scan_id, cve_id, title, description, severity, cvss_score, affected_asset, port, service, remediation, status)
SELECT 
  s.id,
  'CVE-2024-1234',
  'OpenSSL Remote Code Execution',
  'A critical vulnerability in OpenSSL allows remote attackers to execute arbitrary code.',
  'critical',
  9.8,
  'Web Server 01',
  443,
  'HTTPS',
  'Update OpenSSL to version 3.0.13 or later',
  'open'
FROM scans s WHERE s.target = 'Full Network Scan' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO vulnerabilities (scan_id, cve_id, title, description, severity, cvss_score, affected_asset, port, service, remediation, status)
SELECT 
  s.id,
  'CVE-2023-9876',
  'SQL Injection in Web Application',
  'SQL injection vulnerability found in login form allowing unauthorized database access.',
  'high',
  8.2,
  'Web Server 01',
  80,
  'HTTP',
  'Implement parameterized queries and input validation',
  'in_progress'
FROM scans s WHERE s.target = 'Full Network Scan' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO vulnerabilities (scan_id, cve_id, title, description, severity, cvss_score, affected_asset, port, service, remediation, status)
SELECT 
  s.id,
  null,
  'Weak SSL/TLS Configuration',
  'Server supports deprecated SSL protocols and weak cipher suites.',
  'medium',
  5.3,
  'App Server 01',
  443,
  'HTTPS',
  'Disable SSLv3 and TLS 1.0, enable only TLS 1.2 and 1.3',
  'open'
FROM scans s WHERE s.target = 'Full Network Scan' LIMIT 1
ON CONFLICT DO NOTHING;