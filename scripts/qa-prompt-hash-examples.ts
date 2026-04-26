import { fingerprintContext, hashPrompt, stableStringify } from "@/lib/token-optimization/promptHash";
import type { ContextItem } from "@/lib/token-optimization/types";

function runExamples() {
  const objectA = { b: 2, a: 1, nested: { y: true, x: "ok" } };
  const objectB = { a: 1, nested: { x: "ok", y: true }, b: 2 };

  const stableA = stableStringify(objectA);
  const stableB = stableStringify(objectB);
  const hashA = hashPrompt(objectA);
  const hashB = hashPrompt(objectB);

  console.log("Stable stringify equal:", stableA === stableB);
  console.log("Hash equal for different key order:", hashA === hashB);
  console.log("Hash A:", hashA);
  console.log("Hash B:", hashB);

  const contextA: ContextItem[] = [
    { key: "finding", value: { title: "Open port", severity: "high" } },
    { key: "policy", value: { action: "review", reason: "internet_exposure" } },
  ];
  const contextB: ContextItem[] = [
    { key: "finding", value: { severity: "high", title: "Open port" } },
    { key: "policy", value: { reason: "internet_exposure", action: "review" } },
  ];

  console.log("Context fingerprint equal:", fingerprintContext(contextA) === fingerprintContext(contextB));
  console.log("Note: hashes are one-way digests and avoid raw prompt text in cache keys.");
}

runExamples();
