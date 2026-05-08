/**
 * Voice-layer fixtures for the investor demo.
 *
 * The replay engine never speaks to a real ElevenLabs agent. Instead the
 * timeline references the canned phrases below so a UI overlay can render
 * the conversation, and so demoVoiceFixtures stays the single source of
 * truth for voice script content.
 */

import { ACME_FS01, LAPTOP_123, SARAH_MITCHELL } from "./demoSeedData";

export interface DemoVoiceLine {
  /** Stable id referenced by the timeline payload. */
  id: string;
  /** Who is speaking. */
  speaker: "voice_agent" | "admin";
  /** Spoken content (suitable for TTS). */
  text: string;
  /** Hint for the UI: should this line render as a confirmation prompt? */
  isConfirmationPrompt?: boolean;
}

/** Confirmation prompt the voice agent reads at offset 24s. */
export const VOICE_CONFIRMATION_PROMPT: DemoVoiceLine = {
  id: "voice.confirmation_prompt",
  speaker: "voice_agent",
  text:
    `I'm seeing ransomware-precursor behavior on ${LAPTOP_123.hostname} ` +
    `assigned to ${SARAH_MITCHELL.fullName}. ` +
    `The pattern includes a credential-access attempt against ${ACME_FS01.hostname}. ` +
    `Do you want me to isolate ${LAPTOP_123.hostname} now? ` +
    `Please say "confirm isolate" to authorize.`,
  isConfirmationPrompt: true,
};

/** Admin reply at offset 30s. */
export const VOICE_ADMIN_CONFIRMATION: DemoVoiceLine = {
  id: "voice.admin_confirmation",
  speaker: "admin",
  text: "Confirm isolate.",
};

/** Closing line spoken by the voice agent once isolation completes. */
export const VOICE_AGENT_CLOSEOUT: DemoVoiceLine = {
  id: "voice.agent_closeout",
  speaker: "voice_agent",
  text:
    `${LAPTOP_123.hostname} is isolated. A remediation ticket has been created ` +
    `and an executive report is on the way. I'll keep you posted as the playbook runs.`,
};

/**
 * Whole script in chronological order. Useful for the UI overlay and for
 * unit tests that want to verify the voice fixtures stay deterministic.
 */
export const DEMO_VOICE_SCRIPT: ReadonlyArray<DemoVoiceLine> = [
  VOICE_CONFIRMATION_PROMPT,
  VOICE_ADMIN_CONFIRMATION,
  VOICE_AGENT_CLOSEOUT,
];

/** Look up a voice line by id; throws if missing so typos surface in tests. */
export function getDemoVoiceLine(id: string): DemoVoiceLine {
  const found = DEMO_VOICE_SCRIPT.find((l) => l.id === id);
  if (!found) throw new Error(`[demoVoiceFixtures] unknown voice line id: ${id}`);
  return found;
}
