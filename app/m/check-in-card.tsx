'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, MapPinOff, ShieldAlert, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/shared/StatusBadge';
import GeoPermissionGate, { type GeoCoords } from '@/components/shared/GeoPermissionGate';
import SelfieCamera from '@/components/shared/SelfieCamera';
import { useToast } from '@/components/ui/Toast';
import type { AttendanceLogRow } from '@/lib/queries/attendance';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import { formatClock, formatDuration } from './format';

export type PendingAction = 'check-in' | 'check-out' | 'done';

export interface CheckInCardProps {
  log: AttendanceLogRow | null;
  pendingAction: PendingAction;
  orgTimezone: string;
}

type Step =
  | { kind: 'camera' }
  // TRD.md §14: "Upload and the check-in call happen in sequence with clear progress."
  | { kind: 'submitting'; phase: 'upload' | 'punch' }
  | { kind: 'result'; status: AttendanceStatus; lateMinutes: number }
  | { kind: 'business-error'; message: string };

interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: ApiErrorBody;
}

/** Every /api/* write goes through this: parses the { data } / { error } envelope
 * (lib/api-response.ts) and never throws — a network failure becomes a null result
 * instead of an uncaught rejection, so callers always get a clean success/failure shape. */
async function postJson<T>(url: string, init: RequestInit): Promise<{ status: number; json: ApiEnvelope<T> } | null> {
  try {
    const res = await fetch(url, init);
    const json = (await res.json()) as ApiEnvelope<T>;
    return { status: res.status, json };
  } catch {
    return null;
  }
}

/**
 * Cosmetic client-side clock only, in the org's timezone, ticking every second. The
 * actually recorded check-in/out time comes from the server's now() in every case
 * (AGENTS.md domain rule #4) — this is purely a friendly display, never read back.
 * Starts at null so the first server-rendered and first client-rendered paint match
 * exactly; the real time appears once the effect ticks after hydration. Lives in the card
 * (not in the clock block) so the number keeps ticking when the block is re-created for a
 * different step instead of flashing "--.--.--" again.
 */
function useClock(timeZone: string): string | null {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString('id-ID', {
          timeZone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeZone]);

  return now;
}

/** The big clock and, for a check-out, when the person checked in. Centered in a narrow
 * container, left-aligned (and larger) beside the viewfinder in a wide one (see SelfieCamera
 * `intro`). */
function ClockBlock({ time, checkedInAt }: { time: string | null; checkedInAt: string | null }) {
  return (
    <div className="flex flex-col items-center gap-2 @xl:items-start">
      <p className="text-4xl font-bold leading-none tabular-nums text-text @xl:text-5xl">
        {time ?? '--.--.--'}
      </p>
      {checkedInAt ? (
        <p className="text-sm text-muted">
          Masuk pukul <span className="font-semibold tabular-nums text-text">{checkedInAt}</span>
        </p>
      ) : null}
    </div>
  );
}

// Neutral surface for every notice; semantic color lives on the icon only (a tinted panel is
// off-brand here). Destructive is a theme token (it already switches with .dark); there is no
// warning token, so the amber pair follows the warning accents used elsewhere, light + dark.
const NOTICE_ICON_CLASSES = {
  danger: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-400',
} as const;

/** One look for every "something needs your attention" state of the check-in flow
 * (location denied / not found, weak GPS, a refused check-in): icon + bold title + plain
 * explanation, left-aligned so a multi-line explanation reads like a paragraph, and an
 * optional action underneath. */
function Notice({
  tone,
  icon: Icon,
  title,
  children,
  action,
  role = 'alert',
}: {
  tone: keyof typeof NOTICE_ICON_CLASSES;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'alert' | 'status';
}) {
  return (
    <div role={role} className="flex w-full gap-3 rounded-input border border-border bg-accent p-3 text-left">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${NOTICE_ICON_CLASSES[tone]}`} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-semibold text-text">{title}</p>
        {children ? <p className="text-sm text-text/80">{children}</p> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

/** Everything is done for today: a plain summary, no camera. */
function DoneSummary({ log, orgTimezone }: { log: AttendanceLogRow | null; orgTimezone: string }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Masuk', value: formatClock(log?.checkInAt, orgTimezone) },
    { label: 'Keluar', value: formatClock(log?.checkOutAt, orgTimezone) },
  ];
  if (log?.workMinutes != null) rows.push({ label: 'Durasi kerja', value: formatDuration(log.workMinutes) });
  if (log && log.lateMinutes > 0) rows.push({ label: 'Terlambat', value: formatDuration(log.lateMinutes) });
  if (log && log.earlyLeaveMinutes > 0) rows.push({ label: 'Pulang lebih awal', value: formatDuration(log.earlyLeaveMinutes) });

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-text">Absensi hari ini sudah lengkap</h3>
      </div>
      <dl className="divide-y divide-border text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-muted">{row.label}</dt>
            <dd className="font-semibold tabular-nums text-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Check-in/check-out client island for app/m/page.tsx (PRD.md E2/E3/E4, TRD.md §7).
 * The page works out `pendingAction` and passes it down with today's log; this
 * component owns the geolocation → selfie → upload → punch flow for check-in/out and
 * renders a plain summary (no camera UI) when pendingAction is "done". The page
 * mounts this with `key={pendingAction}`, so a successful punch + router.refresh()
 * naturally remounts it fresh for whatever comes next (check-out, or the summary).
 *
 * Layout: the nearest ancestor `@container` decides. Narrow (the /m phone column): one
 * centered column. Wide (>= 36rem, /check-in in the marketing shell): the viewfinder on the
 * left, the clock + hint + capture button beside it (see SelfieCamera `intro`).
 */
export default function CheckInCard({ log, pendingAction, orgTimezone }: CheckInCardProps) {
  if (pendingAction === 'done') return <DoneSummary log={log} orgTimezone={orgTimezone} />;
  return <CheckInFlow log={log} pendingAction={pendingAction} orgTimezone={orgTimezone} />;
}

function CheckInFlow({
  log,
  pendingAction,
  orgTimezone,
}: {
  log: AttendanceLogRow | null;
  pendingAction: Exclude<PendingAction, 'done'>;
  orgTimezone: string;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [step, setStep] = useState<Step>({ kind: 'camera' });
  const clock = useClock(orgTimezone);

  const actionNoun = pendingAction === 'check-in' ? 'Absen masuk' : 'Absen keluar';
  const checkedInAt = pendingAction === 'check-out' ? formatClock(log?.checkInAt, orgTimezone) : null;
  const clockBlock = <ClockBlock time={clock} checkedInAt={checkedInAt} />;

  function handleFailure(status: number | undefined, message: string) {
    if (status === 422) {
      setStep({ kind: 'business-error', message });
      return;
    }
    show(message, 'error');
    setStep({ kind: 'camera' });
    // 409 means our local guess of "what's next" is stale (e.g. another device
    // already closed today's log) — refresh so the server state wins.
    if (status === 409) router.refresh();
  }

  async function handleCapture(blob: Blob, coords: GeoCoords) {
    setStep({ kind: 'submitting', phase: 'upload' });

    const form = new FormData();
    form.append('file', blob, 'selfie.jpg');
    form.append('kind', pendingAction === 'check-in' ? 'attendance-check-in' : 'attendance-check-out');

    const uploadResult = await postJson<{ url: string }>('/api/uploads', { method: 'POST', body: form });
    const photoUrl = uploadResult?.json.data?.url;
    if (!photoUrl) {
      handleFailure(
        uploadResult?.status,
        uploadResult?.json.error?.message ?? 'Gagal mengunggah foto. Periksa koneksi internet Anda dan coba lagi.',
      );
      return;
    }

    setStep({ kind: 'submitting', phase: 'punch' });
    const endpoint = pendingAction === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
    const punchResult = await postJson<{ log: AttendanceLogRow }>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyM: Math.max(1, Math.round(coords.accuracyM)),
        photoUrl,
      }),
    });
    const resultLog = punchResult?.json.data?.log;
    if (!resultLog) {
      handleFailure(
        punchResult?.status,
        punchResult?.json.error?.message ?? 'Gagal mencatat absensi. Periksa koneksi internet Anda dan coba lagi.',
      );
      return;
    }

    setStep({ kind: 'result', status: resultLog.status, lateMinutes: resultLog.lateMinutes });
    show(`${actionNoun} berhasil dicatat.`, 'success');
    router.refresh();
  }

  return (
    <GeoPermissionGate>
      {(coords, geoStatus, retryGeo) => {
        // Every step except "ready for the selfie" is the clock plus one status block
        // (stacked when narrow, side by side when wide). The ready step hands the clock to
        // SelfieCamera as its intro, so the viewfinder can sit beside it.
        const withClock = (content: ReactNode) => (
          <div className="flex w-full flex-col items-center gap-4 @xl:flex-row @xl:justify-center @xl:gap-10">
            {clockBlock}
            <div className="flex w-full flex-col items-center gap-3 @xl:max-w-sm">{content}</div>
          </div>
        );

        if (geoStatus === 'loading') {
          return withClock(
            <div role="status" className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Mendapatkan lokasi Anda...
            </div>,
          );
        }

        if (geoStatus === 'denied') {
          return withClock(
            <Notice
              tone="danger"
              icon={ShieldAlert}
              title="Izin lokasi ditolak"
              action={
                <Button variant="outline" onClick={retryGeo}>
                  Coba Lagi
                </Button>
              }
            >
              Lokasi dibutuhkan untuk mencatat absensi. Izinkan akses lokasi untuk situs ini di pengaturan browser
              atau perangkat Anda, lalu ketuk Coba Lagi.
            </Notice>,
          );
        }

        if (geoStatus === 'error') {
          return withClock(
            <Notice
              tone="danger"
              icon={MapPinOff}
              title="Lokasi belum terdeteksi"
              action={
                <Button variant="outline" onClick={retryGeo}>
                  Coba Lagi
                </Button>
              }
            >
              Pastikan GPS atau layanan lokasi di perangkat Anda aktif, lalu coba lagi.
            </Notice>,
          );
        }

        // geoStatus is 'ok' or 'weak-signal' below — both are allowed to proceed.
        if (step.kind === 'business-error') {
          return withClock(
            <Notice
              tone="danger"
              icon={XCircle}
              title={`${actionNoun} belum tercatat`}
              action={
                <Button variant="outline" onClick={() => setStep({ kind: 'camera' })}>
                  Coba Lagi
                </Button>
              }
            >
              {step.message}
            </Notice>,
          );
        }

        if (step.kind === 'result') {
          // Shown for the moment between the punch and router.refresh() remounting this
          // card for the next action. A check-out keeps the morning's status (LATE stays
          // LATE), so only a check-in reports on time vs late here.
          return withClock(
            <div role="status" className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p className="text-base font-semibold text-text">{actionNoun} berhasil dicatat</p>
              {pendingAction === 'check-in' ? (
                <>
                  <StatusBadge status={step.status} />
                  {step.status === 'LATE' ? (
                    <p className="text-sm text-muted">Anda terlambat {formatDuration(step.lateMinutes)}.</p>
                  ) : null}
                </>
              ) : null}
            </div>,
          );
        }

        if (!coords) return null; // GeoPermissionGate always sets coords alongside 'ok'/'weak-signal'.

        // Sending the photo keeps the camera on screen (frozen on the captured frame, with the
        // progress text over it) instead of swapping it for a short status line: the card does not
        // collapse and jump, and if the send fails the live preview just resumes.
        const busyLabel =
          step.kind === 'submitting'
            ? step.phase === 'upload'
              ? 'Mengunggah foto...'
              : `Mencatat ${actionNoun.toLowerCase()}...`
            : undefined;

        const accuracy = Math.round(coords.accuracyM);
        const weak = geoStatus === 'weak-signal';
        return (
          <SelfieCamera
            compact={weak}
            busyLabel={busyLabel}
            intro={
              <>
                {clockBlock}
                {weak ? (
                  // Short on purpose: this state still allows a check-in, and the viewfinder
                  // below shrinks (compact) so "Ambil Foto" stays above the fold on 360×740.
                  <Notice tone="warning" icon={AlertTriangle} title={`Sinyal GPS lemah (±${accuracy}\u00A0m)`} role="status">
                    Anda tetap bisa absen. Cari tempat terbuka agar lebih akurat.
                  </Notice>
                ) : null}
                <div className="flex flex-col items-center gap-1 text-center @xl:items-start @xl:text-left">
                  <p className="text-sm text-text">Ambil selfie untuk {actionNoun.toLowerCase()}.</p>
                  {/* Like Talenta's camera step, the employee sees that their location was
                      found before the photo is sent, not only when something is wrong. */}
                  {weak ? null : (
                    <p role="status" className="flex items-center gap-1 text-xs text-muted">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Lokasi terdeteksi · akurasi ±{accuracy}&nbsp;m
                    </p>
                  )}
                </div>
              </>
            }
            onCapture={(blob) => handleCapture(blob, coords)}
            onError={(message) => show(message, 'error')}
          />
        );
      }}
    </GeoPermissionGate>
  );
}
