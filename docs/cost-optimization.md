# Cost Optimization Analysis

Analysis of token usage patterns and recommendations for reducing LLM costs in The Librarian API.

## Current State

### System Prompt Size
- **Total characters:** ~3,900 chars
- **Estimated tokens:** ~1,050 tokens
- **Structure:** Role definition + rules + 7 hint pattern categories + 16 in-context examples

### Token Consumption Per Request

| Component | Tokens (est.) |
|-----------|---------------|
| System prompt | ~1,050 |
| User prompt template | ~100 |
| Challenge description | 200-500 |
| Student code | 300-1,000 |
| Test failure message | 50-200 |
| **Total input** | **1,700-2,850** |
| Response (max_tokens=500) | up to 500 |
| **Total per request** | **2,200-3,300** |

### Current Model Configuration
- **Model:** `llama-3.3-70b-versatile`
- **max_tokens:** 500 (hardcoded)
- **temperature:** 0.7 (hardcoded)
- **Timeout:** 30 seconds
- **Retries:** 2 with exponential backoff

### Existing Optimizations
- Only first failing test extracted from hints array
- Prompt size capped at 32K characters
- Circuit breaker prevents cascade failures

---

## Proposed Strategies

### 1. Challenge-Type Specific Prompts

**Concept:** Add a `challengeType` parameter to requests and use specialized shorter prompts for each type.

**Current prompt breakdown by example type:**
- HTML examples: 4
- CSS examples: 4
- JavaScript examples: 4
- General/nesting examples: 4

**Proposed structure:**
```
prompts/
  system-html.ts      # ~400 tokens (HTML + nesting examples only)
  system-css.ts       # ~400 tokens (CSS examples only)
  system-javascript.ts # ~450 tokens (JS examples only)
  system-python.ts    # ~400 tokens (Python examples only)
```

**Impact:**
| Metric | Before | After | Savings |
|--------|--------|-------|---------|
| System prompt tokens | ~1,050 | ~400-450 | **55-60%** |
| Examples per request | 16 | 4-5 | 70% |

**Implementation requirements:**
- freeCodeCamp adds `challengeType` to API requests (confirmed feasible)
- Create 4 specialized prompt files
- Update promptBuilder to select prompt by type
- Fallback to full prompt if type not provided

---

### 2. Model Selection by Challenge Type

**Concept:** Route simpler challenges to cheaper, faster models.

**Groq model pricing comparison:**

| Model | Input $/M tokens | Output $/M tokens | Quality |
|-------|------------------|-------------------|---------|
| llama-3.3-70b-versatile | $0.59 | $0.79 | High |
| llama-3.1-70b-versatile | $0.59 | $0.79 | High |
| llama-3.1-8b-instant | $0.05 | $0.08 | Good |
| gemma2-9b-it | $0.20 | $0.20 | Good |

**Proposed routing:**

| Challenge Type | Model | Rationale |
|----------------|-------|-----------|
| HTML | llama-3.1-8b-instant | Structural hints, simpler context |
| CSS | llama-3.1-8b-instant | Property/value hints, lower complexity |
| JavaScript | llama-3.3-70b-versatile | Logic, algorithms, debugging |
| Python | llama-3.3-70b-versatile | Logic, algorithms, debugging |

**Cost impact example (1M requests, 50/30/15/5 split):**

| Type | Requests | Model | Input Cost | Output Cost | Total |
|------|----------|-------|------------|-------------|-------|
| HTML (50%) | 500K | 8b | $42.50 | $20.00 | $62.50 |
| CSS (30%) | 300K | 8b | $25.50 | $12.00 | $37.50 |
| JavaScript (15%) | 150K | 70b | $150.45 | $59.25 | $209.70 |
| Python (5%) | 50K | 70b | $50.15 | $19.75 | $69.90 |
| **Total** | 1M | mixed | $268.60 | $111.00 | **$379.60** |

**Compared to all 70b:** $590 + $395 = **$985**

**Savings: ~61%**

**Trade-offs:**
- 8b model may produce lower quality hints for edge cases
- Need A/B testing to validate acceptable quality
- Should log model used per request for quality monitoring

---

### 3. Response Caching

**Concept:** Cache LLM responses for identical or similar requests.

**Cache key options:**

| Strategy | Key Format | Hit Rate | Complexity |
|----------|------------|----------|------------|
| Exact match | `hash(type + desc + code + test)` | Low (~5%) | Low |
| Challenge + test | `hash(type + descHash + test)` | Medium (~15-25%) | Medium |
| Challenge only | `hash(type + descHash)` | Higher (~30%) | High (quality risk) |

**Recommended approach:** Challenge + failing test hash
- Students often hit the same stumbling blocks
- Same failing test usually needs similar guidance
- Cache TTL: 1-4 hours

**Implementation:**
```typescript
const cacheKey = `hint:${challengeType}:${hash(description)}:${hash(failingTest)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
// ... generate hint
await redis.setex(cacheKey, 3600, JSON.stringify(hint));
```

**Trade-offs:**
- Additional Redis memory usage
- Hints may feel less personalized
- Cache invalidation on prompt changes

---

### 4. Quick Wins

#### 4a. Reduce max_tokens

**Current:** 500 tokens allocated for output
**Issue:** Hints are truncated to 300 characters (~75 tokens) by `hintSanitizer.ts`

**Recommendation:** Reduce to 200 tokens

**Savings:** ~300 output tokens per request (60% output reduction)

#### 4b. Add Token Usage Logging

**Current:** No visibility into actual token consumption

**Recommendation:** Log Groq response usage data:
```typescript
const response = await axios.post(...);
logger.info('Token usage', {
  challengeType,
  inputTokens: response.data.usage.prompt_tokens,
  outputTokens: response.data.usage.completion_tokens,
  model: response.data.model,
});
```

**Value:** Validates optimization impact, identifies heavy requests

#### 4c. Lower Temperature

**Current:** 0.7 (moderate randomness)
**Recommendation:** 0.3-0.5 for more deterministic, concise hints

**Impact:** Potentially shorter responses, more consistent quality

---

## Implementation Priority

| Priority | Strategy | Effort | Cost Impact | Risk |
|----------|----------|--------|-------------|------|
| 1 | Reduce max_tokens to 200 | 1 line | 10-15% | None |
| 2 | Add token logging | 10 lines | Visibility | None |
| 3 | Model selection by type | Medium | 30-60% | Quality testing |
| 4 | Type-specific prompts | Medium | 20-30% | API contract |
| 5 | Response caching | High | 10-30% | Complexity |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1)
1. Reduce `max_tokens` from 500 to 200
2. Add token usage logging to Groq client
3. Lower temperature to 0.5

### Phase 2: Model Routing (Week 2-3)
1. Add `challengeType` parameter to API schema
2. Create model routing logic in groqClient
3. Update environment config for model mapping
4. Add quality monitoring/alerting

### Phase 3: Specialized Prompts (Week 3-4)
1. Extract type-specific examples from current prompt
2. Create 4 specialized prompt files
3. Update promptBuilder to select by type
4. Test hint quality per type

### Phase 4: Caching (Optional, if needed)
1. Design cache key strategy
2. Implement Redis caching layer
3. Add cache hit/miss metrics
4. Monitor and tune TTL

---

## API Contract Change

To enable type-based optimizations, the hint request schema needs a new field:

```typescript
interface HintRequest {
  userId: string;
  challengeType: 'html' | 'css' | 'javascript' | 'python';  // NEW
  description: string;
  userInput: string;
  seed?: string;
  hints?: { text: string; failed: boolean }[];
}
```

**Backward compatibility:** Make `challengeType` optional initially, default to full prompt + 70b model if not provided.

---

## Expected Total Savings

With all optimizations implemented:

| Optimization | Savings |
|--------------|---------|
| max_tokens reduction | 10-15% |
| Model routing | 30-60% |
| Type-specific prompts | 20-30% |
| Caching (if implemented) | 10-30% |
| **Combined estimate** | **50-70%** |

---

## Next Steps

1. Review and approve this analysis
2. Coordinate with freeCodeCamp team on `challengeType` parameter
3. Begin Phase 1 implementation
4. Set up cost monitoring dashboard

---

## Prompt Caching Implementation (Groq)

Groq provides automatic prompt caching (50% discount on cached tokens) for our models `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. No API changes are required, but we need to keep prompts cache-friendly and monitor hit rates to ensure hint quality is preserved.

### How We Will Use It
- Keep static content first: system prompt + few-shot examples remain stable per challenge type; dynamic user code and failing tests stay in the user message.
- Maintain message shape: system → user messages only; no per-request structural changes.
- Model stability: keep per-type model mapping (20b for HTML/CSS, 120b for JS/Python) to maximize cache reuse.

### Rollout Plan
1) **Enable & observe (now)**: Caching is already on by default; keep current prompt order. Run smoke tests across all challenge types.
2) **Measure**: Use existing Groq usage logs (`cachedTokens`, `cacheHitRate`, `promptTokens`, `completionTokens`, `model`, `challengeType`). Target ≥60% hit rate when sending multiple requests of the same challenge type in a short window.
3) **Tune prompts (if needed)**: If hit rate is low, reduce variability in system prompts (remove incidental changes) and keep dynamic data out of system prompts.
4) **Quality guardrails**: For any prompt edits, capture before/after sample hints per challenge type; block changes that degrade clarity or specificity. Keep temperature and max_tokens unchanged during cache tuning.

### Monitoring & Reporting
- **Per-request logs** (already added): include `cachedTokens`, `cacheHitRate`, `promptTokens`, `completionTokens`, `model`, `challengeType`.
- **Periodic check**: run `scripts/prove-caching.sh` (identical prompts) and `scripts/test-hints.sh` (real challenge mix) to confirm cache hits and hint quality.
- **Alerting (optional)**: add a simple threshold alert if cacheHitRate < 20% over N requests for a given challenge type, to catch regressions from prompt drift.

### Quality Preservation Checklist
- Do not add timestamps/IDs/randomness to system prompts.
- Keep system prompts stable per challenge type; put all user-specific data in the user message.
- Validate sample hints after any prompt change; compare tone, specificity, and correctness.

### Success Criteria
- Cache hit rate ≥60% for repeated requests of the same challenge type within a session.
- No degradation in hint clarity or correctness in sampled outputs before/after prompt adjustments.
