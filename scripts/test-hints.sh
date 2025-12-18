#!/usr/bin/env bash

# test-hints.sh
# Runs hint API tests using JSON test case files
# Usage: pnpm run test:manual [test-file.json]

# Don't exit on error - we handle errors in run_test
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_CASES_DIR="${SCRIPT_DIR}/test-cases"
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-secret}"
OUTPUT_FILE="${SCRIPT_DIR}/test-results.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  The Librarian - Hint API Test Runner${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "  Base URL: ${BASE_URL}"
    echo -e "  API Key:  ${API_KEY:0:8}..."
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"
}

check_health() {
    echo -e "${YELLOW}Checking server health...${NC}"
    if curl -s "${BASE_URL}/health" | jq -e '.status == "ok"' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Server is healthy${NC}\n"
        return 0
    else
        echo -e "${RED}✗ Server is not responding at ${BASE_URL}${NC}"
        echo -e "  Make sure the server is running: pnpm dev"
        exit 1
    fi
}

run_test() {
    local test_file="$1"
    local test_name=$(jq -r '.name' "$test_file")
    local challenge=$(jq -r '.challenge' "$test_file")
    local mistake=$(jq -r '.mistake' "$test_file")

    echo -e "${YELLOW}━━━ ${test_name} ━━━${NC}"
    echo -e "  Challenge: ${challenge}"
    echo -e "  Mistake:   ${mistake}"

    # Extract request payload
    local request=$(jq -c '.request' "$test_file")

    # Make API call
    local response=$(curl -s -X POST "${BASE_URL}/hint" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: ${API_KEY}" \
        -d "$request")

    # Extract hint and model
    local hint=$(echo "$response" | jq -r '.hint // "ERROR: No hint returned"')
    local model=$(echo "$response" | jq -r '.model_used // "unknown"')
    local error=$(echo "$response" | jq -r '.message // empty')

    if [ -n "$error" ]; then
        echo -e "  ${RED}✗ Error: ${error}${NC}\n"
        return 1
    else
        echo -e "  ${GREEN}✓ Hint:${NC} ${hint}"
        echo -e "  Model: ${model}\n"
        return 0
    fi
}

run_all_tests() {
    local passed=0
    local failed=0

    for test_file in "${TEST_CASES_DIR}"/*.json; do
        if [ -f "$test_file" ]; then
            if run_test "$test_file"; then
                ((passed++))
            else
                ((failed++))
            fi
        fi
    done

    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "  Results: ${GREEN}${passed} passed${NC}, ${RED}${failed} failed${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
}

generate_report() {
    echo -e "\n${YELLOW}Generating test report...${NC}"

    {
        echo "# Hint API Test Results"
        echo ""
        echo "**Date:** $(date)"
        echo "**Endpoint:** ${BASE_URL}/hint"
        echo "**Model:** llama-3.3-70b-versatile (Groq)"
        echo ""
        echo "---"
        echo ""

        for test_file in "${TEST_CASES_DIR}"/*.json; do
            if [ -f "$test_file" ]; then
                local test_name=$(jq -r '.name' "$test_file")
                local challenge=$(jq -r '.challenge' "$test_file")
                local mistake=$(jq -r '.mistake' "$test_file")
                local user_input=$(jq -r '.request.userInput' "$test_file")
                local request=$(jq -c '.request' "$test_file")

                echo "## ${test_name}"
                echo ""
                echo "**Challenge:** ${challenge}"
                echo ""
                echo "**Student Mistake:** ${mistake}"
                echo ""
                echo "**Student Code:**"
                echo "\`\`\`"
                echo "${user_input}"
                echo "\`\`\`"
                echo ""

                # Get response
                local response=$(curl -s -X POST "${BASE_URL}/hint" \
                    -H "Content-Type: application/json" \
                    -H "X-API-Key: ${API_KEY}" \
                    -d "$request")

                local hint=$(echo "$response" | jq -r '.hint // "ERROR"')

                echo "**Hint Response:**"
                echo "> ${hint}"
                echo ""
                echo "---"
                echo ""
            fi
        done
    } > "$OUTPUT_FILE"

    echo -e "${GREEN}✓ Report saved to: ${OUTPUT_FILE}${NC}"
}

# Main
print_header
check_health

if [ -n "$1" ]; then
    # Run single test file
    if [ -f "$1" ]; then
        run_test "$1"
    elif [ -f "${TEST_CASES_DIR}/$1" ]; then
        run_test "${TEST_CASES_DIR}/$1"
    else
        echo -e "${RED}Test file not found: $1${NC}"
        exit 1
    fi
else
    # Run all tests
    run_all_tests

    # Generate report if --report flag is passed
    if [[ "$*" == *"--report"* ]]; then
        generate_report
    fi
fi

exit 0
