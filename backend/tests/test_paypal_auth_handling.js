import { getPayPalAccessToken } from '../src/services/paypalService.js';

console.log('--- TESTING PAYPAL REAL OAUTH ERROR HANDLING ---');

// Set dummy invalid credentials to test real rejection by PayPal Sandbox endpoint
process.env.PAYPAL_CLIENT_ID = 'dummy_invalid_sandbox_client_id_12345';
process.env.PAYPAL_CLIENT_SECRET = 'dummy_invalid_sandbox_secret_67890';

try {
  await getPayPalAccessToken();
  console.error('❌ Expected PayPal Sandbox to reject invalid credentials');
  process.exit(1);
} catch (err) {
  console.log(`✅ Caught expected PayPal rejection: [${err.code}] ${err.message}`);
  console.log('PayPal authentication refuses dummy credentials and never simulates success!\n');
  process.exit(0);
}
