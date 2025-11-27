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

- [ ] Create Express server with health check endpoint
- [ ] Set up CORS and security middleware
- [ ] Configure environment variables
- [ ] Implement basic logging

## Phase 2: Core Data Processing

### Step 2.1: Input Sanitizer Implementation

- [ ] Create sanitizer module to filter noise
- [ ] Implement logic to discard: err, stack, message, testString
- [ ] Extract and keep: description, userInput, first failed test text
- [ ] Add input validation and error handling

### Step 2.2: Prompt Engineering

- [ ] Define system prompt with pedagogical constraints
- [ ] Create user prompt template with XML delimiters
- [ ] Implement prompt builder function
- [ ] Add prompt length validation

### Step 2.3: Ollama Integration

- [ ] Install Ollama client library
- [ ] Configure connection to Ollama server
- [ ] Implement model inference function
- [ ] Add timeout and retry logic

## Phase 3: API Implementation

### Step 3.1: Request/Response Handling

- [ ] Define TypeScript interfaces for request/response
- [ ] Implement POST /hint endpoint
- [ ] Add request validation middleware
- [ ] Create response formatting logic

### Step 3.2: Rate Limiting

- [ ] Install Redis client
- [ ] Implement token bucket algorithm
- [ ] Add per-user rate limiting (10 req/min)
- [ ] Add global rate limiting (1000 req/min)
- [ ] Configure rate limit headers

### Step 3.3: Error Handling

- [ ] Implement comprehensive error handling
- [ ] Create fallback responses for model unavailability
- [ ] Add input validation with 400 responses
- [ ] Implement 429 rate limit responses
- [ ] Set up error logging and monitoring

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

- **Model Size**: < 3 Billion Parameters (Llama 3.2 3B)
- **Pedagogy**: The AI must provide hints, not solutions
- **Input Data**: The raw input contains significant noise that must be filtered

### Data Processing Strategy (The Sanitizer)

**What to Discard (Noise):**

- err & stack: Internal test runner stack traces
- message: Often a duplicate of text
- testString: Raw JS assertion logic
- The Complete Workshop: Risk of future step spoilers

**What to Keep (Signal):**

- Description: The ground truth for the specific step
- User Input: The student's current context
- Active Failed Test: First failed test's natural language text

### Prompt Engineering

**System Prompt:**

```
You are a helpful teaching assistant for a coding bootcamp.
Your goal is to help a student fix their code based on a specific error message.

**Guidelines:**
1.  Analyze the Student Code and the Error Message.
2.  Explain the concept the student is missing (e.g., nesting, attribute syntax).
3.  **CRITICAL:** Do NOT provide the corrected code snippet. Do not write the answer.
4.  Keep your response short (under 50 words).
5.  Be encouraging but concise.
```

**User Prompt Template:**

```
<challenge_instructions>
{cleaned_description}
</challenge_instructions>

<student_code>
{user_input}
</student_code>

<current_error>
{failed_test_text}
</current_error>

Based on the error, give the student a hint.
```

### Infrastructure Requirements

- **Platform**: Local development with Docker, production on DigitalOcean Droplet
- **Runtime**: Ollama for local model serving
- **Model**: Llama 3.2 3B
- **Resources**: Minimum 4GB RAM, 2 CPU cores
- **Rate Limiting**: Redis-based, 10 req/min per user, 1000 req/min global

### API Interface

**Request Schema:**

```json
{
  "userId": "uuid-string",
  "description": "HTML string...",
  "userInput": "HTML string...",
  "tests": [ ...raw test objects... ]
}
```

**Response Schema:**

```json
{
  "hint": "string",
  "model_used": "string"
}
```
