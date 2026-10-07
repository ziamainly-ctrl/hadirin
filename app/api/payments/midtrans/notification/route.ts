import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/midtrans';
import { claimIdempotencyKey } from '@/lib/redis';
import { getInvoiceByMidtransOrderId, markInvoicePaid, markInvoiceStatus } from '@/lib/queries/invoices';
import { insertPaymentLog } from '@/lib/queries/payment-logs';
import { activateOrgAfterPayment, getOrganizationById } from '@/lib/queries/organizations';
import { listActiveOwnersAndAdmins } from '@/lib/queries/users';
import { notify } from '@/lib/notify';
import { zonedTimeToInstant, parseDate } from '@/lib/tz';

interface MidtransNotificationBody {
  order_id: string;
  transaction_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  payment_type: string;
  fraud_status?: string;
  signature_key: string;
}

// POST /api/payments/midtrans/notification — TRD.md §9 step 4. The ENTIRE security
// boundary is verifyWebhookSignature(); nothing else in this handler is trusted until
// that returns true. Always returns 200 once the signature checks out (even for an
// unrecognized order_id or a `pending` status) so Midtrans doesn't keep retrying —
// only a bad signature gets a non-200.
export async function POST(request: Request) {
  let body: MidtransNotificationBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const valid = verifyWebhookSignature({
    orderId: body.order_id,
    statusCode: body.status_code,
    grossAmount: body.gross_amount,
    signatureKey: body.signature_key,
  });
  if (!valid) {
    console.error('Midtrans webhook: invalid signature', { orderId: body.order_id });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const invoice = await getInvoiceByMidtransOrderId(body.order_id);
  if (!invoice) {
    // payment_logs.invoice_id is NOT NULL with a FK — there is nowhere to attach a log
    // row for an order_id we don't recognize. Visible via stderr instead.
    console.error('Midtrans webhook: unknown order_id', body.order_id);
    return NextResponse.json({ ok: true, note: 'unknown order_id' });
  }

  await insertPaymentLog({
    invoiceId: invoice.id,
    direction: 'WEBHOOK',
    endpoint: '/api/payments/midtrans/notification',
    requestPayload: body,
    responsePayload: null,
    httpStatus: 200,
  });

  const firstDelivery = await claimIdempotencyKey(`idem:midtrans:${body.order_id}:${body.transaction_status}`, 86400);
  if (!firstDelivery) {
    return NextResponse.json({ ok: true, note: 'duplicate delivery' });
  }

  const isPaid =
    body.transaction_status === 'settlement' ||
    (body.transaction_status === 'capture' && body.fraud_status === 'accept');

  if (isPaid) {
    await markInvoicePaid(invoice.id, { midtransTransactionId: body.transaction_id });

    const org = await getOrganizationById(invoice.orgId);
    if (org) {
      const { year, month, day } = parseDate(invoice.periodEnd);
      const planExpiresAt = zonedTimeToInstant(year, month, day, 23, 59, 59, org.timezone).toISOString();
      await activateOrgAfterPayment(invoice.orgId, planExpiresAt);

      const recipients = await listActiveOwnersAndAdmins(invoice.orgId);
      await Promise.all(
        recipients
          .filter((r) => r.email)
          .map((r) =>
            notify({
              orgId: invoice.orgId,
              eventTrigger: 'INVOICE_PAID',
              channel: 'EMAIL',
              recipientUserId: r.id,
              recipientAddress: r.email as string,
              variables: {
                invoice_code: invoice.invoiceCode,
                total_amount: String(invoice.totalAmount),
                payment_method: body.payment_type,
                plan_expires_at: planExpiresAt.slice(0, 10),
              },
              relatedInvoiceId: invoice.id,
            }),
          ),
      );
    }
  } else if (body.transaction_status === 'expire') {
    await markInvoiceStatus(invoice.id, 'EXPIRED');
  } else if (body.transaction_status === 'cancel' || body.transaction_status === 'deny') {
    await markInvoiceStatus(invoice.id, 'FAILED');
  }
  // 'pending' → no state change (TRD.md §9 step 4).

  return NextResponse.json({ ok: true });
}
