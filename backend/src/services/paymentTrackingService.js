/**
 * PayPal Payment Tracking & Lifecycle Service
 * Normalizes genuine invoice statuses from PayPal Sandbox.
 * Enforces rate limiting on status refresh requests.
 * Strictly never fabricates payment confirmations or fake transaction IDs.
 */

// Rate-limiting cache: maps invoiceId -> timestamp of last fetch
const statusRateLimitCache = new Map();
const REFRESH_COOLDOWN_MS = 10000; // 10 seconds cooldown per invoice

/**
 * Checks if status refresh is within cooldown
 * @param {string} invoiceId
 * @returns {{ allowed: boolean, remainingMs: number }}
 */
export function checkRateLimit(invoiceId) {
  const lastTime = statusRateLimitCache.get(invoiceId);
  const now = Date.now();

  if (lastTime && now - lastTime < REFRESH_COOLDOWN_MS) {
    return {
      allowed: false,
      remainingMs: REFRESH_COOLDOWN_MS - (now - lastTime)
    };
  }

  statusRateLimitCache.set(invoiceId, now);
  return { allowed: true, remainingMs: 0 };
}

/**
 * Normalizes PayPal Invoicing REST v2 status
 * @param {string} rawStatus - PayPal status string
 * @param {string} dueDateStr - Due date in YYYY-MM-DD
 * @returns {Object} { normalizedStatus, displayLabel, colorCategory, isOverdue }
 */
export function normalizePayPalStatus(rawStatus = 'DRAFT', dueDateStr = null) {
  const upper = String(rawStatus).toUpperCase().trim();
  let isOverdue = false;

  // Check if invoice is overdue (if due date is in the past and not yet paid/cancelled)
  if (dueDateStr && (upper === 'SENT' || upper === 'UNPAID')) {
    const dueDate = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isNaN(dueDate.getTime()) && dueDate < today) {
      isOverdue = true;
    }
  }

  switch (upper) {
    case 'PAID':
    case 'MARKED_AS_PAID':
      return {
        normalizedStatus: 'PAID',
        displayLabel: upper === 'MARKED_AS_PAID' ? 'Marked as Paid' : 'Paid',
        colorCategory: 'emerald',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        isOverdue: false
      };

    case 'SENT':
      if (isOverdue) {
        return {
          normalizedStatus: 'OVERDUE',
          displayLabel: 'Overdue',
          colorCategory: 'rose',
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
          isOverdue: true
        };
      }
      return {
        normalizedStatus: 'SENT',
        displayLabel: 'Sent (Awaiting Payment)',
        colorCategory: 'blue',
        badgeBg: 'bg-blue-50 text-brand-700 border-blue-200',
        isOverdue: false
      };

    case 'DRAFT':
      return {
        normalizedStatus: 'DRAFT',
        displayLabel: 'Draft',
        colorCategory: 'amber',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        isOverdue: false
      };

    case 'CANCELLED':
      return {
        normalizedStatus: 'CANCELLED',
        displayLabel: 'Cancelled',
        colorCategory: 'slate',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
        isOverdue: false
      };

    case 'PARTIALLY_PAID':
      return {
        normalizedStatus: 'PARTIALLY_PAID',
        displayLabel: 'Partially Paid',
        colorCategory: 'indigo',
        badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        isOverdue: isOverdue
      };

    case 'PAYMENT_PENDING':
      return {
        normalizedStatus: 'PAYMENT_PENDING',
        displayLabel: 'Payment Pending',
        colorCategory: 'orange',
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        isOverdue: false
      };

    case 'REFUNDED':
      return {
        normalizedStatus: 'REFUNDED',
        displayLabel: 'Refunded',
        colorCategory: 'purple',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
        isOverdue: false
      };

    case 'SCHEDULED':
      return {
        normalizedStatus: 'SCHEDULED',
        displayLabel: 'Scheduled',
        colorCategory: 'cyan',
        badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        isOverdue: false
      };

    default:
      return {
        normalizedStatus: upper,
        displayLabel: upper,
        colorCategory: 'slate',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
        isOverdue: false
      };
  }
}

/**
 * Extracts verified payment details from a PayPal invoice response
 * Never fakes or assumes payments.
 * @param {Object} rawPayPalInvoice
 * @returns {Object} paymentSummary
 */
export function extractPayPalPaymentDetails(rawPayPalInvoice = {}) {
  const paymentsObj = rawPayPalInvoice.payments;
  const rawStatus = rawPayPalInvoice.status || 'DRAFT';

  // Check paid_amount object from PayPal
  let paidAmount = 0;
  if (paymentsObj && paymentsObj.paid_amount && paymentsObj.paid_amount.value) {
    paidAmount = parseFloat(paymentsObj.paid_amount.value) || 0;
  }

  // Check transactions array
  const transactions = [];
  if (paymentsObj && Array.isArray(paymentsObj.transactions)) {
    for (const tx of paymentsObj.transactions) {
      if (tx.payment_id) {
        transactions.push({
          paymentId: tx.payment_id,
          paymentDate: tx.payment_date || null,
          method: tx.payment_method || tx.method || 'PAYPAL',
          amount: parseFloat(tx.amount?.value) || 0,
          currency: tx.amount?.currency_code || rawPayPalInvoice.detail?.currency_code || 'USD',
          note: tx.note || null
        });
      }
    }
  }

  const hasVerifiedPayment = transactions.length > 0 || paidAmount > 0 || rawStatus === 'PAID';

  return {
    hasVerifiedPayment,
    paidAmount,
    transactions,
    verificationSource: hasVerifiedPayment ? 'PAYPAL_SANDBOX_REST_API' : 'NONE'
  };
}

/**
 * Builds a standardized tracking record from a raw PayPal REST API invoice
 * @param {Object} rawPayPalInvoice
 * @returns {Object} Clean tracking payload
 */
export function buildTrackingRecord(rawPayPalInvoice = {}) {
  const detail = rawPayPalInvoice.detail || {};
  const metadata = rawPayPalInvoice.metadata || {};
  const primaryRecipient = rawPayPalInvoice.primary_recipients?.[0] || {};
  const billingInfo = primaryRecipient.billing_info || {};

  const dueDateStr = detail.payment_term?.due_date || null;
  const statusInfo = normalizePayPalStatus(rawPayPalInvoice.status, dueDateStr);
  const paymentDetails = extractPayPalPaymentDetails(rawPayPalInvoice);

  // Financial calculation
  let totalAmount = 0;
  if (rawPayPalInvoice.amount && rawPayPalInvoice.amount.value) {
    totalAmount = parseFloat(rawPayPalInvoice.amount.value) || 0;
  } else if (rawPayPalInvoice.items && Array.isArray(rawPayPalInvoice.items)) {
    totalAmount = rawPayPalInvoice.items.reduce((sum, it) => {
      const q = parseFloat(it.quantity) || 1;
      const p = parseFloat(it.unit_amount?.value) || 0;
      return sum + (q * p);
    }, 0);
  }

  const balanceDue = Math.max(0, totalAmount - paymentDetails.paidAmount);

  // Customer Name
  const nameObj = billingInfo.name || {};
  const customerName = [nameObj.given_name, nameObj.surname].filter(Boolean).join(' ') || 'Customer';

  return {
    invoiceId: rawPayPalInvoice.id,
    invoiceNumber: detail.invoice_number || rawPayPalInvoice.id,
    rawStatus: rawPayPalInvoice.status || 'DRAFT',
    status: statusInfo.normalizedStatus,
    displayStatus: statusInfo.displayLabel,
    badgeBg: statusInfo.badgeBg,
    isOverdue: statusInfo.isOverdue,
    customer: {
      name: customerName,
      email: billingInfo.email_address || null
    },
    financials: {
      totalAmount: Math.round(totalAmount * 100) / 100,
      currency: detail.currency_code || 'USD',
      paidAmount: Math.round(paymentDetails.paidAmount * 100) / 100,
      balanceDue: Math.round(balanceDue * 100) / 100
    },
    dates: {
      issueDate: detail.invoice_date || null,
      dueDate: dueDateStr,
      createdTime: metadata.create_time || null,
      lastUpdatedTime: metadata.last_update_time || new Date().toISOString()
    },
    payments: paymentDetails,
    isPayPalSynced: true
  };
}
