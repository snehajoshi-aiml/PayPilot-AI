import { formatPayPalInvoicePayload, convertForPayPal, getConversionRate } from '../src/services/paypalService.js';

console.log('--- TESTING PAYPAL INVOICE PAYLOAD FORMATTER ---');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    testsFailed++;
  }
}

// ── Test 1: INR invoice with conversion rate ────────────────────────

const mockInvoiceINR = {
  invoiceNumber: 'INV-20261112-9999',
  customerName: 'Rahul Sharma',
  customerEmail: 'rahul@example.com',
  serviceDescription: 'Full-Stack Development',
  amount: 15000,
  currency: 'INR',
  dueDate: '2026-11-25',
  issueDate: '2026-11-12',
  items: [
    {
      name: 'Full-Stack Development',
      description: 'Building custom React and Express fintech app',
      quantity: 1,
      unitPrice: 15000,
      total: 15000
    }
  ]
};

// Pass explicit conversion rate for deterministic testing (1 INR = 0.012 USD)
const { payload, conversionInfo } = formatPayPalInvoicePayload(mockInvoiceINR, { conversionRate: 0.012 });

// Payload structure assertions
assert(payload.detail.invoice_number === 'INV-20261112-9999', 'Invoice number matches');
assert(payload.detail.currency_code === 'USD', 'Detail currency_code converted to USD for INR invoice');
assert(payload.detail.payment_term.due_date === '2026-11-25', 'Due date correctly assigned in payment term');
assert(payload.detail.payment_term.term_type === 'DUE_ON_DATE_SPECIFIED', 'Payment term type is DUE_ON_DATE_SPECIFIED');

// Primary recipient billing info
assert(payload.primary_recipients.length === 1, 'Single primary recipient');
assert(payload.primary_recipients[0].billing_info.email_address === 'rahul@example.com', 'Recipient email set');
assert(payload.primary_recipients[0].billing_info.name.given_name === 'Rahul', 'Given name extracted as Rahul');
assert(payload.primary_recipients[0].billing_info.name.surname === 'Sharma', 'Surname extracted as Sharma');

// Items — should be converted to USD (15000 * 0.012 = 180.00)
assert(payload.items.length === 1, 'Line items formatted');
assert(payload.items[0].name === 'Full-Stack Development', 'Item name preserved');
assert(payload.items[0].unit_amount.value === '180.00', 'INR amount converted to USD (15000 * 0.012 = 180.00)');
assert(payload.items[0].unit_amount.currency_code === 'USD', 'Item currency is USD after conversion');

// Configuration check
assert(payload.configuration.partial_payment.allow_partial_payment === false, 'Disallow partial payment');

// Conversion info metadata
assert(conversionInfo.originalCurrency === 'INR', 'conversionInfo preserves original currency as INR');
assert(conversionInfo.originalAmount === 15000, 'conversionInfo preserves original amount');
assert(conversionInfo.paypalCurrency === 'USD', 'conversionInfo reports paypalCurrency as USD');
assert(conversionInfo.paypalAmount === 180.00, 'conversionInfo reports converted paypalAmount');
assert(conversionInfo.conversionApplied === true, 'conversionInfo.conversionApplied is true for INR');
assert(conversionInfo.conversionRate === 0.012, 'conversionInfo reports rate used');

// Note should mention the conversion
assert(payload.detail.note.includes('Original amount: INR'), 'Invoice note mentions original INR amount');
assert(payload.detail.note.includes('converted to USD'), 'Invoice note mentions USD conversion');

// ── Test 2: USD invoice (no conversion needed) ─────────────────────

const mockInvoiceUSD = {
  invoiceNumber: 'INV-20261112-8888',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  serviceDescription: 'Consulting',
  amount: 500,
  currency: 'USD',
  dueDate: '2026-12-01',
  issueDate: '2026-11-12'
};

const usdResult = formatPayPalInvoicePayload(mockInvoiceUSD);

assert(usdResult.payload.detail.currency_code === 'USD', 'USD invoice keeps USD currency_code');
assert(usdResult.payload.items[0].unit_amount.currency_code === 'USD', 'USD item keeps USD currency_code');
assert(usdResult.payload.items[0].unit_amount.value === '500.00', 'USD amount unchanged');
assert(usdResult.conversionInfo.conversionApplied === false, 'No conversion for USD invoice');
assert(usdResult.conversionInfo.conversionRate === null, 'Conversion rate is null for USD');
assert(usdResult.conversionInfo.originalCurrency === 'USD', 'Original currency preserved as USD');

console.log(`\nPayPal Formatter Summary: ${testsPassed} passed, ${testsFailed} failed.`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('All PayPal Payload tests PASSED!\n');
}
