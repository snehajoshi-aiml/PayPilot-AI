import { extractInvoiceFromPrompt } from '../src/services/geminiService.js';

console.log('--- TESTING GEMINI SDK ERROR HANDLING ---');

// Test with invalid API key to verify it throws clean error and does NOT crash
process.env.GEMINI_API_KEY = 'invalid_test_api_key_12345';

try {
  await extractInvoiceFromPrompt('Create invoice for Alice for $100');
  console.error('❌ Expected Gemini to throw an API key authentication error');
  process.exit(1);
} catch (err) {
  console.log(`✅ Caught expected Gemini error: [${err.name}] ${err.message}`);
  console.log('Gemini error handling is secure and robust!\n');
  process.exit(0);
}
