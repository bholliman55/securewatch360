"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "listening" | "processing" | "speaking" | "error";

interface CommandResult {
  parsedCommand: {
    intent: string;
    agent: string;
    confidence: number;
    parameters: Record<string, unknown>;
    requiresApproval: boolean;
  } | null;
  status: "executed" | "requires_approval" | "error";
  message: string;
  scanId?: string;
}

// Extend window type for browser speech APIs
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

function speak(text: string): void {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export function VoiceCommandPanel({ userId }: { userId: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<CommandResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    (window.SpeechRecognition != null || window.webkitSpeechRecognition != null);

  const sendCommand = useCallback(
    async (input: string) => {
      setStatus("processing");
      try {
        const res = await fetch("/api/nl/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, input }),
        });
        const data = (await res.json()) as CommandResult;
        setResult(data);
        setStatus("speaking");
        speak(data.message);
        setTimeout(() => setStatus("idle"), 3000);
      } catch {
        setErrorMsg("Failed to reach the command endpoint.");
        setStatus("error");
      }
    },
    [userId]
  );

  const startListening = useCallback(() => {
    if (!isSupported) return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      recognition.stop();
      void sendCommand(text);
    };

    recognition.onerror = (event) => {
      setErrorMsg(`Speech recognition error: ${event.error}`);
      setStatus("error");
    };

    recognition.onend = () => {
      if (status === "listening") setStatus("idle");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setStatus("listening");
    setTranscript("");
    setResult(null);
    setErrorMsg("");
  }, [isSupported, sendCommand, status]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
        Speech recognition is not supported in this browser. Use Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Voice Command</h2>
        <StatusBadge status={status} />
      </div>

      {/* Mic button */}
      <div className="flex justify-center">
        <button
          onClick={status === "listening" ? stopListening : startListening}
          disabled={status === "processing" || status === "speaking"}
          className={[
            "flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all",
            status === "listening"
              ? "animate-pulse bg-red-500 hover:bg-red-600"
              : status === "processing" || status === "speaking"
              ? "cursor-not-allowed bg-gray-400"
              : "bg-blue-600 hover:bg-blue-700 active:scale-95",
          ].join(" ")}
          aria-label={status === "listening" ? "Stop listening" : "Start listening"}
        >
          {status === "listening" ? (
            <StopIcon />
          ) : status === "processing" ? (
            <SpinnerIcon />
          ) : (
            <MicIcon />
          )}
        </button>
      </div>

      {/* Transcript */}
      {transcript && (
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <span className="font-medium text-gray-500">You said: </span>
          {transcript}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={[
            "rounded-md p-3 text-sm",
            result.status === "executed"
              ? "bg-green-50 text-green-800"
              : result.status === "requires_approval"
              ? "bg-yellow-50 text-yellow-800"
              : "bg-red-50 text-red-800",
          ].join(" ")}
        >
          <p className="font-medium">{result.message}</p>
          {result.parsedCommand && (
            <p className="mt-1 text-xs opacity-70">
              Intent: {result.parsedCommand.intent} · Confidence:{" "}
              {(result.parsedCommand.confidence * 100).toFixed(0)}%
              {result.scanId ? ` · Scan: ${result.scanId.slice(0, 8)}…` : ""}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && errorMsg && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
      )}

      <p className="text-center text-xs text-gray-400">
        Say something like "Run a scan on example.com" or "Show me critical risks"
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const configs: Record<Status, { label: string; className: string }> = {
    idle: { label: "Ready", className: "bg-gray-100 text-gray-600" },
    listening: { label: "Listening…", className: "bg-red-100 text-red-700 animate-pulse" },
    processing: { label: "Processing…", className: "bg-blue-100 text-blue-700" },
    speaking: { label: "Speaking…", className: "bg-green-100 text-green-700" },
    error: { label: "Error", className: "bg-red-100 text-red-700" },
  };
  const { label, className } = configs[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

function MicIcon() {
  return (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
