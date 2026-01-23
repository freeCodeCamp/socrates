#!/usr/bin/env bash
# prove-caching.sh
# Demonstrates Groq prompt caching by sending two identical requests
# and showing cached token counts from the API response.

set -euo pipefail

MODEL="${MODEL:-openai/gpt-oss-20b}"
SYSTEM_PROMPT=${SYSTEM_PROMPT:-"You are a concise code reviewer."}
USER_PROMPT=${USER_PROMPT:-"Review this function and suggest one improvement."}
GROQ_API_KEY=${GROQ_API_KEY:-""}

if [[ -z "$GROQ_API_KEY" ]]; then
  echo "GROQ_API_KEY is required" >&2
  exit 1
fi

call_groq() {
  local label="$1"
  local response
  response=$(curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${GROQ_API_KEY}" \
    -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"system\",\"content\":\"${SYSTEM_PROMPT}\"},{\"role\":\"user\",\"content\":\"${USER_PROMPT}\"}],\"max_tokens\":64,\"temperature\":0.2}")

  local prompt_tokens completion_tokens cached_tokens cache_hit_rate
  prompt_tokens=$(echo "$response" | jq -r '.usage.prompt_tokens // 0')
  completion_tokens=$(echo "$response" | jq -r '.usage.completion_tokens // 0')
  cached_tokens=$(echo "$response" | jq -r '.usage.prompt_tokens_details.cached_tokens // 0')
  if [[ "$prompt_tokens" != "0" ]]; then
    cache_hit_rate=$(python - <<PY
pt=${prompt_tokens}
ct=${cached_tokens}
print(f"{(ct/pt*100):.1f}%" if pt else "0.0%")
PY
)
  else
    cache_hit_rate="0.0%"
  fi

  echo "${label}:"
  echo "  model:             ${MODEL}"
  echo "  prompt_tokens:     ${prompt_tokens}"
  echo "  cached_tokens:     ${cached_tokens}"
  echo "  cache_hit_rate:    ${cache_hit_rate}"
  echo "  completion_tokens: ${completion_tokens}"
  echo
}

export PROMPT_TOKENS CACHED_TOKENS

# First call seeds the cache
PROMPT_TOKENS=0 CACHED_TOKENS=0
call_groq "Request 1 (cache warm-up)"

# Second call should show cached_tokens > 0 when caching hits
PROMPT_TOKENS=0 CACHED_TOKENS=0
call_groq "Request 2 (expected cache hit)"
