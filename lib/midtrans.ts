// Midtrans Snap integration (TRD.md §9, AGENTS.md "Payments: Midtrans Snap. Webhooks are
// signature-verified and idempotent"). MIDTRANS_SERVER_KEY is read from process.env inside
// each function and is never accepted as a parameter, so it can never be logged or
// forwarded from a request body (TRD.md §9: "Never send the server key to the client").

import crypto from 'crypto';
import midtransClient from 'midtrans-client';
import type { PaymentMethodCode } from './constants/statuses';

function requireServerKey(): string {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error('MIDTRANS_SERVER_KEY is not set. See .env.example.');
  }
  return serverKey;
}

export interface CreateSnapTransactionInput {
  orderId: string;
  /** Integer rupiah (AGENTS.md "Money is integer rupiah"); this is `invoices.total_amount`. */
  grossAmount: number;
  paymentMethodCode: PaymentMethodCode;
  customerName: string;
  customerEmail: string;
}

export interface CreateSnapTransactionResult {
  token: string;
  redirectUrl: string;
}

/**
 * Creates one Snap transaction for a billing attempt (TRD.md §9 step 2). `orderId` must be
 * unique per attempt (`{invoice_code}-{n}`) — Midtrans rejects a reused order_id.
 */
export async function createSnapTransaction(
  input: CreateSnapTransactionInput,
): Promise<CreateSnapTransactionResult> {
  const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: requireServerKey(),
  });

  const response = await snap.createTransaction({
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.grossAmount,
    },
    enabled_payments: [input.paymentMethodCode],
    customer_details: {
      first_name: input.customerName,
      email: input.customerEmail,
    },
  });

  return { token: response.token, redirectUrl: response.redirect_url };
}

export interface VerifyWebhookSignatureInput {
  orderId: string;
  /** `status_code` exactly as received — Midtrans sends it as a string (e.g. "200"). */
  statusCode: string;
  /** `gross_amount` exactly as received — a decimal string (e.g. "149000.00"), never
   *  reformatted from a number: re-stringifying a number would drop the ".00" suffix
   *  Midtrans's own signature was computed against, breaking every verification. */
  grossAmount: string;
  signatureKey: string;
}

/**
 * Verifies a Midtrans webhook notification (TRD.md §9 step 4):
 * `signature_key == sha512(order_id + status_code + gross_amount + SERVER_KEY)`.
 *
 * This is the entire security boundary for `/api/payments/midtrans/notification`
 * (AGENTS.md: "Webhooks are signature-verified and idempotent") — call it, and reject on
 * `false`, before anything else in the webhook reads the body or mutates state. Comparison
 * is constant-time (`crypto.timingSafeEqual`) so response timing can't leak how much of the
 * signature a forged request got right.
 */
export function verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
  const serverKey = requireServerKey();

  const expectedHex = crypto
    .createHash('sha512')
    .update(input.orderId + input.statusCode + input.grossAmount + serverKey)
    .digest('hex');

  // sha512 hex digests are always 128 chars, but signatureKey comes straight off the wire —
  // guard the length before timingSafeEqual, which throws (rather than returning false) on
  // buffers of different sizes.
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(input.signatureKey, 'hex');
  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}
