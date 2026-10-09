import { after } from 'next/server';
import { apiOk, apiError, handleApiError, ConflictError, BusinessRuleError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { reviewRequestSchema } from '@/lib/validators/attendance-requests';
import { idParam } from '@/lib/validators/common';
import { withTx } from '@/lib/db';
import { bust, cacheKeys } from '@/lib/redis';
import { getRequestWithRequesterInOrg, reviewRequestAtomic, cancelRequestInOrg } from '@/lib/queries/attendance-requests';
import { getLogByUserAndDate, applyCorrectionToLog, applyRangeStatusToLogs } from '@/lib/queries/attendance';
import { getShiftRuleById } from '@/lib/queries/shifts';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { notify } from '@/lib/notify';
import { lateMinutes as computeLateMinutes, workMinutes as computeWorkMinutes } from '@/lib/attendance-rules';
import { zonedTimeToInstant, parseDate, addDaysToDateString } from '@/lib/tz';

// PATCH /api/attendance-requests/[id] { action, note? } — TRD.md §8. Everything that
// mutates state happens inside one withTx; the atomic UPDATE in reviewRequestAtomic
// (WHERE status='PENDING') is what makes a double-review race return 409, not a
// double-applied log.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, orgId, role } = await requireActiveSession(['OWNER', 'ADMIN', 'MANAGER']);
    const id = idParam.parse((await params).id);
    const body = reviewRequestSchema.parse(await request.json());

    const target = await getRequestWithRequesterInOrg(orgId, id);

    if (target.userId === userId) {
      return apiError(403, 'FORBIDDEN', 'Anda tidak dapat meninjau pengajuan Anda sendiri.');
    }
    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    const isOwnReport = role === 'MANAGER' && target.requesterManagerId === userId;
    if (!isOrgWide && !isOwnReport) {
      return apiError(403, 'FORBIDDEN', 'Anda hanya dapat meninjau pengajuan dari anggota tim Anda.');
    }

    const org = await getOrganizationPlanContext(orgId);
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organisasi tidak ditemukan.');

    const newStatus = body.action === 'approve' ? 'APPROVED' : 'REJECTED';

    const reviewed = await withTx(async (client) => {
      const updated = await reviewRequestAtomic(client, {
        orgId,
        requestId: id,
        reviewerId: userId,
        status: newStatus,
        note: body.note ?? null,
      });
      if (!updated) throw new ConflictError('ALREADY_REVIEWED', 'Pengajuan ini sudah ditinjau.');

      if (body.action === 'approve') {
        if (!target.requesterShiftId) {
          // Untracked requester (no shift) — nothing to write to attendance_logs; the
          // request itself is still marked APPROVED above.
          return updated;
        }
        const shift = await getShiftRuleById(target.requesterShiftId);
        if (!shift) throw new BusinessRuleError('SHIFT_MISSING', 'Shift pemohon sudah tidak ada.');

        if (target.type === 'CORRECTION') {
          const workDate = target.dateFrom;
          const existing = await getLogByUserAndDate(orgId, target.userId, workDate);
          const { year, month, day } = parseDate(workDate);

          const checkInAt = target.requestedCheckIn
            ? zonedTimeToInstant(year, month, day, ...timeParts(target.requestedCheckIn), org.timezone)
            : existing?.checkInAt
              ? new Date(existing.checkInAt)
              : null;
          const checkOutDate = shift.isCrossDay ? addDaysToDateString(workDate, 1) : workDate;
          const { year: coY, month: coM, day: coD } = parseDate(checkOutDate);
          const checkOutAt = target.requestedCheckOut
            ? zonedTimeToInstant(coY, coM, coD, ...timeParts(target.requestedCheckOut), org.timezone)
            : existing?.checkOutAt
              ? new Date(existing.checkOutAt)
              : null;

          const lateMinutes = checkInAt ? computeLateMinutes(checkInAt, workDate, shift, org.timezone) : 0;
          const status = checkInAt && lateMinutes > 0 ? 'LATE' : 'PRESENT';
          const workMinutes =
            checkInAt && checkOutAt ? computeWorkMinutes(checkInAt, checkOutAt, shift.breakMinutes) : null;

          await applyCorrectionToLog(client, {
            orgId,
            userId: target.userId,
            shiftId: target.requesterShiftId,
            workDate,
            scheduledIn: shift.timeIn,
            scheduledOut: shift.timeOut,
            status,
            checkInAt: checkInAt ? checkInAt.toISOString() : null,
            checkOutAt: checkOutAt ? checkOutAt.toISOString() : null,
            lateMinutes,
            workMinutes,
            requestId: id,
          });
        } else {
          // LEAVE / SICK / PERMIT share the request's own `type` as the resulting status
          // (ERD.md §1.1 — both are drawn from the same value set).
          await applyRangeStatusToLogs(client, {
            orgId,
            userId: target.userId,
            shiftId: target.requesterShiftId,
            dateFrom: target.dateFrom,
            dateTo: target.dateTo,
            status: target.type,
            requestId: id,
          });
        }
      }

      return updated;
    });

    after(async () => {
      await bust(cacheKeys.dashboard(orgId, target.dateFrom));
      if (target.dateTo !== target.dateFrom) await bust(cacheKeys.dashboard(orgId, target.dateTo));

      const [requester, reviewer] = await Promise.all([
        getUserByIdInOrg(orgId, target.userId).catch(() => null),
        getUserByIdInOrg(orgId, userId).catch(() => null),
      ]);
      if (!requester) return;
      const statusLabel = newStatus === 'APPROVED' ? 'disetujui' : 'ditolak';
      const variables = {
        request_type: target.type,
        date_range: target.dateFrom === target.dateTo ? target.dateFrom : `${target.dateFrom} – ${target.dateTo}`,
        status_label: statusLabel,
        reviewer_name: reviewer?.name ?? `#${userId}`,
        review_note: body.note ?? '',
      };
      if (org.features.email_alerts && requester.email) {
        await notify({
          orgId,
          eventTrigger: 'REQUEST_REVIEWED',
          channel: 'EMAIL',
          recipientUserId: requester.id,
          recipientAddress: requester.email,
          variables,
          relatedRequestId: id,
        });
      }
      if (org.features.whatsapp_alerts && requester.phone) {
        await notify({
          orgId,
          eventTrigger: 'REQUEST_REVIEWED',
          channel: 'WHATSAPP',
          recipientUserId: requester.id,
          recipientAddress: requester.phone,
          variables,
          relatedRequestId: id,
        });
      }
    });

    return apiOk({ request: reviewed });
  } catch (error) {
    return handleApiError(error);
  }
}

function timeParts(time: string): [number, number, number] {
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number);
  return [h, m, s];
}

// GET /api/attendance-requests/[id]
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, orgId, role } = await requireActiveSession();
    const id = idParam.parse((await params).id);

    const target = await getRequestWithRequesterInOrg(orgId, id);
    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    const isOwner = target.userId === userId;
    const isManagerOfOwner = role === 'MANAGER' && target.requesterManagerId === userId;
    if (!isOrgWide && !isOwner && !isManagerOfOwner) {
      return apiError(404, 'NOT_FOUND', 'Pengajuan tidak ditemukan');
    }

    return apiOk({ request: target });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/attendance-requests/[id] — self-service cancel while PENDING (PRD.md E6).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId, orgId } = await requireActiveSession();
    const id = idParam.parse((await params).id);
    const cancelled = await cancelRequestInOrg(orgId, userId, id);
    return apiOk({ request: cancelled });
  } catch (error) {
    return handleApiError(error);
  }
}
