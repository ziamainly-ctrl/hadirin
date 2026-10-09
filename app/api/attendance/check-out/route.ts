import { after } from 'next/server';
import { apiOk, apiError, ConflictError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { checkOutSchema, MAX_PUNCH_ACCURACY_M } from '@/lib/validators/attendance';
import { checkinRatelimit } from '@/lib/redis';
import { loadPunchContext } from '@/lib/punch-context';
import { updateCheckOutById, getHolidayNameForDate } from '@/lib/queries/attendance';
import { getShiftByIdInOrg } from '@/lib/queries/shifts';
import { dayKindFor } from '@/lib/punch';
import { workMinutes as computeWorkMinutes, earlyLeaveMinutes as computeEarlyLeaveMinutes } from '@/lib/attendance-rules';
import { formatDistance, nearestBranch } from '@/lib/geo';
import { isOwnAttendancePhoto } from '@/lib/attendance-photo';
import { bustDashboardCache } from '@/lib/dashboard-cache';
import { PunchRuleError, handlePunchError } from '@/lib/punch-errors';

// TRD.md §7 — check-out shares the same geofence/selfie rules as check-in, then closes the
// person's OPEN log. It looks for the open log, not for "today's row": a check-out after
// midnight (overtime) or after a cross-day shift ends belongs to the log of the previous work
// date, and keying on today's date made that impossible (NOT_CHECKED_IN, only a correction
// request could close it). 409 "already checked out" vs 422 "not checked in" is decided by
// looking the rows up first (AGENTS.md domain rule #6: idempotent writes).
export async function POST(request: Request) {
  try {
    const { userId, orgId, context } = await requireActiveSession();
    const body = checkOutSchema.parse(await request.json());

    const pc = await loadPunchContext({ orgId, userId, shiftId: context.shiftId });
    const { org } = pc;
    if (org.status === 'SUSPENDED') {
      return apiError(403, 'ORG_SUSPENDED', 'Langganan organisasi ditangguhkan, jadi absen dinonaktifkan.');
    }
    if (!pc.shift || !pc.workDate) {
      throw new PunchRuleError('NOT_TRACKED', 'Akun ini belum punya shift, jadi belum bisa absen. Minta admin menetapkan shift.');
    }
    if (body.accuracyM > MAX_PUNCH_ACCURACY_M) {
      throw new PunchRuleError('ACCURACY_TOO_LOW', 'Akurasi lokasi terlalu rendah (lebih dari 1 km). Perbarui lokasi lalu coba lagi.', {
        accuracyM: body.accuracyM,
      });
    }

    if (org.selfieRequired && !body.photoUrl) {
      return apiError(400, 'VALIDATION_ERROR', 'Foto selfie wajib diambil.', { photoUrl: 'Foto selfie wajib diambil.' });
    }
    if (body.photoUrl && !isOwnAttendancePhoto(body.photoUrl, orgId, userId, 'out')) {
      return apiError(400, 'VALIDATION_ERROR', 'Foto tidak valid. Ambil ulang foto selfie.', {
        photoUrl: 'Foto tidak valid. Ambil ulang foto selfie.',
      });
    }

    const openLog = pc.target?.action === 'check-out' ? pc.target.log : null;
    if (!openLog || !openLog.checkInAt) {
      const today = pc.todayLog;
      if (today?.checkOutAt) {
        throw new ConflictError('ALREADY_CHECKED_OUT', 'Absen keluar sudah tercatat.');
      }
      if (today?.checkInAt) {
        throw new PunchRuleError(
          'CHECKOUT_WINDOW_CLOSED',
          'Batas waktu absen keluar sudah lewat. Ajukan koreksi absensi agar jam keluar tercatat.',
        );
      }
      throw new PunchRuleError('NOT_CHECKED_IN', 'Anda belum absen masuk pada hari kerja ini.');
    }

    if (pc.activeBranches.length === 0) {
      throw new PunchRuleError('NO_BRANCHES', 'Organisasi belum punya cabang aktif sebagai titik absen.');
    }
    const nearest = nearestBranch(body.latitude, body.longitude, pc.activeBranches);
    if (!nearest) {
      throw new PunchRuleError('NO_BRANCHES', 'Organisasi belum punya cabang aktif sebagai titik absen.');
    }
    if (nearest.isOutside && org.geofenceMode === 'STRICT') {
      throw new PunchRuleError(
        'OUTSIDE_GEOFENCE',
        `Anda berada ${formatDistance(nearest.distanceM)} dari ${nearest.branch.name} (batas ${formatDistance(nearest.branch.radiusM)}).`,
        {
          distanceM: nearest.distanceM,
          radiusM: nearest.branch.radiusM,
          branchId: nearest.branch.id,
          branchName: nearest.branch.name,
        },
      );
    }

    const { success } = await checkinRatelimit.limit(String(userId));
    if (!success) return apiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');

    // History is a snapshot (AGENTS.md rule #10): break length and the scheduled end come from the
    // shift the log was opened under, not whatever the person is assigned to right now.
    const logShift =
      openLog.shiftId === null || openLog.shiftId === pc.shift.id
        ? pc.shift
        : await getShiftByIdInOrg(orgId, openLog.shiftId).catch(() => pc.shift!);
    const now = pc.now;
    const workMinutes = computeWorkMinutes(new Date(openLog.checkInAt), now, logShift.breakMinutes);

    // Leaving "early" only means something on a day the person was expected to work.
    const holidayName =
      openLog.workDate === pc.workDate ? pc.holidayName : await getHolidayNameForDate(orgId, openLog.workDate);
    const dayKind = dayKindFor(openLog.workDate, logShift.workDays, holidayName);
    const earlyLeaveMinutes =
      dayKind === 'WORK'
        ? computeEarlyLeaveMinutes(
            now,
            openLog.workDate,
            { timeOut: openLog.scheduledOut ?? logShift.timeOut, isCrossDay: logShift.isCrossDay },
            org.timezone,
          )
        : 0;

    const updated = await updateCheckOutById({
      orgId,
      logId: openLog.id,
      branchId: nearest.branch.id,
      lat: body.latitude,
      lng: body.longitude,
      accuracyM: body.accuracyM,
      distanceM: nearest.distanceM,
      photoUrl: body.photoUrl ?? null,
      isOutside: nearest.isOutside,
      workMinutes,
      earlyLeaveMinutes,
    });
    if (!updated) throw new ConflictError('ALREADY_CHECKED_OUT', 'Absen keluar sudah tercatat.');

    after(() => bustDashboardCache(orgId, openLog.workDate));

    return apiOk({
      log: updated,
      branch: { id: nearest.branch.id, name: nearest.branch.name },
      serverNow: new Date().toISOString(),
      dayKind,
    });
  } catch (error) {
    return handlePunchError(error);
  }
}
