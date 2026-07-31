import { describe, expect, it } from 'vitest';
import { PromptSizeError } from '../../errors/promptSizeError';
import type { NormalizedHintRequest } from '../../types/hint';
import { buildPrompt } from '../promptBuilder';

function baseSanitized(overrides: Partial<NormalizedHintRequest> = {}): NormalizedHintRequest {
  return {
    userId: 'user-1',
    description: 'Write a function that adds two numbers',
    userInput: 'function add(a, b) { return a + b; }',
    seed: '',
    hints: 'Expected 5 but got undefined',
    ...overrides,
  };
}

describe('buildPrompt', () => {
  it('returns HTML system prompt for challengeType html', () => {
    const result = buildPrompt(baseSanitized({ challengeType: 'html' }));
    expect(result.systemPrompt).toContain('HTML Element Issues');
    expect(result.challengeType).toBe('html');
  });

  it('returns CSS system prompt for challengeType css', () => {
    const result = buildPrompt(baseSanitized({ challengeType: 'css' }));
    expect(result.systemPrompt).toContain('CSS Issues');
    expect(result.challengeType).toBe('css');
  });

  it('returns JS system prompt for challengeType javascript', () => {
    const result = buildPrompt(baseSanitized({ challengeType: 'javascript' }));
    expect(result.systemPrompt).toContain('JavaScript Issues');
    expect(result.challengeType).toBe('javascript');
  });

  it('returns Python system prompt for challengeType python', () => {
    const result = buildPrompt(baseSanitized({ challengeType: 'python' }));
    expect(result.systemPrompt).toContain('Python Issues');
    expect(result.challengeType).toBe('python');
  });

  it('falls back to full prompt when no challengeType', () => {
    const result = buildPrompt(baseSanitized({ challengeType: undefined }));
    expect(result.systemPrompt).toContain('HTML Element Issues');
    expect(result.systemPrompt).toContain('CSS Issues');
    expect(result.systemPrompt).toContain('JavaScript Issues');
  });

  it('interpolates template variables correctly', () => {
    const result = buildPrompt(
      baseSanitized({
        description: 'Test description',
        userInput: 'Test code',
        hints: 'Test hint',
      }),
    );
    expect(result.userPrompt).toContain('Test description');
    expect(result.userPrompt).toContain('Test code');
    expect(result.userPrompt).toContain('Test hint');
  });

  it('does not replace placeholders contained in untrusted values', () => {
    const result = buildPrompt(
      baseSanitized({
        description: 'Keep the literal {hints} placeholder',
        hints: 'Do not splice this value into the description',
      }),
    );

    expect(result.userPrompt).toContain('Keep the literal {hints} placeholder');
  });

  it('preserves dollar substitution patterns in untrusted values', () => {
    const result = buildPrompt(baseSanitized({ userInput: 'a$`b$&c$$d' }));

    expect(result.userPrompt).toContain('a$`b$&c$$d');
  });

  it('instructs the model to treat framed request content as untrusted', () => {
    const result = buildPrompt(baseSanitized());

    expect(result.systemPrompt.toLowerCase()).toContain('untrusted');
  });

  it('throws PromptSizeError when combined prompt exceeds MAX_PROMPT_CHARS', () => {
    const huge = 'x'.repeat(100001);
    expect(() => buildPrompt(baseSanitized({ description: huge }))).toThrow(PromptSizeError);
  });
});
