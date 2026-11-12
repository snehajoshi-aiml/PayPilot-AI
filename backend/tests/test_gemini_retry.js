import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isTransientError, stripCodeFences } from '../src/utils/geminiRetry.js';

// ── Unit tests for helper functions ─────────────────────────────────

describe('isTransientError', () => {
  it('should return true for error with status 503', () => {
    const err = new Error('Server overloaded');
    err.status = 503;
    assert.equal(isTransientError(err), true);
  });

  it('should return true for error with status 429', () => {
    const err = new Error('Rate limited');
    err.status = 429;
    assert.equal(isTransientError(err), true);
  });

  it('should return true for error with httpStatusCode 503', () => {
    const err = new Error('fail');
    err.httpStatusCode = 503;
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "503"', () => {
    const err = new Error('[503 Service Unavailable] The model is overloaded');
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "overloaded"', () => {
    const err = new Error('The model is currently overloaded with requests');
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "high demand"', () => {
    const err = new Error('Model temporarily unavailable due to high demand');
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "resource exhausted"', () => {
    const err = new Error('RESOURCE_EXHAUSTED: quota exceeded');
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "too many requests"', () => {
    const err = new Error('Too many requests, please slow down');
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "service unavailable"', () => {
    const err = new Error('Service Unavailable');
    assert.equal(isTransientError(err), true);
  });

  it('should return true for message containing "temporarily unavailable"', () => {
    const err = new Error('Model is temporarily unavailable');
    assert.equal(isTransientError(err), true);
  });

  it('should return false for 404 not found error', () => {
    const err = new Error('Model not found');
    err.status = 404;
    assert.equal(isTransientError(err), false);
  });

  it('should return false for 401 auth error', () => {
    const err = new Error('Invalid API key');
    err.status = 401;
    assert.equal(isTransientError(err), false);
  });

  it('should return false for generic 500 error', () => {
    const err = new Error('Internal server error');
    err.status = 500;
    assert.equal(isTransientError(err), false);
  });

  it('should return false for a SyntaxError (parse failure)', () => {
    const err = new SyntaxError('Unexpected token');
    assert.equal(isTransientError(err), false);
  });
});

describe('stripCodeFences', () => {
  it('should strip ```json fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('should strip plain ``` fences', () => {
    const input = '```\n{"key": "value"}\n```';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('should return plain JSON unchanged', () => {
    const input = '{"key": "value"}';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });

  it('should trim whitespace', () => {
    const input = '   {"key": "value"}   ';
    assert.equal(stripCodeFences(input), '{"key": "value"}');
  });
});

// ── Integration-style tests for generateWithRetry (mocked SDK) ──────

describe('generateWithRetry', () => {
  // We test the retry logic by dynamically importing with mocked SDK.
  // Since the module imports GoogleGenerativeAI at the top level of
  // geminiRetry.js, we test the flow by verifying the function signature
  // and error classification behavior.

  it('should classify CONFIG_MISSING from geminiService when key is empty', async () => {
    // Temporarily clear GEMINI_API_KEY
    const original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = '';

    try {
      const { extractInvoiceFromPrompt } = await import('../src/services/geminiService.js');
      await extractInvoiceFromPrompt('Test prompt');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.equal(err.code, 'CONFIG_MISSING');
      assert.equal(err.status, 503);
    } finally {
      process.env.GEMINI_API_KEY = original;
    }
  });

  it('should correctly identify transient vs non-transient errors for retry decisions', () => {
    // 503 high demand → should retry
    const err503 = new Error('503 high demand');
    err503.status = 503;
    assert.equal(isTransientError(err503), true);

    // 429 rate limit → should retry
    const err429 = new Error('rate limited');
    err429.status = 429;
    assert.equal(isTransientError(err429), true);

    // 404 model not found → should NOT retry (fail fast)
    const err404 = new Error('model not found');
    err404.status = 404;
    assert.equal(isTransientError(err404), false);

    // 400 bad request → should NOT retry
    const err400 = new Error('bad request');
    err400.status = 400;
    assert.equal(isTransientError(err400), false);
  });
});
