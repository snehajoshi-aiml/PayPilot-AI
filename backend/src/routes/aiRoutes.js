import express from 'express';
import { parseInvoice } from '../controllers/aiController.js';
import { generateReminder, sendReminder } from '../controllers/assistantController.js';

const router = express.Router();

// POST /api/ai/parse-invoice - Extract invoice from natural language
router.post('/parse-invoice', parseInvoice);

// POST /api/ai/generate-reminder - Contextual follow-up reminder generator
router.post('/generate-reminder', generateReminder);

// POST /api/ai/send-reminder - Authorize and send reminder
router.post('/send-reminder', sendReminder);

export default router;
