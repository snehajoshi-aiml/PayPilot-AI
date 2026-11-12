import {
  normalizePayPalStatus,
  extractPayPalPaymentDetails,
  buildTrackingRecord,
  checkRateLimit
} from '../src/services/paymentTrackingService.js';

console.log('--- TESTING PAYMENT TRACKING & STATUS LIFECYCLE ---');

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

// 1. Test Status Normalization: DRAFT
const draftStatus = normalizePayPalStatus('DRAFT');
assert(draftStatus.normalizedStatus === 'DRAFT', 'Normalize DRAFT status');
assert(draftStatus.colorCategory === 'amber', 'DRAFT uses amber badge color');
assert(draftStatus.isOverdue === false, 'DRAFT is not overdue');

// 2. Test Status Normalization: SENT (Future due date)
const sentFuture = normalizePayPalStatus('SENT', '2099-12-31');
assert(sentFuture.normalizedStatus === 'SENT', 'Future SENT invoice normalized as SENT');
assert(sentFuture.isOverdue === false, 'Future SENT invoice is not overdue');
assert(sentFuture.displayLabel.includes('Awaiting Payment'), 'SENT indicates awaiting payment');

// 3. Test Status Normalization: SENT (Past due date -> OVERDUE)
const sentPast = normalizePayPalStatus('SENT', '2020-01-01');
assert(sentPast.normalizedStatus === 'OVERDUE', 'Past SENT invoice detected as OVERDUE');
assert(sentPast.isOverdue === true, 'isOverdue is true for expired due date');
assert(sentPast.colorCategory === 'rose', 'OVERDUE uses rose alert color');

// 4. Test Status Normalization: PAID and MARKED_AS_PAID
const paidStatus = normalizePayPalStatus('PAID');
assert(paidStatus.normalizedStatus === 'PAID', 'Normalize PAID status');
assert(paidStatus.colorCategory === 'emerald', 'PAID uses emerald color');

const markedPaidStatus = normalizePayPalStatus('MARKED_AS_PAID');
assert(markedPaidStatus.normalizedStatus === 'PAID', 'Normalize MARKED_AS_PAID to PAID');
assert(markedPaidStatus.displayLabel === 'Marked as Paid', 'Display label specifies marked as paid');

// 5. Test Status Normalization: CANCELLED & PARTIALLY_PAID
const cancelled = normalizePayPalStatus('CANCELLED');
assert(cancelled.normalizedStatus === 'CANCELLED', 'Normalize CANCELLED status');

const partiallyPaid = normalizePayPalStatus('PARTIALLY_PAID');
assert(partiallyPaid.normalizedStatus === 'PARTIALLY_PAID', 'Normalize PARTIALLY_PAID');

// 6. Test Payment Extraction: Genuine vs Empty (Never fake payments)
const emptyInvoice = {
  status: 'SENT',
  payments: null
};
const emptyPaymentDetails = extractPayPalPaymentDetails(emptyInvoice);
assert(emptyPaymentDetails.hasVerifiedPayment === false, 'Unpaid invoice has hasVerifiedPayment = false');
assert(emptyPaymentDetails.paidAmount === 0, 'Unpaid invoice has 0 paidAmount');
assert(emptyPaymentDetails.transactions.length === 0, 'Unpaid invoice has empty transactions list');
assert(emptyPaymentDetails.verificationSource === 'NONE', 'Verification source is NONE when unpaid');

// Genuine payment payload
const invoiceWithPayment = {
  status: 'PAID',
  payments: {
    paid_amount: { currency_code: 'USD', value: '150.00' },
    transactions: [
      {
        payment_id: 'CAPTURE-789XYZ',
        payment_date: '2026-11-12T10:00:00Z',
        method: 'PAYPAL',
        amount: { currency_code: 'USD', value: '150.00' },
        note: 'Payment received via PayPal checkout'
      }
    ]
  }
};
const paidDetails = extractPayPalPaymentDetails(invoiceWithPayment);
assert(paidDetails.hasVerifiedPayment === true, 'Verified payment detected');
assert(paidDetails.paidAmount === 150, 'Paid amount parsed as 150');
assert(paidDetails.transactions[0].paymentId === 'CAPTURE-789XYZ', 'Capture ID preserved');
assert(paidDetails.verificationSource === 'PAYPAL_SANDBOX_REST_API', 'Verified source is PAYPAL_SANDBOX_REST_API');

// 7. Test Tracking Record Builder
const fullMockPayPalInvoice = {
  id: 'INV2-TEST-1234',
  status: 'SENT',
  detail: {
    invoice_number: 'INV-20261112-001',
    invoice_date: '2026-11-12',
    currency_code: 'USD',
    payment_term: {
      due_date: '2026-11-26'
    }
  },
  metadata: {
    create_time: '2026-11-12T09:00:00Z',
    last_update_time: '2026-11-12T09:05:00Z'
  },
  primary_recipients: [
    {
      billing_info: {
        name: { given_name: 'Rahul', surname: 'Sharma' },
        email_address: 'rahul@example.com'
      }
    }
  ],
  items: [
    {
      name: 'Full-stack development',
      quantity: '1',
      unit_amount: { currency_code: 'USD', value: '500.00' }
    }
  ]
};

const trackingRecord = buildTrackingRecord(fullMockPayPalInvoice);
assert(trackingRecord.invoiceId === 'INV2-TEST-1234', 'Invoice ID mapped');
assert(trackingRecord.customer.name === 'Rahul Sharma', 'Customer name formatted');
assert(trackingRecord.customer.email === 'rahul@example.com', 'Customer email mapped');
assert(trackingRecord.financials.totalAmount === 500, 'Total amount computed as 500');
assert(trackingRecord.financials.balanceDue === 500, 'Balance due is 500 when unpaid');
assert(trackingRecord.isPayPalSynced === true, 'Marked as isPayPalSynced = true');

// 8. Test Rate Limiting
const rateCheck1 = checkRateLimit('INV2-RATE-TEST');
assert(rateCheck1.allowed === true, 'First rate limit check is allowed');

const rateCheck2 = checkRateLimit('INV2-RATE-TEST');
assert(rateCheck2.allowed === false, 'Immediate subsequent rate limit check is throttled');
assert(rateCheck2.remainingMs > 0, 'Remaining cooldown time is returned');

console.log(`\nPayment Tracking Summary: ${testsPassed} passed, ${testsFailed} failed.`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('All Payment Tracking & Status Lifecycle tests PASSED!\n');
}
