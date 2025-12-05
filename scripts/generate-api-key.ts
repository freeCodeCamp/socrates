#!/usr/bin/env ts-node

import { randomBytes } from 'node:crypto';

/**
 * Generate a secure random API key
 * @param length - Length of the API key in bytes (default: 32)
 * @returns A hex-encoded API key string
 */
function generateApiKey(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

// Main execution
if (require.main === module) {
  const apiKey = generateApiKey();
  console.log('Generated API Key:');
  console.log(apiKey);
  console.log('\nAdd this to your .env file:');
  console.log(`API_KEY=${apiKey}`);
  console.log('\nClients should send this key in the X-API-Key header');
}

export { generateApiKey };
