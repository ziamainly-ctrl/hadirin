// Recipient resolution for notify() (lib/notify.ts handles rendering/sending one
// message). TRD.md §8: "Notification recipients: the requester's manager_id. If it is
// NULL, every ACTIVE OWNER and ADMIN of the org. The same fallback applies to
// LATE_CHECK_IN." A plan's email_alerts/whatsapp_alerts feature flags gate which
// channels are even attempted (ERD.md §4 seed: FREE has neither, STARTER email only,
// BUSINESS both) — and a recipient missing that contact method is simply skipped.

import { notify } from './notify';
import { getUserByIdInOrg, listActiveOwnersAndAdmins } from './queries/users';
import type { NotificationEventTrigger } from './constants/events';
import type { PlanFeatures } from './constants/plan-features';

export interface NotifyFallbackInput {
  orgId: number;
  eventTrigger: NotificationEventTrigger;
  /** The affected user's manager_id — null falls back to every ACTIVE OWNER/ADMIN. */
  managerId: number | null;
  features: PlanFeatures;
  variables: Record<string, string>;
  relatedAttendanceLogId?: number | null;
  relatedRequestId?: number | null;
  /** Never notify this user, even if they are the manager or an owner/admin: a late person is not told
   * about their own lateness (the check-in route passes the person who just punched). */
  excludeUserId?: number;
}

/** Fire-and-forget — call from inside `after()`, same as notify() itself. */
export async function notifyManagerOrOrgAdmins(input: NotifyFallbackInput): Promise<void> {
  const candidates = input.managerId
    ? [await getUserByIdInOrg(input.orgId, input.managerId).catch(() => null)].filter((r) => r !== null)
    : await listActiveOwnersAndAdmins(input.orgId);
  const recipients = candidates.filter((recipient) => recipient.id !== input.excludeUserId);

  await Promise.all(
    recipients.flatMap((recipient) => {
      const sends: Promise<unknown>[] = [];
      if (input.features.email_alerts && recipient.email) {
        sends.push(
          notify({
            orgId: input.orgId,
            eventTrigger: input.eventTrigger,
            channel: 'EMAIL',
            recipientUserId: recipient.id,
            recipientAddress: recipient.email,
            variables: { ...input.variables, manager_name: recipient.name },
            relatedAttendanceLogId: input.relatedAttendanceLogId,
            relatedRequestId: input.relatedRequestId,
          }),
        );
      }
      if (input.features.whatsapp_alerts && recipient.phone) {
        sends.push(
          notify({
            orgId: input.orgId,
            eventTrigger: input.eventTrigger,
            channel: 'WHATSAPP',
            recipientUserId: recipient.id,
            recipientAddress: recipient.phone,
            variables: { ...input.variables, manager_name: recipient.name },
            relatedAttendanceLogId: input.relatedAttendanceLogId,
            relatedRequestId: input.relatedRequestId,
          }),
        );
      }
      return sends;
    }),
  );
}
