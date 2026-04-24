import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

const distPath = join(__dirname, 'dist');
app.use(express.static(distPath));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const N8N_WEBHOOK_MAPPING = {
  'vulnerability':    process.env.N8N_WEBHOOK_AGENT_2,
  'penetration_test': process.env.N8N_WEBHOOK_AGENT_1,
  'web_application':  process.env.N8N_WEBHOOK_AGENT_1,
  'compliance':       process.env.N8N_WEBHOOK_AGENT_3,
  'network':          process.env.N8N_WEBHOOK_AGENT_2,
};

const errorResponse = (endpoint, scanResultId, message, statusCode = 500) => ({
  error: message,
  endpoint,
  scanResultId,
  timestamp: new Date().toISOString(),
  statusCode,
});

const validateTarget = (scanType, target) => {
  if (!target || target.trim() === '') {
    return 'Target cannot be empty';
  }

  if (scanType === 'vulnerability') {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d+)?$/;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const urlRegex = /^https?:\/\/.+/;

    const isValidIP = ipRegex.test(target);
    const isValidDomain = domainRegex.test(target);
    const isValidURL = urlRegex.test(target);

    if (!isValidIP && !isValidDomain && !isValidURL) {
      return 'For Vulnerability Scan, target must be a valid IP address, domain, or URL';
    }
  }

  return null;
};

const logRequest = (endpoint, scanType, target, scanResultId) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${endpoint} - scanType: ${scanType}, target: ${target}, scanResultId: ${scanResultId}`);
};

const logWebhookCall = (webhookUrl, payload) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Calling webhook: ${webhookUrl}`);
  console.log(`[${timestamp}] Webhook payload:`, JSON.stringify(payload, null, 2));
};

const logWebhookResponse = (webhookUrl, status, responseBody) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Webhook response from ${webhookUrl}: ${status}`);
  console.log(`[${timestamp}] Response body:`, JSON.stringify(responseBody, null, 2));
};

app.post('/api/run-scan', async (req, res) => {
  const { scanId, scanType, target, clientId } = req.body;
  const timestamp = new Date().toISOString();

  try {
    logRequest('/api/run-scan', scanType, target, scanId || null);

    if (!scanType || !target || clientId === undefined) {
      return res.status(400).json(
        errorResponse(
          '/api/run-scan',
          null,
          'Missing required fields: scanType, target, clientId',
          400
        )
      );
    }

    const validationError = validateTarget(scanType, target);
    if (validationError) {
      return res.status(400).json(
        errorResponse(
          '/api/run-scan',
          null,
          validationError,
          400
        )
      );
    }

    const webhookUrl = N8N_WEBHOOK_MAPPING[scanType];
    if (!webhookUrl) {
      return res.status(500).json(
        errorResponse(
          '/api/run-scan',
          null,
          `Webhook URL not configured for scanType: ${scanType}`,
          500
        )
      );
    }

    const payload = {
      scanId,
      scanType,
      target,
      clientId,
      timestamp,
    };

    logWebhookCall(webhookUrl, payload);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.json().catch(() => ({}));
      logWebhookResponse(webhookUrl, response.status, responseBody);

      if (!response.ok) {
        return res.status(500).json(
          errorResponse('/api/run-scan', null, `Webhook failed with status ${response.status}: ${JSON.stringify(responseBody)}`, 500)
        );
      }

      res.json({ success: true, scanType, target, timestamp });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`[${timestamp}] Webhook timeout:`, error.message);
        return res.status(504).json(
          errorResponse('/api/run-scan', null, 'Webhook timed out', 504)
        );
      }

      console.error(`[${timestamp}] Webhook call error:`, error);
      return res.status(500).json(
        errorResponse('/api/run-scan', null, `Webhook error: ${error.message}`, 500)
      );
    }
  } catch (error) {
    console.error(`[${timestamp}] Unexpected error in /api/run-scan:`, error);
    res.status(500).json(
      errorResponse('/api/run-scan', null, error.message, 500)
    );
  }
});

app.post('/api/scan-webhook-response', async (req, res) => {
  const {
    scanResultId,
    scanType,
    status,
    vulnerabilitiesFound,
    assetsScanned,
    durationSeconds,
    severitySummary,
    findings,
    clientId,
  } = req.body;
  const timestamp = new Date().toISOString();

  try {
    console.log(`[${timestamp}] /api/scan-webhook-response - scanResultId: ${scanResultId}, scanType: ${scanType}`);

    if (!scanResultId) {
      return res.status(400).json(
        errorResponse(
          '/api/scan-webhook-response',
          null,
          'Missing required field: scanResultId',
          400
        )
      );
    }

    const updatePayload = {
      status: status || 'completed',
      vulnerabilities_found: vulnerabilitiesFound || 0,
      assets_scanned: assetsScanned || 0,
      scan_duration_seconds: durationSeconds,
      severity_summary: severitySummary || {},
      completed_at: timestamp,
      updated_at: timestamp,
    };

    const { error: updateError } = await supabase
      .from('scan_results')
      .update(updatePayload)
      .eq('scan_results_id', scanResultId);

    if (updateError) {
      console.error(`[${timestamp}] scan_results update error:`, updateError);
      return res.status(500).json(
        errorResponse(
          '/api/scan-webhook-response',
          scanResultId,
          `Failed to update scan_results: ${updateError.message}`,
          500
        )
      );
    }

    let insertedCount = 0;
    let skippedCount = 0;

    if (Array.isArray(findings) && findings.length > 0) {
      for (const finding of findings) {
        if (!finding.title || finding.title.trim() === '') {
          skippedCount++;
          console.log(`[${timestamp}] Skipping finding with empty title`);
          continue;
        }

        const detectedDate = new Date().toISOString().split('T')[0];

        const findingPayload = {
          scan_result_id: scanResultId,
          client_id: clientId || 1,
          title: finding.title,
          description: finding.description || null,
          severity: finding.severity ? finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1).toLowerCase() : 'Low',
          cvss_score: finding.cvssScore || null,
          affected_asset: finding.affectedAsset || null,
          port_protocol: finding.port || null,
          cve_id: finding.cveId || null,
          remediation_steps: finding.remediation || null,
          status: 'Open',
          detected_date: detectedDate,
        };

        const { error: insertError } = await supabase
          .from('scan_findings_detail')
          .insert(findingPayload);

        if (insertError) {
          skippedCount++;
          console.error(`[${timestamp}] Failed to insert finding "${finding.title}":`, insertError);
          continue;
        }

        insertedCount++;
      }
    }

    res.json({
      success: true,
      scanResultId,
      findingsInserted: insertedCount,
      findingsSkipped: skippedCount,
      timestamp,
    });
  } catch (error) {
    console.error(`[${timestamp}] Unexpected error in /api/scan-webhook-response:`, error);
    res.status(500).json(
      errorResponse(
        '/api/scan-webhook-response',
        scanResultId || 'unknown',
        error.message,
        500
      )
    );
  }
});

app.get('/api/scan-status/:scanResultId', async (req, res) => {
  const { scanResultId } = req.params;
  const timestamp = new Date().toISOString();

  try {
    console.log(`[${timestamp}] /api/scan-status/:scanResultId - scanResultId: ${scanResultId}`);

    const { data, error } = await supabase
      .from('scan_results')
      .select('status, vulnerabilities_found, assets_scanned, scan_duration_seconds, severity_summary, started_at, completed_at')
      .eq('scan_results_id', scanResultId)
      .maybeSingle();

    if (error) {
      console.error(`[${timestamp}] Database query error:`, error);
      return res.status(500).json(
        errorResponse('/api/scan-status', scanResultId, `Database error: ${error.message}`, 500)
      );
    }

    if (!data) {
      return res.status(404).json(
        errorResponse('/api/scan-status', scanResultId, 'Scan result not found', 404)
      );
    }

    res.json({
      success: true,
      scanResultId,
      status: data.status,
      vulnerabilitiesFound: data.vulnerabilities_found,
      assetsScanned: data.assets_scanned,
      durationSeconds: data.scan_duration_seconds,
      severitySummary: data.severity_summary,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      timestamp,
    });
  } catch (error) {
    console.error(`[${timestamp}] Unexpected error in /api/scan-status:`, error);
    res.status(500).json(
      errorResponse('/api/scan-status', scanResultId, error.message, 500)
    );
  }
});

app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API Endpoints:');
  console.log('  POST /api/run-scan - Initiate a scan');
  console.log('  POST /api/scan-webhook-response - Receive scan results from n8n');
  console.log('  GET /api/scan-status/:scanResultId - Get scan status');
});
