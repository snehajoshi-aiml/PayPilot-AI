/**
 * Invoice Validation Service
 * Validates extracted invoice data and checks for missing mandatory fields.
 * Never invents or assumes missing data.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_REGEX = /^[A-Z]{3}$/;

/**
 * Validates the raw user prompt before sending to AI
 */
export function validatePromptInput(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return {
      isValid: false,
      error: 'Prompt is required and must be a string.'
    };
  }

  const trimmed = prompt.trim();
  if (trimmed.length < 5) {
    return {
      isValid: false,
      error: 'Please provide a more descriptive invoice request (at least 5 characters).'
    };
  }

  if (trimmed.length > 2000) {
    return {
      isValid: false,
      error: 'Invoice description is too long (maximum 2000 characters).'
    };
  }

  return { isValid: true, trimmedPrompt: trimmed };
}

/**
 * Validates and normalizes structured invoice data
 * @param {Object} rawData - Data returned by Gemini extraction
 * @returns {Object} { invoice, validation }
 */
export function validateAndNormalizeInvoice(rawData = {}) {
  const fieldErrors = {};
  const missingFields = [];

  // Customer Name
  let customerName = null;
  if (rawData.customerName && typeof rawData.customerName === 'string') {
    const trimmed = rawData.customerName.trim();
    if (trimmed.length > 0 && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'unknown') {
      customerName = trimmed;
    }
  }
  if (!customerName) {
    missingFields.push('customerName');
  }

  // Customer Email
  let customerEmail = null;
  if (rawData.customerEmail && typeof rawData.customerEmail === 'string') {
    const trimmed = rawData.customerEmail.trim();
    if (trimmed.length > 0 && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'unknown') {
      if (EMAIL_REGEX.test(trimmed)) {
        customerEmail = trimmed;
      } else {
        fieldErrors.customerEmail = 'Extracted email address is not in a valid format.';
        missingFields.push('customerEmail');
      }
    }
  }
  if (!customerEmail && !fieldErrors.customerEmail) {
    missingFields.push('customerEmail');
  }

  // Service Description
  let serviceDescription = null;
  if (rawData.serviceDescription && typeof rawData.serviceDescription === 'string') {
    const trimmed = rawData.serviceDescription.trim();
    if (trimmed.length > 0 && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'unknown') {
      serviceDescription = trimmed;
    }
  }
  if (!serviceDescription) {
    missingFields.push('serviceDescription');
  }

  // Amount
  let amount = null;
  if (rawData.amount !== undefined && rawData.amount !== null) {
    const parsedAmount = typeof rawData.amount === 'number'
      ? rawData.amount
      : parseFloat(String(rawData.amount).replace(/[^0-9.-]+/g, ''));

    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      amount = Math.round(parsedAmount * 100) / 100; // Round to 2 decimals
    } else {
      fieldErrors.amount = 'Amount must be a positive number.';
      missingFields.push('amount');
    }
  }
  if (amount === null && !fieldErrors.amount) {
    missingFields.push('amount');
  }

  // Currency
  let currency = null;
  if (rawData.currency && typeof rawData.currency === 'string') {
    const upper = rawData.currency.trim().toUpperCase();
    if (CURRENCY_REGEX.test(upper)) {
      currency = upper;
    } else {
      fieldErrors.currency = 'Currency must be a 3-letter ISO code (e.g. USD, EUR, INR).';
      missingFields.push('currency');
    }
  }
  if (!currency && !fieldErrors.currency) {
    missingFields.push('currency');
  }

  // Due Date
  let dueDate = null;
  if (rawData.dueDate && typeof rawData.dueDate === 'string') {
    const trimmedDate = rawData.dueDate.trim().slice(0, 10);
    if (ISO_DATE_REGEX.test(trimmedDate)) {
      const parsedDate = new Date(trimmedDate);
      if (!isNaN(parsedDate.getTime())) {
        dueDate = trimmedDate;
      } else {
        fieldErrors.dueDate = 'Due date is not a valid calendar date.';
        missingFields.push('dueDate');
      }
    } else {
      fieldErrors.dueDate = 'Due date must be in YYYY-MM-DD format.';
      missingFields.push('dueDate');
    }
  }
  if (!dueDate && !fieldErrors.dueDate) {
    missingFields.push('dueDate');
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = rawData.invoiceNumber || `INV-${todayStr.replace(/-/g, '')}-${randomSuffix}`;

  // Normalized line items array
  const items = [
    {
      name: serviceDescription || 'Custom Service',
      description: serviceDescription || '',
      quantity: 1,
      unitPrice: amount || 0,
      total: amount || 0
    }
  ];

  const isComplete = missingFields.length === 0 && Object.keys(fieldErrors).length === 0;

  return {
    invoice: {
      invoiceNumber,
      customerName,
      customerEmail,
      serviceDescription,
      amount,
      currency,
      dueDate,
      issueDate: todayStr,
      status: 'DRAFT',
      items
    },
    validation: {
      isComplete,
      missingFields,
      fieldErrors
    }
  };
}
