import {
  validateReminderEligibility,
  calculateUrgencyAndFollowUp,
  generateAiReminder,
  generateOfflineReminderTemplate
} from '../services/aiAssistantService.js';

/**
 * Controller: Generate AI Payment Reminder
 * POST /api/ai/generate-reminder
 */
export async function generateReminder(req, res, next) {
  try {
    const { invoice, tone } = req.body;

    // 1. Validation check
    const check = validateReminderEligibility(invoice, tone);
    if (!check.isValid) {
      return res.status(400).json({
        success: false,
        code: check.code,
        error: check.error
      });
    }

    // 2. Call AI reminder generator
    let reminder;
    try {
      reminder = await generateAiReminder(invoice, check.normalizedTone);
    } catch (aiErr) {
      if (aiErr.code === 'CONFIG_MISSING') {
        return res.status(503).json({
          success: false,
          code: 'CONFIG_MISSING',
          error: aiErr.message,
          instructions: 'Please configure GEMINI_API_KEY in backend/.env to use AI reminder generation.'
        });
      }
      return res.status(aiErr.status || 500).json({
        success: false,
        code: 'AI_SERVICE_ERROR',
        error: aiErr.message || 'Error communicating with Google Gemini AI.'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...reminder,
        recipient: {
          name: invoice.customerName,
          email: invoice.customerEmail
        },
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Send Reminder (With mandatory explicit confirmation & honest delivery check)
 * POST /api/ai/send-reminder
 */
export async function sendReminder(req, res, next) {
  try {
    const { confirmed, recipient, subject, messageBody } = req.body;

    // Requirement: Require explicit user authorization
    if (!confirmed) {
      return res.status(400).json({
        success: false,
        code: 'CONFIRMATION_REQUIRED',
        error: 'Explicit user authorization (confirmed: true) is required before sending any payment reminder.'
      });
    }

    if (!recipient || !recipient.email) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_RECIPIENT',
        error: 'Recipient email is required to dispatch reminder.'
      });
    }

    // Honest delivery reporting: No fake email dispatch
    return res.status(200).json({
      success: false,
      deliveryConfigured: false,
      code: 'DELIVERY_NOT_CONFIGURED',
      message: 'Direct SMTP / Email relay delivery is not configured in this hackathon sandbox environment. Please use the Copy to Clipboard feature to paste and send this message through your preferred email client.',
      recipientEmail: recipient.email,
      canCopy: true
    });
  } catch (err) {
    next(err);
  }
}
