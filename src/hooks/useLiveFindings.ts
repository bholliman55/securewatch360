"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveEvent {
  type: "finding" | "intel_event" | "asset" | "heartbeat" | "connected";
  payload?: Record<string, unknown>;
  timestamp?: string;
  tenantId?: string;
}

interface UseLiveFindingsOptions {
  onFinding?: (payload: Record<string, unknown>) => void;
  onAsset?: (payload: Record<string, unknown>) => void;
  onIntelEvent?: (payload: Record<string, unknown>) => void;
  onHeartbeat?: () => void;
}

export interface UseLiveFindingsResult {
  connected: boolean;
  lastEvent: Date | null;
}

const MAX_RETRIES = 5;

export function useLiveFindings(options: UseLiveFindingsOptions = {}): UseLiveFindingsResult {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<Date | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const connect = useCallback(() => {
    esRef.current?.close();

    const es = new EventSource("/api/events/findings");
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    es.onmessage = (event: MessageEvent<string>) => {
      setLastEvent(new Date());
      let data: LiveEvent;
      try {
        data = JSON.parse(event.data) as LiveEvent;
      } catch {
        return;
      }
      const o = optsRef.current;
      if (data.type === "finding" && data.payload) o.onFinding?.(data.payload);
      if (data.type === "asset" && data.payload) o.onAsset?.(data.payload);
      if (data.type === "intel_event" && data.payload) o.onIntelEvent?.(data.payload);
      if (data.type === "heartbeat") o.onHeartbeat?.();
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      if (retriesRef.current < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30_000);
        retriesRef.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [connect]);

  return { connected, lastEvent };
}
