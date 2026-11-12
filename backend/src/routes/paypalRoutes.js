import express from 'express';
import {
  getPayPalStatus,
  createInvoice,
  getInvoice,
  getInvoiceTracking,
  batchInvoiceStatus,
  sendInvoice,
  listInvoices
} from '../controllers/paypalController.js';

const router = express.Router();

// GET /api/paypal/status - Connection & OAuth config health
router.get('/status', getPayPalStatus);

// POST /api/paypal/invoices - Create draft invoice in PayPal Sandbox
router.post('/invoices', createInvoice);

// GET /api/paypal/invoices - List invoices from PayPal Sandbox
router.get('/invoices', listInvoices);

// POST /api/paypal/invoices/batch-status - Batch status refresh
router.post('/invoices/batch-status', batchInvoiceStatus);

// GET /api/paypal/invoices/:id - Retrieve raw invoice details
router.get('/invoices/:id', getInvoice);

// GET /api/paypal/invoices/:id/tracking - Retrieve normalized payment tracking & lifecycle data
router.get('/invoices/:id/tracking', getInvoiceTracking);

// POST /api/paypal/invoices/:id/send - Send invoice (requires explicit confirmation)
router.post('/invoices/:id/send', sendInvoice);

export default router;
