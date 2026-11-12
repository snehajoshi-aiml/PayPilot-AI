import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Extracts structured invoice information from natural language using Google Gemini
 * @param {string} userPrompt - Natural language prompt from the user
 * @returns {Promise<Object>} Extracted raw data from Gemini
 */
export async function extractInvoiceFromPrompt(userPrompt) {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';

  if (!apiKey) {
    const error = new Error('Google Gemini API key is missing. Please add GEMINI_API_KEY to your backend/.env file.');
    error.code = 'CONFIG_MISSING';
    error.status = 503;
    throw error;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.8-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  const systemInstructions = `
You are the AI Invoice Parser for PayPilot AI, a fintech assistant for freelancers and businesses.
Your job is to extract structured invoice data from the user's natural language description.

TODAY'S DATE: ${todayStr} (Year: ${currentYear})

STRICT RULES:
1. NEVER hallucinate, invent, assume, or guess missing information.
2. If the user did not explicitly mention a customer name, customer email, amount, currency, service description, or due date, return NULL for that field.
3. If an email address is not mentioned, customerEmail MUST be null. Never make up an email address.
4. If a currency symbol is provided, normalize to standard 3-letter ISO code:
   - "₹" or "INR" or "Rupees" -> "INR"
   - "$" or "USD" or "Dollars" -> "USD"
   - "€" or "EUR" or "Euros" -> "EUR"
   - "£" or "GBP" or "Pounds" -> "GBP"
   - "C$" or "CAD" -> "CAD"
   - "A$" or "AUD" -> "AUD"
5. If the due date is expressed relatively (e.g. "in 7 days", "in 2 weeks", "next month", "due on Friday"), calculate the exact date based on TODAY'S DATE (${todayStr}) in YYYY-MM-DD format.
6. If an explicit calendar date is mentioned (e.g. "25 November 2026"), format it as YYYY-MM-DD ("2026-11-25").
7. Extract the amount as a pure number (no currency signs or commas). For example, "₹15,000" becomes 15000.
8. Set "aiNotes" to a polite, concise summary of what was extracted and clearly state if any key fields (customer name, customer email, amount, service, or due date) are missing.

JSON SCHEMA TO RETURN:
{
  "customerName": string | null,
  "customerEmail": string | null,
  "serviceDescription": string | null,
  "amount": number | null,
  "currency": string | null,
  "dueDate": string | null,
  "aiNotes": string
}
`;

  const fullPrompt = `${systemInstructions}\n\nUSER INVOICE REQUEST:\n"${userPrompt}"`;

  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Received empty response from Gemini API.');
    }

    // Strip markdown code fences if Gemini wraps JSON in ```json ... ```
    let cleanJson = text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanJson);
    return parsed;
  } catch (err) {
    console.error('Gemini API extraction error:', err);
    if (err instanceof SyntaxError) {
      const parseError = new Error('Failed to parse AI response into structured JSON.');
      parseError.code = 'AI_PARSE_ERROR';
      parseError.status = 502;
      throw parseError;
    }
    // Forward Gemini SDK errors (like invalid key, quota, etc.)
    err.status = err.status || 500;
    throw err;
  }
}
