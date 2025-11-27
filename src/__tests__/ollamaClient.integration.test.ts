import { it, describe, expect } from 'vitest';

// This test hits a real Ollama instance. Run locally like:
// RUN_OLLAMA_INTEGRATION=true npm run test
// Ensure OLLAMA_HOST, OLLAMA_MODEL are set in your environment (.env)

if (!process.env.RUN_OLLAMA_INTEGRATION) {
  // When not set, skip the whole suite
  describe.skip('Ollama Integration tests (skipped by default)', () => {});
} else {
  describe('Ollama Integration tests', () => {
    it('calls real Ollama instance and returns a hint', async () => {
      const { generateFromOllama } = await import('../lib/ollamaClient');

      // Provide a short prompt that should be inexpensive to process
      const prompt = `You are a test system. Return a short hint (max 10 words): 'Missing closing tag'`;
      const res = await generateFromOllama(prompt);

      expect(res).toBeDefined();
      expect(typeof res.hint).toBe('string');
      expect(res.hint.length).toBeGreaterThan(0);
      expect(res.model_used).toBeDefined();
    }, 20000);
  });
}
