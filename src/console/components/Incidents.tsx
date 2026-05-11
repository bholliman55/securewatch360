'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, AlertCircle, Clock, CheckCircle, RefreshCw, Plus,
  X, Users, BookOpen, Bell, ChevronRight, Phone, Mail, Hash as Slack,
  ShieldCheck, Edit2, Trash2, Save, PhoneCall,
} from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { useTenant } from '../contexts/TenantContext';
import { formatDistanceToNow } from '../utils/formatters';
import CreateIncidentModal from './CreateIncidentModal';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BcpContact {
  id: string;
  name: string;
  title?: string | null;
  role: string;
  email?: string | null;
  phone?: string | null;
  slack_handle?: string | null;
  escalation_level: number;
  notify_on_severity: string[];
  notify_on_category: string[];
  active: boolean;
  notes?: string | null;
}

interface ResponsePlan {
  id: string;
  name: string;
  description?: string | null;
  incident_category?: string | null;
  min_severity: string;
  procedures: { step: string; owner: string; sla_hours: number; description: string }[];
  auto_notify: boolean;
  auto_create_actions: boolean;
  active: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  investigating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  contained: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
};

const ESCALATION_LABELS: Record<number, string> = {
  1: 'First Responder',
  2: 'Team Lead',
  3: 'Management',
  4: 'Executive',
  5: 'External / Legal',
};

const ESCALATION_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-cyan-400',
  3: 'text-yellow-400',
  4: 'text-orange-400',
  5: 'text-red-400',
};

// ─── BCP Contacts Tab ────────────────────────────────────────────────────────

function BcpContactsTab() {
  const { selectedTenantId } = useTenant();
  const [contacts, setContacts] = useState<BcpContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyForm = {
    name: '', title: '', role: '', email: '', phone: '', slack_handle: '',
    escalation_level: 1,
    notify_on_severity: ['critical', 'high'],
    active: true, notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bcp/contacts?tenantId=${encodeURIComponent(selectedTenantId)}`);
      const data = await res.json() as { ok: boolean; contacts?: BcpContact[] };
      if (data.ok) setContacts(data.contacts ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!selectedTenantId || !form.name || !form.role) {
      setError('Name and role are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/bcp/contacts/${editingId}?tenantId=${encodeURIComponent(selectedTenantId)}`
        : `/api/bcp/contacts?tenantId=${encodeURIComponent(selectedTenantId)}`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Save failed');
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedTenantId || !confirm('Delete this BCP contact?')) return;
    await fetch(`/api/bcp/contacts/${id}?tenantId=${encodeURIComponent(selectedTenantId)}`, {
      method: 'DELETE', credentials: 'include',
    });
    await load();
  };

  const startEdit = (c: BcpContact) => {
    setForm({
      name: c.name, title: c.title ?? '', role: c.role, email: c.email ?? '',
      phone: c.phone ?? '', slack_handle: c.slack_handle ?? '',
      escalation_level: c.escalation_level,
      notify_on_severity: c.notify_on_severity,
      active: c.active, notes: c.notes ?? '',
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const grouped = contacts.reduce<Record<number, BcpContact[]>>((acc, c) => {
    if (!acc[c.escalation_level]) acc[c.escalation_level] = [];
    acc[c.escalation_level].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--sw-text-muted)]">
          Define who is notified and how when a security incident occurs. Contacts are grouped by escalation level.
        </p>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1565c0] text-white rounded-lg hover:bg-[#1e88e5] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-xl p-6 space-y-4">
          <h4 className="font-bold text-[var(--sw-text-primary)]">
            {editingId ? 'Edit Contact' : 'New BCP Contact'}
          </h4>
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm">
                <option value="">Select role…</option>
                {['ciso', 'cto', 'ceo', 'coo', 'it_director', 'security_analyst', 'incident_commander',
                  'legal', 'pr', 'hr', 'external_counsel', 'insurance', 'board_member', 'other'].map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Escalation Level</label>
              <select value={form.escalation_level} onChange={e => setForm(f => ({ ...f, escalation_level: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm">
                {[1, 2, 3, 4, 5].map(l => (
                  <option key={l} value={l}>{l} — {ESCALATION_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Slack Handle</label>
              <input value={form.slack_handle} onChange={e => setForm(f => ({ ...f, slack_handle: e.target.value }))}
                placeholder="@handle"
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-2">Notify On Severity</label>
              <div className="flex flex-wrap gap-2">
                {['critical', 'high', 'medium', 'low'].map(sev => (
                  <label key={sev} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox"
                      checked={form.notify_on_severity.includes(sev)}
                      onChange={e => setForm(f => ({
                        ...f,
                        notify_on_severity: e.target.checked
                          ? [...f.notify_on_severity, sev]
                          : f.notify_on_severity.filter(s => s !== sev),
                      }))}
                      className="rounded" />
                    <span className="text-xs text-[var(--sw-text-muted)] capitalize">{sev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setEditingId(null); setError(null); }}
              className="px-4 py-2 border border-[var(--sw-border)] rounded-lg text-sm text-[var(--sw-text-muted)] hover:bg-[var(--sw-surface)]">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1565c0] text-white rounded-lg hover:bg-[#1e88e5] text-sm disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Contact'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e88e5]" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-[var(--sw-text-muted)]">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No BCP contacts yet</p>
          <p className="text-sm mt-1">Add your first contact to define who gets notified during incidents.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(level => {
            const group = grouped[level] ?? [];
            if (group.length === 0) return null;
            return (
              <div key={level}>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${ESCALATION_COLORS[level]}`}>
                    Level {level} — {ESCALATION_LABELS[level]}
                  </span>
                  <div className="flex-1 h-px bg-[var(--sw-border)]" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {group.map(c => (
                    <div key={c.id} className={`bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-xl p-4 ${!c.active ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--sw-text-primary)] text-sm">{c.name}</span>
                            {c.title && <span className="text-xs text-[var(--sw-text-muted)]">· {c.title}</span>}
                            {!c.active && <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">Inactive</span>}
                          </div>
                          <span className="text-xs text-[var(--sw-accent-bright)] uppercase tracking-wide mt-0.5 block">
                            {c.role.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(c)}
                            className="p-1.5 rounded-lg hover:bg-[var(--sw-surface-elevated)] text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)]">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => void handleDelete(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-900/20 text-[var(--sw-text-muted)] hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--sw-text-muted)]">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-[var(--sw-accent-bright)]">
                            <Mail className="w-3 h-3" /> {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-[var(--sw-accent-bright)]">
                            <Phone className="w-3 h-3" /> {c.phone}
                          </a>
                        )}
                        {c.slack_handle && (
                          <span className="flex items-center gap-1">
                            <Slack className="w-3 h-3" /> {c.slack_handle}
                          </span>
                        )}
                      </div>
                      {c.notify_on_severity.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.notify_on_severity.map(s => (
                            <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${SEVERITY_COLORS[s] ?? ''}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Response Plans Tab ──────────────────────────────────────────────────────

function ResponsePlansTab() {
  const { selectedTenantId } = useTenant();
  const [plans, setPlans] = useState<ResponsePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emptyForm = {
    name: '', description: '', incident_category: '', min_severity: 'high',
    auto_notify: true, auto_create_actions: false,
    procedures: [
      { step: 'Identify & Scope', owner: 'Incident Commander', sla_hours: 1, description: 'Confirm the incident scope and classify severity.' },
      { step: 'Contain', owner: 'Security Team', sla_hours: 4, description: 'Isolate affected systems to prevent spread.' },
      { step: 'Notify Stakeholders', owner: 'CISO', sla_hours: 2, description: 'Notify BCP contacts per escalation level.' },
      { step: 'Eradicate', owner: 'Security Team', sla_hours: 24, description: 'Remove malware/attacker access and patch vulnerabilities.' },
      { step: 'Recover', owner: 'IT Operations', sla_hours: 48, description: 'Restore affected systems from clean backups.' },
      { step: 'Post-Incident Review', owner: 'CISO', sla_hours: 168, description: 'Document lessons learned and update controls.' },
    ],
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!selectedTenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bcp/plans?tenantId=${encodeURIComponent(selectedTenantId)}`);
      const data = await res.json() as { ok: boolean; plans?: ResponsePlan[] };
      if (data.ok) setPlans(data.plans ?? []);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!selectedTenantId || !form.name) { setError('Name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/bcp/plans?tenantId=${encodeURIComponent(selectedTenantId)}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Save failed');
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--sw-text-muted)]">
          Response plans define step-by-step procedures for incident categories and severity levels.
        </p>
        <button
          onClick={() => { setShowForm(true); setForm(emptyForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#1565c0] text-white rounded-lg hover:bg-[#1e88e5] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Create Plan
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--sw-surface-elevated)] border border-[var(--sw-border)] rounded-xl p-6 space-y-4">
          <h4 className="font-bold text-[var(--sw-text-primary)]">New Response Plan</h4>
          {error && <div className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Plan Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Critical Incident Response — Ransomware"
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Minimum Severity</label>
              <select value={form.min_severity} onChange={e => setForm(f => ({ ...f, min_severity: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm">
                {['info', 'low', 'medium', 'high', 'critical'].map(s => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-1">Incident Category (optional)</label>
              <select value={form.incident_category} onChange={e => setForm(f => ({ ...f, incident_category: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg text-[var(--sw-text-primary)] text-sm">
                <option value="">All categories</option>
                {['ransomware', 'data_breach', 'credential_compromise', 'supply_chain', 'zero_day', 'ddos', 'insider_threat', 'phishing', 'other'].map(c => (
                  <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--sw-text-muted)]">
                <input type="checkbox" checked={form.auto_notify} onChange={e => setForm(f => ({ ...f, auto_notify: e.target.checked }))} />
                Auto-notify BCP contacts
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--sw-text-muted)] mb-2">Response Steps</label>
            <div className="space-y-2">
              {form.procedures.map((proc, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg px-3 py-2 text-sm">
                  <span className="text-[var(--sw-accent-bright)] font-mono text-xs w-5 shrink-0">{idx + 1}.</span>
                  <span className="font-medium text-[var(--sw-text-primary)] w-36 shrink-0">{proc.step}</span>
                  <span className="text-[var(--sw-text-muted)] flex-1 truncate">{proc.description}</span>
                  <span className="text-[var(--sw-text-muted)] text-xs shrink-0">{proc.sla_hours}h SLA</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--sw-text-muted)] mt-2">Default steps pre-loaded. Customize after creation.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(null); }}
              className="px-4 py-2 border border-[var(--sw-border)] rounded-lg text-sm text-[var(--sw-text-muted)] hover:bg-[var(--sw-surface)]">
              Cancel
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-[#1565c0] text-white rounded-lg hover:bg-[#1e88e5] text-sm disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Create Plan'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e88e5]" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-[var(--sw-text-muted)]">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No response plans yet</p>
          <p className="text-sm mt-1">Create a plan to define step-by-step procedures for incident response.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <div key={plan.id} className="bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-xl overflow-hidden">
              <button
                className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-[var(--sw-surface-elevated)] transition-colors"
                onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="w-4 h-4 text-[var(--sw-accent-bright)]" />
                  <div>
                    <p className="font-semibold text-[var(--sw-text-primary)] text-sm">{plan.name}</p>
                    <p className="text-xs text-[var(--sw-text-muted)] mt-0.5">
                      Min: {plan.min_severity.toUpperCase()}
                      {plan.incident_category ? ` · ${plan.incident_category.replace(/_/g, ' ')}` : ' · All categories'}
                      {' · '}{plan.procedures.length} steps
                    </p>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-[var(--sw-text-muted)] transition-transform ${expandedId === plan.id ? 'rotate-90' : ''}`} />
              </button>
              {expandedId === plan.id && (
                <div className="px-6 pb-5 border-t border-[var(--sw-border)] pt-4 space-y-2">
                  {plan.procedures.map((proc, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-2 border-b border-[var(--sw-border)] last:border-0">
                      <span className="text-[var(--sw-accent-bright)] font-bold text-xs mt-0.5 w-5 shrink-0">{idx + 1}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--sw-text-primary)]">{proc.step}</p>
                        <p className="text-xs text-[var(--sw-text-muted)] mt-0.5">{proc.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[var(--sw-text-muted)]">{proc.owner}</p>
                        <p className="text-xs text-[var(--sw-accent-bright)]">{proc.sla_hours}h SLA</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Incident Detail Panel ───────────────────────────────────────────────────

interface IncidentDetailPanelProps {
  incident: {
    incident_id: string;
    title: string;
    description?: string | null;
    severity: string;
    status: string;
    category: string;
    assigned_to?: string | null;
    detected_at: string;
  };
  onClose: () => void;
}

function IncidentDetailPanel({ incident, onClose }: IncidentDetailPanelProps) {
  const { selectedTenantId } = useTenant();
  const [bcpContacts, setBcpContacts] = useState<BcpContact[]>([]);
  const [plans, setPlans] = useState<ResponsePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedTenantId) return;
    Promise.all([
      fetch(`/api/bcp/contacts?tenantId=${encodeURIComponent(selectedTenantId)}`).then(r => r.json()) as Promise<{ ok: boolean; contacts?: BcpContact[] }>,
      fetch(`/api/bcp/plans?tenantId=${encodeURIComponent(selectedTenantId)}`).then(r => r.json()) as Promise<{ ok: boolean; plans?: ResponsePlan[] }>,
    ]).then(([contactsRes, plansRes]) => {
      const contacts = (contactsRes.contacts ?? []).filter(c =>
        c.active && c.notify_on_severity.includes(incident.severity)
      );
      setBcpContacts(contacts);
      const matchingPlans = (plansRes.plans ?? []).filter(p =>
        p.active &&
        ['info', 'low', 'medium', 'high', 'critical'].indexOf(incident.severity) >=
        ['info', 'low', 'medium', 'high', 'critical'].indexOf(p.min_severity) &&
        (!p.incident_category || p.incident_category === incident.category)
      );
      setPlans(matchingPlans);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedTenantId, incident.severity, incident.category]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-end z-50 p-4">
      <div className="bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-2xl shadow-2xl w-full max-w-lg h-full max-h-full overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[var(--sw-border)] sticky top-0 bg-[var(--sw-surface)] z-10">
          <div>
            <h3 className="font-bold text-[var(--sw-text-primary)]">{incident.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${SEVERITY_COLORS[incident.severity] ?? ''}`}>
                {incident.severity}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[incident.status] ?? ''}`}>
                {incident.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--sw-surface-elevated)] rounded-lg text-[var(--sw-text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Incident Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sw-text-muted)]">Incident Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[var(--sw-text-muted)]">Category</p>
                <p className="text-[var(--sw-text-primary)] capitalize">{incident.category.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--sw-text-muted)]">Assigned To</p>
                <p className="text-[var(--sw-text-primary)]">{incident.assigned_to ?? 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--sw-text-muted)]">Detected</p>
                <p className="text-[var(--sw-text-primary)]">{formatDistanceToNow(incident.detected_at)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--sw-text-muted)]">ID</p>
                <p className="text-[var(--sw-text-primary)] font-mono text-xs truncate">{incident.incident_id}</p>
              </div>
            </div>
            {incident.description && (
              <p className="text-sm text-[var(--sw-text-muted)] bg-[var(--sw-surface-elevated)] rounded-lg p-3">
                {incident.description}
              </p>
            )}
          </div>

          {/* BCP Contacts to Notify */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[var(--sw-accent-bright)]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sw-text-muted)]">
                BCP Contacts to Notify
                {!loading && <span className="ml-2 text-[var(--sw-accent-bright)]">({bcpContacts.length})</span>}
              </h4>
            </div>
            {loading ? (
              <div className="text-xs text-[var(--sw-text-muted)]">Loading contacts…</div>
            ) : bcpContacts.length === 0 ? (
              <div className="text-sm text-[var(--sw-text-muted)] bg-[var(--sw-surface-elevated)] rounded-lg p-3">
                No BCP contacts configured for{' '}
                <span className="font-medium capitalize">{incident.severity}</span> severity.
                Go to the{' '}
                <span className="text-[var(--sw-accent-bright)]">Response Plan</span> tab to add contacts.
              </div>
            ) : (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].flatMap(level =>
                  bcpContacts
                    .filter(c => c.escalation_level === level)
                    .map(c => (
                      <div key={c.id} className="flex items-center justify-between bg-[var(--sw-surface-elevated)] rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-[var(--sw-text-primary)]">{c.name}</p>
                          <p className={`text-xs ${ESCALATION_COLORS[c.escalation_level]}`}>
                            L{c.escalation_level} · {c.role.replace(/_/g, ' ').toUpperCase()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.email && (
                            <a href={`mailto:${c.email}?subject=Incident: ${encodeURIComponent(incident.title)}`}
                              className="p-1.5 rounded-lg hover:bg-[var(--sw-surface)] text-[var(--sw-text-muted)] hover:text-[var(--sw-accent-bright)]">
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {c.phone && (
                            <a href={`tel:${c.phone}`}
                              className="p-1.5 rounded-lg hover:bg-[var(--sw-surface)] text-[var(--sw-text-muted)] hover:text-[var(--sw-accent-bright)]">
                              <PhoneCall className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Matching Response Plans */}
          {!loading && plans.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--sw-accent-bright)]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--sw-text-muted)]">
                  Applicable Response Plans ({plans.length})
                </h4>
              </div>
              {plans.map(plan => (
                <div key={plan.id} className="bg-[var(--sw-surface-elevated)] rounded-xl p-4">
                  <p className="text-sm font-semibold text-[var(--sw-text-primary)] mb-3">{plan.name}</p>
                  <div className="space-y-2">
                    {plan.procedures.map((proc, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="text-[var(--sw-accent-bright)] font-bold w-4 shrink-0 mt-0.5">{idx + 1}.</span>
                        <div className="flex-1">
                          <span className="font-medium text-[var(--sw-text-primary)]">{proc.step}</span>
                          <span className="text-[var(--sw-text-muted)] ml-2">— {proc.sla_hours}h SLA</span>
                          <p className="text-[var(--sw-text-muted)] mt-0.5">{proc.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Incidents Component ────────────────────────────────────────────────

type Tab = 'incidents' | 'response_plan' | 'bcp_contacts';

export default function Incidents() {
  const [activeTab, setActiveTab] = useState<Tab>('incidents');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<{
    incident_id: string;
    title: string;
    description?: string | null;
    severity: string;
    status: string;
    category: string;
    assigned_to?: string | null;
    detected_at: string;
  } | null>(null);

  const { incidents, metrics, loading, error, refresh } = useIncidents();

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { key: 'response_plan', label: 'Response Plans', icon: BookOpen },
    { key: 'bcp_contacts', label: 'BCP Contacts', icon: Users },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e88e5]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-[var(--sw-text-primary)] mb-2">Incident Response</h2>
          <p className="text-[var(--sw-text-muted)]">
            Security incident management, BCP contacts, and response playbooks
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'incidents' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1565c0] text-white rounded-lg hover:bg-[#1e88e5] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Incident
            </button>
          )}
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--sw-surface)] border border-[var(--sw-border)] rounded-lg hover:bg-[var(--sw-surface-elevated)] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics (always visible) */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{metrics.total}</p>
              </div>
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Open</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{metrics.open}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Resolved</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{metrics.resolved}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg p-4 border border-[var(--sw-border)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Resolution</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{metrics.avgResolutionTimeHours}h</p>
              </div>
              <Clock className="w-5 h-5 text-[#29b6f6]" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--sw-border)]">
        <nav className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-[#1e88e5] text-[#1e88e5]'
                    : 'border-transparent text-[var(--sw-text-muted)] hover:text-[var(--sw-text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'incidents' && (
        <div className="bg-[var(--sw-surface)] rounded-lg shadow-lg border border-[var(--sw-border)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--sw-surface-elevated)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Incident</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Detected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sw-border)]">
                {incidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      No incidents reported
                    </td>
                  </tr>
                ) : (
                  incidents.map((incident) => (
                    <tr
                      key={incident.incident_id}
                      className="hover:bg-[var(--sw-surface-elevated)] transition-colors cursor-pointer"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{incident.title}</p>
                          {incident.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{incident.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SEVERITY_COLORS[incident.severity] ?? ''}`}>
                          {incident.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[incident.status] ?? ''}`}>
                          {incident.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                          {incident.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {incident.assigned_to ?? 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {formatDistanceToNow(incident.detected_at)}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--sw-text-muted)]" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'response_plan' && <ResponsePlansTab />}
      {activeTab === 'bcp_contacts' && <BcpContactsTab />}

      {/* Incident Detail Slide-over */}
      {selectedIncident && (
        <IncidentDetailPanel
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      <CreateIncidentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onIncidentCreated={refresh}
      />
    </div>
  );
}
