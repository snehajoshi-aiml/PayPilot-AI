import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini API Retry & Fallback Utility
 *
 * Provides exponential backoff for transient HTTP 503 (overloaded) and
 * 429 (rate-limited) errors, then falls back to a stable secondary model
 * if the primary model remains unavailable after all retries.
 *
 * Flow:
 *   1. Try PRIMARY model up to MAX_RETRIES times with exponential backoff.
 *   2. If all retries fail with 503/429, try FALLBACK model once.
 *   3. If the fallback also fails, throw the final error.
 */

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;   // 1s → 2s → 4s
const MAX_DELAY_MS = 8000;

/**
 * Determines whether an error is a transient 503/429 that warrants a retry.
 * The @google/generative-ai SDK wraps HTTP errors in various shapes;
 * we check the most common ones.
 *
 * @param {Error} err
 * @returns {boolean}
 */
export function isTransientError(err) {
  // Explicit status property (set by SDK or our own code)
  const status = err.status || err.httpStatusCode || err.code;
  if (status === 503 || status === 429) return true;

  // The SDK sometimes puts the HTTP status in the message string
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('overloaded') ||
    msg.includes('resource exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('service unavailable') ||
    msg.includes('high demand') ||
    msg.includes('temporarily unavailable')
  ) {
    return true;
  }

  return false;
}

/**
 * Sleeps for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculates delay with exponential backoff and ±25% jitter.
 * @param {number} attempt - Zero-based attempt index
 * @returns {number} delay in ms
 */
function getBackoffDelay(attempt) {
  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const capped = Math.min(exponential, MAX_DELAY_MS);
  const jitter = capped * (0.75 + Math.random() * 0.5); // ±25%
  return Math.round(jitter);
}

/**
 * Executes a Gemini generateContent call with retry + fallback logic.
 *
 * @param {Object} options
 * @param {string} options.apiKey        - Gemini API key (never logged)
 * @param {Object} options.generationConfig - e.g. { temperature, responseMimeType }
 * @param {string} options.prompt        - The full prompt string
 * @returns {Promise<{ text: string, modelUsed: string }>}
 */
export async function generateWithRetry({ apiKey, generationConfig, prompt }) {
  const genAI = new GoogleGenerativeAI(apiKey);

  // ── Attempt primary model with retries ──────────────────────────
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: PRIMARY_MODEL,
        generationConfig
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return { text, modelUsed: PRIMARY_MODEL };
    } catch (err) {
      lastError = err;

      if (!isTransientError(err)) {
        // Non-transient error (auth, not found, parse, etc.) — fail immediately
        throw err;
      }

      if (attempt < MAX_RETRIES) {
        const delay = getBackoffDelay(attempt);
        console.warn(
          `[Gemini Retry] ${PRIMARY_MODEL} attempt ${attempt + 1}/${MAX_RETRIES + 1} failed ` +
          `(${err.status || err.message}). Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  // ── All primary retries exhausted — try fallback model ──────────
  console.warn(
    `[Gemini Fallback] ${PRIMARY_MODEL} failed after ${MAX_RETRIES + 1} attempts. ` +
    `Falling back to ${FALLBACK_MODEL}...`
  );

  try {
    const fallbackModel = genAI.getGenerativeModel({
      model: FALLBACK_MODEL,
      generationConfig
    });

    const result = await fallbackModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.info(`[Gemini Fallback] ${FALLBACK_MODEL} succeeded.`);
    return { text, modelUsed: FALLBACK_MODEL };
  } catch (fallbackErr) {
    console.error(
      `[Gemini Fallback] ${FALLBACK_MODEL} also failed:`,
      fallbackErr.message
    );
    // Throw the original primary error with fallback context
    lastError.fallbackAttempted = true;
    lastError.fallbackModel = FALLBACK_MODEL;
    lastError.fallbackError = fallbackErr.message;
    throw lastError;
  }
}

/**
 * Strips markdown code fences from Gemini responses.
 * @param {string} text
 * @returns {string}
 */
export function stripCodeFences(text) {
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return clean;
}
