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
    expect(res.fullPrompt).toContain('You are a helpful teaching assistant for freeCodeCamp');
    expect(res.fullPrompt).toContain('Challenge Instructions');
    expect(res.fullPrompt).toContain('Do X');
    expect(res.fullPrompt).toContain('Starting Context');
    expect(res.fullPrompt).toContain('What the Student Wrote');
    expect(res.fullPrompt).toContain('Failing Tests/Requirements');
    expect(res.length).toBe(res.fullPrompt.length);
  });

  it('throws PromptSizeError when prompt exceeds MAX_PROMPT_CHARS', () => {
    const longDescription = 'D'.repeat(13000);
    const sanitized = {
      description: longDescription,
      userInput: 'U',
      seed: 'S',
      hints: 'H',
    } as any;

    expect(() => buildPrompt(sanitized)).toThrow();
  });
});
