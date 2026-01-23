# Prompt Caching

The Librarian API automatically benefits from Groq's prompt caching feature, which reduces costs by 50% for cached tokens and improves response times.

## How It Works

Prompt caching is **automatic** - no code changes are needed. Groq automatically:

1. Identifies matching prefixes from recent requests (within 2 hours)
2. Reuses cached computation for matching portions
3. Processes only the new/changed parts of the prompt
4. Provides a 50% discount on cached input tokens

## Supported Models

Prompt caching works with all models we use:
- `openai/gpt-oss-20b` - Used for HTML and CSS challenges
- `openai/gpt-oss-120b` - Used for JavaScript and Python challenges

## Our Implementation

Our prompt structure is already optimized for caching:

```javascript
{
  messages: [
    { role: 'system', content: systemPrompt },  // Static - cached
    { role: 'user', content: userPrompt }       // Dynamic - processed
  ]
}
```

### What Gets Cached

**Static content (cacheable):**
- System prompts (optimized per challenge type: html, css, javascript, python)
- Few-shot examples in system prompts
- Instruction patterns and formatting rules

**Dynamic content (always processed):**
- User's specific code (`userInput`)
- Challenge descriptions
- Test failure messages
- User IDs and session data

## Monitoring Cache Performance

Cache metrics are automatically logged with each request:

```json
{
  "model": "openai/gpt-oss-20b",
  "challengeType": "html",
  "promptTokens": 4641,
  "cachedTokens": 4608,
  "cacheHitRate": "99.3%",
  "completionTokens": 150,
  "totalTokens": 4791
}
```

### Key Metrics

- **promptTokens**: Total input tokens
- **cachedTokens**: Tokens served from cache
- **cacheHitRate**: Percentage of prompt cached (higher = better)
- **completionTokens**: Output tokens (never cached)

## Expected Cache Performance

### High Cache Hit Rates (80-99%)

Requests using the same challenge type benefit from caching since the system prompt remains identical:

```bash
# Sequential HTML challenges - high cache hits
Request 1: HTML challenge → promptTokens: 1200, cachedTokens: 0 (0%)
Request 2: HTML challenge → promptTokens: 1200, cachedTokens: 1150 (95.8%)
Request 3: HTML challenge → promptTokens: 1200, cachedTokens: 1150 (95.8%)
```

### Lower Cache Hit Rates (0-50%)

Switching between challenge types reduces cache hits since system prompts differ:

```bash
Request 1: HTML challenge  → cachedTokens: 1150 (95.8%)
Request 2: JS challenge    → cachedTokens: 0 (0%) - new system prompt
Request 3: CSS challenge   → cachedTokens: 0 (0%) - new system prompt
Request 4: JS challenge    → cachedTokens: 1100 (91.2%) - JS prompt cached
```

## Cache Lifetime

- Cached data expires after **2 hours** of inactivity
- All cached data exists only in volatile memory (RAM)
- No persistent storage - privacy is maintained

## Cost Savings

With 50% discount on cached tokens:

```
Without caching:
- 10,000 prompt tokens × $0.10/1M = $0.001

With 80% cache hit rate:
- 2,000 uncached tokens × $0.10/1M = $0.0002
- 8,000 cached tokens × $0.05/1M = $0.0004
- Total: $0.0006 (40% cost reduction)
```

## Best Practices

### ✅ Already Implemented

1. **Static content first**: System prompts placed before user prompts
2. **Challenge-type-specific prompts**: Separate optimized prompts for html, css, js, python
3. **Consistent structure**: Same message format across all requests

### ❌ What to Avoid

1. **Don't modify system prompts**: Keep system prompts stable to maximize cache hits
2. **Don't add timestamps to system prompts**: Place variable data in user prompts only
3. **Don't randomize prompt structure**: Maintain consistent message ordering

## Troubleshooting

### Low Cache Hit Rates

**Symptom**: `cacheHitRate` consistently below 50%

**Causes**:
- Frequent challenge type changes
- Cache expired (requests > 2 hours apart)
- System prompt was modified

**Solutions**:
- Expected behavior when switching challenge types
- Maintain stable system prompts
- Group similar challenge types together when testing

### No Cache Hits (0%)

**Symptom**: `cachedTokens: 0` for consecutive requests

**Causes**:
- First request after cache expiration
- Using a new/modified system prompt
- Challenge type not seen recently

**Solutions**:
- Normal for first request or after 2+ hours
- Subsequent requests of same type will cache
- Check logs to verify system prompt consistency

## References

- [Groq Prompt Caching Documentation](https://console.groq.com/docs/prompt-caching)
- [Groq API Reference](https://console.groq.com/docs/api-reference)
