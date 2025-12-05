#!/usr/bin/env bash

# Manual tests script for local development.
# Usage: pnpm run test:manual

BASE_URL=${BASE_URL:-http://localhost:3000}
CONTENT_TYPE="Content-Type: application/json"
API_KEY=${API_KEY:-"secret"}

# Always use API key in headers
API_KEY_HEADER="-H \"X-API-Key: $API_KEY\""
echo "Using API Key: $API_KEY"

echo "== thelibrarian Manual Tests =="
echo "Base URL: ${BASE_URL}"

echo "\n1) Health check"
curl -sS "${BASE_URL}/health" | jq . || { echo "Health check failed (server might be down)"; }

echo "\n2) Valid hint request (JSON default)"
curl -sS -X POST "${BASE_URL}/hint" \
  -H "${CONTENT_TYPE}" \
  -H "Accept: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"userId":"test-user","description":"Fix the heading element","userInput":"<h1>Hello</h1>","seed":"","hints":[{"text":"The h1 element needs proper nesting","failed":true}]}' | jq . || true

echo "\n3) Invalid hint request (missing userId) - should return 400"
curl -sS -w "\nHTTP_STATUS:%{http_code}\n" -X POST "${BASE_URL}/hint" \
  -H "${CONTENT_TYPE}" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Fix export","userInput":"<div></div>","seed":"","hints":[{"text":"test","failed":true}]}' | jq . || true

echo "\n4) Invalid hint request (missing description) - should return 400"
curl -sS -w "\nHTTP_STATUS:%{http_code}\n" -X POST "${BASE_URL}/hint" \
  -H "${CONTENT_TYPE}" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"userId":"test-user","userInput":"<div></div>","seed":"","hints":[{"text":"test","failed":true}]}' | jq . || true

echo "\n5) Rate-limit test loop (5 attempts). Adjust PER_USER_LIMIT for quicker testing."
for i in {1..5}; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/hint" \
    -H "${CONTENT_TYPE}" \
    -H "X-API-Key: ${API_KEY}" \
    -d '{"userId":"rate-limit-test","description":"Rate limit test","userInput":"<div></div>","seed":"","hints":[{"text":"fail","failed":true}]}')
  echo "Attempt $i: $status"
done

echo "\n6) Fallback test: check whether the server returns a fallback hint if the LLM is not available."
echo "(Stop Ollama or set OLLAMA_HOST wrong before running this to emulate model-unavailable fallback.)"
response=$(curl -sS -X POST "${BASE_URL}/hint" \
  -H "${CONTENT_TYPE}" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"userId":"test-user","description":"Test fallback","userInput":"<div></div>","seed":"","hints":[{"text":"fail","failed":true}]}')
echo "$response" | jq . || true
echo "Headers:"
curl -sS -i -X POST "${BASE_URL}/hint" \
  -H "${CONTENT_TYPE}" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"userId":"test-user","description":"Test fallback","userInput":"<div></div>","seed":"","hints":[{"text":"fail","failed":true}]}' 2>&1 | head -20

echo "\nManual tests done. Reminder: Stopping Ollama/pointing OLLAMA_HOST to a wrong address will exercise the fallback behavior (model_used='fallback')."

exit 0
