import express from 'express';
import paypalRoutes from '../src/routes/paypalRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/paypal', paypalRoutes);

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`--- TESTING PAYPAL HTTP ENDPOINTS ON PORT ${port} ---`);

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
    // 1. GET /api/paypal/status when credentials are not configured
    const res1 = await fetch(`http://localhost:${port}/api/paypal/status`);
    const data1 = await res1.json();
    assert(res1.status === 200, 'Status endpoint returns 200');
    assert(data1.configured === false, 'Detects unconfigured credentials');
    assert(data1.status === 'CONFIG_REQUIRED', 'Returns status CONFIG_REQUIRED');

    // 2. POST /api/paypal/invoices when credentials missing -> 503
    const res2 = await fetch(`http://localhost:${port}/api/paypal/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerEmail: 'rahul@example.com' })
    });
    const data2 = await res2.json();
    assert(res2.status === 503, 'Create invoice returns 503 when PayPal credentials missing');
    assert(data2.code === 'PAYPAL_CONFIG_REQUIRED', 'Returns code PAYPAL_CONFIG_REQUIRED');

    // 3. POST /api/paypal/invoices/:id/send without explicit confirmation -> 400
    // Temporarily mock credentials to reach confirmation check
    const oldClientId = process.env.PAYPAL_CLIENT_ID;
    const oldClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    process.env.PAYPAL_CLIENT_ID = 'test_client_id';
    process.env.PAYPAL_CLIENT_SECRET = 'test_client_secret';

    const res3 = await fetch(`http://localhost:${port}/api/paypal/invoices/INV2-1234/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: false })
    });
    const data3 = await res3.json();
    assert(res3.status === 400, 'Send invoice rejects unconfirmed request with 400');
    assert(data3.code === 'CONFIRMATION_REQUIRED', 'Returns CONFIRMATION_REQUIRED error code');
    assert(data3.error.includes('Explicit user confirmation'), 'Requires explicit confirmation flag');

    // Restore environment
    process.env.PAYPAL_CLIENT_ID = oldClientId;
    process.env.PAYPAL_CLIENT_SECRET = oldClientSecret;

    console.log(`\nPayPal HTTP Summary: ${testsPassed} passed, ${testsFailed} failed.`);
    server.close(() => {
      process.exit(testsFailed > 0 ? 1 : 0);
    });
  } catch (err) {
    console.error('Test execution error:', err);
    server.close(() => process.exit(1));
  }
});
