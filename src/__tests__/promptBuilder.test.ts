import { describe, it, expect } from 'vitest';
import buildPrompt from '../lib/promptBuilder';

describe('buildPrompt', () => {
  it('composes full prompt from sanitized request', () => {
    const sanitized = {
      description: 'Do X',
      userInput: '<div></div>',
      failedTestText: 'should pass',
      userId: '123'
    } as any;

    const res = buildPrompt(sanitized);
    expect(res.fullPrompt).toContain('You are a helpful teaching assistant for a coding bootcamp.');
    expect(res.fullPrompt).toContain('<challenge_instructions>');
    expect(res.fullPrompt).toContain('Do X');
    expect(res.fullPrompt).toContain('<student_code>');
    expect(res.fullPrompt).toContain('<current_error>');
    expect(res.length).toBe(res.fullPrompt.length);
  });

  it('throws PromptSizeError when prompt exceeds MAX_PROMPT_CHARS', () => {
    const longDescription = 'D'.repeat(9000);
    const sanitized = {
      description: longDescription,
      userInput: 'U',
      failedTestText: 'F'
    } as any;

    expect(() => buildPrompt(sanitized)).toThrow();
  });
});
