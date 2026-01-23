#!/bin/bash
# Test prompt caching by sending multiple requests with the same challenge type

echo "Testing prompt caching with HTML challenges..."
echo "================================================"
echo ""

for i in {1..3}; do
    echo "Request $i:"
    curl -s -X POST http://localhost:3000/hint \
        -H "Content-Type: application/json" \
        -H "X-API-Key: secret" \
        -d '{
            "userId":"cache-test-'$i'",
            "challengeType":"html",
            "description":"Add an h1 element with text CatPhotoApp",
            "userInput":"<h1>Wrong</h1>",
            "hints":[{"text":"Your h1 text should be CatPhotoApp","failed":true}]
        }' | jq -r '.model_used'
    echo ""
    sleep 2
done

echo ""
echo "Check server logs for cache metrics:"
echo "Look for lines containing 'Groq token usage' with cachedTokens and cacheHitRate"
