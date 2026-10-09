'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarClock, FileEdit, Loader2, LogIn, LogOut, MapPinOff, RefreshCw, TriangleAlert, WifiOff, XCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import DayTimeline from '@/components/shared/DayTimeline';
import WeekStrip from '@/components/shared/WeekStrip';
import GeoPermissionGate, { type GeoCoords, type GeoHelpers, type GeoStatus } from '@/components/shared/GeoPermissionGate';
import SelfieCamera from '@/components/shared/SelfieCamera';
import LocationCard from '@/components/shared/checkin/LocationCard';
import ShiftProgress from '@/components/shared/checkin/ShiftProgress';
import StepIndicator from '@/components/shared/checkin/StepIndicator';
import SuccessCheck from '@/components/shared/checkin/SuccessCheck';
import { describeBusy } from '@/components/shared/checkin/busy-label';
import { describeCtaState } from '@/components/shared/checkin/cta-state';
import { deriveSteps } from '@/components/shared/checkin/steps';
import { postFormWithProgress } from '@/components/shared/checkin/upload';
import { useObjectUrl } from '@/components/shared/checkin/useObjectUrl';
import { useOnline } from '@/components/shared/checkin/useOnline';
import '@/components/shared/checkin/checkin.css';
import { describePunchError, type ApiErrorLike, type PunchErrorCopy, type PunchKind } from '@/lib/check-in-copy';
import { formatDistance } from '@/lib/geo';
import { minutesUntil, type TodayLogView, type WeekDayView } from '@/lib/today-view-model';
import type { AttendanceStatus } from '@/lib/constants/statuses';
import type { DayKind } from '@/lib/punch';
import { formatClock, formatDuration } from './format';
import Notice from './notice';
import { usePrecheck } from './use-precheck';

export type PendingAction = 'check-in' | 'check-out' | 'done' | 'expired';

export interface CheckInCardProps {
  /** The log the pending action applies to (the open log for a check-out, which can be yesterday's). */
  log: TodayLogView | null;
  pendingAction: PendingAction;
  orgTimezone: string;
  selfieRequired: boolean;
  dayKind: DayKind;
  /** "07.00–15.00" */
  scheduleLabel: string;
  week: WeekDayView[];
  /** "YYYY-MM-DD" of today on the org's wall clock. */
  today: string;
  /** Where "Ajukan Koreksi" goes when the check-out window has closed. */
  correctionHref: string;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: ApiErrorLike;
}

/** The punch call: parses the { data } / { error } envelope (lib/api-response.ts) and never throws, so a
 * network failure becomes a null result instead of an uncaught rejection. */
async function postJson<T>(url: string, init: RequestInit): Promise<{ status: number; json: ApiEnvelope<T> } | null> {
  try {
    const res = await fetch(url, init);
    const json = (await res.json()) as ApiEnvelope<T>;
    return { status: res.status, json };
  } catch {
    return null;
  }
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: the animation is the feedback.
  }
}

/**
 * Cosmetic client-side clock only, in the org's timezone, ticking every second. The
 * actually recorded check-in/out time comes from the server's now() in every case
 * (AGENTS.md domain rule #4) — this is purely a friendly display, never read back.
 * Starts at null so the first server-rendered and first client-rendered paint match
 * exactly; the real time appears once the effect ticks after hydration.
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

/** The big clock and, for a check-out, when the person checked in. Centered in a narrow container,
 * left-aligned (and larger) beside the viewfinder in a wide one. It owns its own ticking state, so only
 * these few characters re-render every second, not the camera next to it. `hideOnShort` drops it on a
 * short desktop window, where the height belongs to the viewfinder. */
function ClockBlock({ timeZone, checkedInAt, hideOnShort = false }: { timeZone: string; checkedInAt: string | null; hideOnShort?: boolean }) {
  const time = useClock(timeZone);
  return (
    <div className={`flex flex-col items-center gap-1.5 @xl:items-start ${hideOnShort ? '[@media(min-width:1024px)_and_(max-height:700px)]:hidden' : ''}`}>
      <p className="text-4xl font-bold leading-none tabular-nums text-text @xl:text-5xl">{time ?? '--.--.--'}</p>
      {checkedInAt ? (
        <p className="text-sm text-muted">
          Masuk pukul <span className="font-semibold tabular-nums text-text">{checkedInAt}</span>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// What the person sees after a successful punch. It lives in the top-level card (not in the flow)
// because router.refresh() right after the punch changes `pendingAction`, which swaps the flow
// for the summary; the result must stay on screen until the person taps "Selesai".

interface PunchResult {
  kind: PunchKind;
  at: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  branchName: string | null;
  distanceM: number | null;
  isOutside: boolean;
  /** False when the server answered with the row that was already there (a repeated tap). */
  isNew: boolean;
  /** The photo that was just sent (the one the admin will see); the result shows it through an object URL it frees on leave. */
  photo: Blob | null;
}

function ResultView({
  result,
  timeZone,
  scheduleLabel,
  onDone,
}: {
  result: PunchResult;
  timeZone: string;
  scheduleLabel: string;
  onDone: () => void;
}) {
  const isIn = result.kind === 'check-in';
  const late = isIn && result.status === 'LATE';
  // The camera that was just used is gone, so move keyboard and screen-reader focus to the outcome.
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
    buzz([20, 40, 20]);
  }, []);
  // The object URL of the sent photo belongs to this screen and is freed when the person leaves.
  const photoUrl = useObjectUrl(result.photo);

  const rows: { label: string; value: React.ReactNode }[] = [];
  if (isIn) {
    rows.push({ label: 'Jadwal masuk', value: <span className="font-semibold tabular-nums">{scheduleLabel.split('–')[0]}</span> });
  } else {
    if (result.workMinutes != null) rows.push({ label: 'Durasi kerja', value: <span className="font-semibold">{formatDuration(result.workMinutes)}</span> });
    if (result.earlyLeaveMinutes > 0) {
      rows.push({ label: 'Pulang lebih awal', value: <span className="font-semibold">{formatDuration(result.earlyLeaveMinutes)}</span> });
    }
  }
  if (result.branchName) {
    rows.push({
      label: 'Cabang',
      value: (
        <span className="font-semibold">
          {result.branchName}
          {result.distanceM !== null ? <span className="font-normal text-muted"> · {formatDistance(result.distanceM)}</span> : null}
        </span>
      ),
    });
  }
  if (result.isOutside) {
    rows.push({
      label: 'Lokasi',
      value: (
        <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
          <MapPinOff className="h-3.5 w-3.5" aria-hidden="true" />
          Di luar area
        </span>
      ),
    });
  }
  if (photoUrl) {
    rows.push({
      label: 'Foto selfie',
      value: (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL of the photo just sent; next/image cannot optimise it
        <img src={photoUrl} alt="Foto selfie yang baru dikirim" className="ml-auto h-9 w-7 rounded-md border border-border object-cover" />
      ),
    });
  }

  return (
    <div role="status" className="ci-enter mx-auto grid w-full max-w-sm gap-4 @xl:max-w-none @xl:grid-cols-2 @xl:items-center @xl:gap-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <SuccessCheck />
        <div>
          <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-text outline-none">
            {isIn ? 'Absen masuk' : 'Absen keluar'} berhasil dicatat
          </h3>
          {result.isNew ? null : <p className="mt-1 text-sm text-muted">Absen ini sudah tercatat sebelumnya.</p>}
        </div>
        <p className="ci-pop text-5xl font-bold leading-none tabular-nums text-text">{formatClock(result.at, timeZone)}</p>
        {isIn ? (
          <p className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <StatusBadge status={result.status} />
            <span className={late ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted'}>
              {late ? `${formatDuration(result.lateMinutes)} dari jadwal masuk` : 'Tepat waktu'}
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        {rows.length ? (
          <dl className="ci-stagger w-full divide-y divide-border rounded-input border border-border bg-accent px-3 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 py-2 text-text">
                <dt className="text-muted">{row.label}</dt>
                <dd className="min-w-0 text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Button type="button" size="lg" onClick={onDone} className="w-full">
          Selesai
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

/**
 * Check-in/check-out client island for the "Hari ini" screen, shared by /m, /check-in and
 * /app/check-in (PRD.md E2/E3/E4, TRD.md §7). The server component works out `pendingAction` and
 * passes today's record; this owns the whole flow: GPS -> pre-check (nearest branch, distance,
 * accuracy, inside/outside) -> selfie with a guide, a timer and a preview with "Ulangi" -> upload
 * with progress -> punch -> a result that stays until dismissed -> the day timeline and the last
 * seven days. A step indicator (Lokasi, Selfie, Kirim) says where the person is, and a disabled
 * button always says why.
 *
 * Layout: the nearest ancestor `@container` decides. Narrow (the /m phone column): one centered
 * column. Wide (>= 36rem): the action on the left, the record on the right (idle), or the
 * viewfinder on the left with the clock, location card and button beside it (camera). On a phone
 * (< lg) the camera is a full-screen sheet (components/shared/checkin/CameraSheet).
 */
export default function CheckInCard(props: CheckInCardProps) {
  const router = useRouter();
  const [result, setResult] = useState<PunchResult | null>(null);

  if (result) {
    return (
      <ResultView
        result={result}
        timeZone={props.orgTimezone}
        scheduleLabel={props.scheduleLabel}
        // Dismissing re-renders the page from the server once more, so the timeline and the next
        // action are current even if the refresh right after the punch was dropped (a flaky network).
        onDone={() => {
          setResult(null);
          router.refresh();
        }}
      />
    );
  }
  if (props.pendingAction === 'done' || props.pendingAction === 'expired') return <StaticDay {...props} />;
  return <CheckInFlow {...props} pendingAction={props.pendingAction} onResult={setResult} />;
}

/** Everything is done for today (or the check-out window has closed): the record, no camera, no GPS. */
function StaticDay({ log, pendingAction, orgTimezone, scheduleLabel, week, today, correctionHref }: CheckInCardProps) {
  const expired = pendingAction === 'expired';
  return (
    <div className="ci-enter grid gap-5 @xl:grid-cols-2 @xl:gap-8">
      <div className="flex flex-col gap-3">
        {expired ? (
          <Notice
            tone="warning"
            icon={CalendarClock}
            title="Batas absen keluar sudah lewat"
            role="status"
            action={
              <ButtonLink href={correctionHref} variant="outline" size="sm">
                <FileEdit className="h-4 w-4" aria-hidden="true" />
                Ajukan Koreksi
              </ButtonLink>
            }
          >
            Absen keluar hanya bisa dilakukan sampai 6 jam setelah jam pulang. Ajukan koreksi agar jam keluar Anda tercatat.
          </Notice>
        ) : (
          <div className="flex items-center gap-2">
            <SuccessCheck size="sm" />
            <h3 className="text-sm font-semibold text-text">Absensi hari ini sudah lengkap</h3>
          </div>
        )}
        <DayTimeline log={log} timezone={orgTimezone} scheduleLabel={scheduleLabel} />
      </div>
      <section aria-label="Tujuh hari terakhir" className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">7 hari terakhir</h3>
        <WeekStrip days={week} today={today} legend={false} compact />
      </section>
    </div>
  );
}

function CheckInFlow(props: CheckInCardProps & { pendingAction: 'check-in' | 'check-out'; onResult: (result: PunchResult) => void }) {
  return (
    <GeoPermissionGate>
      {(coords, geoStatus, retryGeo, geo) => (
        <FlowBody {...props} coords={coords} geoStatus={geoStatus} retryGeo={retryGeo} geo={geo} />
      )}
    </GeoPermissionGate>
  );
}

type Phase = 'idle' | 'camera';

function FlowBody({
  log,
  pendingAction,
  orgTimezone,
  selfieRequired,
  dayKind,
  scheduleLabel,
  week,
  today,
  onResult,
  coords,
  geoStatus,
  retryGeo,
  geo,
}: CheckInCardProps & {
  pendingAction: 'check-in' | 'check-out';
  onResult: (result: PunchResult) => void;
  coords: GeoCoords | null;
  geoStatus: GeoStatus;
  retryGeo: () => void;
  geo: GeoHelpers;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState<'upload' | 'punch' | null>(null);
  // Bytes of the selfie sent so far (0..1) while busy === 'upload'.
  const [progress, setProgress] = useState<number | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [punchError, setPunchError] = useState<PunchErrorCopy | null>(null);
  // Minutes early the person is about to leave, while the confirmation is open (null = closed).
  const [confirmEarly, setConfirmEarly] = useState<number | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refreshedFor = useRef<string | null>(null);
  // A second tap lands before React re-renders `busy`, so the button's own `disabled` cannot stop it: the second
  // request hit the idempotent branch and the person saw "sudah tercatat sebelumnya" after their first action.
  const punchInFlight = useRef(false);
  // The selfie that already reached the server: when the punch call fails afterwards (a dropped
  // connection, the server answering 5xx) a retry sends only the punch, never the same photo twice.
  const uploaded = useRef<{ blob: Blob; url: string } | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => uploadAbort.current?.abort();
  }, []);

  const kind: PunchKind = pendingAction;
  const actionNoun = kind === 'check-in' ? 'Absen masuk' : 'Absen keluar';
  const hasFix = coords !== null && (geoStatus === 'ok' || geoStatus === 'weak-signal' || geoStatus === 'loading');
  const precheck = usePrecheck({ coords, enabled: hasFix, nonce: refreshNonce });
  const blocked = Boolean(precheck.data && !precheck.data.canSubmit);

  // Another device (or a cron) changed today's record while this page was open: the server answers
  // the pre-check with an action that no longer matches the card, so re-render the page from the
  // server once instead of letting the person punch the wrong thing.
  const serverAction = precheck.data?.action;
  useEffect(() => {
    if (phase !== 'idle' || !serverAction) return;
    const known = serverAction === 'check-in' || serverAction === 'check-out' || serverAction === 'done' || serverAction === 'recorded' || serverAction === 'expired';
    if (!known || serverAction === pendingAction) return;
    const tag = `${pendingAction}>${serverAction}`;
    if (refreshedFor.current === tag) return;
    refreshedFor.current = tag;
    router.refresh();
  }, [serverAction, pendingAction, phase, router]);

  function refreshLocation() {
    setRefreshNonce((n) => n + 1);
    retryGeo();
  }

  function handleError(error: PunchErrorCopy, status: number | undefined, code: string | undefined) {
    setBusy(null);
    setProgress(null);
    if (error.next === 'login') {
      router.push(`/login?next=${encodeURIComponent(pathname || '/check-in')}`);
      return;
    }
    if (error.next === 'change-password') {
      router.push('/change-password');
      return;
    }
    setPunchError(error);
    // The page we show is out of step with the server (another device already closed the day).
    if (status === 409 || code === 'ALREADY_RECORDED' || code === 'NOT_CHECKED_IN') router.refresh();
    if (error.next === 'update-location') setRefreshNonce((n) => n + 1);
  }

  async function submit(blob: Blob | null) {
    if (punchInFlight.current) return;
    punchInFlight.current = true;
    try {
      await submitOnce(blob);
    } finally {
      punchInFlight.current = false;
    }
  }

  async function submitOnce(blob: Blob | null) {
    setPunchError(null);
    let photoUrl: string | undefined;

    if (blob) {
      photoUrl = uploaded.current?.blob === blob ? uploaded.current.url : undefined;
      if (!photoUrl) {
        setBusy('upload');
        setProgress(0);
        const form = new FormData();
        form.append('file', blob, 'selfie.jpg');
        form.append('kind', kind === 'check-in' ? 'attendance-check-in' : 'attendance-check-out');
        const controller = new AbortController();
        uploadAbort.current = controller;
        const upload = await postFormWithProgress<{ url: string }>('/api/uploads', form, {
          onProgress: setProgress,
          signal: controller.signal,
        });
        uploadAbort.current = null;
        photoUrl = upload?.json.data?.url;
        if (!photoUrl) {
          handleError(describePunchError(kind, upload?.status, upload?.json.error, 'upload'), upload?.status, upload?.json.error?.code);
          return;
        }
        uploaded.current = { blob, url: photoUrl };
      }
    }

    setProgress(null);
    setBusy('punch');
    // The coordinates sent are read NOW, not the fix from when the page opened.
    let position: GeoCoords;
    try {
      position = await geo.getFreshPosition();
    } catch (error) {
      const denied = typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 1;
      if (!denied && coords) {
        // The device is slow to answer: the last good fix is better than refusing the punch.
        position = coords;
      } else {
        setBusy(null);
        setPunchError({
          title: denied ? 'Izin lokasi ditolak' : 'Lokasi belum terdeteksi',
          message: denied
            ? 'Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu ketuk Perbarui Lokasi.'
            : 'GPS belum memberi lokasi. Pastikan layanan lokasi aktif, lalu ketuk Perbarui Lokasi.',
          next: 'update-location',
          tone: 'danger',
        });
        return;
      }
    }

    const endpoint = kind === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
    const punch = await postJson<{ log: PunchLogWire; branch?: { id: number; name: string } | null; isNewCheckIn?: boolean }>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyM: Math.max(1, Math.round(position.accuracyM)),
        ...(photoUrl ? { photoUrl } : {}),
      }),
    });
    const saved = punch?.json.data?.log;
    if (!saved) {
      handleError(describePunchError(kind, punch?.status, punch?.json.error, 'punch'), punch?.status, punch?.json.error?.code);
      return;
    }

    setBusy(null);
    setPhase('idle');
    uploaded.current = null;
    onResult({
      kind,
      at: kind === 'check-in' ? saved.checkInAt : saved.checkOutAt,
      status: saved.status,
      lateMinutes: saved.lateMinutes,
      earlyLeaveMinutes: saved.earlyLeaveMinutes,
      workMinutes: saved.workMinutes,
      branchName: punch?.json.data?.branch?.name ?? null,
      distanceM: kind === 'check-in' ? (saved.checkInDistanceM ?? null) : (saved.checkOutDistanceM ?? null),
      isOutside: kind === 'check-in' ? saved.checkInIsOutside : saved.checkOutIsOutside,
      isNew: kind === 'check-out' ? true : punch?.json.data?.isNewCheckIn !== false,
      photo: blob,
    });
    // Re-render the server component so the dashboard-facing data (timeline, week, next action) is current.
    router.refresh();
  }

  function startPunch() {
    setPunchError(null);
    if (selfieRequired) setPhase('camera');
    else void submit(null);
  }

  function handleCta() {
    // Display-only estimate from the browser clock; the recorded early-leave minutes come from the server.
    const early = kind === 'check-out' && dayKind === 'WORK' ? minutesUntil(log?.scheduledOutAt ?? null, Date.now()) : 0;
    if (early > 0) {
      setConfirmEarly(early);
      return;
    }
    startPunch();
  }

  function leaveCamera() {
    uploadAbort.current?.abort();
    setPunchError(null);
    setHasPhoto(false);
    setPhase('idle');
  }

  const checkedInAt = kind === 'check-out' ? formatClock(log?.checkInAt, orgTimezone) : null;

  const awaitingPrecheck = hasFix && !precheck.data && !precheck.failed;
  const cta = describeCtaState({
    hasFix,
    geoStatus,
    awaitingPrecheck,
    block: precheck.data && !precheck.data.canSubmit ? (precheck.data.block ?? 'BLOCKED') : null,
    branchName: precheck.data?.branch?.name ?? null,
    online,
    busy: busy !== null,
  });

  const steps = deriveSteps({
    geo: geoStatus === 'weak-signal' ? 'weak' : geoStatus,
    blocked,
    inCamera: phase === 'camera',
    hasPhoto,
    sending: busy !== null,
    done: false,
    selfieRequired,
  });
  const stepIndicator = <StepIndicator steps={steps} />;

  const locationCard = (compact: boolean) => (
    <LocationCard
      compact={compact}
      geoStatus={geoStatus}
      coords={coords}
      errorKind={geo.errorKind}
      state={precheck}
      updatedAt={geo.updatedAt}
      timeZone={orgTimezone}
      permission={geo.permission}
      onRefresh={refreshLocation}
    />
  );

  const errorNotice = punchError ? (
    <Notice
      tone={punchError.tone}
      icon={punchError.tone === 'danger' ? XCircle : TriangleAlert}
      title={punchError.title}
      className="ci-fade"
      action={
        <>
          {punchError.next === 'update-location' ? (
            <Button type="button" variant="outline" size="sm" onClick={refreshLocation}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Perbarui Lokasi
            </Button>
          ) : null}
          {punchError.next === 'reload' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPunchError(null);
                setPhase('idle');
                router.refresh();
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Muat Ulang
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setPunchError(null)}>
            Tutup
          </Button>
        </>
      }
    >
      {punchError.message}
    </Notice>
  ) : null;

  const offlineLine = !online ? (
    <p role="status" className="ci-fade flex w-full items-center gap-2 rounded-input border border-border bg-accent px-3 py-2 text-left text-xs text-text">
      <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      Tidak ada koneksi internet. Foto tetap aman di layar ini; ketuk Kirim Absen setelah Anda online.
    </p>
  ) : null;

  const earlyDialog = (
    <ConfirmDialog
      open={confirmEarly !== null}
      variant="primary"
      title="Absen keluar lebih awal?"
      description={`Jadwal pulang Anda pukul ${formatClock(log?.scheduledOutAt, orgTimezone)}. Anda akan tercatat pulang ${formatDuration(confirmEarly ?? 0)} lebih awal dari jadwal. Tetap absen keluar?`}
      confirmLabel="Ya, Absen Keluar"
      cancelLabel="Belum"
      onCancel={() => setConfirmEarly(null)}
      onConfirm={() => {
        setConfirmEarly(null);
        startPunch();
      }}
    />
  );

  if (phase === 'camera') {
    const busyLabel = describeBusy(busy, progress, actionNoun);
    // The camera can be used offline; sending cannot. The shutter stays on, "Kirim" waits for the network.
    const confirmDisabled = blocked || !hasFix || !online;
    return (
      <>
        <SelfieCamera
          review
          compact={geoStatus === 'weak-signal' || Boolean(punchError)}
          busyLabel={busyLabel}
          progress={busy === 'upload' ? progress : null}
          confirmLabel="Kirim Absen"
          captureDisabled={blocked || !hasFix}
          disabledReason={cta.code === 'ready' || cta.code === 'busy' || cta.code === 'offline' ? null : cta.reason}
          confirmDisabled={confirmDisabled}
          // Offline is already said, with the photo's fate, by the line in `intro`.
          confirmDisabledReason={cta.code === 'offline' ? null : cta.reason}
          onCancel={busy !== null ? undefined : leaveCamera}
          onPhotoChange={setHasPhoto}
          intro={({ sheet }) => (
            <>
              {stepIndicator}
              {sheet ? null : <ClockBlock timeZone={orgTimezone} checkedInAt={checkedInAt} hideOnShort />}
              {offlineLine}
              {errorNotice}
              {locationCard(true)}
              <p className="sr-only">Ambil selfie untuk {actionNoun.toLowerCase()}.</p>
            </>
          )}
          onCapture={(blob) => void submit(blob)}
          onError={(message) =>
            setPunchError({ title: 'Foto belum bisa diproses', message, next: 'retry', tone: 'warning' })
          }
        />
        {earlyDialog}
      </>
    );
  }

  return (
    <>
      <div className="ci-enter grid gap-5 @xl:grid-cols-2 @xl:items-start @xl:gap-8">
        <div className="flex flex-col items-center gap-3 @xl:items-stretch">
          {stepIndicator}
          <ClockBlock timeZone={orgTimezone} checkedInAt={checkedInAt} />
          {errorNotice}
          {locationCard(false)}
          <Button
            type="button"
            size="lg"
            onClick={handleCta}
            disabled={!cta.enabled}
            isLoading={busy !== null}
            className="w-full max-w-xs @xl:max-w-none"
          >
            {busy === null ? (
              kind === 'check-in' ? <LogIn className="h-5 w-5" aria-hidden="true" /> : <LogOut className="h-5 w-5" aria-hidden="true" />
            ) : null}
            {busy !== null ? `Mencatat ${actionNoun.toLowerCase()}...` : actionNoun}
          </Button>
          {cta.reason ? (
            <p role="status" className="ci-fade flex w-full max-w-xs items-start gap-1.5 text-left text-xs text-muted @xl:max-w-none">
              {cta.code === 'locating' || cta.code === 'checking-area' ? (
                <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : cta.code === 'offline' ? (
                <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : null}
              {cta.reason}
            </p>
          ) : null}
          {!selfieRequired ? (
            <p className="text-center text-xs text-muted @xl:text-left">Foto selfie tidak diwajibkan oleh organisasi Anda.</p>
          ) : null}
        </div>
        <div className="ci-stagger flex flex-col gap-4">
          <section aria-label="Catatan hari ini" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">Hari ini</h3>
            <DayTimeline log={log} timezone={orgTimezone} scheduleLabel={scheduleLabel} />
          </section>
          {kind === 'check-out' ? (
            <ShiftProgress checkInAt={log?.checkInAt ?? null} scheduledOutAt={log?.scheduledOutAt ?? null} timeZone={orgTimezone} />
          ) : null}
          <section aria-label="Tujuh hari terakhir" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text">7 hari terakhir</h3>
            <WeekStrip days={week} today={today} legend={false} compact />
          </section>
        </div>
      </div>
      {earlyDialog}
    </>
  );
}

/** The part of the punch response the result needs (a subset of AttendanceLogRow). */
interface PunchLogWire {
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workMinutes: number | null;
  checkInIsOutside: boolean;
  checkOutIsOutside: boolean;
  checkInDistanceM?: number | null;
  checkOutDistanceM?: number | null;
}
