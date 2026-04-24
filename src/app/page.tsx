"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type FormState = {
  tenantId: string;
  targetName: string;
  targetType: string;
  targetValue: string;
};

const initialForm: FormState = {
  tenantId: "",
  targetName: "",
  targetType: "url",
  targetValue: "",
};

export default function HomePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const createRes = await fetch("/api/scan-targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: form.tenantId,
          targetName: form.targetName,
          targetType: form.targetType,
          targetValue: form.targetValue,
        }),
      });

      const createJson = (await createRes.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
        scanTarget?: { id: string };
      };

      if (!createRes.ok || !createJson.ok || !createJson.scanTarget?.id) {
        throw new Error(createJson.error || createJson.message || "Failed to create scan target");
      }

      const requestRes = await fetch("/api/scans/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: form.tenantId,
          scanTargetId: createJson.scanTarget.id,
        }),
      });

      const requestJson = (await requestRes.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
      };

      if (!requestRes.ok || !requestJson.ok) {
        throw new Error(requestJson.error || requestJson.message || "Failed to request scan");
      }

      setSuccess(`Scan requested. New scan target id: ${createJson.scanTarget.id}`);
      setForm(initialForm);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unexpected error";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <h1>SecureWatch360</h1>
      <p>
        v1 flow: create a scan target for a tenant, send a scan request event, and let Inngest run
        the workflow in the background.
      </p>
      <p>
        <Link href="/login">Login</Link> | <Link href="/signup">Sign up</Link> |{" "}
        <Link href="/account">Account</Link> | <Link href="/console/">SOC Console (UI)</Link> |{" "}
        <Link href="/command-center">Command Center</Link> |{" "}
        <Link href="/policy-decisions">Policy Decisions</Link> |{" "}
        <Link href="/approval-requests">Approval Requests</Link> |{" "}
        <Link href="/risk-exceptions">Risk Exceptions</Link>
      </p>

      <form onSubmit={handleSubmit} className="sw-form">
        <label className="sw-field">
          Tenant ID
          <input
            value={form.tenantId}
            onChange={(e) => setForm((prev) => ({ ...prev, tenantId: e.target.value }))}
            placeholder="uuid"
            required
            className="sw-input"
          />
        </label>

        <label className="sw-field">
          Target Name
          <input
            value={form.targetName}
            onChange={(e) => setForm((prev) => ({ ...prev, targetName: e.target.value }))}
            placeholder="Primary Web App"
            required
            className="sw-input"
          />
        </label>

        <label className="sw-field">
          Target Type
          <input
            value={form.targetType}
            onChange={(e) => setForm((prev) => ({ ...prev, targetType: e.target.value }))}
            placeholder="url"
            required
            className="sw-input"
          />
        </label>

        <label className="sw-field">
          Target Value
          <input
            value={form.targetValue}
            onChange={(e) => setForm((prev) => ({ ...prev, targetValue: e.target.value }))}
            placeholder="https://app.example.com"
            required
            className="sw-input"
          />
        </label>

        <button type="submit" disabled={isSubmitting} className="sw-button">
          {isSubmitting ? "Submitting..." : "Create Target and Request Scan"}
        </button>
      </form>

      {success ? <p className="sw-success">{success}</p> : null}
      {error ? <p className="sw-error">{error}</p> : null}
    </main>
  );
}
