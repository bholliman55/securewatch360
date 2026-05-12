import type { ParsedCommand, SupportedAgent, SupportedIntent } from "./intentSchema";

export type NLIntent = SupportedIntent;
export type NLAgent = SupportedAgent;
export type ParsedNLCommand = ParsedCommand;

export interface LLMParser {
  name: string;
  parse(input: string): Promise<ParsedNLCommand>;
}
