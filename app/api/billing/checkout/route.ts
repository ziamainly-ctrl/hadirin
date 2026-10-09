import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { checkoutSchema } from '@/lib/validators/invoices';
import { getOrganizationById } from '@/lib/queries/organizations';
import { getPlanById } from '@/lib/queries/plans';
import { getPaymentMethodById } from '@/lib/queries/payment-methods';
import { countActiveSeats, getUserByIdInOrg } from '@/lib/queries/users';
import { getPendingInvoiceForPeriod, insertInvoice, attachMidtransCheckout } from '@/lib/queries/invoices';
import { createSnapTransaction } from '@/lib/midtrans';
import { insertPaymentLog } from '@/lib/queries/payment-logs';
import { formatDate, getLocalParts } from '@/lib/tz';

const PAYMENT_WINDOW_HOURS = 24;

// POST /api/billing/checkout { paymentMethodId } — TRD.md §9 steps 1–2. The method's
// fee must be locked in BEFORE the Snap token is requested, because gross_amount is
// fixed at that point and can't be changed without a new token.
export async function POST(request: Request) {
  try {
    const { userId, orgId } = await requireActiveSession(['OWNER']);
    const body = checkoutSchema.parse(await request.json());

    const [org, method] = await Promise.all([getOrganizationById(orgId), getPaymentMethodById(body.paymentMethodId)]);
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organisasi tidak ditemukan.');
    if (!method || !method.isActive) return apiError(400, 'VALIDATION_ERROR', 'Metode pembayaran tidak tersedia.');

    const plan = await getPlanById(org.planId);
    if (!plan) return apiError(500, 'INTERNAL_ERROR', 'Paket tidak ditemukan.');

    const { year, month } = getLocalParts(new Date(), org.timezone);
    const periodStart = formatDate(year, month, 1);
    const periodEndDate = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
    const periodEnd = formatDate(periodEndDate.getUTCFullYear(), periodEndDate.getUTCMonth() + 1, periodEndDate.getUTCDate());

    let invoice = await getPendingInvoiceForPeriod(orgId, periodStart, periodEnd);
    if (!invoice) {
      const employeeCount = await countActiveSeats(orgId);
      invoice = await insertInvoice({
        orgId,
        planId: plan.id,
        periodStart,
        periodEnd,
        employeeCount,
        amount: plan.priceMonthly,
        adminFee: 0,
        totalAmount: plan.priceMonthly,
        invoiceCode: `INV-${year}${String(month).padStart(2, '0')}-ORG${orgId}`,
      });
    }

    const adminFee = method.adminFeeFlat + Math.ceil((invoice.amount * method.adminFeePct) / 100);
    const totalAmount = invoice.amount + adminFee;
    const attemptSuffix = Date.now().toString(36);
    const midtransOrderId = `${invoice.invoiceCode}-${attemptSuffix}`;
    const expiresAt = new Date(Date.now() + PAYMENT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const owner = await getUserByIdInOrg(orgId, userId);
    const snapRequest = {
      orderId: midtransOrderId,
      grossAmount: totalAmount,
      paymentMethodCode: method.code,
      customerName: owner.name,
      customerEmail: owner.email ?? '',
    };

    let snap;
    try {
      snap = await createSnapTransaction(snapRequest);
    } catch (err) {
      await insertPaymentLog({
        invoiceId: invoice.id,
        direction: 'REQUEST',
        endpoint: 'snap/v1/transactions',
        requestPayload: snapRequest,
        responsePayload: { error: err instanceof Error ? err.message : String(err) },
        httpStatus: 502,
      });
      throw err;
    }

    await insertPaymentLog({
      invoiceId: invoice.id,
      direction: 'REQUEST',
      endpoint: 'snap/v1/transactions',
      requestPayload: snapRequest,
      responsePayload: snap,
      httpStatus: 201,
    });

    const updated = await attachMidtransCheckout(invoice.id, {
      paymentMethodId: method.id,
      midtransOrderId,
      snapToken: snap.token,
      snapRedirectUrl: snap.redirectUrl,
      adminFee,
      totalAmount,
      expiresAt,
    });

    return apiOk({ invoice: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
