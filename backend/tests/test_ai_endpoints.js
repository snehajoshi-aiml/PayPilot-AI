import { validatePromptInput, validateAndNormalizeInvoice } from '../src/services/invoiceValidator.js';

console.log('--- RUNNING PAYPILOT AI BACKEND UNIT & VALIDATION TESTS ---\n');

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

// 1. Test Prompt Validation: Empty or Short input
const emptyCheck = validatePromptInput('');
assert(!emptyCheck.isValid && emptyCheck.error.includes('required'), 'Reject empty prompt');

const shortCheck = validatePromptInput('hi');
assert(!shortCheck.isValid && shortCheck.error.includes('at least 5 characters'), 'Reject too short prompt');

const validPrompt = validatePromptInput('  Create an invoice for Rahul Sharma for $500   ');
assert(validPrompt.isValid && validPrompt.trimmedPrompt === 'Create an invoice for Rahul Sharma for $500', 'Accept valid prompt and trim properly');

// 2. Test Incomplete Invoice (Missing Email, as in prompt example)
// "Create an invoice for Rahul Sharma for website development worth ₹15,000, due on 25 November 2026."
const extractedIncomplete = {
  customerName: 'Rahul Sharma',
  customerEmail: null, // email not provided!
  serviceDescription: 'Website development',
  amount: 15000,
  currency: 'INR',
  dueDate: '2026-11-25',
  aiNotes: 'Customer email is missing.'
};

const incompleteResult = validateAndNormalizeInvoice(extractedIncomplete);
assert(!incompleteResult.validation.isComplete, 'Detect that invoice is incomplete');
assert(incompleteResult.validation.missingFields.includes('customerEmail'), 'Identify customerEmail in missingFields');
assert(incompleteResult.invoice.customerName === 'Rahul Sharma', 'Preserve customerName accurately');
assert(incompleteResult.invoice.amount === 15000, 'Preserve amount as numeric 15000');
assert(incompleteResult.invoice.currency === 'INR', 'Preserve currency as INR');
assert(incompleteResult.invoice.dueDate === '2026-11-25', 'Preserve dueDate as 2026-11-25');
assert(incompleteResult.invoice.status === 'DRAFT', 'Set default status to DRAFT');

// 3. Test Full Complete Invoice
const extractedComplete = {
  customerName: 'Alice Johnson',
  customerEmail: 'alice@example.com',
  serviceDescription: 'Cloud Architecture Consulting',
  amount: 2500,
  currency: 'USD',
  dueDate: '2026-12-01',
  aiNotes: 'All information extracted.'
};

const completeResult = validateAndNormalizeInvoice(extractedComplete);
assert(completeResult.validation.isComplete, 'Mark complete invoice as isComplete = true');
assert(completeResult.validation.missingFields.length === 0, 'No missing fields for complete invoice');
assert(completeResult.invoice.customerEmail === 'alice@example.com', 'Preserve valid customer email');

// 4. Test Invalid Email and Negative Amount Validation
const extractedInvalid = {
  customerName: 'Bob Corp',
  customerEmail: 'not-an-email',
  serviceDescription: 'Design',
  amount: -100,
  currency: 'US', // invalid length
  dueDate: 'invalid-date'
};

const invalidResult = validateAndNormalizeInvoice(extractedInvalid);
assert(!invalidResult.validation.isComplete, 'Detect errors on invalid invoice data');
assert(Boolean(invalidResult.validation.fieldErrors.customerEmail), 'Detect invalid email format');
assert(Boolean(invalidResult.validation.fieldErrors.amount), 'Detect non-positive amount error');
assert(Boolean(invalidResult.validation.fieldErrors.currency), 'Detect invalid 3-letter currency error');
assert(Boolean(invalidResult.validation.fieldErrors.dueDate), 'Detect invalid date format error');

console.log(`\nTests Summary: ${testsPassed} passed, ${testsFailed} failed.`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('All validation and extraction logic unit tests PASSED successfully!\n');
}
