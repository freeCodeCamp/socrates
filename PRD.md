# Implementation Plan: freeCodeCamp AI Hint API

## Phase 1: Project Setup & Infrastructure

### Step 1.1: Environment Setup

- [x] Initialize Node.js project with TypeScript
- [x] Set up Express.js server framework
- [x] Configure development environment with nodemon
- [x] Set up ESLint and Prettier for code quality

### Step 1.2: Local Development Infrastructure

- [x] Install Docker and Docker Compose (local)
- [x] Set up Ollama container with Llama 3.2 3B
- [x] Set up Redis for rate limiting

### Step 1.3: Basic API Structure

- [x] Create Express server with health check endpoint
- [x] Set up CORS and security middleware
- [x] Configure environment variables
- [x] Implement basic logging

## Phase 2: Core Data Processing

### Step 2.1: Input Sanitizer Implementation

- [x] Create sanitizer module to filter noise
- [x] Implement logic to discard: err, stack, message, testString
- [x] Extract and keep: description, userInput, first failed test text
- [x] Add input validation and error handling

### Step 2.2: Prompt Engineering

- [x] Define system prompt with pedagogical constraints
- [x] Create user prompt template with XML delimiters
- [x] Implement prompt builder function
- [x] Add prompt length validation

### Step 2.3: Ollama Integration

- [x] Install Ollama client library
- [x] Configure connection to Ollama server
- [x] Implement model inference function
- [x] Add timeout and retry logic

## Phase 3: API Implementation

### Step 3.1: Request/Response Handling

- [x] Define TypeScript interfaces for request/response
- [x] Implement POST /hint endpoint
- [x] Add request validation middleware
- [x] Create response formatting logic

### Step 3.2: Rate Limiting

- [x] Install Redis client
- [x] Implement token bucket algorithm (atomic via Redis Lua script)
- [x] Add per-user rate limiting (10 req/min)
- [x] Add global rate limiting (1000 req/min)
- [x] Configure rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)

### Step 3.3: Error Handling

- [x] Implement comprehensive error handling
- [x] Create fallback responses for model unavailability
- [x] Add input validation with 400 responses
- [x] Implement 429 rate limit responses
- [x] Set up error logging and monitoring

## Phase 4: Testing & Quality Assurance

### Step 4.1: Unit Testing

- [ ] Test sanitizer logic with various inputs
- [ ] Test prompt building functionality
- [ ] Test Ollama integration (mocked)
- [ ] Test rate limiting logic

### Step 4.2: Integration Testing

- [ ] Test full API endpoint flow
- [ ] Test with real Ollama server
- [ ] Test error scenarios
- [ ] Test rate limiting behavior

### Step 4.3: Performance Testing

- [ ] Measure response times
- [ ] Test concurrent requests
- [ ] Validate memory usage
- [ ] Optimize bottlenecks

## Phase 5: Deployment & Monitoring

### Step 5.1: Production Deployment

- [ ] Create Dockerfile for application
- [ ] Set up Docker Compose with Redis and Ollama
- [ ] Configure environment variables for production
- [ ] Create DigitalOcean Droplet (4GB RAM, 2 CPU cores)
- [ ] Configure firewall and security settings
- [ ] Deploy to DigitalOcean Droplet

### Step 5.2: Monitoring & Logging

- [ ] Set up application logging
- [ ] Configure health checks
- [ ] Monitor resource usage
- [ ] Set up alerting for failures

### Step 5.3: Documentation

- [ ] Create API documentation
- [ ] Write deployment guide
- [ ] Document configuration options
- [ ] Create troubleshooting guide

## Technical Specifications

### Core Constraints & Requirements

- **Model**: qwen2.5:7b (7 Billion Parameters) - Upgraded from llama3.2:3b for improved instruction-following
- **Language Support**: Language-agnostic design validated with HTML, CSS, JavaScript, and Python
- **Pedagogy**: The AI must provide hints, not solutions
- **Input Data**: The raw input contains significant noise that must be filtered
- **Hint Quality**: Max 20 words per hint, concept-focused, no solution-giving

### Data Processing Strategy (The Sanitizer)

**Input Fields (from freeCodeCamp):**

- **description**: Step instructions with learning objectives and examples
- **userInput**: The student's attempted code that failed tests
- **seed**: The starting code state for the challenge
- **hints**: Array of test failure messages (natural language)
- **userId**: User identifier for rate limiting

**Processing:**

- Validates all required fields are present and non-empty
- Trims whitespace from text fields
- Concatenates hints array into a single string for the prompt
- Filters out invalid or empty hint entries

### Prompt Engineering

**System Prompt:**

```
You are a helpful teaching assistant for freeCodeCamp.
Your goal is to help students understand coding concepts by analyzing their failed attempts.

**Guidelines:**
1. Analyze the challenge instructions, student's code, starting code (seed), and failing tests.
2. Identify the specific misconception or error in the student's approach.
3. Give ONE concise hint about what concept they need to understand (1-2 sentences max).
4. CRITICAL: NEVER provide the exact solution, specific code, or corrected values.
5. CRITICAL: Do NOT say "add X" or "use Y" - that's giving the answer.
6. CRITICAL: Keep response under 30 words. Be extremely brief.
7. Guide them toward understanding the concept, not the implementation.
8. Do not ask questions. State the concept directly.
9. Be encouraging but terse.
```

**User Prompt Template:**

```
<challenge_instructions>
{description}
</challenge_instructions>

<starting_code>
{seed}
</starting_code>

<student_attempt>
{userInput}
</student_attempt>

<failing_tests>
{hints}
</failing_tests>

Based on what the student tried versus what was expected, give them a brief conceptual hint.
```

### Infrastructure Requirements

- **Platform**: Local development with Docker, production on DigitalOcean Droplet
- **Runtime**: Ollama for local model serving
- **Model**: qwen2.5:7b (7B parameters, ~5GB memory requirement)
- **Resources**: Minimum 8GB RAM, 2-4 CPU cores (7B model requires more than 3B)
- **Rate Limiting**: Redis-based, 10 req/min per user, 1000 req/min global

### API Interface

**Request Schema:**

```json
{
  "userId": "uuid-string",
  "description": "Step instructions with examples...",
  "userInput": "Student's attempted code...",
  "seed": "Starting code from challenge...",
  "hints": ["Test message 1", "Test message 2", ...]
}
```

**Response (default):**

- Content-Type: `application/json`
- Body: JSON with a single concatenated hint, e.g. `{ "hint": "...", "model_used": "..." }`
- Header: `X-Model-Used` with the model identifier (e.g., `qwen2.5:7b`)

If the client requests JSON (via `Accept: application/json`), the server will respond with:

```json
{
  "hint": "string",
  "model_used": "string"
}
```

Note: `hint` is a single string representing the final concatenated hint. If the model streams the response in chunks (JSONL), the API concatenates streamed fragments into a single `hint` string before returning.

## Language Expansion Roadmap

The hint system uses a language-agnostic architecture to support freeCodeCamp's 14,000+ challenges. Current implementation is validated across Tier 1 languages with a clear path for expansion.

### Tier 1: Current Implementation (Validated & Production-Ready)

**Languages:** HTML, CSS, JavaScript, Python

**Status:** Production-ready with comprehensive testing

**Validation:** 
- Test cases: `COMPARISON_TESTS.md` (8 examples across 4 languages)
- Results: `comparison-results.md` (3 runs per test, averaged)
- Test script: `./scripts/test-comparison.sh` (generates fresh results with 3 runs per test, averages responses)

**Performance:**
- HTML: Accurately identifies missing elements and text content gaps
- CSS: Guides students to missing properties and value corrections
- JavaScript: Identifies variable declaration, function call, and parameter issues
- Python: Highlights import statements, indentation, and module usage problems

### Tier 2: Backend & Data Structures (Ready for Implementation)

**Languages/Topics:**
- Node.js + Express.js (routing, middleware, templating)
- SQL & Databases (queries, schema design, relationships)
- React.js (components, hooks, state management)
- Data Structures (arrays, objects, trees, graphs)

**Implementation Strategy:**
1. Create test cases in new file: `TIER2_TESTS.md` (2-3 examples per topic)
2. Validate using existing `./scripts/test-comparison.sh`
3. Review hints for correctness and concept-focus
4. Deploy incrementally with frontend monitoring
5. Iterate on prompts based on student feedback

**Expected Performance:** ~3,000 additional challenges supported

### Tier 3: Specialized Languages & Platforms (Future)

**Languages/Topics:**
- Strongly-typed languages: C/C++, Java, C#
- Dynamic languages: Ruby, Go, Rust, PHP
- Advanced topics: Git/DevOps, Cryptography, System Design
- External platforms: CodePen, AWS, Certifications

**Implementation Strategy:**
- Monitor Tier 1 & 2 performance for model drift
- Collect real hint requests from frontend to identify blind spots
- Augment system prompt with language-specific examples if needed
- May require fine-tuning for specialized domains

**Expected Performance:** ~8,000 additional challenges supported

### Scaling & Maintenance

**Prompt Evolution:**
- Current prompts use language-agnostic analysis framework
- New languages tested first with existing prompts
- If success < 80%, add language-specific examples
- Collect frontend team feedback for iteration

**Model Considerations:**
- qwen2.5:7b provides strong instruction-following and reasoning
- Larger models (13B+) available for specialized reasoning if needed
- Fine-tuning possible if quality degrades with domain-specific content

**Quality Assurance:**
1. Create test cases (2-3 per new language/topic)
2. Run `./scripts/test-comparison.sh` for baseline
3. Review hints for correctness and concept-focus
4. Deploy with frontend monitoring
5. Iterate based on real student feedback
