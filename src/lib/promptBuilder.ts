import { getSystemPrompt, MAX_PROMPT_CHARS, USER_PROMPT_TEMPLATE } from '../config/prompts';
import { PromptSizeError } from '../errors/promptSizeError';
import type { ChallengeType, NormalizedHintRequest } from '../types/hint';

function interpolate(template: string, values: Record<string, string | undefined>) {
  const keys = Object.keys(values);
  if (keys.length === 0) return template;

  const pattern = new RegExp(`\\{(${keys.join('|')})\\}`, 'g');
  return template.replace(pattern, (_match, key: string) => values[key] ?? '');
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
  length: number;
  challengeType?: ChallengeType;
}

export function buildPrompt(sanitized: NormalizedHintRequest): BuiltPrompt {
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
