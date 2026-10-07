'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, MapPinOff, ShieldAlert, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/shared/StatusBadge';
import GeoPermissionGate, { type GeoCoords } from '@/components/shared/GeoPermissionGate';
import SelfieCamera from '@/components/shared/SelfieCamera';
import { useToast } from '@/components/ui/Toast';
import type { AttendanceLogRow } from '@/lib/queries/attendance';
import type { AttendanceStatus } from '@/lib/constants/statuses';

export type PendingAction = 'check-in' | 'check-out' | 'done';

export interface CheckInCardProps {
  log: AttendanceLogRow | null;
  pendingAction: PendingAction;
  orgTimezone: string;
}

type Step =
  | { kind: 'camera' }
  | { kind: 'submitting' }
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

function formatClockTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
}

/**
 * Cosmetic client-side clock only, always Asia/Jakarta, ticking every second. The
 * actually recorded check-in/out time comes from the server's now() in every case
 * (AGENTS.md domain rule #4) — this is purely a friendly display, never read back.
 * Starts at null so the first server-rendered and first client-rendered paint match
 * exactly; the real time appears once the effect ticks after hydration.
 */
function LiveClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <p className="text-3xl font-bold tabular-nums text-text">{now ?? '--:--:--'}</p>;
}

/**
 * Check-in/check-out client island for app/m/page.tsx (PRD.md E2/E3/E4, TRD.md §7).
 * The page works out `pendingAction` and passes it down with today's log; this
 * component owns the geolocation → selfie → upload → punch flow for check-in/out and
 * renders a plain summary (no camera UI) when pendingAction is "done". The page
 * mounts this with `key={pendingAction}`, so a successful punch + router.refresh()
 * naturally remounts it fresh for whatever comes next (check-out, or the summary).
 */
export default function CheckInCard({ log, pendingAction, orgTimezone }: CheckInCardProps) {
  const router = useRouter();
  const { show } = useToast();
  const [step, setStep] = useState<Step>({ kind: 'camera' });

  if (pendingAction === 'done') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Absensi hari ini selesai</h3>
          {log ? <StatusBadge status={log.status} /> : null}
        </div>
        <dl className="space-y-1 text-sm text-text">
          <div className="flex justify-between">
            <dt className="text-muted">Masuk</dt>
            <dd className="font-medium">{log?.checkInAt ? formatClockTime(log.checkInAt, orgTimezone) : '-'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Keluar</dt>
            <dd className="font-medium">{log?.checkOutAt ? formatClockTime(log.checkOutAt, orgTimezone) : '-'}</dd>
          </div>
          {log?.workMinutes != null ? (
            <div className="flex justify-between">
              <dt className="text-muted">Durasi kerja</dt>
              <dd className="font-medium">
                {Math.floor(log.workMinutes / 60)} jam {log.workMinutes % 60} menit
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
  }

  const actionNoun = pendingAction === 'check-in' ? 'Absen masuk' : 'Absen keluar';

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
    setStep({ kind: 'submitting' });

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
    <div className="flex flex-col items-center gap-4">
      <LiveClock />

      <GeoPermissionGate>
        {(coords, geoStatus) => {
          if (geoStatus === 'loading') {
            return (
              <div role="status" className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Mendapatkan lokasi Anda...
              </div>
            );
          }

          if (geoStatus === 'denied') {
            return (
              <div role="alert" className="flex flex-col items-center gap-2 text-center text-sm text-red-700 dark:text-red-300">
                <ShieldAlert className="h-8 w-8" aria-hidden="true" />
                <p>
                  Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser atau perangkat Anda,
                  lalu muat ulang halaman.
                </p>
              </div>
            );
          }

          if (geoStatus === 'error') {
            return (
              <div role="alert" className="flex flex-col items-center gap-2 text-center text-sm text-red-700 dark:text-red-300">
                <MapPinOff className="h-8 w-8" aria-hidden="true" />
                <p>Tidak dapat mendeteksi lokasi Anda. Pastikan GPS aktif, lalu coba lagi.</p>
              </div>
            );
          }

          // geoStatus is 'ok' or 'weak-signal' below — both are allowed to proceed.
          if (step.kind === 'business-error') {
            return (
              <div role="alert" className="w-full space-y-3 rounded-input border border-red-200 bg-red-50 p-3 text-center dark:border-red-900 dark:bg-red-950/40">
                <div className="flex items-center justify-center gap-2 text-sm text-red-800 dark:text-red-300">
                  <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {step.message}
                </div>
                <Button variant="primary" onClick={() => setStep({ kind: 'camera' })}>
                  Coba Lagi
                </Button>
              </div>
            );
          }

          if (step.kind === 'result') {
            const isLate = step.status === 'LATE';
            return (
              <p role="status" className={`text-base font-semibold ${isLate ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {isLate ? `Terlambat ${step.lateMinutes} menit` : 'Tepat waktu'}
              </p>
            );
          }

          if (step.kind === 'submitting') {
            return (
              <div role="status" className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Mengirim {actionNoun.toLowerCase()}...
              </div>
            );
          }

          if (!coords) return null; // GeoPermissionGate always sets coords alongside 'ok'/'weak-signal'.

          return (
            <div className="flex w-full flex-col items-center gap-3">
              {geoStatus === 'weak-signal' ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-input border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Sinyal GPS terlalu lemah. Pindah ke tempat yang lebih terbuka agar lokasi lebih akurat.
                </div>
              ) : null}
              <p className="text-sm text-muted">Ambil selfie untuk mencatat {actionNoun.toLowerCase()}.</p>
              <SelfieCamera onCapture={(blob) => handleCapture(blob, coords)} onError={(message) => show(message, 'error')} />
            </div>
          );
        }}
      </GeoPermissionGate>
    </div>
  );
}
