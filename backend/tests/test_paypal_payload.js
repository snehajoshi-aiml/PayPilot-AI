import { formatPayPalInvoicePayload } from '../src/services/paypalService.js';

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

const mockInvoice = {
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

const payload = formatPayPalInvoicePayload(mockInvoice);

// Assertions on PayPal v2 Invoicing payload structure
assert(payload.detail.invoice_number === 'INV-20261112-9999', 'Invoice number matches');
assert(payload.detail.currency_code === 'INR', 'Currency code normalized to INR');
assert(payload.detail.payment_term.due_date === '2026-11-25', 'Due date correctly assigned in payment term');
assert(payload.detail.payment_term.term_type === 'DUE_ON_DATE_SPECIFIED', 'Payment term type is DUE_ON_DATE_SPECIFIED');

// Primary recipient billing info
assert(payload.primary_recipients.length === 1, 'Single primary recipient');
assert(payload.primary_recipients[0].billing_info.email_address === 'rahul@example.com', 'Recipient email set');
assert(payload.primary_recipients[0].billing_info.name.given_name === 'Rahul', 'Given name extracted as Rahul');
assert(payload.primary_recipients[0].billing_info.name.surname === 'Sharma', 'Surname extracted as Sharma');

// Items check
assert(payload.items.length === 1, 'Line items formatted');
assert(payload.items[0].name === 'Full-Stack Development', 'Item name preserved');
assert(payload.items[0].unit_amount.value === '15000.00', 'Amount formatted with 2 decimal precision');
assert(payload.items[0].unit_amount.currency_code === 'INR', 'Item currency is INR');

// Configuration check
assert(payload.configuration.partial_payment.allow_partial_payment === false, 'Disallow partial payment');

console.log(`\nPayPal Formatter Summary: ${testsPassed} passed, ${testsFailed} failed.`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('All PayPal Payload tests PASSED!\n');
}
