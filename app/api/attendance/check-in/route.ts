import { after } from 'next/server';
import { apiOk, apiError, ConflictError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { checkInSchema, lowAccuracyNote, MAX_PUNCH_ACCURACY_M } from '@/lib/validators/attendance';
import { checkinRatelimit } from '@/lib/redis';
import { loadPunchContext } from '@/lib/punch-context';
import { insertCheckIn, getLogByUserAndDate } from '@/lib/queries/attendance';
import { getUserByIdInOrg } from '@/lib/queries/users';
import { classifyCheckIn } from '@/lib/punch';
import { formatDistance, nearestBranch } from '@/lib/geo';
import { isOwnAttendancePhoto } from '@/lib/attendance-photo';
import { notifyManagerOrOrgAdmins } from '@/lib/notify-recipients';
import { bustDashboardCache } from '@/lib/dashboard-cache';
import { PunchRuleError, handlePunchError } from '@/lib/punch-errors';

// TRD.md §7 — the full check-in flow. Idempotent: a second check-in on the same work
// date returns the existing row with 200, never a duplicate (AGENTS.md domain rule #6).
// Everything the decision depends on is recomputed here from the session and the database; the
// client sends raw lat/lng/accuracy and a photo URL, nothing else is trusted (rules #3-#5).
export async function POST(request: Request) {
  try {
    const { userId, orgId, context } = await requireActiveSession();
    const body = checkInSchema.parse(await request.json());

    const pc = await loadPunchContext({ orgId, userId, shiftId: context.shiftId });
    const { org } = pc;
    if (org.status === 'SUSPENDED') {
      return apiError(403, 'ORG_SUSPENDED', 'Langganan organisasi ditangguhkan, jadi absen dinonaktifkan.');
    }
    // Before the selfie check: a person without a shift should hear that, not "photo required".
    if (!pc.shift || !pc.workDate) {
      throw new PunchRuleError('NOT_TRACKED', 'Akun ini belum punya shift, jadi belum bisa absen. Minta admin menetapkan shift.');
    }
    if (pc.activeBranches.length === 0) {
      throw new PunchRuleError('NO_BRANCHES', 'Organisasi belum punya cabang aktif sebagai titik absen.');
    }
    if (body.accuracyM > MAX_PUNCH_ACCURACY_M) {
      throw new PunchRuleError('ACCURACY_TOO_LOW', 'Akurasi lokasi terlalu rendah (lebih dari 1 km). Perbarui lokasi lalu coba lagi.', {
        accuracyM: body.accuracyM,
      });
    }

    if (org.selfieRequired && !body.photoUrl) {
      return apiError(400, 'VALIDATION_ERROR', 'Foto selfie wajib diambil.', { photoUrl: 'Foto selfie wajib diambil.' });
    }
    if (body.photoUrl && !isOwnAttendancePhoto(body.photoUrl, orgId, userId, 'in')) {
      return apiError(400, 'VALIDATION_ERROR', 'Foto tidak valid. Ambil ulang foto selfie.', {
        photoUrl: 'Foto tidak valid. Ambil ulang foto selfie.',
      });
    }

    const { workDate, shift, dayKind } = pc;
    const existing = pc.todayLog;
    if (existing?.checkInAt) {
      // Idempotent re-check-in (a double tap, a retry after a lost response): the row that is
      // already there, with 200. Nothing is written.
      return apiOk(
        {
          log: existing,
          isNewCheckIn: false,
          branch: branchRef(pc.allBranches, existing.checkInBranchId),
          serverNow: new Date().toISOString(),
          dayKind,
        },
        200,
      );
    }
    if (existing) {
      // Approved leave / sick / permit, a holiday or an absent row already owns today.
      throw new PunchRuleError('ALREADY_RECORDED', 'Hari ini sudah tercatat sebagai bukan hari hadir, jadi tidak perlu absen masuk.', {
        status: existing.status,
      });
    }
    if (pc.target?.action === 'check-out' && pc.target.log && pc.target.log.workDate !== workDate) {
      throw new ConflictError('OPEN_LOG_EXISTS', 'Absen masuk sebelumnya belum ditutup. Absen keluar dulu.');
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

    // Counted only now, once every gate has passed: a refused attempt (outside the area, no
    // photo) does not eat the person's budget, so walking to the office and retrying always works.
    const { success } = await checkinRatelimit.limit(String(userId));
    if (!success) return apiError(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');

    const now = pc.now;
    const { status, lateMinutes } = classifyCheckIn({ now, workDate, shift, timezone: org.timezone, dayKind });

    const inserted = await insertCheckIn({
      orgId,
      userId,
      shiftId: shift.id,
      workDate,
      scheduledIn: shift.timeIn,
      scheduledOut: shift.timeOut,
      branchId: nearest.branch.id,
      lat: body.latitude,
      lng: body.longitude,
      accuracyM: body.accuracyM,
      distanceM: nearest.distanceM,
      photoUrl: body.photoUrl ?? null,
      isOutside: nearest.isOutside,
      status,
      lateMinutes,
      note: lowAccuracyNote(body.note, body.accuracyM),
    });

    // A concurrent request won the unique (user_id, work_date) race: ON CONFLICT DO NOTHING
    // returned nothing, so hand back the row that is there instead of a second one.
    const log = inserted ?? (await getLogByUserAndDate(orgId, userId, workDate));
    if (!log) return apiError(500, 'INTERNAL_ERROR', 'Absen masuk belum bisa dicatat. Coba lagi.');

    after(async () => {
      // Two independent steps, each with its own try/catch: a Redis hiccup must not skip the
      // notification and a mail failure must not leave the dashboard stale.
      await bustDashboardCache(orgId, workDate);
      if (!inserted || status !== 'LATE') return;
      try {
        const employee = await getUserByIdInOrg(orgId, userId).catch(() => null);
        const notification = {
          orgId,
          eventTrigger: 'LATE_CHECK_IN' as const,
          managerId: context.managerId,
          features: org.features,
          variables: {
            employee_name: employee?.name ?? `#${userId}`,
            branch_name: nearest.branch.name,
            check_in_time: now.toLocaleTimeString('id-ID', { timeZone: org.timezone, hour: '2-digit', minute: '2-digit' }),
            late_minutes: String(lateMinutes),
          },
          relatedAttendanceLogId: log.id,
          // The late person is not told about their own lateness (honoured once
          // lib/notify-recipients.ts supports it; harmless before).
          excludeUserId: userId,
        };
        await notifyManagerOrOrgAdmins(notification);
      } catch (error) {
        console.error('late check-in notification failed', error);
      }
    });

    return apiOk(
      {
        log,
        isNewCheckIn: Boolean(inserted),
        branch: { id: nearest.branch.id, name: nearest.branch.name },
        serverNow: new Date().toISOString(),
        dayKind,
      },
      inserted ? 201 : 200,
    );
  } catch (error) {
    return handlePunchError(error);
  }
}

function branchRef(branches: readonly { id: number; name: string }[], id: number | null): { id: number; name: string } | null {
  if (id === null) return null;
  const found = branches.find((b) => b.id === id);
  return found ? { id: found.id, name: found.name } : null;
}
