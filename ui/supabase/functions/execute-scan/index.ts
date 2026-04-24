import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// `npm:` is resolved by Deno at deploy; the Vite/TS workspace does not model this module specifier.
// @ts-expect-error TS cannot resolve Deno npm specifier (see Supabase Edge Functions docs)
import { createClient } from "npm:@supabase/supabase-js@2";

/** Minimal Deno surface used here; avoids `Cannot find name 'Deno'` when the IDE uses the Vite TS project instead of Deno's lib. */
interface DenoEdgeRuntime {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
}

const edge = (globalThis as unknown as { Deno: DenoEdgeRuntime }).Deno;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getN8nWebhooks = () => ({
  'compliance': edge.env.get('N8N_WEBHOOK_AGENT_3') || 'https://blackstrawfarms.app.n8n.cloud/webhook/compliance-scan',
  'vulnerability': edge.env.get('N8N_WEBHOOK_AGENT_2') || 'https://blackstrawfarms.app.n8n.cloud/webhook/vuln-scan',
  'penetration_test': edge.env.get('N8N_WEBHOOK_AGENT_1') || 'https://blackstrawfarms.app.n8n.cloud/webhook/security-scanner-start',
  'web_application': edge.env.get('N8N_WEBHOOK_AGENT_1') || 'https://blackstrawfarms.app.n8n.cloud/webhook/security-scanner-start',
});

interface ScanRequest {
  scanId: string;
  scanType: string;
  target: string;
}

interface ScanPlugin {
  name: string;
  execute: (target: string) => Promise<ScanResult>;
}

interface ScanResult {
  vulnerabilities: VulnerabilityData[];
  assetsScanned: number;
  metadata?: Record<string, unknown>;
}

interface VulnerabilityData {
  cve_id?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cvss_score?: number;
  affected_asset: string;
  port?: number;
  service?: string;
  remediation: string;
}

async function dnsSecurityScan(target: string): Promise<ScanResult> {
  const vulnerabilities: VulnerabilityData[] = [];
  let assetsScanned = 0;

  try {
    const domain = target.replace(/^https?:\/\//, '').split('/')[0];

    const dnsTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS'];
    const results = await Promise.allSettled(
      dnsTypes.map(type =>
        fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=${type}`, {
          headers: { 'Accept': 'application/dns-json' }
        })
      )
    );

    assetsScanned = 1;

    const txtRecords = results[3];
    if (txtRecords.status === 'fulfilled') {
      const txtData = await txtRecords.value.json();
      const hasSPF = txtData.Answer?.some((r: { data: string }) => r.data.includes('v=spf1'));
      const hasDMARC = txtData.Answer?.some((r: { data: string }) => r.data.includes('v=DMARC1'));

      if (!hasSPF) {
        vulnerabilities.push({
          title: 'Missing SPF Record',
          description: 'No SPF record found. This allows email spoofing and phishing attacks using your domain.',
          severity: 'medium',
          cvss_score: 5.3,
          affected_asset: domain,
          service: 'DNS',
          remediation: 'Add an SPF record to your DNS: "v=spf1 include:_spf.google.com ~all"'
        });
      }

      if (!hasDMARC) {
        vulnerabilities.push({
          title: 'Missing DMARC Policy',
          description: 'No DMARC policy configured. Email authentication cannot be enforced.',
          severity: 'medium',
          cvss_score: 5.0,
          affected_asset: domain,
          service: 'DNS',
          remediation: 'Add a DMARC record: "_dmarc.yourdomain.com TXT v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com"'
        });
      }
    }

    const nsRecords = results[4];
    if (nsRecords.status === 'fulfilled') {
      const nsData = await nsRecords.value.json();
      if (!nsData.Answer || nsData.Answer.length < 2) {
        vulnerabilities.push({
          title: 'Insufficient DNS Redundancy',
          description: 'Only one nameserver configured. Single point of failure for DNS resolution.',
          severity: 'low',
          cvss_score: 3.1,
          affected_asset: domain,
          service: 'DNS',
          remediation: 'Configure at least 2 nameservers for redundancy'
        });
      }
    }

  } catch (error) {
    vulnerabilities.push({
      title: 'DNS Query Failed',
      description: `Unable to perform DNS security checks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'info',
      affected_asset: target,
      service: 'DNS',
      remediation: 'Verify domain is accessible and DNS is properly configured'
    });
  }

  return { vulnerabilities, assetsScanned };
}

async function sslTlsScan(target: string): Promise<ScanResult> {
  const vulnerabilities: VulnerabilityData[] = [];
  let assetsScanned = 0;

  try {
    const url = target.startsWith('http') ? target : `https://${target}`;
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    });

    assetsScanned = 1;

    const headers = response.headers;

    if (!headers.get('strict-transport-security')) {
      vulnerabilities.push({
        title: 'Missing HSTS Header',
        description: 'HTTP Strict Transport Security (HSTS) header not configured. Site vulnerable to SSL stripping attacks.',
        severity: 'medium',
        cvss_score: 5.9,
        affected_asset: hostname,
        port: 443,
        service: 'HTTPS',
        remediation: 'Add HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains'
      });
    }

    if (!headers.get('x-frame-options') && !headers.get('content-security-policy')?.includes('frame-ancestors')) {
      vulnerabilities.push({
        title: 'Missing Clickjacking Protection',
        description: 'No X-Frame-Options or CSP frame-ancestors directive found.',
        severity: 'medium',
        cvss_score: 4.3,
        affected_asset: hostname,
        port: 443,
        service: 'HTTPS',
        remediation: 'Add X-Frame-Options: DENY or Content-Security-Policy with frame-ancestors directive'
      });
    }

    if (!headers.get('x-content-type-options')) {
      vulnerabilities.push({
        title: 'Missing X-Content-Type-Options',
        description: 'MIME-sniffing vulnerabilities possible without X-Content-Type-Options header.',
        severity: 'low',
        cvss_score: 3.7,
        affected_asset: hostname,
        port: 443,
        service: 'HTTPS',
        remediation: 'Add X-Content-Type-Options: nosniff header'
      });
    }

    if (!headers.get('content-security-policy')) {
      vulnerabilities.push({
        title: 'Missing Content Security Policy',
        description: 'No CSP header detected. Site vulnerable to XSS and data injection attacks.',
        severity: 'high',
        cvss_score: 7.4,
        affected_asset: hostname,
        port: 443,
        service: 'HTTPS',
        remediation: 'Implement a Content-Security-Policy header with appropriate directives'
      });
    }

    const insecureResponse = await fetch(`http://${hostname}`, {
      method: 'HEAD',
      redirect: 'manual',
      signal: AbortSignal.timeout(5000)
    }).catch(() => null);

    if (insecureResponse && insecureResponse.status !== 301 && insecureResponse.status !== 302) {
      vulnerabilities.push({
        title: 'HTTP Accessible Without Redirect',
        description: 'Site accessible over HTTP without automatic redirect to HTTPS.',
        severity: 'high',
        cvss_score: 7.5,
        affected_asset: hostname,
        port: 80,
        service: 'HTTP',
        remediation: 'Configure server to redirect all HTTP traffic to HTTPS'
      });
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'TypeError' && error.message.includes('https')) {
      vulnerabilities.push({
        title: 'HTTPS Not Available',
        description: 'Target does not support HTTPS connections.',
        severity: 'critical',
        cvss_score: 9.3,
        affected_asset: target,
        port: 443,
        service: 'HTTPS',
        remediation: 'Install valid SSL/TLS certificate and enable HTTPS'
      });
      assetsScanned = 1;
    } else {
      vulnerabilities.push({
        title: 'SSL/TLS Scan Failed',
        description: `Unable to complete SSL/TLS security scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'info',
        affected_asset: target,
        service: 'HTTPS',
        remediation: 'Verify target is accessible and supports HTTPS connections'
      });
    }
  }

  return { vulnerabilities, assetsScanned };
}

async function webApplicationScan(target: string): Promise<ScanResult> {
  const vulnerabilities: VulnerabilityData[] = [];
  let assetsScanned = 0;

  try {
    const url = target.startsWith('http') ? target : `https://${target}`;
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    });

    assetsScanned = 1;
    const headers = response.headers;

    const serverHeader = headers.get('server');
    if (serverHeader) {
      vulnerabilities.push({
        title: 'Server Information Disclosure',
        description: `Server header reveals software version: ${serverHeader}`,
        severity: 'low',
        cvss_score: 2.7,
        affected_asset: hostname,
        service: 'HTTP',
        remediation: 'Remove or obscure Server header to prevent information disclosure'
      });
    }

    const xPoweredBy = headers.get('x-powered-by');
    if (xPoweredBy) {
      vulnerabilities.push({
        title: 'Technology Stack Disclosure',
        description: `X-Powered-By header reveals technology: ${xPoweredBy}`,
        severity: 'low',
        cvss_score: 2.6,
        affected_asset: hostname,
        service: 'HTTP',
        remediation: 'Remove X-Powered-By header to prevent technology enumeration'
      });
    }

    const cookies = headers.get('set-cookie');
    if (cookies) {
      if (!cookies.includes('Secure')) {
        vulnerabilities.push({
          title: 'Insecure Cookie Configuration',
          description: 'Cookies transmitted without Secure flag. Vulnerable to interception over HTTP.',
          severity: 'medium',
          cvss_score: 5.4,
          affected_asset: hostname,
          service: 'HTTP',
          remediation: 'Set Secure flag on all cookies: Set-Cookie: name=value; Secure; HttpOnly'
        });
      }
      if (!cookies.includes('HttpOnly')) {
        vulnerabilities.push({
          title: 'Missing HttpOnly Cookie Flag',
          description: 'Cookies accessible via JavaScript. Vulnerable to XSS cookie theft.',
          severity: 'medium',
          cvss_score: 5.3,
          affected_asset: hostname,
          service: 'HTTP',
          remediation: 'Set HttpOnly flag on session cookies'
        });
      }
    }

    const html = await response.text();

    if (html.toLowerCase().includes('<!-- todo') || html.toLowerCase().includes('<!-- fixme')) {
      vulnerabilities.push({
        title: 'Exposed Development Comments',
        description: 'HTML comments containing TODO or FIXME markers found in production.',
        severity: 'info',
        affected_asset: hostname,
        service: 'HTTP',
        remediation: 'Remove development comments from production code'
      });
    }

    if (html.match(/\bpassword\s*=|api[_-]?key\s*=|secret\s*=/i)) {
      vulnerabilities.push({
        title: 'Potential Credential Exposure in Source',
        description: 'HTML source contains patterns resembling passwords or API keys.',
        severity: 'critical',
        cvss_score: 9.1,
        affected_asset: hostname,
        service: 'HTTP',
        remediation: 'Immediately rotate exposed credentials and remove from client-side code'
      });
    }

  } catch (error) {
    vulnerabilities.push({
      title: 'Web Application Scan Failed',
      description: `Unable to complete web application scan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'info',
      affected_asset: target,
      service: 'HTTP',
      remediation: 'Verify target URL is accessible'
    });
  }

  return { vulnerabilities, assetsScanned };
}

async function comprehensiveScan(target: string): Promise<ScanResult> {
  const [dnsResults, sslResults, webResults] = await Promise.all([
    dnsSecurityScan(target),
    sslTlsScan(target),
    webApplicationScan(target)
  ]);

  return {
    vulnerabilities: [
      ...dnsResults.vulnerabilities,
      ...sslResults.vulnerabilities,
      ...webResults.vulnerabilities
    ],
    assetsScanned: Math.max(dnsResults.assetsScanned, sslResults.assetsScanned, webResults.assetsScanned)
  };
}

const scanPlugins: Record<string, ScanPlugin> = {
  'vulnerability': {
    name: 'Comprehensive Vulnerability Scan',
    execute: comprehensiveScan
  },
  'network': {
    name: 'Network Security Scan',
    execute: async (target) => {
      const dnsResults = await dnsSecurityScan(target);
      return dnsResults;
    }
  },
  'web_application': {
    name: 'Web Application Scan',
    execute: webApplicationScan
  },
  'compliance': {
    name: 'Compliance Audit',
    execute: comprehensiveScan
  },
  'penetration_test': {
    name: 'Penetration Test',
    execute: comprehensiveScan
  }
};

edge.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = edge.env.get('SUPABASE_URL')!;
    const supabaseKey = edge.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { scanId, scanType, target }: ScanRequest = await req.json();

    if (!scanId || !scanType || !target) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: scanId, scanType, target' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const plugin = scanPlugins[scanType];
    if (!plugin) {
      return new Response(
        JSON.stringify({ error: `Unsupported scan type: ${scanType}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const startTime = Date.now();

    await supabase
      .from('scan_results')
      .update({ status: 'running' })
      .eq('scan_results_id', scanId);

    const N8N_WEBHOOKS = getN8nWebhooks();
    const webhookUrl = N8N_WEBHOOKS[scanType as keyof typeof N8N_WEBHOOKS];
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scanId,
            scanType,
            target,
            timestamp: new Date().toISOString()
          })
        });
      } catch (webhookError) {
        console.warn('N8N webhook call failed:', webhookError);
      }
    }

    const results = await plugin.execute(target);

    const severitySummary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const vuln of results.vulnerabilities) {
      severitySummary[vuln.severity]++;

      await supabase.from('vulnerabilities').insert({
        title: vuln.title,
        description: vuln.description,
        severity: vuln.severity,
        cvss_score: vuln.cvss_score || null,
        package_name: vuln.service || null,
        remediation_steps: vuln.remediation,
        status: 'open',
        cve_id: vuln.cve_id || null
      });
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    await supabase
      .from('scan_results')
      .update({
        status: 'completed',
        severity_summary: severitySummary,
        vulnerabilities_found: results.vulnerabilities.length,
        assets_scanned: results.assetsScanned,
        scan_duration_seconds: durationSeconds
      })
      .eq('scan_results_id', scanId);

    return new Response(
      JSON.stringify({
        success: true,
        scanId,
        vulnerabilitiesFound: results.vulnerabilities.length,
        assetsScanned: results.assetsScanned,
        durationSeconds
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Scan execution error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
