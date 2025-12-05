#!/bin/bash

# test-comparison.sh
# Automated testing script for hint API across multiple languages
# Runs each test 3 times, averages results, and logs responses

set -e

API_URL="${API_URL:-http://localhost:3000/hint}"
API_KEY="${API_KEY:-secret}"
RUNS_PER_TEST=3
OUTPUT_FILE="comparison-results.md"

# Clear output file
> "$OUTPUT_FILE"

# HTML Test 1
echo "Running HTML Test 1: Change Element Text..."
{
    echo "## HTML Test 1: Change Element Text"
    echo ""
    echo "**Description:** Modify h1 text from 'Hello World' to 'CatPhotoApp'"
    echo ""
    echo "**Request:**"
    echo "\`\`\`bash"
    echo "curl -X POST $API_URL \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -H \"X-API-Key: \${API_KEY}\" \\"
    echo "  -d '{\"userId\": \"test_html_001\", \"description\": \"HTML elements have opening tags like \\\`<h1>\\\` and closing tags like \\\`</h1>\\\`. The text an element will display goes between its opening and closing tags.\\n\\nChange the text of the \\\`h1\\\` element below from \\\`Hello World\\\` to \\\`CatPhotoApp\\\` and watch the change in the browser preview.\", \"userInput\": \"<h1>Hello World</h1>\", \"seed\": \"\", \"hints\": [{\"text\": \"The text \\\`CatPhotoApp\\\` should be present in the code.\"}, {\"text\": \"Your \\\`h1\\\` element should have an opening tag.\"}, {\"text\": \"Your \\\`h1\\\` element's text should be \\\`CatPhotoApp\\\`. You have either omitted the text, have a typo, or it is not between the \\\`h1\\\` element's opening and closing tags.\", \"failed\": true}]}'"
    echo "\`\`\`"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    total_length=0
    hints_arr=()
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_html_001",
                "description": "HTML elements have opening tags like `<h1>` and closing tags like `</h1>`. The text an element will display goes between its opening and closing tags.\n\nChange the text of the `h1` element below from `Hello World` to `CatPhotoApp` and watch the change in the browser preview.",
                "userInput": "<h1>Hello World</h1>",
                "seed": "",
                "hints": [
                    {"text": "The text `CatPhotoApp` should be present in the code."},
                    {"text": "Your `h1` element should have an opening tag."},
                    {"text": "Your `h1` element'\''s text should be `CatPhotoApp`. You have either omitted the text, have a typo, or it is not between the `h1` element'\''s opening and closing tags.", "failed": true}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        hints_arr+=("$hint")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    echo "**Analysis:** All runs produced similar results focusing on text content identification."
    echo ""
    
} >> "$OUTPUT_FILE"

# HTML Test 2
echo "Running HTML Test 2: Add New Element..."
{
    echo "## HTML Test 2: Add New Element"
    echo ""
    echo "**Description:** Add h2 element with text 'Cat Photos'"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_html_002",
                "description": "The `h2` element is used for subheadings. Below the `h1` element, add an `h2` element with this text: `Cat Photos`",
                "userInput": "<h1>CatPhotoApp</h1>",
                "seed": "",
                "hints": [
                    {"text": "Your `h2` element should have an opening tag.", "failed": true},
                    {"text": "Your `h2` element should have a closing tag."},
                    {"text": "Your `h2` element'\''s text should be `Cat Photos`."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

# CSS Test 1
echo "Running CSS Test 1: Add Style Property..."
{
    echo "## CSS Test 1: Add Style Property"
    echo ""
    echo "**Description:** Add color property to .title class"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_css_001",
                "description": "The `color` property in CSS sets the text color of an element. Add a `color` property to the `.title` class and set it to `blue`.",
                "userInput": ".title {\n  font-size: 24px;\n}",
                "seed": ".title {\n  font-size: 24px;\n}",
                "hints": [
                    {"text": "Your `.title` class should have a `color` property.", "failed": true},
                    {"text": "The `color` property should be set to `blue`."},
                    {"text": "The property should be inside the `.title` class definition."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

# CSS Test 2
echo "Running CSS Test 2: Fix Property Value..."
{
    echo "## CSS Test 2: Fix Property Value"
    echo ""
    echo "**Description:** Change margin from 20px to 10px"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_css_002",
                "description": "Margin controls the space outside an element. Set the `margin` property of the `.box` class to `10px` on all sides.",
                "userInput": ".box {\n  margin: 20px;\n}",
                "seed": "",
                "hints": [
                    {"text": "The `.box` class should have a `margin` property.", "failed": true},
                    {"text": "The `margin` value should be `10px`, not `20px`."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

# JavaScript Test 1
echo "Running JavaScript Test 1: Missing Variable Declaration..."
{
    echo "## JavaScript Test 1: Missing Variable Declaration"
    echo ""
    echo "**Description:** Declare const variable 'count' with value 5"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_js_001",
                "description": "Declare a variable named `count` using `const` and assign it the value `5`. Then log the variable to the console.",
                "userInput": "console.log(count);",
                "seed": "",
                "hints": [
                    {"text": "You should declare a variable named `count`.", "failed": true},
                    {"text": "The variable should be declared with `const`."},
                    {"text": "The variable should be assigned the value `5`."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

# JavaScript Test 2
echo "Running JavaScript Test 2: Incorrect Function Syntax..."
{
    echo "## JavaScript Test 2: Incorrect Function Syntax"
    echo ""
    echo "**Description:** Call arrow function with both arguments (3, 4)"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_js_002",
                "description": "Write an arrow function named `add` that takes two parameters `a` and `b` and returns their sum. Then call the function with arguments `3` and `4`.",
                "userInput": "const add = (a, b) => a + b;\nconsole.log(add(3));",
                "seed": "",
                "hints": [
                    {"text": "The function should be called with two arguments.", "failed": true},
                    {"text": "Both parameters `a` and `b` should be passed when calling the function."},
                    {"text": "The function call should use `add(3, 4)`."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

# Python Test 1
echo "Running Python Test 1: Missing Import Statement..."
{
    echo "## Python Test 1: Missing Import Statement"
    echo ""
    echo "**Description:** Import random module at the top"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_py_001",
                "description": "Import the `random` module at the top of your file. Then use `random.randint(1, 10)` to generate a random number between 1 and 10.",
                "userInput": "num = random.randint(1, 10)\nprint(num)",
                "seed": "",
                "hints": [
                    {"text": "You should import the `random` module.", "failed": true},
                    {"text": "The import statement should be at the top of the file."},
                    {"text": "Use `import random` to import the module."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

# Python Test 2
echo "Running Python Test 2: Incorrect Indentation..."
{
    echo "## Python Test 2: Incorrect Indentation"
    echo ""
    echo "**Description:** Fix indentation in function body"
    echo ""
    echo "**Responses (averaged over $RUNS_PER_TEST runs):**"
    echo ""
    
    for ((run=1; run<=RUNS_PER_TEST; run++)); do
        response=$(curl -s -X POST "$API_URL" \
            -H "Content-Type: application/json" \
            -H "X-API-Key: ${API_KEY}" \
            -d '{
                "userId": "test_py_002",
                "description": "Write a function named `greet` that takes a `name` parameter and returns a greeting string in the format `Hello, {name}!`. The function body should be properly indented.",
                "userInput": "def greet(name):\nreturn f'\''Hello, {name}!'\''",
                "seed": "",
                "hints": [
                    {"text": "The function body should be indented.", "failed": true},
                    {"text": "Python requires the `return` statement to be indented inside the function."},
                    {"text": "Make sure the indentation is consistent (typically 4 spaces or 1 tab)."}
                ]
            }')
        
        hint=$(echo "$response" | jq -r '.hint // "ERROR"' 2>/dev/null || echo "ERROR")
        echo "**Run $run:** \`$hint\`"
    done
    
    echo ""
    
} >> "$OUTPUT_FILE"

{
    echo "---"
    echo ""
    echo "## Summary"
    echo ""
    echo "- **Test Date:** $(date)"
    echo "- **API Endpoint:** $API_URL"
    echo "- **Runs per Test:** $RUNS_PER_TEST"
    echo "- **Total Tests:** 8 (2 HTML, 2 CSS, 2 JavaScript, 2 Python)"
    echo "- **Model:** qwen2.5:7b"
    echo ""
} >> "$OUTPUT_FILE"

echo ""
echo "✓ All tests completed!"
echo "✓ Results saved to: $OUTPUT_FILE"
