import express from 'express';
import aiRoutes from '../src/routes/aiRoutes.js';
import {
  validateReminderEligibility,
  calculateUrgencyAndFollowUp,
  generateOfflineReminderTemplate
} from '../src/services/aiAssistantService.js';

console.log('--- TESTING AI PAYMENT ASSISTANT & REMINDER ENGINE ---');

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

// 1. Test Tone Validation
const validToneCheck = validateReminderEligibility(
  { customerName: 'Alice', customerEmail: 'alice@example.com', invoiceNumber: 'INV-1', amount: 100, dueDate: '2026-12-01', status: 'SENT' },
  'friendly'
);
assert(validToneCheck.isValid && validToneCheck.normalizedTone === 'friendly', 'Accept valid friendly tone');

const invalidToneCheck = validateReminderEligibility(
  { customerName: 'Alice', customerEmail: 'alice@example.com', invoiceNumber: 'INV-1', amount: 100, dueDate: '2026-12-01', status: 'SENT' },
  'aggressive'
);
assert(!invalidToneCheck.isValid && invalidToneCheck.code === 'INVALID_TONE', 'Reject unsupported aggressive tone');

// 2. Test Ineligible Statuses: PAID and CANCELLED
const paidCheck = validateReminderEligibility({
  customerName: 'Rahul',
  customerEmail: 'rahul@example.com',
  invoiceNumber: 'INV-2',
  amount: 500,
  dueDate: '2026-11-01',
  status: 'PAID'
});
assert(!paidCheck.isValid && paidCheck.code === 'INELIGIBLE_STATUS', 'Reject reminder generation for PAID invoice');

const cancelledCheck = validateReminderEligibility({
  customerName: 'Rahul',
  customerEmail: 'rahul@example.com',
  invoiceNumber: 'INV-3',
  amount: 500,
  dueDate: '2026-11-01',
  status: 'CANCELLED'
});
assert(!cancelledCheck.isValid && cancelledCheck.code === 'INELIGIBLE_STATUS', 'Reject reminder generation for CANCELLED invoice');

// 3. Test Missing Invoice Fields
const missingEmailCheck = validateReminderEligibility({
  customerName: 'Bob',
  customerEmail: '', // missing
  invoiceNumber: 'INV-4',
  amount: 200,
  dueDate: '2026-11-30'
});
assert(!missingEmailCheck.isValid && missingEmailCheck.code === 'MISSING_INVOICE_DATA', 'Reject invoice with missing email');

// 4. Test Urgency and Suggested Follow-Up Calculation
const overdueCalc = calculateUrgencyAndFollowUp('2020-01-01');
assert(overdueCalc.urgencyLevel === 'OVERDUE', 'Detect overdue status');
assert(overdueCalc.daysDiff < 0, 'daysDiff is negative for overdue');
assert(Boolean(overdueCalc.suggestedFollowUpDate), 'Generate suggested follow-up date for overdue');

const futureCalc = calculateUrgencyAndFollowUp('2099-12-31');
assert(futureCalc.urgencyLevel === 'UPCOMING', 'Detect upcoming status');
assert(futureCalc.daysDiff > 0, 'daysDiff is positive for upcoming');

// 5. Test All Three Tones (Professional, Friendly, Firm) with offline template generator
const mockInv = {
  customerName: 'Rahul Sharma',
  customerEmail: 'rahul@example.com',
  invoiceNumber: 'INV-20261112-001',
  amount: 15000,
  currency: 'INR',
  dueDate: '2026-11-20'
};

const urgencyMock = { daysDiff: 8, urgencyLevel: 'UPCOMING', suggestedFollowUpDate: '2026-11-18' };

const profReminder = generateOfflineReminderTemplate(mockInv, 'professional', urgencyMock);
assert(profReminder.subject.includes('Invoice #INV-20261112-001'), 'Professional reminder includes invoice number');
assert(profReminder.tone === 'professional', 'Professional tone set');

const friendlyReminder = generateOfflineReminderTemplate(mockInv, 'friendly', urgencyMock);
assert(friendlyReminder.messageBody.includes('Hi Rahul Sharma'), 'Friendly reminder uses casual greeting');
assert(friendlyReminder.tone === 'friendly', 'Friendly tone set');

const firmReminder = generateOfflineReminderTemplate(mockInv, 'firm', urgencyMock);
assert(firmReminder.messageBody.includes('Please be advised'), 'Firm reminder uses formal assertive phrasing');
assert(firmReminder.tone === 'firm', 'Firm tone set');

// 6. HTTP API Endpoint Tests
const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);

const server = app.listen(0, async () => {
  const port = server.address().port;

  try {
    // Test HTTP reject for PAID invoice
    const res1 = await fetch(`http://localhost:${port}/api/ai/generate-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: { ...mockInv, status: 'PAID' },
        tone: 'friendly'
      })
    });
    const data1 = await res1.json();
    assert(res1.status === 400, 'HTTP returns 400 for PAID invoice');
    assert(data1.code === 'INELIGIBLE_STATUS', 'HTTP returns INELIGIBLE_STATUS code');

    // Test HTTP send-reminder requires explicit confirmation
    const res2 = await fetch(`http://localhost:${port}/api/ai/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmed: false,
        recipient: { email: 'rahul@example.com' },
        subject: 'Reminder',
        messageBody: 'Body'
      })
    });
    const data2 = await res2.json();
    assert(res2.status === 400, 'Send reminder rejects unconfirmed request with 400');
    assert(data2.code === 'CONFIRMATION_REQUIRED', 'Send reminder returns CONFIRMATION_REQUIRED');

    // Test HTTP send-reminder honest reporting (does NOT fake email delivery)
    const res3 = await fetch(`http://localhost:${port}/api/ai/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmed: true,
        recipient: { email: 'rahul@example.com' },
        subject: 'Reminder',
        messageBody: 'Body'
      })
    });
    const data3 = await res3.json();
    assert(data3.deliveryConfigured === false, 'Explicitly reports email delivery is not configured');
    assert(data3.canCopy === true, 'Provides canCopy flag to copy message');
    assert(!data3.message.includes('sent successfully'), 'Never claims email was dispatched');

    server.close(() => {
      console.log(`\nAI Assistant Tests Summary: ${testsPassed} passed, ${testsFailed} failed.`);
      process.exit(testsFailed > 0 ? 1 : 0);
    });
  } catch (err) {
    console.error('Test execution error:', err);
    server.close(() => process.exit(1));
  }
});
