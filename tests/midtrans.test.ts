import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { verifyWebhookSignature } from '../lib/midtrans';

// TRD.md §18 lists the Midtrans signature check as a required unit test; it is also the
// entire security boundary for /api/payments/midtrans/notification (AGENTS.md), so every
// branch of verifyWebhookSignature's logic is covered here, including the length guard
// that keeps a malformed signature from reaching (and throwing inside) timingSafeEqual.

const SERVER_KEY = 'SB-Mid-server-test-key-12345';
const ORDER_ID = 'INV-202610-0001-1';
const STATUS_CODE = '200';
const GROSS_AMOUNT = '149000.00'; // Midtrans sends gross_amount as a decimal string.

function sign(orderId: string, statusCode: string, grossAmount: string, serverKey = SERVER_KEY): string {
  return crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex');
}

describe('verifyWebhookSignature (TRD.md §9 step 4)', () => {
  beforeEach(() => {
    process.env.MIDTRANS_SERVER_KEY = SERVER_KEY;
  });

  it('accepts a correctly computed signature', () => {
    const signatureKey = sign(ORDER_ID, STATUS_CODE, GROSS_AMOUNT);
    expect(
      verifyWebhookSignature({ orderId: ORDER_ID, statusCode: STATUS_CODE, grossAmount: GROSS_AMOUNT, signatureKey }),
    ).toBe(true);
  });

  it('rejects a signature computed for a different gross amount', () => {
    const signatureKey = sign(ORDER_ID, STATUS_CODE, '1.00');
    expect(
      verifyWebhookSignature({ orderId: ORDER_ID, statusCode: STATUS_CODE, grossAmount: GROSS_AMOUNT, signatureKey }),
    ).toBe(false);
  });

  it('rejects a signature computed for a different order id', () => {
    const signatureKey = sign('INV-202610-0002-1', STATUS_CODE, GROSS_AMOUNT);
    expect(
      verifyWebhookSignature({ orderId: ORDER_ID, statusCode: STATUS_CODE, grossAmount: GROSS_AMOUNT, signatureKey }),
    ).toBe(false);
  });

  it('rejects a signature computed with the wrong server key (forged notification)', () => {
    const signatureKey = sign(ORDER_ID, STATUS_CODE, GROSS_AMOUNT, 'attacker-controlled-key');
    expect(
      verifyWebhookSignature({ orderId: ORDER_ID, statusCode: STATUS_CODE, grossAmount: GROSS_AMOUNT, signatureKey }),
    ).toBe(false);
  });

  it('treats the gross_amount string as significant — "149000" is not "149000.00"', () => {
    const signatureKey = sign(ORDER_ID, STATUS_CODE, GROSS_AMOUNT);
    expect(
      verifyWebhookSignature({ orderId: ORDER_ID, statusCode: STATUS_CODE, grossAmount: '149000', signatureKey }),
    ).toBe(false);
  });

  it('returns false (does not throw) for a short/malformed signature', () => {
    expect(() =>
      verifyWebhookSignature({
        orderId: ORDER_ID,
        statusCode: STATUS_CODE,
        grossAmount: GROSS_AMOUNT,
        signatureKey: 'not-a-valid-signature',
      }),
    ).not.toThrow();
    expect(
      verifyWebhookSignature({
        orderId: ORDER_ID,
        statusCode: STATUS_CODE,
        grossAmount: GROSS_AMOUNT,
        signatureKey: 'not-a-valid-signature',
      }),
    ).toBe(false);
  });

  it('returns false (does not throw) for an empty signature', () => {
    expect(
      verifyWebhookSignature({ orderId: ORDER_ID, statusCode: STATUS_CODE, grossAmount: GROSS_AMOUNT, signatureKey: '' }),
    ).toBe(false);
  });

  it('throws a clear configuration error when MIDTRANS_SERVER_KEY is not set', () => {
    delete process.env.MIDTRANS_SERVER_KEY;
    expect(() =>
      verifyWebhookSignature({
        orderId: ORDER_ID,
        statusCode: STATUS_CODE,
        grossAmount: GROSS_AMOUNT,
        signatureKey: 'anything',
      }),
    ).toThrow(/MIDTRANS_SERVER_KEY/);
  });
});
