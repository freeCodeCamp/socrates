#!/usr/bin/env bash

# Manual tests script for local development.
# Usage: npm run test:manual

BASE_URL=${BASE_URL:-http://localhost:3000}
CONTENT_TYPE="Content-Type: application/json"
API_KEY=${API_KEY:-""}

# If API_KEY is set, use it in headers
if [ -n "$API_KEY" ]; then
  API_KEY_HEADER="-H \"X-API-Key: $API_KEY\""
  echo "Using API Key from environment"
else
  API_KEY_HEADER=""
  echo "No API Key set - requests may fail if API key is required"
fi

echo "== thelibrarian Manual Tests =="
echo "Base URL: ${BASE_URL}"

echo "\n1) Health check"
curl -sS "${BASE_URL}/health" | jq . || { echo "Health check failed (server might be down)"; }

echo "\n2) Valid hint request (JSON default)"
eval curl -sS -X POST \"${BASE_URL}/hint\" -H \"${CONTENT_TYPE}\" -H \"Accept: application/json\" $API_KEY_HEADER -d \'{\"userId\":\"test-user\",\"description\":\"Fix export of the main component\",\"userInput\":\"<div><h1></div>\",\"tests\":[{\"text\":\"Expected <h1> nesting\",\"failed\":true}]}\' | jq . || true

echo "\n3) Invalid hint request (missing userId) - should return 400"
eval curl -sS -w \"\\nHTTP_STATUS:%{http_code}\\n\" -X POST \"${BASE_URL}/hint\" -H \"${CONTENT_TYPE}\" $API_KEY_HEADER -d \'{\"description\":\"Fix export\",\"userInput\":\"<div></div>\",\"tests\":[{\"text\":\"test\",\"failed\":true}]}\' | jq . || true

echo "\n4) Invalid hint request (missing tests) - should return 400"
eval curl -sS -w \"\\nHTTP_STATUS:%{http_code}\\n\" -X POST \"${BASE_URL}/hint\" -H \"${CONTENT_TYPE}\" $API_KEY_HEADER -d \'{\"userId\":\"test-user\",\"description\":\"Fix export\",\"userInput\":\"<div></div>\"}\' | jq . || true

echo "\n5) Rate-limit test loop (5 attempts). Adjust PER_USER_LIMIT for quicker testing."
for i in {1..5}; do
  status=$(eval curl -s -o /dev/null -w \"%{http_code}\" -X POST \"${BASE_URL}/hint\" -H \"${CONTENT_TYPE}\" $API_KEY_HEADER -d \'{\"userId\":\"rate-limit-test\",\"description\":\"Rate limit test\",\"userInput\":\"<div></div>\",\"tests\":[{\"text\":\"fail\",\"failed\":true}]}\')
  echo "Attempt $i: $status"
done

echo "\n6) Fallback test: check whether the server returns a fallback hint if the LLM is not available."
echo "(Stop Ollama or set OLLAMA_HOST wrong before running this to emulate model-unavailable fallback.)"
response=$(eval curl -sS -X POST \"${BASE_URL}/hint\" -H \"${CONTENT_TYPE}\" $API_KEY_HEADER -d \'{\"userId\":\"test-user\",\"description\":\"Test fallback\",\"userInput\":\"<div></div>\",\"tests\":[{\"text\":\"fail\",\"failed\":true}]}\')
echo "$response" | jq . || true
echo "Headers (if curl supports it):"
eval curl -sSI -X POST \"${BASE_URL}/hint\" -H \"${CONTENT_TYPE}\" $API_KEY_HEADER -d \'{\"userId\":\"test-user\",\"description\":\"Test fallback\",\"userInput\":\"<div></div>\",\"tests\":[{\"text\":\"fail\",\"failed\":true}]}\' | sed -n \'1,20p\'

echo "\nManual tests done. Reminder: Stopping Ollama/pointing OLLAMA_HOST to a wrong address will exercise the fallback behavior (model_used='fallback')."

exit 0
