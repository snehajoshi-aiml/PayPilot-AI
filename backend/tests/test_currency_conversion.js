import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { convertForPayPal, getConversionRate, formatPayPalInvoicePayload } from '../src/services/paypalService.js';

// ── convertForPayPal unit tests ─────────────────────────────────────

describe('convertForPayPal', () => {
  it('should convert INR to USD using provided rate', () => {
    const result = convertForPayPal(15000, 'INR', 0.012);
    assert.equal(result.convertedAmount, 180.00);
    assert.equal(result.paypalCurrency, 'USD');
    assert.equal(result.conversionApplied, true);
  });

  it('should round converted amount to 2 decimal places', () => {
    // 1234 * 0.012 = 14.808 → should round to 14.81
    const result = convertForPayPal(1234, 'INR', 0.012);
    assert.equal(result.convertedAmount, 14.81);
  });

  it('should handle small amounts without losing precision', () => {
    // 100 * 0.012 = 1.20
    const result = convertForPayPal(100, 'INR', 0.012);
    assert.equal(result.convertedAmount, 1.20);
  });

  it('should handle large amounts correctly', () => {
    // 500000 * 0.012 = 6000.00
    const result = convertForPayPal(500000, 'INR', 0.012);
    assert.equal(result.convertedAmount, 6000.00);
  });

  it('should not convert USD (natively supported)', () => {
    const result = convertForPayPal(250, 'USD', 0.012);
    assert.equal(result.convertedAmount, 250.00);
    assert.equal(result.paypalCurrency, 'USD');
    assert.equal(result.conversionApplied, false);
  });

  it('should not convert EUR (natively supported)', () => {
    const result = convertForPayPal(100, 'EUR', 0.012);
    assert.equal(result.convertedAmount, 100.00);
    assert.equal(result.paypalCurrency, 'EUR');
    assert.equal(result.conversionApplied, false);
  });

  it('should not convert GBP (natively supported)', () => {
    const result = convertForPayPal(500, 'GBP', 0.012);
    assert.equal(result.convertedAmount, 500.00);
    assert.equal(result.paypalCurrency, 'GBP');
    assert.equal(result.conversionApplied, false);
  });

  it('should handle case-insensitive currency codes', () => {
    const result = convertForPayPal(200, 'usd', 0.012);
    assert.equal(result.paypalCurrency, 'USD');
    assert.equal(result.conversionApplied, false);
  });

  it('should convert unknown currencies to USD', () => {
    const result = convertForPayPal(1000, 'KRW', 0.00075);
    assert.equal(result.convertedAmount, 0.75);
    assert.equal(result.paypalCurrency, 'USD');
    assert.equal(result.conversionApplied, true);
  });

  it('should default to USD when currency is missing', () => {
    const result = convertForPayPal(100, null, 0.012);
    assert.equal(result.paypalCurrency, 'USD');
    assert.equal(result.conversionApplied, false);
  });
});

// ── getConversionRate validation tests ──────────────────────────────

describe('getConversionRate', () => {
  let originalRate;

  beforeEach(() => {
    originalRate = process.env.INR_TO_USD_RATE;
  });

  afterEach(() => {
    if (originalRate !== undefined) {
      process.env.INR_TO_USD_RATE = originalRate;
    } else {
      delete process.env.INR_TO_USD_RATE;
    }
  });

  it('should return error when INR_TO_USD_RATE is not set', () => {
    delete process.env.INR_TO_USD_RATE;
    const result = getConversionRate();
    assert.ok(result.error);
    assert.ok(result.error.includes('not configured'));
  });

  it('should return error when INR_TO_USD_RATE is empty string', () => {
    process.env.INR_TO_USD_RATE = '   ';
    const result = getConversionRate();
    assert.ok(result.error);
  });

  it('should return error when INR_TO_USD_RATE is not a number', () => {
    process.env.INR_TO_USD_RATE = 'abc';
    const result = getConversionRate();
    assert.ok(result.error);
    assert.ok(result.error.includes('not a valid positive number'));
  });

  it('should return error when INR_TO_USD_RATE is zero', () => {
    process.env.INR_TO_USD_RATE = '0';
    const result = getConversionRate();
    assert.ok(result.error);
  });

  it('should return error when INR_TO_USD_RATE is negative', () => {
    process.env.INR_TO_USD_RATE = '-0.5';
    const result = getConversionRate();
    assert.ok(result.error);
  });

  it('should return valid rate for a positive number', () => {
    process.env.INR_TO_USD_RATE = '0.012';
    const result = getConversionRate();
    assert.equal(result.rate, 0.012);
    assert.equal(result.error, undefined);
  });

  it('should trim whitespace around rate value', () => {
    process.env.INR_TO_USD_RATE = '  0.0119  ';
    const result = getConversionRate();
    assert.equal(result.rate, 0.0119);
  });
});

// ── PayPal payload currency consistency tests ───────────────────────

describe('PayPal payload currency consistency', () => {
  it('should use USD in ALL currency_code fields for INR invoice', () => {
    const invoice = {
      invoiceNumber: 'INV-TEST-001',
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      serviceDescription: 'Testing',
      amount: 25000,
      currency: 'INR',
      dueDate: '2026-12-31',
      items: [
        { name: 'Item A', unitPrice: 10000, quantity: 1 },
        { name: 'Item B', unitPrice: 15000, quantity: 1 }
      ]
    };

    const { payload, conversionInfo } = formatPayPalInvoicePayload(invoice, { conversionRate: 0.012 });

    // Detail level
    assert.equal(payload.detail.currency_code, 'USD', 'detail.currency_code is USD');

    // Every item
    for (let i = 0; i < payload.items.length; i++) {
      assert.equal(
        payload.items[i].unit_amount.currency_code,
        'USD',
        `items[${i}].unit_amount.currency_code is USD`
      );
    }

    // Verify converted amounts: 10000*0.012=120, 15000*0.012=180
    assert.equal(payload.items[0].unit_amount.value, '120.00');
    assert.equal(payload.items[1].unit_amount.value, '180.00');

    // Conversion metadata
    assert.equal(conversionInfo.conversionApplied, true);
    assert.equal(conversionInfo.originalCurrency, 'INR');
    assert.equal(conversionInfo.originalAmount, 25000);
  });

  it('should throw CONVERSION_RATE_MISSING when INR invoice has no rate configured', () => {
    const originalRate = process.env.INR_TO_USD_RATE;
    delete process.env.INR_TO_USD_RATE;

    const invoice = {
      invoiceNumber: 'INV-TEST-002',
      customerName: 'Test',
      customerEmail: 'test@example.com',
      amount: 1000,
      currency: 'INR'
    };

    try {
      formatPayPalInvoicePayload(invoice);
      assert.fail('Should have thrown CONVERSION_RATE_MISSING');
    } catch (err) {
      assert.equal(err.code, 'CONVERSION_RATE_MISSING');
      assert.equal(err.status, 400);
    } finally {
      if (originalRate !== undefined) {
        process.env.INR_TO_USD_RATE = originalRate;
      }
    }
  });

  it('should NOT convert EUR invoice and preserve EUR in all fields', () => {
    const invoice = {
      invoiceNumber: 'INV-TEST-003',
      customerName: 'Hans Mueller',
      customerEmail: 'hans@example.com',
      amount: 500,
      currency: 'EUR'
    };

    const { payload, conversionInfo } = formatPayPalInvoicePayload(invoice);

    assert.equal(payload.detail.currency_code, 'EUR');
    assert.equal(payload.items[0].unit_amount.currency_code, 'EUR');
    assert.equal(payload.items[0].unit_amount.value, '500.00');
    assert.equal(conversionInfo.conversionApplied, false);
    assert.equal(conversionInfo.conversionRate, null);
  });

  it('should preserve original invoice data (never mutate input)', () => {
    const original = {
      invoiceNumber: 'INV-TEST-004',
      customerName: 'Priya Patel',
      customerEmail: 'priya@example.com',
      amount: 8500,
      currency: 'INR',
      dueDate: '2026-12-15'
    };

    const amountBefore = original.amount;
    const currencyBefore = original.currency;

    formatPayPalInvoicePayload(original, { conversionRate: 0.012 });

    assert.equal(original.amount, amountBefore, 'Original amount unchanged');
    assert.equal(original.currency, currencyBefore, 'Original currency unchanged');
  });
});
