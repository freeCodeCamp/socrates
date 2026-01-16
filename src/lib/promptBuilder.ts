import { getSystemPrompt, MAX_PROMPT_CHARS, USER_PROMPT_TEMPLATE } from '../config/prompts';
import { PromptSizeError } from '../errors/promptSizeError';
import type { ChallengeType, SanitizedRequest } from '../types/sanitizer';

function interpolate(template: string, values: Record<string, string | undefined>) {
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v ? v : '');
  }
  return out;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
  length: number;
  challengeType?: ChallengeType;
}

export function buildPrompt(sanitized: SanitizedRequest): BuiltPrompt {
  const desc = sanitized.description || '';
  const code = sanitized.userInput || '';
  const seed = sanitized.seed || '';
  const hints = sanitized.hints || '';
  const challengeType = sanitized.challengeType;

  const systemPrompt = getSystemPrompt(challengeType);

  const userPrompt = interpolate(USER_PROMPT_TEMPLATE, {
    description: desc,
    userInput: code,
    seed: seed,
    hints: hints,
  });

  const full = `${systemPrompt}\n\n${userPrompt}`;
  const len = full.length;

  if (len > MAX_PROMPT_CHARS) {
    throw new PromptSizeError(`Prompt too long: ${len} characters (max ${MAX_PROMPT_CHARS})`);
  }

  return {
    systemPrompt,
    userPrompt,
    fullPrompt: full,
    length: len,
    challengeType,
  };
}

export default buildPrompt;
