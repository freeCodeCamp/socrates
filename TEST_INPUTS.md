# TEST_INPUTS — API Request Examples

This document contains 24 diverse example requests for testing the `/hint` endpoint. Each example demonstrates different challenge types and scenarios.

## API Key Authentication

**Important:** If your server has `API_KEY` configured in the environment, you must include it in all requests:

```bash
-H "X-API-Key: your-api-key-here"
```

To generate an API key, run:
```bash
npm run generate-api-key
```

Then add it to your `.env` file:
```
API_KEY=your-generated-key
```

## Examples

All curl commands below include the `X-API-Key` header using the `${API_KEY}` environment variable.

**Before running these commands:**
1. Generate an API key: `npm run generate-api-key`
2. Add it to your `.env` file
3. Export it in your shell: `export API_KEY=your-key-here`

Or run without API key validation by leaving `API_KEY` unset in your `.env` file (development mode).

## Example 1: HTML Element Nesting

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Turn the existing text '\''cute cats'\'' into an anchor element","userInput":"<p>Everyone loves cute cats online!</p>","tests":[{"text":"There should be a new anchor element in the first <p> element.","failed":true}],"userId":"user_001"}'
```

## Example 2: JavaScript Function - Sum

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that returns the sum of two numbers","userInput":"function add(a, b) { return a + b }","tests":[{"text":"add(2, 3) should return 5","failed":true}],"userId":"user_002"}'
```

## Example 3: CSS Styling - Background Color

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Add a red background color to the header element","userInput":"header { color: red; }","tests":[{"text":"The header should have a red background color","failed":true}],"userId":"user_003"}'
```

## Example 4: Array Filter - Even Numbers

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Filter out even numbers from an array","userInput":"function filterEven(arr) { return arr.filter(n => n % 2 === 0) }","tests":[{"text":"filterEven([1,2,3,4]) should return [2,4]","failed":true}],"userId":"user_004"}'
```

## Example 5: HTML Form with Submit Button

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Add a submit button to the form","userInput":"<form><input type='\''text'\'' name='\''username'\''></form>","tests":[{"text":"There should be a submit button in the form","failed":true}],"userId":"user_005"}'
```

## Example 6: Object Methods - Calculator

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a calculator object with add and subtract methods","userInput":"const calculator = { add: (a, b) => a + b }","tests":[{"text":"calculator.add(2, 3) should return 5"},{"text":"calculator.subtract(5, 2) should return 3","failed":true}],"userId":"user_006"}'
```

## Example 7: String Manipulation - Reverse

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that reverses a string","userInput":"function reverse(str) { return str.split('\''\'').reverse() }","tests":[{"text":"reverse('\''hello'\'') should return '\''olleh'\''","failed":true}],"userId":"user_007"}'
```

## Example 8: Class Definition - Stack Data Structure (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Implement a stack data structure with push and pop methods","userInput":"class Stack { constructor() { this.items = []; } push(item) { this.items.push(item); } }","tests":[{"text":"Stack should have a push method"},{"text":"Stack should have a pop method","failed":true},{"text":"Stack should have a peek method"},{"text":"Stack should handle empty stack correctly"},{"text":"Stack should maintain LIFO order"}],"userId":"user_008"}'
```

## Example 9: Loop - Print Numbers 1-10 (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Write a loop that prints numbers from 1 to 10","userInput":"for (let i = 1; i <= 10; i++) { console.log(i) }","tests":[{"text":"Loop should start at 1"},{"text":"Loop should end at 10"},{"text":"Should output 10 numbers to the console","failed":true},{"text":"Each number should be on a new line"},{"text":"Numbers should be in ascending order"}],"userId":"user_009"}'
```

## Example 10: Conditional Logic - Age Checker (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that checks if someone is an adult (age >= 18)","userInput":"function isAdult(age) { if (age > 18) return true; }","tests":[{"text":"isAdult(20) should return true","failed":true},{"text":"isAdult(18) should return true"},{"text":"isAdult(17) should return false"},{"text":"isAdult(25) should return true"},{"text":"Function should handle edge case at 18"}],"userId":"user_010"}'
```

## Example 11: Array Iteration - Map Method (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that doubles all numbers in an array using map","userInput":"function doubleArray(arr) { return arr.map(n => n) }","tests":[{"text":"Should use the map method"},{"text":"doubleArray([1, 2, 3]) should return [2, 4, 6]","failed":true},{"text":"Should preserve array length"},{"text":"Should return a new array, not modify original"},{"text":"Should handle negative numbers"},{"text":"Should handle zero"},{"text":"Should handle floating point numbers"},{"text":"Should return empty array when input is empty"},{"text":"Should not mutate the original array"},{"text":"Output array should have same type as input"}],"userId":"user_011"}'
```

## Example 12: Object Key Iteration (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that counts the number of keys in an object","userInput":"function countKeys(obj) { return Object.keys(obj) }","tests":[{"text":"Should return a number"},{"text":"countKeys({a: 1, b: 2}) should return 2","failed":true},{"text":"countKeys({}) should return 0"},{"text":"Should handle nested objects"},{"text":"Should not count inherited properties"},{"text":"Should work with symbol keys"},{"text":"Should handle objects with null prototype"},{"text":"Should handle large objects efficiently"},{"text":"Should distinguish between empty object and null"},{"text":"Result should be a number, not an array"}],"userId":"user_012"}'
```

## Example 13: String Concatenation - Template Literals (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a greeting function using template literals","userInput":"function greet(name, age) { return \"Hello \" + name }","tests":[{"text":"Should include the name in greeting"},{"text":"Should include the age in greeting","failed":true},{"text":"greet('\''Alice'\'', 30) should return '\''Hello Alice, you are 30'\''"},{"text":"Should use template literals"},{"text":"Should handle names with spaces"},{"text":"Should handle single digit ages"},{"text":"Should handle three digit ages"},{"text":"Should not have typos in output"},{"text":"Age should be formatted as a number"},{"text":"String should have proper punctuation"}],"userId":"user_013"}'
```

## Example 14: Array Find - First Match (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that finds the first even number in an array","userInput":"function findFirstEven(arr) { return arr.find(n => n % 2) }","tests":[{"text":"Should use find method"},{"text":"findFirstEven([1, 3, 4, 5]) should return 4","failed":true},{"text":"findFirstEven([2]) should return 2"},{"text":"findFirstEven([1, 3, 5]) should return undefined"},{"text":"Should return the first match, not all matches"},{"text":"Should handle empty arrays"},{"text":"Should handle negative even numbers"},{"text":"Should return original number, not index"},{"text":"Should stop searching after first match"},{"text":"Should handle arrays with duplicates"}],"userId":"user_014"}'
```

## Example 15: Higher Order Function - Filter & Reduce (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create a function that sums all even numbers in an array","userInput":"function sumEvens(arr) { return arr.filter(n => n % 2 === 0) }","tests":[{"text":"Should filter even numbers"},{"text":"Should sum the filtered results","failed":true},{"text":"sumEvens([1, 2, 3, 4, 5, 6]) should return 12"},{"text":"sumEvens([1, 3, 5]) should return 0"},{"text":"sumEvens([]) should return 0"},{"text":"Should handle negative even numbers"},{"text":"Should return a number, not an array"},{"text":"Should use reduce or similar aggregation"},{"text":"Should handle large arrays efficiently"},{"text":"Should not mutate the original array"}],"userId":"user_015"}'
```

## Example 16: CatPhotoApp - Missing Meta Charset

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Fix the meta charset declaration in the HTML head","userInput":"<!DOCTYPE html>\n<html>\n  <head>\n    <meta charset=\"utf-8\"\n    <title>CatPhotoApp</title>\n  </head>","tests":[{"text":"Meta charset tag should have proper syntax"},{"text":"Meta tag should be self-closing with >","failed":true},{"text":"Charset should be set to utf-8"},{"text":"Meta tag should be in the head section"},{"text":"HTML should be valid"}],"userId":"user_016"}'
```

## Example 17: CatPhotoApp - Missing Image Alt Text (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Add alt text to all images in the cat photo gallery","userInput":"<img src=\"https://cdn.freecodecamp.org/curriculum/cat-photo-app/relaxing-cat.jpg\">","tests":[{"text":"Image should have an alt attribute"},{"text":"Alt text should describe the image","failed":true},{"text":"Alt text should be meaningful"},{"text":"Alt attribute is important for accessibility"},{"text":"Should not leave alt empty"}],"userId":"user_017"}'
```

## Example 18: CatPhotoApp - Broken Link Tags (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Fix the anchor tag that links to cat photos","userInput":"<a href=\"https://freecatphotoapp.com\">cat photos</a>","tests":[{"text":"Link should open in new tab with target=\"_blank\""},{"text":"href attribute should be correct URL","failed":true},{"text":"Link text should be descriptive"},{"text":"Link should be functional"},{"text":"URL should not have typos"},{"text":"Target blank is recommended for external links"}],"userId":"user_018"}'
```

## Example 19: CatPhotoApp - Section Structure (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Organize cat photos and lists into proper semantic sections","userInput":"<div>\n  <h2>Cat Photos</h2>\n  <p>Photo content here</p>\n</div>","tests":[{"text":"Should use <section> tags instead of <div>"},{"text":"Each major content area should have its own section","failed":true},{"text":"Sections improve semantic HTML"},{"text":"Better for screen readers and SEO"},{"text":"Makes code more maintainable"},{"text":"Should wrap related content together"}],"userId":"user_019"}'
```

## Example 20: CatPhotoApp - Figure and Figcaption (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Associate image captions with images using figure and figcaption","userInput":"<img src=\"lasagna.jpg\" alt=\"Lasagna\">\n<p>Cats love lasagna.</p>","tests":[{"text":"Image and caption should be wrapped in <figure>"},{"text":"Caption should use <figcaption> tag","failed":true},{"text":"<figure> creates semantic association"},{"text":"<figcaption> is specifically for figure captions"},{"text":"Improves accessibility"},{"text":"Makes relationship between image and text clear"},{"text":"Valid HTML5 structure"}],"userId":"user_020"}'
```

## Example 21: CatPhotoApp - List Elements (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create an ordered list of cat traits","userInput":"<div>\n  <p>1. catnip</p>\n  <p>2. laser pointers</p>\n  <p>3. lasagna</p>\n</div>","tests":[{"text":"Should use <ol> for ordered lists"},{"text":"Each item should be wrapped in <li>","failed":true},{"text":"Don't manually number items"},{"text":"Browser handles numbering automatically"},{"text":"Screen readers benefit from semantic lists"},{"text":"Easier to rearrange items"},{"text":"Proper HTML structure"}],"userId":"user_021"}'
```

## Example 22: CatPhotoApp - Unordered List (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Create an unordered list of things cats love","userInput":"<div>\n  • catnip\n  • laser pointers\n  • lasagna\n</div>","tests":[{"text":"Should use <ul> for unordered lists"},{"text":"Each item should be in <li> tags","failed":true},{"text":"Don't use bullet characters manually"},{"text":"Use proper semantic HTML"},{"text":"Makes content machine-readable"},{"text":"Better accessibility"},{"text":"Consistent formatting across browsers"}],"userId":"user_022"}'
```

## Example 23: CatPhotoApp - Footer Structure (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Add a footer with copyright and link to freeCodeCamp","userInput":"<div class=\"footer\">\n  <p>No Copyright - <a href=\"https://www.freecodecamp.org\">freeCodeCamp.org</a></p>\n</div>","tests":[{"text":"Should use semantic <footer> tag instead of div"},{"text":"Footer should be outside main content","failed":true},{"text":"<footer> has semantic meaning"},{"text":"Better for screen readers"},{"text":"Improves page structure"},{"text":"Footer typically contains metadata"},{"text":"Should be last element in body"}],"userId":"user_023"}'
```

## Example 24: CatPhotoApp - Main Element (Multiple Tests)

```bash
curl -X POST http://localhost:3000/hint \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"description":"Wrap primary content in a main element","userInput":"<body>\n  <h1>CatPhotoApp</h1>\n  <section>Photo content...</section>\n  <footer>Footer</footer>\n</body>","tests":[{"text":"Primary content should be in <main> tags"},{"text":"<main> should wrap the header and all sections","failed":true},{"text":"<main> is semantic and searchable"},{"text":"Helps with page structure"},{"text":"Improves accessibility"},{"text":"Only one <main> per page"},{"text":"Valid HTML5 element"}],"userId":"user_024"}'
```

---

## Usage

1. Copy any curl command above
2. Paste it into your terminal
3. Press Enter to send the request
4. The server will return a JSON response with the hint and model used

## Testing Notes

- Examples 1-7: Single failing test each (basic programming concepts)
- Examples 8-15: Multiple tests (5-10 tests per example)
- Examples 16-24: CatPhotoApp HTML challenges with multiple tests based on real project
- Each example includes a unique `userId` (user_001 through user_024) to track responses per user
- All required fields are included in every example
