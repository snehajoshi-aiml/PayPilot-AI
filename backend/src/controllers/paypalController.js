import {
  isPayPalConfigured,
  getPayPalAccessToken,
  createPayPalInvoice,
  getPayPalInvoice,
  sendPayPalInvoice,
  listPayPalInvoices
} from '../services/paypalService.js';

import {
  checkRateLimit,
  buildTrackingRecord
} from '../services/paymentTrackingService.js';

/**
 * Controller: Check PayPal Sandbox configuration and connection status
 * GET /api/paypal/status
 */
export async function getPayPalStatus(req, res) {
  const configured = isPayPalConfigured();

  if (!configured) {
    return res.status(200).json({
      configured: false,
      mode: 'sandbox',
      status: 'CONFIG_REQUIRED',
      message: 'PayPal Sandbox Client ID or Secret is not configured in backend/.env.',
      instructions: 'Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to backend/.env to connect to PayPal Sandbox.'
    });
  }

  // If credentials are present, attempt authentic OAuth handshake without simulating
  try {
    await getPayPalAccessToken();
    return res.status(200).json({
      configured: true,
      mode: 'sandbox',
      status: 'CONNECTED',
      message: 'Successfully authenticated with PayPal Sandbox OAuth 2.0.'
    });
  } catch (err) {
    return res.status(200).json({
      configured: true,
      mode: 'sandbox',
      status: 'AUTH_FAILED',
      error: err.message,
      message: 'PayPal credentials present but authentication with PayPal Sandbox failed. Check Client ID and Secret.'
    });
  }
}

/**
 * Controller: Create a new draft invoice in PayPal Sandbox
 * POST /api/paypal/invoices
 */
export async function createInvoice(req, res, next) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'PAYPAL_CONFIG_REQUIRED',
        error: 'PayPal Sandbox credentials are not configured.',
        instructions: 'Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to backend/.env to create PayPal invoices.'
      });
    }

    const invoiceData = req.body;
    if (!invoiceData || !invoiceData.customerEmail) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        error: 'Invoice data must include a valid customerEmail.'
      });
    }

    const created = await createPayPalInvoice(invoiceData);

    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully in PayPal Sandbox (Status: DRAFT).',
      data: created
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Retrieve invoice details by PayPal Invoice ID
 * GET /api/paypal/invoices/:id
 */
export async function getInvoice(req, res, next) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'PAYPAL_CONFIG_REQUIRED',
        error: 'PayPal Sandbox credentials are not configured.'
      });
    }

    const { id } = req.params;
    const invoice = await getPayPalInvoice(id);

    return res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Retrieve normalized payment tracking & lifecycle data
 * GET /api/paypal/invoices/:id/tracking
 */
export async function getInvoiceTracking(req, res, next) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'PAYPAL_CONFIG_REQUIRED',
        error: 'PayPal Sandbox credentials are not configured.'
      });
    }

    const { id } = req.params;

    // Check rate limit (10 second cooldown per invoice ID)
    const rateCheck = checkRateLimit(id);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        error: `Status refresh rate limited. Please wait ${Math.ceil(rateCheck.remainingMs / 1000)} seconds before refreshing again.`,
        remainingMs: rateCheck.remainingMs
      });
    }

    const rawInvoice = await getPayPalInvoice(id);
    const tracking = buildTrackingRecord(rawInvoice);

    return res.status(200).json({
      success: true,
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Batch status refresh for multiple synced invoices
 * POST /api/paypal/invoices/batch-status
 */
export async function batchInvoiceStatus(req, res, next) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'PAYPAL_CONFIG_REQUIRED',
        error: 'PayPal Sandbox credentials are not configured.'
      });
    }

    const { invoiceIds } = req.body;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_INPUT',
        error: 'invoiceIds must be a non-empty array of PayPal invoice IDs.'
      });
    }

    // Cap batch size to 20 for safety
    const boundedIds = invoiceIds.slice(0, 20);
    const results = [];
    const errors = [];

    for (const id of boundedIds) {
      try {
        const raw = await getPayPalInvoice(id);
        results.push(buildTrackingRecord(raw));
      } catch (e) {
        errors.push({ id, error: e.message });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        records: results,
        errors: errors.length > 0 ? errors : null
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Send a PayPal invoice to recipient
 * POST /api/paypal/invoices/:id/send
 * Requires explicit user confirmation in request body.
 */
export async function sendInvoice(req, res, next) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'PAYPAL_CONFIG_REQUIRED',
        error: 'PayPal Sandbox credentials are not configured.'
      });
    }

    const { id } = req.params;
    const { confirmed, subject, note } = req.body;

    // Requirement: Require explicit user confirmation before any payment action
    if (!confirmed) {
      return res.status(400).json({
        success: false,
        code: 'CONFIRMATION_REQUIRED',
        error: 'Explicit user confirmation (confirmed: true) is required before sending an invoice through PayPal.'
      });
    }

    const result = await sendPayPalInvoice(id, { subject, note });

    return res.status(200).json({
      success: true,
      message: 'Invoice dispatched to recipient via PayPal Sandbox.',
      data: result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: List recent invoices from PayPal Sandbox
 * GET /api/paypal/invoices
 */
export async function listInvoices(req, res, next) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'PAYPAL_CONFIG_REQUIRED',
        error: 'PayPal Sandbox credentials are not configured.'
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 20;

    const list = await listPayPalInvoices(page, pageSize);

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (err) {
    next(err);
  }
}
