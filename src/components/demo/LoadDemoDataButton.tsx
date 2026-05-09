"use client";

import { useState } from "react";
import styles from "./LoadDemoDataButton.module.css";

interface Props {
  tenantId: string;
  onLoaded?: () => void;
}

export function LoadDemoDataButton({ tenantId, onLoaded }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleLoad = async () => {
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/seed/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (data.ok) {
        setState("done");
        setMessage(data.message ?? "Demo data loaded!");
        onLoaded?.();
        // Reload the page after a moment so the data appears
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setState("error");
        setMessage(data.error ?? "Failed to load demo data.");
      }
    } catch {
      setState("error");
      setMessage("Network error — please try again.");
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.icon}>🎯</div>
        <h3 className={styles.title}>No data yet</h3>
        <p className={styles.desc}>
          Load realistic demo findings, scan runs, remediations, and approvals to see this dashboard in action.
        </p>
        <button
          className={styles.btn}
          onClick={handleLoad}
          disabled={state === "loading" || state === "done"}
        >
          {state === "loading" ? "Loading demo data…" : state === "done" ? "Loaded! Refreshing…" : "Load Demo Data"}
        </button>
        {message && (
          <p className={state === "error" ? styles.error : styles.success}>{message}</p>
        )}
      </div>
    </div>
  );
}
