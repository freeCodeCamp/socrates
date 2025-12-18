import { describe, expect, it } from 'vitest';

// This test hits the real Groq API. Run locally like:
// RUN_GROQ_INTEGRATION=true pnpm run test
// Ensure GROQ_API_KEY is set in your environment (.env)

if (!process.env.RUN_GROQ_INTEGRATION) {
  // When not set, skip the whole suite
  describe.skip('Groq Integration tests (skipped by default)', () => {});
} else {
  describe('Groq Integration tests', () => {
    it('calls real Groq API and returns a hint', async () => {
      const { generateFromGroq } = await import('../lib/groqClient');

      // Provide a short prompt that should be inexpensive to process
      const prompt = `Return a short hint (max 10 words): 'Missing closing tag'`;
      const res = await generateFromGroq(prompt);

      expect(res).toBeDefined();
      expect(typeof res.hint).toBe('string');
      expect(res.hint.length).toBeGreaterThan(0);
      expect(res.model_used).toBeDefined();
    }, 30000);
  });
}
