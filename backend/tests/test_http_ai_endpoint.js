import http from 'http';
import express from 'express';
import aiRoutes from '../src/routes/aiRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ HTTP PASS: ${name}`);
      testsPassed++;
    } else {
      console.error(`❌ HTTP FAIL: ${name}`);
      testsFailed++;
    }
  }

  try {
    // Test 1: Empty body
    const res1 = await fetch(`http://localhost:${port}/api/ai/parse-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data1 = await res1.json();
    assert(res1.status === 400, 'Empty body returns 400 status');
    assert(data1.code === 'INVALID_INPUT', 'Empty body returns INVALID_INPUT code');

    // Test 2: Prompt too short
    const res2 = await fetch(`http://localhost:${port}/api/ai/parse-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi' })
    });
    const data2 = await res2.json();
    assert(res2.status === 400, 'Short prompt returns 400 status');
    assert(data2.error.includes('at least 5 characters'), 'Short prompt explains length requirement');

    // Test 3: Valid prompt with unconfigured API key
    // Ensure GEMINI_API_KEY is unset for this test
    const oldKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = '';

    const res3 = await fetch(`http://localhost:${port}/api/ai/parse-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Create an invoice for Rahul Sharma for website development worth ₹15,000' })
    });
    const data3 = await res3.json();
    assert(res3.status === 503, 'Missing API key returns 503 status');
    assert(data3.code === 'CONFIG_MISSING', 'Missing API key returns CONFIG_MISSING code');
    assert(data3.instructions.includes('GEMINI_API_KEY in backend/.env'), 'Instructions guide user to backend/.env');

    process.env.GEMINI_API_KEY = oldKey;

    console.log(`\nHTTP Tests Summary: ${testsPassed} passed, ${testsFailed} failed.`);
    server.close(() => {
      process.exit(testsFailed > 0 ? 1 : 0);
    });
  } catch (err) {
    console.error('Test execution error:', err);
    server.close(() => process.exit(1));
  }
});
