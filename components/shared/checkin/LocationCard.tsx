'use client';

import { LifeBuoy, Loader2, MapPin, MapPinOff, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import IconButton from '@/components/ui/IconButton';
import Skeleton from '@/components/ui/Skeleton';
import type { GeoCoords, GeoStatus } from '@/components/shared/GeoPermissionGate';
import Notice from '@/app/m/notice';
import type { PrecheckState } from '@/app/m/use-precheck';
import { WEAK_GPS_HELP_STEPS, describeGeoError, type GeoErrorKind } from '@/lib/check-in-copy';
import { formatDistance } from '@/lib/geo';
import { describeAccuracy } from './accuracy';
import './checkin.css';

export interface LocationCardProps {
  geoStatus: GeoStatus;
  coords: GeoCoords | null;
  errorKind: GeoErrorKind | null;
  state: PrecheckState;
  /** Last GPS fix (epoch ms), for "Diperbarui 08.01.23". */
  updatedAt: number | null;
  timeZone: string;
  onRefresh: () => void;
  /** The browser's location permission ('prompt' while the person has not answered), for the loading copy. */
  permission?: PermissionState | null;
  /** Tighter: no "Diperbarui" text and an icon-only refresh. Used while the camera is open, where every
   * pixel of height belongs to the viewfinder. */
  compact?: boolean;
}

// What to do about a missing position, by cause (the one-line message is describeGeoError's).
const GEO_RECOVERY_STEPS: Partial<Record<GeoErrorKind, readonly string[]>> = {
  denied: ['Ketuk ikon gembok di dekat alamat web.', 'Ubah izin Lokasi menjadi Izinkan.', 'Kembali ke sini lalu ketuk Coba Lagi.'],
  blocked: ['Ketuk ikon gembok di dekat alamat web.', 'Ubah izin Lokasi menjadi Izinkan.', 'Kembali ke sini lalu ketuk Coba Lagi.'],
  unavailable: ['Nyalakan Lokasi atau GPS di perangkat.', 'Pindah ke dekat jendela atau tempat terbuka.', 'Ketuk Coba Lagi.'],
  timeout: ['Pindah ke dekat jendela atau tempat terbuka.', 'Tunggu beberapa detik, lalu ketuk Coba Lagi.'],
};

/** Four rising bars, like a signal meter. Filled bars are the neutral text colour; a weak fix turns
 * them into the small amber accent. */
function SignalBars({ bars, weak }: { bars: number; weak: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-3.5 items-end gap-0.5">
      {[5, 8, 11, 14].map((height, i) => (
        <span
          key={height}
          style={{ height }}
          className={`w-[3px] rounded-[1px] transition-colors duration-300 ${i < bars ? (weak ? 'bg-warning' : 'bg-text') : 'bg-border'}`}
        />
      ))}
    </span>
  );
}

/**
 * Where the person is before the photo: the nearest branch, the distance to it (a chip: "12 m / 100 m"),
 * inside or outside, and how good the GPS fix is (a four-bar meter plus the accuracy in metres).
 * The branch numbers come from the server (POST /api/attendance/precheck), computed with the same
 * functions the punch route uses; this card only shows them. A STRICT organisation blocks the camera
 * outside the radius, a FLAG one says the punch will be marked "Di Luar Area". Every failure says what
 * to do next.
 */
export default function LocationCard({ geoStatus, coords, errorKind, state, updatedAt, timeZone, onRefresh, permission = null, compact = false }: LocationCardProps) {
  if (geoStatus === 'loading' && !coords) {
    return (
      <div role="status" aria-live="polite" className="ci-fade flex w-full flex-col gap-2 rounded-input border border-border bg-accent p-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="ci-ping absolute inset-0 rounded-full bg-text" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-text" />
          </span>
          {permission === 'prompt' ? 'Menunggu izin lokasi...' : 'Mencari lokasi Anda...'}
        </p>
        {permission === 'prompt' ? (
          <p className="text-xs text-muted">Ketuk Izinkan pada jendela izin di bagian atas layar.</p>
        ) : (
          <>
            <Skeleton className="h-3 w-3/4" />
            {compact ? null : <Skeleton className="h-3 w-1/2" />}
          </>
        )}
      </div>
    );
  }

  if (geoStatus === 'denied' || geoStatus === 'error') {
    const kind: GeoErrorKind = errorKind ?? (geoStatus === 'denied' ? 'denied' : 'unavailable');
    const copy = describeGeoError(kind);
    const steps = GEO_RECOVERY_STEPS[kind];
    return (
      <Notice
        tone="danger"
        icon={geoStatus === 'denied' ? ShieldAlert : MapPinOff}
        title={copy.title}
        className="ci-fade"
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Coba Lagi
          </Button>
        }
      >
        <p>{copy.message}</p>
        {steps && !compact ? (
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs [@media(max-height:700px)]:hidden">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : null}
      </Notice>
    );
  }

  // 'ok' | 'weak-signal' (or 'loading' again after a manual refresh, with the previous fix kept).
  const accuracy = coords ? Math.round(coords.accuracyM) : null;
  const meter = describeAccuracy(coords ? coords.accuracyM : null);
  const weak = geoStatus === 'weak-signal' || (accuracy !== null && accuracy > 100);
  const data = state.data;
  const refreshing = geoStatus === 'loading' || state.loading;
  const updated =
    updatedAt !== null
      ? new Date(updatedAt).toLocaleTimeString('id-ID', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : null;

  const inside = data?.branch?.isInside ?? null;
  const Icon = inside === false ? MapPinOff : MapPin;
  const iconClass = inside === false ? 'text-amber-600 dark:text-amber-400' : inside === true ? 'text-success' : 'text-muted';

  return (
    <div className="ci-fade flex w-full flex-col gap-2 rounded-input border border-border bg-accent p-3 text-left">
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 transition-colors ${iconClass}`} aria-hidden="true" />
        {/* The one live region: "Di dalam area / Di luar area" and the distance are what change when the
            person moves; the refresh time and the buttons are not announced. */}
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          {data?.branch ? (
            <>
              <p className="text-sm font-semibold leading-snug text-text">
                {inside ? 'Di dalam area' : 'Di luar area'}
                <span className="font-normal text-muted"> · </span>
                <span className="break-words">{data.branch.name}</span>
              </p>
              <p className="text-xs text-muted">Cabang terdekat, batas {formatDistance(data.branch.radiusM)}</p>
            </>
          ) : state.loading || (!state.failed && !data) ? (
            <div className="flex flex-col gap-1.5" aria-hidden="true">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-text">Lokasi terdeteksi</p>
              <p className="text-xs text-muted">Area dicek saat absen dikirim.</p>
            </>
          )}
        </div>
        {data?.branch ? (
          <span
            aria-label={`Jarak ${formatDistance(data.branch.distanceM)} dari titik, batas ${formatDistance(data.branch.radiusM)}`}
            className={`shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums ${
              inside === false ? 'text-amber-700 dark:text-amber-400' : 'text-text'
            }`}
          >
            {formatDistance(data.branch.distanceM)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <SignalBars bars={meter.bars} weak={weak} />
        <span className="min-w-0 truncate text-text">
          {accuracy !== null ? <span className="tabular-nums">±{accuracy} m</span> : null}
          <span className="text-muted"> · {meter.label}</span>
          {compact || !updated ? null : <span className="text-muted tabular-nums"> · {updated}</span>}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {compact ? (
            <IconButton label="Perbarui lokasi" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            </IconButton>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} title={updated ? `Diperbarui ${updated}` : undefined} className="shrink-0">
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Perbarui
            </Button>
          )}
        </span>
      </div>

      {data && !data.canSubmit && data.block === 'OUTSIDE_GEOFENCE' && data.branch ? (
        <p className="ci-fade text-xs text-text">Absen hanya bisa dilakukan di dalam area. Dekati {data.branch.name}, lalu perbarui lokasi.</p>
      ) : null}
      {data && !data.canSubmit && data.block === 'ACCURACY_TOO_LOW' ? (
        <p className="ci-fade text-xs text-text">Sinyal GPS terlalu lemah (di atas 1 km). Pindah ke tempat terbuka lalu perbarui lokasi.</p>
      ) : null}
      {data?.willFlagOutside ? (
        <p className="ci-fade flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          <MapPinOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Absen akan ditandai Di Luar Area
        </p>
      ) : null}

      {weak ? (
        <details className="group relative text-xs">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 font-medium text-text [&::-webkit-details-marker]:hidden">
            <TriangleAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Sinyal GPS lemah
            <LifeBuoy className="ml-1 h-3.5 w-3.5 text-muted" aria-hidden="true" />
            <span className="text-muted">Bantuan lokasi</span>
          </summary>
          {/* A popover above the summary, not more rows: opening the help must not push the page taller. */}
          <ol className="ci-fade absolute inset-x-0 bottom-full z-20 mb-1 list-decimal space-y-1 rounded-input border border-border bg-surface p-3 pl-7 text-muted shadow-lg">
            {WEAK_GPS_HELP_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
