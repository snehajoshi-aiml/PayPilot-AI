import { generateWithRetry, stripCodeFences } from '../utils/geminiRetry.js';

/**
 * AI Payment Assistant Service
 * Generates contextual payment follow-up reminders based on genuine invoice status and tone.
 * Never claims an unpaid invoice is paid, and refuses to generate reminders for PAID or CANCELLED invoices.
 */

const VALID_TONES = ['professional', 'friendly', 'firm'];

/**
 * Calculates days difference between due date and today
 * @param {string} dueDateStr - YYYY-MM-DD
 * @returns {{ daysDiff: number, urgencyLevel: string, suggestedFollowUpDate: string }}
 */
export function calculateUrgencyAndFollowUp(dueDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let urgencyLevel = 'UPCOMING';
  let suggestedDate = new Date();

  if (daysDiff < 0) {
    urgencyLevel = 'OVERDUE';
    // If overdue by 1-5 days, follow up in 3 days. If overdue > 5 days, follow up in 2 days.
    const addDays = Math.abs(daysDiff) <= 5 ? 3 : 2;
    suggestedDate.setDate(today.getDate() + addDays);
  } else if (daysDiff === 0) {
    urgencyLevel = 'DUE_TODAY';
    suggestedDate.setDate(today.getDate() + 2);
  } else if (daysDiff <= 3) {
    urgencyLevel = 'UPCOMING_URGENT';
    suggestedDate.setDate(today.getDate() + daysDiff + 1);
  } else {
    urgencyLevel = 'UPCOMING';
    // Follow up 2 days before due date
    suggestedDate.setDate(today.getDate() + Math.max(1, daysDiff - 2));
  }

  const suggestedFollowUpDate = suggestedDate.toISOString().split('T')[0];

  return {
    daysDiff,
    urgencyLevel,
    suggestedFollowUpDate
  };
}

/**
 * Validates invoice eligibility for reminder generation
 */
export function validateReminderEligibility(invoice, tone = 'professional') {
  if (!invoice || typeof invoice !== 'object') {
    return { isValid: false, error: 'Invoice data object is required.' };
  }

  const rawStatus = (invoice.paypalStatus || invoice.status || 'DRAFT').toUpperCase();

  // Rule: Do not generate reminders for PAID or CANCELLED invoices
  if (rawStatus === 'PAID' || rawStatus === 'MARKED_AS_PAID') {
    return {
      isValid: false,
      code: 'INELIGIBLE_STATUS',
      error: 'Invoice is already settled. Payment reminders cannot be generated for paid invoices.'
    };
  }

  if (rawStatus === 'CANCELLED') {
    return {
      isValid: false,
      code: 'INELIGIBLE_STATUS',
      error: 'Invoice is cancelled. Payment reminders cannot be generated for cancelled invoices.'
    };
  }

  // Validate required fields
  const missing = [];
  if (!invoice.customerName) missing.push('customerName');
  if (!invoice.customerEmail) missing.push('customerEmail');
  if (!invoice.invoiceNumber) missing.push('invoiceNumber');
  if (!invoice.amount || invoice.amount <= 0) missing.push('amount');
  if (!invoice.dueDate) missing.push('dueDate');

  if (missing.length > 0) {
    return {
      isValid: false,
      code: 'MISSING_INVOICE_DATA',
      error: `Missing required invoice information for reminder: ${missing.join(', ')}.`
    };
  }

  const normalizedTone = String(tone).toLowerCase().trim();
  if (!VALID_TONES.includes(normalizedTone)) {
    return {
      isValid: false,
      code: 'INVALID_TONE',
      error: `Invalid tone '${tone}'. Supported tones are: professional, friendly, firm.`
    };
  }

  return { isValid: true, normalizedTone };
}

/**
 * Generates an offline template reminder (deterministic, safe fallback for unit testing)
 */
export function generateOfflineReminderTemplate(invoice, tone, urgencyInfo) {
  const { customerName, invoiceNumber, amount, currency, dueDate } = invoice;
  const formattedAmount = `${currency || 'USD'} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  const isOverdue = urgencyInfo.urgencyLevel === 'OVERDUE';
  const daysOverdue = Math.abs(urgencyInfo.daysDiff);

  let subject = '';
  let body = '';

  if (tone === 'friendly') {
    if (isOverdue) {
      subject = `Friendly check-in: Invoice #${invoiceNumber} is past due`;
      body = `Hi ${customerName},\n\nI hope you're having a great week! Just wanted to gently follow up on invoice #${invoiceNumber} for ${formattedAmount}, which was due on ${dueDate} (${daysOverdue} days ago).\n\nPlease let me know if you need another copy of the invoice or have any questions regarding payment.\n\nBest regards,\nPayPilot AI Merchant`;
    } else {
      subject = `Upcoming payment reminder: Invoice #${invoiceNumber}`;
      body = `Hi ${customerName},\n\nHope everything is going well! This is a quick note to remind you that invoice #${invoiceNumber} for ${formattedAmount} is coming due on ${dueDate}.\n\nThank you for your business and partnership!\n\nBest regards,\nPayPilot AI Merchant`;
    }
  } else if (tone === 'firm') {
    if (isOverdue) {
      subject = `URGENT: Overdue payment notice for Invoice #${invoiceNumber}`;
      body = `Dear ${customerName},\n\nThis is a formal notice that invoice #${invoiceNumber} for ${formattedAmount} is currently ${daysOverdue} days overdue (due date: ${dueDate}).\n\nPlease submit payment today to bring your account up to date. If payment has already been sent in the last 24 hours, please disregard this notice.\n\nSincerely,\nPayPilot AI Accounts Department`;
    } else {
      subject = `Payment reminder: Invoice #${invoiceNumber} due on ${dueDate}`;
      body = `Dear ${customerName},\n\nPlease be advised that payment of ${formattedAmount} for invoice #${invoiceNumber} is due on ${dueDate}.\n\nKindly ensure funds are transferred on or before the due date.\n\nSincerely,\nPayPilot AI Accounts Department`;
    }
  } else {
    // Professional (default)
    if (isOverdue) {
      subject = `Follow-up: Overdue Invoice #${invoiceNumber} - ${formattedAmount}`;
      body = `Dear ${customerName},\n\nWe are writing to follow up on invoice #${invoiceNumber} in the amount of ${formattedAmount}, which was scheduled for payment on ${dueDate}.\n\nAccording to our records, this payment is now ${daysOverdue} days past due. We kindly ask that you process this payment at your earliest convenience.\n\nThank you for your prompt attention.\n\nSincerely,\nPayPilot AI Accounts`;
    } else {
      subject = `Payment Reminder: Invoice #${invoiceNumber} due ${dueDate}`;
      body = `Dear ${customerName},\n\nThis is a courtesy reminder that invoice #${invoiceNumber} for ${formattedAmount} is scheduled for payment on ${dueDate}.\n\nPlease find the payment details attached or in your PayPal dashboard.\n\nThank you for your prompt attention.\n\nSincerely,\nPayPilot AI Accounts`;
    }
  }

  return {
    subject,
    messageBody: body,
    tone,
    urgencyLevel: urgencyInfo.urgencyLevel,
    daysDiff: urgencyInfo.daysDiff,
    suggestedFollowUpDate: urgencyInfo.suggestedFollowUpDate
  };
}

/**
 * Generates an AI-powered contextual reminder message via Google Gemini
 */
export async function generateAiReminder(invoice, tone = 'professional') {
  const eligibility = validateReminderEligibility(invoice, tone);
  if (!eligibility.isValid) {
    const error = new Error(eligibility.error);
    error.code = eligibility.code || 'VALIDATION_FAILED';
    error.status = 400;
    throw error;
  }

  const urgencyInfo = calculateUrgencyAndFollowUp(invoice.dueDate);
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

  if (!apiKey) {
    // If Gemini key is missing, report configuration required
    const error = new Error('Google Gemini API key missing. Please set GEMINI_API_KEY in backend/.env to generate AI reminders.');
    error.code = 'CONFIG_MISSING';
    error.status = 503;
    throw error;
  }

  const prompt = `
You are the AI Payment Follow-up Assistant for PayPilot AI.
Generate a tailored email payment reminder for the following invoice:

CUSTOMER NAME: ${invoice.customerName}
CUSTOMER EMAIL: ${invoice.customerEmail}
INVOICE NUMBER: ${invoice.invoiceNumber}
TOTAL AMOUNT: ${invoice.currency} ${invoice.amount}
DUE DATE: ${invoice.dueDate}
DAYS UNTIL / PAST DUE: ${urgencyInfo.daysDiff} (${urgencyInfo.urgencyLevel})
REQUESTED TONE: ${eligibility.normalizedTone}

TONE GUIDELINES:
- "professional": Formal, polite, clear, standard corporate etiquette.
- "friendly": Warm, collaborative, cheerful, relationship-preserving.
- "firm": Direct, assertive, emphasizing overdue status and urgent settlement without being hostile.

STRICT INSTRUCTIONS:
1. NEVER claim or imply that the invoice has been paid.
2. If the invoice is OVERDUE (daysDiff < 0), explicitly acknowledge that it is past due.
3. If the invoice is NOT overdue (daysDiff >= 0), frame it as a gentle upcoming reminder.
4. Output strict JSON with:
   {
     "subject": "Clear email subject line",
     "messageBody": "Full email message body including greeting, context, amount, due date, and sign-off",
     "tone": "${eligibility.normalizedTone}",
     "urgencyLevel": "${urgencyInfo.urgencyLevel}",
     "daysDiff": ${urgencyInfo.daysDiff},
     "suggestedFollowUpDate": "${urgencyInfo.suggestedFollowUpDate}"
   }
`;

  try {
    const { text, modelUsed } = await generateWithRetry({
      apiKey,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      },
      prompt
    });

    const cleanJson = stripCodeFences(text);
    const parsed = JSON.parse(cleanJson);
    return {
      subject: parsed.subject,
      messageBody: parsed.messageBody,
      tone: eligibility.normalizedTone,
      urgencyLevel: urgencyInfo.urgencyLevel,
      daysDiff: urgencyInfo.daysDiff,
      suggestedFollowUpDate: urgencyInfo.suggestedFollowUpDate,
      _modelUsed: modelUsed
    };
  } catch (err) {
    console.error('Gemini Reminder Generation Error:', err);
    // Forward Gemini errors
    err.status = err.status || 500;
    throw err;
  }
}
