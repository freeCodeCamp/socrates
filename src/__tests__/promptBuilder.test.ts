import { describe, expect, it } from 'vitest';
import buildPrompt from '../lib/promptBuilder';

describe('buildPrompt', () => {
  it('composes full prompt from sanitized request', () => {
    const sanitized = {
      description: 'Do X',
      userInput: '<div></div>',
      seed: '<html><body></body></html>',
      hints: 'Your element should have an opening tag.',
      userId: '123',
    } as any;

    const res = buildPrompt(sanitized);
    expect(res.fullPrompt).toContain('freeCodeCamp teaching assistant');
    expect(res.fullPrompt).toContain('<challenge_description>');
    expect(res.fullPrompt).toContain('Do X');
    expect(res.fullPrompt).toContain('<student_code>');
    expect(res.fullPrompt).toContain('<failing_test>');
    expect(res.fullPrompt).toContain('Sentence 1');
    expect(res.fullPrompt).toContain('Sentence 2');
    expect(res.length).toBe(res.fullPrompt.length);
  });

  it('throws PromptSizeError when prompt exceeds MAX_PROMPT_CHARS', () => {
    // MAX_PROMPT_CHARS is 32000, system prompt is ~6113, user template is ~507, so we need >25380 chars of description
    const longDescription = 'D'.repeat(26000);
    const sanitized = {
      description: longDescription,
      userInput: 'U',
      seed: 'S',
      hints: 'H',
    } as any;

    expect(() => buildPrompt(sanitized)).toThrow();
  });
});
