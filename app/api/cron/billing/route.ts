import { apiOk, handleApiError } from '@/lib/api-response';
import { requireCronSecret, chunk } from '@/lib/cron-auth';
import {
  listActiveOrgsNearingExpiry,
  listActiveOrgsPastExpiry,
  listTrialOrgsPastEnd,
  listPastDueOrgsBeyondGrace,
  markOrgPastDue,
  downgradeOrSuspendOrg,
} from '@/lib/queries/organizations';
import { getPlanByCode, getPlanById } from '@/lib/queries/plans';
import { countActiveSeats, listActiveOwnersAndAdmins } from '@/lib/queries/users';
import { countActiveBranches } from '@/lib/queries/branches';
import { getPendingInvoiceForPeriod, insertInvoice, listPendingInvoicesPastExpiry, markInvoiceStatus } from '@/lib/queries/invoices';
import { notify } from '@/lib/notify';
import { addDaysToDateString, formatDate, parseDate } from '@/lib/tz';

const RENEWAL_WINDOW_DAYS = 7;
const GRACE_DAYS = 3;
const BATCH_SIZE = 50;

/** Vercel Cron, daily (vercel.json). TRD.md §9 step 5, in the order TRD.md lists it. */
export async function GET(request: Request) {
  try {
    requireCronSecret(request);

    const result = {
      renewalInvoicesCreated: 0,
      invoicesExpired: 0,
      markedPastDue: 0,
      downgradedToFree: 0,
      suspended: 0,
    };

    // 1. Renewal invoice 7 days before expiry.
    const nearingExpiry = await listActiveOrgsNearingExpiry(RENEWAL_WINDOW_DAYS);
    for (const batch of chunk(nearingExpiry, BATCH_SIZE)) {
      await Promise.all(batch.map((org) => createRenewalInvoice(org, result)));
    }

    // 2. Expire stale PENDING invoices.
    const expired = await listPendingInvoicesPastExpiry();
    for (const batch of chunk(expired, BATCH_SIZE)) {
      await Promise.all(batch.map((inv) => markInvoiceStatus(inv.id, 'EXPIRED')));
      result.invoicesExpired += batch.length;
    }

    // 3. ACTIVE -> PAST_DUE at expiry.
    const pastExpiry = await listActiveOrgsPastExpiry();
    for (const batch of chunk(pastExpiry, BATCH_SIZE)) {
      await Promise.all(batch.map((org) => markOrgPastDue(org.id)));
      result.markedPastDue += batch.length;
    }

    // 4. TRIAL past end, or PAST_DUE beyond grace -> downgrade to FREE if it fits, else SUSPENDED.
    const freePlan = await getPlanByCode('FREE');
    if (freePlan) {
      const [trialEnded, pastDueBeyondGrace] = await Promise.all([
        listTrialOrgsPastEnd(),
        listPastDueOrgsBeyondGrace(GRACE_DAYS),
      ]);
      for (const batch of chunk([...trialEnded, ...pastDueBeyondGrace], BATCH_SIZE)) {
        await Promise.all(batch.map((org) => downgradeOrSuspendIfDue(org.id, freePlan.id, freePlan, result)));
      }
    }

    return apiOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}

interface CronResult {
  renewalInvoicesCreated: number;
  downgradedToFree: number;
  suspended: number;
}

async function createRenewalInvoice(
  org: { id: number; planId: number; timezone: string; planExpiresAt: string | null },
  result: CronResult,
): Promise<void> {
  const plan = await getPlanById(org.planId);
  if (!plan || !org.planExpiresAt) return;

  const nextStart = addDaysToDateString(org.planExpiresAt.slice(0, 10), 1);
  const { year, month } = parseDate(nextStart);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
  const periodEnd = formatDate(lastDayOfMonth.getUTCFullYear(), lastDayOfMonth.getUTCMonth() + 1, lastDayOfMonth.getUTCDate());

  const existing = await getPendingInvoiceForPeriod(org.id, nextStart, periodEnd);
  if (existing) return;

  const employeeCount = await countActiveSeats(org.id);
  const invoice = await insertInvoice({
    orgId: org.id,
    planId: plan.id,
    periodStart: nextStart,
    periodEnd,
    employeeCount,
    amount: plan.priceMonthly,
    adminFee: 0,
    totalAmount: plan.priceMonthly,
    invoiceCode: `INV-${year}${String(month).padStart(2, '0')}-ORG${org.id}`,
  });
  result.renewalInvoicesCreated++;

  const recipients = await listActiveOwnersAndAdmins(org.id);
  await Promise.all(
    recipients
      .filter((r) => r.email)
      .map((r) =>
        notify({
          orgId: org.id,
          eventTrigger: 'INVOICE_CREATED',
          channel: 'EMAIL',
          recipientUserId: r.id,
          recipientAddress: r.email as string,
          variables: {
            invoice_code: invoice.invoiceCode,
            plan_name: plan.name,
            period: `${nextStart} – ${periodEnd}`,
            total_amount: String(invoice.totalAmount),
            due_date: periodEnd,
            pay_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/app/settings/billing`,
          },
          relatedInvoiceId: invoice.id,
        }),
      ),
  );
}

async function downgradeOrSuspendIfDue(
  orgId: number,
  freePlanId: number,
  freePlan: { maxEmployees: number; maxBranches: number },
  result: CronResult,
): Promise<void> {
  const [seats, branches] = await Promise.all([countActiveSeats(orgId), countActiveBranches(orgId)]);
  const fits = seats <= freePlan.maxEmployees && branches <= freePlan.maxBranches;
  await downgradeOrSuspendOrg(orgId, freePlanId, fits);
  if (fits) result.downgradedToFree++;
  else result.suspended++;
}
