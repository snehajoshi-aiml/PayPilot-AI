import axios from 'axios';

/**
 * PayPal Sandbox REST Invoicing Service
 * Strictly uses PayPal Sandbox REST API v2 endpoints.
 * Never executes real-money transactions.
 * Never fakes or simulates successful transactions.
 */

const DEFAULT_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

// In-memory cache for OAuth2 access token
let cachedToken = null;
let tokenExpiryTime = 0;

/**
 * Checks if PayPal Sandbox credentials are configured in backend environment
 */
export function isPayPalConfigured() {
  const clientId = process.env.PAYPAL_CLIENT_ID ? process.env.PAYPAL_CLIENT_ID.trim() : '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET ? process.env.PAYPAL_CLIENT_SECRET.trim() : '';
  return Boolean(clientId && clientSecret);
}

/**
 * Helper to get the configured PayPal API base URL (sandbox only)
 */
export function getPayPalBaseUrl() {
  return process.env.PAYPAL_API_BASE || DEFAULT_SANDBOX_BASE;
}

/**
 * Obtains an OAuth 2.0 Access Token from PayPal Sandbox using Client Credentials
 * @returns {Promise<string>} Access Token
 */
export async function getPayPalAccessToken() {
  if (!isPayPalConfigured()) {
    const error = new Error('PayPal Sandbox credentials missing. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env.');
    error.code = 'PAYPAL_CONFIG_REQUIRED';
    error.status = 503;
    throw error;
  }

  // Return cached token if valid with a 60-second safety buffer
  const now = Date.now();
  if (cachedToken && now < tokenExpiryTime - 60000) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET.trim();
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const baseUrl = getPayPalBaseUrl();

  try {
    const response = await axios({
      method: 'post',
      url: `${baseUrl}/v1/oauth2/token`,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: 'grant_type=client_credentials'
    });

    const { access_token, expires_in } = response.data;
    if (!access_token) {
      throw new Error('PayPal OAuth token endpoint returned an empty token.');
    }

    cachedToken = access_token;
    tokenExpiryTime = now + (expires_in * 1000);
    return cachedToken;
  } catch (err) {
    console.error('PayPal OAuth Error:', err.response?.data || err.message);
    const error = new Error(
      err.response?.data?.error_description ||
      err.response?.data?.message ||
      'Failed to authenticate with PayPal Sandbox OAuth 2.0.'
    );
    error.code = err.response?.status === 401 ? 'PAYPAL_AUTH_FAILED' : 'PAYPAL_API_ERROR';
    error.status = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

/**
 * Converts PayPilot internal invoice model to PayPal Invoicing API v2 payload
 */
export function formatPayPalInvoicePayload(invoice) {
  // Split customer name into given name and surname
  const nameParts = (invoice.customerName || 'Valued Customer').trim().split(/\s+/);
  const givenName = nameParts[0] || 'Valued';
  const surname = nameParts.slice(1).join(' ') || 'Customer';

  const currencyCode = (invoice.currency || 'USD').toUpperCase();
  const todayStr = invoice.issueDate || new Date().toISOString().split('T')[0];

  // Map line items or fallback to single item
  const items = (invoice.items && invoice.items.length > 0)
    ? invoice.items.map((it) => {
        const unitVal = (parseFloat(it.unitPrice) || 0).toFixed(2);
        return {
          name: (it.name || invoice.serviceDescription || 'Service').slice(0, 300),
          description: (it.description || invoice.serviceDescription || '').slice(0, 1000),
          quantity: String(it.quantity || 1),
          unit_amount: {
            currency_code: currencyCode,
            value: unitVal
          },
          unit_of_measure: 'QUANTITY'
        };
      })
    : [
        {
          name: (invoice.serviceDescription || 'Professional Services').slice(0, 300),
          description: (invoice.serviceDescription || '').slice(0, 1000),
          quantity: '1',
          unit_amount: {
            currency_code: currencyCode,
            value: (parseFloat(invoice.amount) || 0).toFixed(2)
          },
          unit_of_measure: 'QUANTITY'
        }
      ];

  const payload = {
    detail: {
      invoice_number: invoice.invoiceNumber,
      invoice_date: todayStr,
      currency_code: currencyCode,
      note: 'Thank you for your business. Generated via PayPilot AI.',
      term: 'No refund after 30 days.'
    },
    invoicer: {
      name: {
        given_name: 'PayPilot AI',
        surname: 'Merchant'
      }
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: givenName,
            surname: surname
          },
          email_address: invoice.customerEmail
        }
      }
    ],
    items,
    configuration: {
      partial_payment: {
        allow_partial_payment: false
      },
      tax_calculated_after_discount: true,
      tax_inclusive: false
    }
  };

  // Add due date if provided
  if (invoice.dueDate) {
    payload.detail.payment_term = {
      term_type: 'DUE_ON_DATE_SPECIFIED',
      due_date: invoice.dueDate
    };
  }

  return payload;
}

/**
 * Creates a new invoice in PayPal Sandbox (Status: DRAFT)
 * @param {Object} invoice - Internal PayPilot invoice object
 * @returns {Promise<Object>} Created PayPal invoice response
 */
export async function createPayPalInvoice(invoice) {
  if (!invoice.customerEmail) {
    const error = new Error('Customer email is required to create a PayPal invoice.');
    error.code = 'INVALID_INVOICE_DATA';
    error.status = 400;
    throw error;
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const payload = formatPayPalInvoicePayload(invoice);

  try {
    const response = await axios({
      method: 'post',
      url: `${baseUrl}/v2/invoicing/invoices`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      data: payload
    });

    return response.data;
  } catch (err) {
    console.error('PayPal Create Invoice Error:', err.response?.data || err.message);
    const error = new Error(
      err.response?.data?.message ||
      err.response?.data?.details?.[0]?.description ||
      'Failed to create invoice in PayPal Sandbox.'
    );
    error.code = 'PAYPAL_CREATE_FAILED';
    error.status = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

/**
 * Retrieves invoice details and status from PayPal Sandbox
 * @param {string} invoiceId - PayPal invoice ID (e.g. INV2-XXXX-XXXX)
 * @returns {Promise<Object>} PayPal invoice details
 */
export async function getPayPalInvoice(invoiceId) {
  if (!invoiceId) {
    const error = new Error('Invoice ID is required.');
    error.code = 'MISSING_INVOICE_ID';
    error.status = 400;
    throw error;
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  try {
    const response = await axios({
      method: 'get',
      url: `${baseUrl}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (err) {
    console.error('PayPal Get Invoice Error:', err.response?.data || err.message);
    const error = new Error(
      err.response?.data?.message ||
      `Failed to retrieve PayPal invoice with ID ${invoiceId}.`
    );
    error.code = 'PAYPAL_FETCH_FAILED';
    error.status = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

/**
 * Sends a PayPal invoice to the recipient email
 * Requires explicit user authorization before execution.
 * @param {string} invoiceId - PayPal invoice ID
 * @param {Object} options - Sending options (subject, note)
 * @returns {Promise<Object>} Result of sending the invoice
 */
export async function sendPayPalInvoice(invoiceId, options = {}) {
  if (!invoiceId) {
    const error = new Error('Invoice ID is required.');
    error.code = 'MISSING_INVOICE_ID';
    error.status = 400;
    throw error;
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const sendPayload = {
    send_to_recipient: true,
    send_to_invoicer: false,
    subject: options.subject || 'Invoice from PayPilot AI Merchant',
    note: options.note || 'Thank you for your business. Please complete your payment securely via PayPal.'
  };

  try {
    const response = await axios({
      method: 'post',
      url: `${baseUrl}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: sendPayload
    });

    return {
      success: true,
      status: 'SENT',
      invoiceId,
      message: 'Invoice successfully dispatched to recipient via PayPal Sandbox.',
      data: response.data || null
    };
  } catch (err) {
    console.error('PayPal Send Invoice Error:', err.response?.data || err.message);
    const error = new Error(
      err.response?.data?.message ||
      err.response?.data?.details?.[0]?.description ||
      `Failed to send PayPal invoice ${invoiceId}.`
    );
    error.code = 'PAYPAL_SEND_FAILED';
    error.status = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}

/**
 * Lists invoices from PayPal Sandbox
 * @param {number} page - Page number (1-indexed)
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Object>} Paginated list of invoices
 */
export async function listPayPalInvoices(page = 1, pageSize = 20) {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  try {
    const response = await axios({
      method: 'get',
      url: `${baseUrl}/v2/invoicing/invoices?page=${page}&page_size=${pageSize}&total_required=true`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (err) {
    console.error('PayPal List Invoices Error:', err.response?.data || err.message);
    const error = new Error(
      err.response?.data?.message || 'Failed to list invoices from PayPal Sandbox.'
    );
    error.code = 'PAYPAL_LIST_FAILED';
    error.status = err.response?.status || 500;
    error.details = err.response?.data || null;
    throw error;
  }
}
