#!/usr/bin/env npx ts-node

// test-hints.ts
// Runs hint API tests using JSON test case files
// Usage: pnpm run test:manual [test-file.json] [--report]
//        pnpm run test:manual --contract-only
//
// Environment Variables:
//   BASE_URL      - API base URL (default: http://localhost:3001)
//   API_KEY       - API key for authentication (default: secret)
//   REQUEST_DELAY - Delay between requests in seconds (default: 1)
//
// Examples:
//   pnpm run test:manual                          # Run all tests with 1s delay
//   REQUEST_DELAY=2 pnpm run test:manual          # Run all tests with 2s delay
//   REQUEST_DELAY=0 pnpm run test:manual          # Run all tests without delay
//   pnpm run test:manual 01-html-wrong-text.json  # Run single test
//   pnpm run test:manual --report                 # Run all tests and generate report
//   pnpm run test:manual --contract-only          # Run local validation/auth checks only

import * as fs from 'fs';
import * as path from 'path';
import sanitizeHtml from 'sanitize-html';

// --- ANSI colors ---
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const BLUE = '\x1b[0;34m';
const NC = '\x1b[0m';

// --- Config ---
const SCRIPT_DIR = __dirname;
const TEST_CASES_DIR = path.join(SCRIPT_DIR, 'test-cases');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
const API_KEY = process.env.API_KEY ?? 'secret';
const REQUEST_DELAY = Number(process.env.REQUEST_DELAY ?? '1');
const OUTPUT_FILE = path.join(SCRIPT_DIR, 'test-results.md');

// --- Interfaces ---
interface TestHint {
  text: string;
  failed?: boolean;
}

interface TestRequest {
  userId: string;
  challengeType?: string;
  userInput?: string;
  description: string;
  seed?: string;
  hints: TestHint[];
}

interface TestCase {
  name: string;
  challenge: string;
  mistake: string;
  request: TestRequest;
}

interface HintResponse {
  hint?: string;
  model_used?: string;
  message?: string;
  status?: number;
}

interface ContractCase {
  name: string;
  payload: Record<string, unknown>;
  expectedStatus: number;
  apiKey?: string | null;
}

// --- Helpers ---
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function loadTestCase(filePath: string): TestCase {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as TestCase;
}

function getTestFiles(): string[] {
  return fs
    .readdirSync(TEST_CASES_DIR)
    .filter((f) => f.endsWith('.json'))
    .toSorted()
    .map((f) => path.join(TEST_CASES_DIR, f));
}

const validContractRequest = {
  userId: 'contract-test-user',
  challengeType: 'javascript',
  description: 'Return the sum of two numbers.',
  userInput: 'function sum(a, b) { return a + b; }',
  hints: [
    { text: 'The function is declared.' },
    { text: 'The function should return a value.', failed: true },
  ],
};

const contractCases: ContractCase[] = [
  {
    name: 'missing API key is rejected before processing',
    payload: validContractRequest,
    expectedStatus: 401,
    apiKey: null,
  },
  {
    name: 'invalid API key is rejected before processing',
    payload: validContractRequest,
    expectedStatus: 403,
    apiKey: `${API_KEY}-invalid`,
  },
  {
    name: 'unknown request fields are rejected',
    payload: { ...validContractRequest, extra: 'not allowed' },
    expectedStatus: 400,
  },
  {
    name: 'unsupported challenge types are rejected',
    payload: { ...validContractRequest, challengeType: 'ruby' },
    expectedStatus: 400,
  },
  {
    name: 'userInput or seed is required',
    payload: { ...validContractRequest, userInput: undefined },
    expectedStatus: 400,
  },
  {
    name: 'at least one failing hint is required',
    payload: {
      ...validContractRequest,
      hints: [{ text: 'This test passed.', failed: false }],
    },
    expectedStatus: 400,
  },
  {
    name: 'whitespace-only descriptions are rejected',
    payload: { ...validContractRequest, description: '   ' },
    expectedStatus: 400,
  },
  {
    name: 'over-limit user IDs are rejected',
    payload: { ...validContractRequest, userId: 'u'.repeat(129) },
    expectedStatus: 400,
  },
];

// --- Output ---
function printHeader(): void {
  console.log(`\n${BLUE}════════════════════════════════════════════════════════════════${NC}`);
  console.log(`${BLUE}  Socrates - Hint API Test Runner${NC}`);
  console.log(`${BLUE}════════════════════════════════════════════════════════════════${NC}`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  API Key:  ${API_KEY ? '[configured]' : '[missing]'}`);
  console.log(`  Delay:    ${REQUEST_DELAY}s between requests`);
  console.log(`${BLUE}════════════════════════════════════════════════════════════════${NC}\n`);
}

// --- Health check ---
async function checkHealth(): Promise<void> {
  console.log(`${YELLOW}Checking server health...${NC}`);
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const body = (await res.json()) as Record<string, unknown>;
    if (body.status === 'ok') {
      console.log(`${GREEN}✓ Server is healthy${NC}\n`);
      return;
    }
    throw new Error('status not ok');
  } catch {
    console.log(`${RED}✗ Server is not responding at ${BASE_URL}${NC}`);
    console.log('  Make sure the server is running: pnpm dev');
    process.exit(1);
  }
}

async function runContractTests(): Promise<boolean> {
  console.log(`${YELLOW}Running local API contract checks...${NC}`);
  let failed = 0;

  for (const testCase of contractCases) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = testCase.apiKey === undefined ? API_KEY : testCase.apiKey;
    if (apiKey !== null) headers['X-API-Key'] = apiKey;

    try {
      const response = await fetch(`${BASE_URL}/hint`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testCase.payload),
      });

      if (response.status === testCase.expectedStatus) {
        console.log(`  ${GREEN}✓${NC} ${testCase.name}`);
      } else {
        failed++;
        console.log(
          `  ${RED}✗${NC} ${testCase.name} (expected ${testCase.expectedStatus}, received ${response.status})`,
        );
      }
    } catch (err: unknown) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ${RED}✗${NC} ${testCase.name} (${message})`);
    }
  }

  console.log('');
  return failed === 0;
}

function followsHintOutputContract(hint: string): boolean {
  return (
    sanitizeHtml(hint, {
      allowedTags: ['code'],
      allowedAttributes: {},
      disallowedTagsMode: 'escape',
    }) === hint
  );
}

// --- Run a single test ---
async function runTest(testFilePath: string): Promise<boolean> {
  const tc = loadTestCase(testFilePath);
  const challengeType = tc.request.challengeType ?? 'not specified';

  console.log(`${YELLOW}━━━ ${tc.name} ━━━${NC}`);
  console.log(`  Challenge:      ${tc.challenge}`);
  console.log(`  Type:           ${challengeType}`);
  console.log(`  Mistake:        ${tc.mistake}`);

  let response: HintResponse;
  let httpStatus: number;
  let modelUsedHeader: string | null;
  let modelAvailableHeader: string | null;
  try {
    const res = await fetch(`${BASE_URL}/hint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify(tc.request),
    });
    httpStatus = res.status;
    modelUsedHeader = res.headers.get('x-model-used');
    modelAvailableHeader = res.headers.get('x-model-available');
    response = (await res.json()) as HintResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${RED}✗ Error: ${msg}${NC}`);
    console.log('');
    return false;
  }

  const hint = response.hint ?? 'ERROR: No hint returned';
  const model = response.model_used ?? 'unknown';
  const error = response.message;
  const status = response.status;

  if (error || httpStatus !== 200) {
    if (httpStatus === 429 || status === 429 || error?.includes('rate')) {
      console.log(`  ${YELLOW}⚠️  Rate limited: ${error}${NC}`);
      console.log(`  ${BLUE}💡 Try increasing REQUEST_DELAY (current: ${REQUEST_DELAY}s)${NC}\n`);
    } else {
      console.log(`  ${RED}✗ Error: ${error}${NC}`);
    }
    console.log(`  Response: ${JSON.stringify(response)}\n`);
    return false;
  }

  if (!response.hint || !response.model_used) {
    console.log(`  ${RED}✗ Invalid success response shape${NC}\n`);
    return false;
  }

  if (modelUsedHeader !== response.model_used) {
    console.log(`  ${RED}✗ X-Model-Used does not match model_used${NC}\n`);
    return false;
  }

  if (modelAvailableHeader !== 'true' && modelAvailableHeader !== 'false') {
    console.log(`  ${RED}✗ X-Model-Available is missing or invalid${NC}\n`);
    return false;
  }

  if (!followsHintOutputContract(response.hint)) {
    console.log(`  ${RED}✗ Hint contains markup outside the limited-HTML contract${NC}\n`);
    return false;
  }

  console.log(`  ${GREEN}✓ Model Used:${NC}   ${model}`);
  console.log(`  ${GREEN}✓ Hint:${NC}        ${hint}\n`);
  return true;
}

// --- Run all tests ---
async function runAllTests(): Promise<boolean> {
  const testFiles = getTestFiles();
  let passed = 0;
  let failed = 0;
  let testCount = 0;

  for (const testFile of testFiles) {
    testCount++;
    console.log(`\n${YELLOW}Running test ${testCount}...${NC}`);

    if (await runTest(testFile)) {
      passed++;
    } else {
      failed++;
    }

    if (REQUEST_DELAY > 0 && testCount < testFiles.length) {
      console.log(`${BLUE}⏳ Waiting ${REQUEST_DELAY}s before next request...${NC}`);
      await sleep(REQUEST_DELAY);
    }
  }

  console.log(`\n${BLUE}════════════════════════════════════════════════════════════════${NC}`);
  console.log(`  Results: ${GREEN}${passed} passed${NC}, ${RED}${failed} failed${NC}`);
  console.log(`${BLUE}════════════════════════════════════════════════════════════════${NC}`);
  return failed === 0;
}

// --- Generate markdown report ---
async function generateReport(): Promise<void> {
  console.log(`\n${YELLOW}Generating test report...${NC}`);

  const testFiles = getTestFiles();
  const totalTests = testFiles.length;
  const lines: string[] = [];

  lines.push('# Hint API Test Results');
  lines.push('');
  lines.push(`**Date:** ${new Date().toString()}`);
  lines.push(`**Endpoint:** ${BASE_URL}/hint`);
  lines.push('**Model:** gpt-oss-20b (Groq)');
  lines.push('');
  lines.push('---');
  lines.push('');

  let reportCount = 0;

  for (const testFile of testFiles) {
    reportCount++;
    console.log(`${YELLOW}Generating report for test ${reportCount}/${totalTests}...${NC}`);

    const tc = loadTestCase(testFile);
    const challengeType = tc.request.challengeType ?? 'not specified';

    lines.push(`## ${tc.name}`);
    lines.push('');
    lines.push(`**Challenge:** ${tc.challenge}`);
    lines.push('');
    lines.push(`**Challenge Type:** ${challengeType}`);
    lines.push('');
    lines.push(`**Student Mistake:** ${tc.mistake}`);
    lines.push('');
    lines.push('**Student Code:**');
    lines.push('```');
    lines.push(tc.request.userInput ?? tc.request.seed ?? '');
    lines.push('```');
    lines.push('');

    let hint = 'ERROR';
    try {
      const res = await fetch(`${BASE_URL}/hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify(tc.request),
      });
      const body = (await res.json()) as HintResponse;
      hint = body.hint ?? 'ERROR';
    } catch {
      // hint stays "ERROR"
    }

    lines.push('**Hint Response:**');
    lines.push(`> ${hint}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    if (REQUEST_DELAY > 0 && reportCount < totalTests) {
      await sleep(REQUEST_DELAY);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`${GREEN}✓ Report saved to: ${OUTPUT_FILE}${NC}`);
}

// --- CLI arg parsing ---
function parseArgs(): { testFile: string | null; report: boolean; contractOnly: boolean } {
  const args = process.argv.slice(2);
  let testFile: string | null = null;
  let report = false;
  let contractOnly = false;

  for (const arg of args) {
    if (arg === '--report') {
      report = true;
    } else if (arg === '--contract-only') {
      contractOnly = true;
    } else if (!testFile) {
      testFile = arg;
    }
  }

  return { testFile, report, contractOnly };
}

function resolveTestFile(input: string): string {
  if (fs.existsSync(input)) {
    return input;
  }
  const inDir = path.join(TEST_CASES_DIR, input);
  if (fs.existsSync(inDir)) {
    return inDir;
  }
  console.log(`${RED}Test file not found: ${input}${NC}`);
  process.exit(1);
}

// --- Main ---
async function main(): Promise<void> {
  const { testFile, report, contractOnly } = parseArgs();

  printHeader();
  await checkHealth();
  const contractPassed = await runContractTests();

  if (contractOnly) {
    process.exit(contractPassed ? 0 : 1);
  }

  let liveTestsPassed: boolean;
  if (testFile) {
    const resolved = resolveTestFile(testFile);
    liveTestsPassed = await runTest(resolved);
  } else {
    liveTestsPassed = await runAllTests();

    if (report) {
      await generateReport();
    }
  }

  process.exit(contractPassed && liveTestsPassed ? 0 : 1);
}

main();
