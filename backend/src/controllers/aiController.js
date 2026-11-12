import { extractInvoiceFromPrompt } from '../services/geminiService.js';
import { validatePromptInput, validateAndNormalizeInvoice } from '../services/invoiceValidator.js';

/**
 * Controller to parse natural language into structured invoice data
 * POST /api/ai/parse-invoice
 */
export async function parseInvoice(req, res, next) {
  try {
    const { prompt } = req.body;

    // 1. Validate prompt input
    const promptCheck = validatePromptInput(prompt);
    if (!promptCheck.isValid) {
      return res.status(400).json({
        success: false,
        error: promptCheck.error,
        code: 'INVALID_INPUT'
      });
    }

    // 2. Call Gemini AI extraction service
    let rawExtracted;
    try {
      rawExtracted = await extractInvoiceFromPrompt(promptCheck.trimmedPrompt);
    } catch (aiErr) {
      if (aiErr.code === 'CONFIG_MISSING') {
        return res.status(503).json({
          success: false,
          error: aiErr.message,
          code: 'CONFIG_MISSING',
          instructions: 'Please configure GEMINI_API_KEY in backend/.env to enable AI natural language invoice parsing.'
        });
      }

      // Check for common Gemini API errors (e.g., invalid key, quota exceeded)
      const errorMsg = aiErr.message || 'Error communicating with Gemini AI service.';
      const statusCode = aiErr.status || 500;
      return res.status(statusCode).json({
        success: false,
        error: errorMsg,
        code: 'AI_SERVICE_ERROR'
      });
    }

    // 3. Validate and normalize the extracted information
    const { invoice, validation } = validateAndNormalizeInvoice(rawExtracted);

    return res.status(200).json({
      success: true,
      data: {
        invoice,
        validation,
        aiNotes: rawExtracted.aiNotes || (validation.isComplete
          ? 'All required invoice details successfully extracted!'
          : `Extracted details with ${validation.missingFields.length} missing field(s).`),
        originalPrompt: promptCheck.trimmedPrompt
      }
    });
  } catch (error) {
    next(error);
  }
}
