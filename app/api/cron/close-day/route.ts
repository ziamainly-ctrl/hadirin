import { apiOk, handleApiError } from '@/lib/api-response';
import { requireCronSecret, chunk } from '@/lib/cron-auth';
import { listAllOrgsForCron } from '@/lib/queries/organizations';
import { insertAbsencesForOrgAndDate, listOpenLogsForOrgAndDate } from '@/lib/queries/attendance';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { notify } from '@/lib/notify';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getLocalParts, formatDate, addDaysToDateString } from '@/lib/tz';

const BATCH_SIZE = 50;

/**
 * Vercel Cron, daily (vercel.json). TRD.md §12 / ERD.md §3.2: marks ABSENT/HOLIDAY for
 * "yesterday" per org timezone, then queues MISSING_CHECK_OUT reminders for open logs.
 * Simplification vs. TRD.md's note on cross-day shifts: this closes "yesterday" uniformly
 * for every shift. There are no cross-day shifts in the seed data, and the extra
 * day-before-yesterday buffer TRD.md describes would need insertAbsencesForOrgAndDate to
 * select a different target date per shift within the same org — not worth the added
 * complexity for a shift type this app doesn't yet exercise; revisit if cross-day shifts
 * see real use.
 */
export async function GET(request: Request) {
  try {
    requireCronSecret(request);

    const orgs = await listAllOrgsForCron();
    let absencesInserted = 0;
    let remindersSent = 0;

    for (const batch of chunk(orgs, BATCH_SIZE)) {
      await Promise.all(
        batch.map(async (org) => {
          const local = getLocalParts(new Date(), org.timezone);
          const today = formatDate(local.year, local.month, local.day);
          const yesterday = addDaysToDateString(today, -1);

          absencesInserted += await insertAbsencesForOrgAndDate(org.id, yesterday);

          const open = await listOpenLogsForOrgAndDate(org.id, yesterday);
          if (open.length === 0) return;

          const planCtx = await getOrganizationPlanContext(org.id);
          if (!planCtx) return;

          await Promise.all(
            open.map(async (log) => {
              const employee = await getUserByIdInOrg(org.id, log.userId).catch(() => null);
              if (!employee) return;
              const variables = { employee_name: employee.name, work_date: log.workDate, app_url: process.env.NEXT_PUBLIC_APP_URL ?? '' };
              if (planCtx.features.whatsapp_alerts && employee.phone) {
                await notify({
                  orgId: org.id,
                  eventTrigger: 'MISSING_CHECK_OUT',
                  channel: 'WHATSAPP',
                  recipientUserId: employee.id,
                  recipientAddress: employee.phone,
                  variables,
                  relatedAttendanceLogId: log.id,
                });
                remindersSent++;
              } else if (planCtx.features.email_alerts && employee.email) {
                await notify({
                  orgId: org.id,
                  eventTrigger: 'MISSING_CHECK_OUT',
                  channel: 'EMAIL',
                  recipientUserId: employee.id,
                  recipientAddress: employee.email,
                  variables,
                  relatedAttendanceLogId: log.id,
                });
                remindersSent++;
              }
            }),
          );
        }),
      );
    }

    return apiOk({ orgsProcessed: orgs.length, absencesInserted, remindersSent });
  } catch (error) {
    return handleApiError(error);
  }
}
