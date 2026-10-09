'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CircleAlert, Loader2, MapPin, RefreshCw, Rocket, Users } from 'lucide-react';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import Notice from '@/app/m/notice';
import { describeGeoError } from '@/lib/check-in-copy';

// First-run setup of check-in for an OWNER/ADMIN: a new organisation has no branch, no shift, and
// the owner is not scheduled, so nothing can be punched. This is the "Siapkan check-in" checklist
// (PRD US-07: branch, shift, invite) that creates them with the EXISTING APIs, in the owner's
// browser and under the owner's own session:
//   1. POST /api/branches   from this browser's location + a radius
//   2. POST /api/shifts     a sensible weekday shift (or pick an existing one)
//   3. PATCH /api/users/me  assign that shift and branch to the owner
// Every step first reuses what already exists, so a retry after a partial failure never
// duplicates anything. Staff (EMPLOYEE/MANAGER) get a plain "ask your admin" message instead.

export interface SetupBranch {
  id: number;
  name: string;
  radiusM: number;
}
export interface SetupShift {
  id: number;
  name: string;
  timeIn: string;
  timeOut: string;
  workDays: string;
}

export interface CheckInSetupProps {
  userId: number;
  /** OWNER/ADMIN. Anyone else only sees the message to ask an admin. */
  canSetup: boolean;
  /** Active branches / shifts of the organisation. */
  branches: SetupBranch[];
  shifts: SetupShift[];
  /** The person's own shift/branch when they resolve inside this organisation. */
  currentShiftId: number | null;
  currentBranchId: number | null;
  /** Hide the "Buka Dashboard" shortcut when already inside the admin panel. */
  insideAdmin?: boolean;
  /** The person has no usable shift (as opposed to a tracked person whose organisation has no branch). */
  untracked?: boolean;
}

const DEFAULT_BRANCH_NAME = 'Kantor Pusat';
const DEFAULT_SHIFT = {
  name: 'Shift Reguler',
  timeIn: '08:00',
  timeOut: '17:00',
  breakMinutes: 60,
  lateToleranceMinutes: 10,
  workDays: '1,2,3,4,5',
  isCrossDay: false,
} as const;
const RADIUS_OPTIONS = [50, 100, 150, 200, 300].map((value) => ({ value: String(value), label: `${value} m` }));
const WEAK_ACCURACY_M = 100;
const TOO_WEAK_ACCURACY_M = 1000;
const DAY_SHORT = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

type StepStatus = 'idle' | 'running' | 'done' | 'error';

interface Fix {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

interface ApiResult<T> {
  status: number;
  data?: T;
  code?: string;
  message?: string;
}

async function api<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T> | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string } };
    return { status: res.status, data: json.data, code: json.error?.code, message: json.error?.message };
  } catch {
    return null;
  }
}

function readPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy }),
      (e) => reject(e),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  });
}

function describeWorkDays(workDays: string | number): string {
  const days = String(workDays ?? '').split(',').map(Number).filter((d) => d >= 1 && d <= 7);
  if (days.length === 5 && days.join(',') === '1,2,3,4,5') return 'Senin–Jumat';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

function clock(time: string): string {
  return time.slice(0, 5).replace(':', '.');
}

/** A failure with a sentence the person can act on. */
class StepError extends Error {}
/** Thrown inside a run when the first GPS fix is usable but weak: the person chooses retry or accept. */
class WeakFix extends Error {}

export default function CheckInSetup(props: CheckInSetupProps) {
  const { canSetup } = props;
  if (!canSetup) return <AskAdmin hasBranch={props.branches.length > 0} untracked={props.untracked ?? props.currentShiftId === null} />;
  return <SetupChecklist {...props} />;
}

function AskAdmin({ hasBranch, untracked }: { hasBranch: boolean; untracked: boolean }) {
  const router = useRouter();
  const title = untracked ? 'Admin belum menjadwalkan Anda' : 'Belum ada cabang untuk absen';
  const message = untracked
    ? `Akun Anda belum punya shift, jadi belum bisa absen. Minta admin menetapkan shift untuk akun Anda di menu Karyawan${
        hasBranch ? '' : ' dan menambahkan cabang di menu Cabang'
      }, lalu muat ulang halaman ini.`
    : 'Organisasi Anda belum punya cabang aktif sebagai titik absen. Minta admin menambahkan cabang di menu Cabang, lalu muat ulang halaman ini.';
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 py-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
        <Users className="h-6 w-6 text-muted" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="text-sm text-muted">{message}</p>
      <Button type="button" variant="outline" onClick={() => router.refresh()}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Muat Ulang
      </Button>
    </div>
  );
}

function StepIcon({ status, index }: { status: StepStatus; index: number }) {
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Selesai" />;
  if (status === 'running') return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted" aria-label="Sedang berjalan" />;
  if (status === 'error') return <CircleAlert className="h-5 w-5 shrink-0 text-destructive" aria-label="Gagal" />;
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-field text-xs font-semibold text-muted"
    >
      {index}
    </span>
  );
}

function Step({
  index,
  title,
  status,
  summary,
  error,
  children,
}: {
  index: number;
  title: string;
  status: StepStatus;
  summary?: string;
  error?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-input border border-border p-3">
      <div className="flex items-center gap-2">
        <StepIcon status={status} index={index} />
        <h4 className="text-sm font-semibold text-text">{title}</h4>
      </div>
      {summary ? <p className="text-xs text-muted">{summary}</p> : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function SetupChecklist({ userId, branches, shifts, currentShiftId, currentBranchId, insideAdmin = false }: CheckInSetupProps) {
  const router = useRouter();
  const { show } = useToast();

  // Choices the owner can change before running.
  const [name, setName] = useState(DEFAULT_BRANCH_NAME);
  const [radius, setRadius] = useState('100');
  const [branchChoice, setBranchChoice] = useState<string>(String(currentBranchId ?? branches[0]?.id ?? ''));
  const [shiftChoice, setShiftChoice] = useState<string>(String(currentShiftId ?? shifts[0]?.id ?? ''));

  // What this session has created or picked so far (the server props catch up after refresh()).
  const [madeBranch, setMadeBranch] = useState<{ id: number; name: string; radiusM: number } | null>(null);
  const [madeShift, setMadeShift] = useState<{ id: number; name: string } | null>(null);
  const [assigned, setAssigned] = useState(false);

  const [status, setStatus] = useState<Record<1 | 2 | 3, StepStatus>>({ 1: 'idle', 2: 'idle', 3: 'idle' });
  const [errors, setErrors] = useState<Record<1 | 2 | 3, string | null>>({ 1: null, 2: null, 3: null });
  const [running, setRunning] = useState(false);
  const [weak, setWeak] = useState<Fix | null>(null);

  const branchExists = branches.length > 0 || madeBranch !== null;
  const shiftExists = shifts.length > 0 || madeShift !== null;
  const scheduled = (currentShiftId !== null && currentBranchId !== null) || assigned;
  const done: Record<1 | 2 | 3, boolean> = { 1: branchExists, 2: shiftExists, 3: scheduled };

  const stepStatus = (n: 1 | 2 | 3): StepStatus => (status[n] === 'running' || status[n] === 'error' ? status[n] : done[n] ? 'done' : 'idle');

  function setStep(n: 1 | 2 | 3, next: StepStatus, error: string | null = null) {
    setStatus((prev) => ({ ...prev, [n]: next }));
    setErrors((prev) => ({ ...prev, [n]: error }));
  }

  // ---- step 1: the branch, from this browser's location -------------------------------------
  async function ensureBranch(acceptFix?: Fix): Promise<number> {
    if (branches.length > 0) return Number(branchChoice) || branches[0]!.id;
    if (madeBranch) return madeBranch.id;

    // Resume after a partial failure: an active branch may already exist that the page props predate.
    const existing = await api<{ branches: SetupBranch[] }>('GET', '/api/branches?activeOnly=1');
    const found = existing?.data?.branches?.[0];
    if (found) {
      setMadeBranch(found);
      return found.id;
    }

    let fix = acceptFix;
    if (!fix) {
      try {
        fix = await readPosition();
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: number }).code : 0;
        const copy = describeGeoError(code === 1 ? 'denied' : code === 3 ? 'timeout' : error instanceof Error && error.message === 'unsupported' ? 'unsupported' : 'unavailable');
        throw new StepError(`${copy.title}. ${copy.message}`);
      }
      if (fix.accuracyM > TOO_WEAK_ACCURACY_M) {
        throw new StepError(
          `Sinyal GPS terlalu lemah (±${Math.round(fix.accuracyM)} m). Pindah ke tempat terbuka lalu coba lagi, atau isi koordinat manual di halaman Cabang.`,
        );
      }
      if (fix.accuracyM > WEAK_ACCURACY_M) {
        setWeak(fix);
        throw new WeakFix();
      }
    }

    let radiusM = Number(radius);
    if (fix.accuracyM > WEAK_ACCURACY_M) radiusM = Math.min(1000, Math.max(radiusM, Math.ceil((fix.accuracyM * 1.5) / 50) * 50));
    else if (fix.accuracyM > 50) radiusM = Math.max(radiusM, 150);

    const created = await api<{ branch: SetupBranch }>('POST', '/api/branches', {
      name: name.trim() || DEFAULT_BRANCH_NAME,
      latitude: Number(fix.latitude.toFixed(6)),
      longitude: Number(fix.longitude.toFixed(6)),
      radiusM,
    });
    if (!created) throw new StepError('Koneksi terputus saat membuat cabang. Periksa internet Anda lalu coba lagi.');
    if (created.status === 201 && created.data?.branch) {
      setMadeBranch(created.data.branch);
      return created.data.branch.id;
    }
    if (created.code === 'SEAT_LIMIT_REACHED') {
      throw new StepError('Paket Anda sudah mencapai batas cabang. Gunakan cabang yang sudah ada atau tingkatkan paket.');
    }
    // A name that already exists (a retry): reuse it instead of failing.
    const again = await api<{ branches: SetupBranch[] }>('GET', '/api/branches?activeOnly=1');
    const same = again?.data?.branches?.find((b) => b.name.toLowerCase() === (name.trim() || DEFAULT_BRANCH_NAME).toLowerCase());
    if (same) {
      setMadeBranch(same);
      return same.id;
    }
    throw new StepError(created.message && created.status < 500 ? created.message : 'Cabang belum bisa dibuat. Coba lagi sebentar lagi.');
  }

  // ---- step 2: the shift ---------------------------------------------------------------------
  async function ensureShift(): Promise<number> {
    if (shifts.length > 0) return Number(shiftChoice) || shifts[0]!.id;
    if (madeShift) return madeShift.id;

    const existing = await api<{ shifts: SetupShift[] }>('GET', '/api/shifts?activeOnly=1');
    const found = existing?.data?.shifts?.[0];
    if (found) {
      setMadeShift(found);
      return found.id;
    }
    const created = await api<{ shift: SetupShift }>('POST', '/api/shifts', DEFAULT_SHIFT);
    if (!created) throw new StepError('Koneksi terputus saat membuat shift. Periksa internet Anda lalu coba lagi.');
    if (created.status === 201 && created.data?.shift) {
      setMadeShift(created.data.shift);
      return created.data.shift.id;
    }
    const again = await api<{ shifts: SetupShift[] }>('GET', '/api/shifts?activeOnly=1');
    const same = again?.data?.shifts?.find((s) => s.name.toLowerCase() === DEFAULT_SHIFT.name.toLowerCase());
    if (same) {
      setMadeShift(same);
      return same.id;
    }
    throw new StepError(created.message && created.status < 500 ? created.message : 'Shift belum bisa dibuat. Coba lagi sebentar lagi.');
  }

  // ---- step 3: schedule the owner ------------------------------------------------------------
  async function assignSelf(shiftId: number, branchId: number): Promise<void> {
    const res = await api('PATCH', `/api/users/${userId}`, { shiftId, branchId });
    if (!res) throw new StepError('Koneksi terputus saat menjadwalkan Anda. Periksa internet lalu coba lagi.');
    if (res.status !== 200) {
      throw new StepError(res.status === 404 ? 'Cabang atau shift tidak ditemukan. Muat ulang halaman lalu coba lagi.' : (res.message ?? 'Anda belum bisa dijadwalkan. Coba lagi.'));
    }
    setAssigned(true);
  }

  // Runs the given steps in order and stops at the first one that needs the person. The per-step
  // buttons run one step; "Siapkan Otomatis" runs all three.
  async function run(steps: readonly (1 | 2 | 3)[], acceptFix?: Fix) {
    if (running) return;
    setRunning(true);
    setWeak(null);
    let branchId = madeBranch?.id ?? (branches.length > 0 ? Number(branchChoice) || branches[0]!.id : null);
    let shiftId = madeShift?.id ?? (shifts.length > 0 ? Number(shiftChoice) || shifts[0]!.id : null);
    let current: 1 | 2 | 3 = steps[0] ?? 1;
    try {
      for (const step of steps) {
        current = step;
        setStep(step, 'running');
        if (step === 1) branchId = await ensureBranch(acceptFix);
        else if (step === 2) shiftId = await ensureShift();
        else {
          if (branchId === null || shiftId === null) throw new StepError('Selesaikan langkah cabang dan shift dulu.');
          await assignSelf(shiftId, branchId);
          show('Check-in siap. Anda bisa absen sekarang.', 'success');
        }
        setStep(step, 'done');
      }
      router.refresh();
    } catch (error) {
      if (error instanceof WeakFix) {
        setStep(current, 'idle');
      } else {
        setStep(current, 'error', error instanceof StepError ? error.message : 'Terjadi kesalahan. Coba lagi.');
        // Keep the page in step with what was created before the failure.
        router.refresh();
      }
    } finally {
      setRunning(false);
    }
  }

  const pickedBranch = madeBranch ?? branches.find((b) => b.id === Number(branchChoice)) ?? branches[0] ?? null;
  const branchSummary = pickedBranch ? `${pickedBranch.name} · radius ${pickedBranch.radiusM} m` : undefined;
  const pickedShift = shifts.find((s) => s.id === Number(shiftChoice)) ?? shifts[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold text-text">Siapkan check-in</h3>
        <p className="mt-0.5 text-sm text-muted">Tiga langkah singkat agar Anda bisa absen sekarang.</p>
      </div>

      <ol className="grid gap-3 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Step
          index={1}
          title="Cabang (titik lokasi absen)"
          status={stepStatus(1)}
          summary={done[1] ? branchSummary : undefined}
          error={errors[1]}
        >
          {done[1] ? (
            branches.length > 1 ? (
              <Select
                aria-label="Cabang untuk Anda"
                value={branchChoice}
                onChange={(e) => setBranchChoice(e.target.value)}
                options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
              />
            ) : null
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                <Input label="Nama cabang" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="off" />
                <Select label="Radius" value={radius} onChange={(e) => setRadius(e.target.value)} options={RADIUS_OPTIONS} />
              </div>
              {weak ? (
                <Notice tone="warning" icon={MapPin} title={`Sinyal GPS lemah (±${Math.round(weak.accuracyM)} m)`} role="status">
                  Cabang akan kurang akurat. Coba lagi di tempat terbuka, atau tetap gunakan lokasi ini dengan radius lebih besar.
                  <span className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => void run([1])} disabled={running}>
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      Coba Lagi
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void run([1], weak)} disabled={running}>
                      Tetap Gunakan
                    </Button>
                  </span>
                </Notice>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => void run([1])} disabled={running} className="h-auto! min-h-8 whitespace-normal! py-1.5 text-center">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Gunakan Lokasi Saya & Buat Cabang
                </Button>
              )}
            </>
          )}
        </Step>

        <Step
          index={2}
          title="Shift kerja"
          status={stepStatus(2)}
          summary={
            done[2]
              ? madeShift && shifts.length === 0
                ? `${madeShift.name} dibuat.`
                : pickedShift
                  ? `${pickedShift.name} · ${clock(pickedShift.timeIn)}–${clock(pickedShift.timeOut)}`
                  : undefined
              : `${DEFAULT_SHIFT.name} · ${describeWorkDays(DEFAULT_SHIFT.workDays)} · ${clock(DEFAULT_SHIFT.timeIn)}–${clock(DEFAULT_SHIFT.timeOut)} · toleransi ${DEFAULT_SHIFT.lateToleranceMinutes} menit · istirahat ${DEFAULT_SHIFT.breakMinutes} menit`
          }
          error={errors[2]}
        >
          {done[2] ? (
            shifts.length > 1 ? (
              <Select
                aria-label="Shift untuk Anda"
                value={shiftChoice}
                onChange={(e) => setShiftChoice(e.target.value)}
                options={shifts.map((s) => ({ value: String(s.id), label: `${s.name} · ${clock(s.timeIn)}–${clock(s.timeOut)}` }))}
              />
            ) : null
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => void run([2])} disabled={running}>
              Buat Shift
            </Button>
          )}
        </Step>

        <Step
          index={3}
          title="Jadwalkan diri Anda"
          status={stepStatus(3)}
          summary={
            done[3]
              ? 'Anda sudah terjadwal.'
              : 'Anda akan tercatat di laporan kehadiran dan dihitung tidak hadir bila tidak absen pada hari kerja.'
          }
          error={errors[3]}
        >
          {!done[3] ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void run([3])}
              disabled={running || !done[1] || !done[2]}
            >
              Jadwalkan Saya
            </Button>
          ) : null}
        </Step>
      </ol>

      <div className="flex flex-col gap-3 border-t border-border pt-3 @xl:flex-row @xl:items-center @xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void run([1, 2, 3])} isLoading={running} disabled={running}>
            {running ? null : <Rocket className="h-4 w-4" aria-hidden="true" />}
            Siapkan Otomatis
          </Button>
          <ButtonLink href="/app/branches" variant="ghost">
            Atur manual
          </ButtonLink>
        </div>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <Link href="/app/employees" className="underline underline-offset-4 hover:text-text">
            Undang karyawan
          </Link>
          {insideAdmin ? null : (
            <Link href="/app" className="underline underline-offset-4 hover:text-text">
              Tidak perlu absen? Buka Dashboard
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
