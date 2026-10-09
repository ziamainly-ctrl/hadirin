'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, TriangleAlert } from 'lucide-react';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Dialog from '@/components/ui/Dialog';
import IconButton from '@/components/ui/IconButton';
import StatusBadge from '@/components/shared/StatusBadge';
import FitPager from '@/components/shared/FitPager';
import type { ServerPagerProps } from '@/components/shared/FitPager';
import type { AttendanceStatus } from '@/lib/constants/statuses';

/**
 * One photo, fully prepared by the Server Component (labels already formatted in the org's
 * timezone and locale, the maps link already validated), so this client leaf holds no date or
 * coordinate logic. `src` is the authorized proxy URL, never a Blob URL.
 */
export interface SelfieCardData {
  key: string;
  logId: number;
  userId: number;
  name: string;
  kind: 'check-in' | 'check-out';
  src: string;
  workDate: string;
  dateLabel: string;
  timeLabel: string;
  branchName: string | null;
  status: AttendanceStatus;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  lateLabel: string | null;
  earlyLeaveLabel: string | null;
  isOutside: boolean;
  distanceLabel: string | null;
  accuracyLabel: string | null;
  mapHref: string | null;
  note: string | null;
  attendanceHref: string;
}

export interface SelfieGalleryProps {
  items: SelfieCardData[];
  /** The server chunk these photos are one page of: the desktop footer then pages across chunks. */
  serverPager?: ServerPagerProps;
}

const KIND_LABEL = { 'check-in': 'Masuk', 'check-out': 'Keluar' } as const;

// A plain <img>: next/image's optimizer fetches server-side without the visitor's session cookie, so
// it could never reach the role + tenant checked proxy. The browser sends the cookie itself.
function Photo({
  item,
  className,
  fit,
  loading,
}: {
  item: SelfieCardData;
  className?: string;
  fit: 'cover' | 'contain';
  loading: 'lazy' | 'eager';
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`flex flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted ${className ?? ''}`}>
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        Foto tidak dapat dimuat
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.src}
      alt={`Foto ${KIND_LABEL[item.kind].toLowerCase()} ${item.name}, ${item.timeLabel}`}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${className ?? ''}`}
    />
  );
}

export default function SelfieGallery({ items, serverPager }: SelfieGalleryProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const item = selected !== null ? (items[selected] ?? null) : null;

  const close = useCallback(() => setSelected(null), []);
  const move = useCallback(
    (delta: number) => setSelected((current) => (current === null ? null : Math.min(items.length - 1, Math.max(0, current + delta)))),
    [items.length],
  );

  // Left / right arrow keys step through the photos while the dialog is open.
  useEffect(() => {
    if (selected === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') move(-1);
      else if (event.key === 'ArrowRight') move(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, move]);

  return (
    <>
      {/* Desktop: the gallery is paginated to the room under the filters (FitPager: columns x rows
          that fit), so nothing scrolls; lg:p-1 and the negative margin leave room for the focus
          ring of the cards on the edge. On a short window the photos go 4:3 and a column more, so a
          page still holds a useful number of them. */}
      <FitPager
        as="ul"
        label="Galeri selfie"
        noun="foto"
        serverPager={serverPager}
        className="grid grid-cols-2 gap-3 fit-gap sm:grid-cols-3 lg:-mx-1 lg:content-start lg:p-1 xl:grid-cols-5 min-[1500px]:grid-cols-6 min-[1800px]:grid-cols-7"
      >
        {items.map((card, index) => (
          <li key={card.key} className="min-w-0">
            <button
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Buka foto ${KIND_LABEL[card.kind].toLowerCase()} ${card.name}, ${card.dateLabel} ${card.timeLabel}`}
              className="group flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface text-left transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span className="relative block aspect-square w-full overflow-hidden bg-accent [@media(min-width:1024px)_and_(max-height:860px)]:aspect-[4/3]">
                <Photo item={card} fit="cover" loading="lazy" className="h-full w-full" />
                <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-xs font-medium text-white">
                  {KIND_LABEL[card.kind]}
                </span>
                {card.isOutside ? (
                  <span
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-medium text-amber-300"
                    title="Di luar area"
                  >
                    <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Di luar area</span>
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2">
                <span className="truncate text-sm font-medium text-text">{card.name}</span>
                <span className="truncate text-xs tabular-nums text-muted">
                  {card.dateLabel} · {card.timeLabel}
                </span>
                <span className="mt-1 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
                  {card.kind === 'check-in' ? <StatusBadge status={card.status} /> : null}
                  {card.lateLabel && card.kind === 'check-in' ? <span className="text-xs tabular-nums text-muted">{card.lateLabel}</span> : null}
                  {card.earlyLeaveLabel && card.kind === 'check-out' ? (
                    <span className="text-xs tabular-nums text-muted">{card.earlyLeaveLabel}</span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        ))}
      </FitPager>

      <Dialog open={item !== null} onClose={close} title={item ? `Foto ${KIND_LABEL[item.kind].toLowerCase()} · ${item.name}` : undefined} size="lg">
        {item ? (
          <>
            <Dialog.Body className="flex flex-col gap-4">
              {/* key: a new photo remounts the image, so a failure on one never hides the next. */}
              <div className="flex max-h-[55dvh] min-h-48 items-center justify-center overflow-hidden rounded-card border border-border bg-accent">
                <Photo key={item.key} item={item} fit="contain" loading="eager" className="max-h-[55dvh] w-full" />
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Detail label="Karyawan">
                  <Link
                    href={`/app/employees/${item.userId}`}
                    className="rounded-sm font-medium text-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {item.name}
                  </Link>
                </Detail>
                <Detail label="Waktu">
                  {KIND_LABEL[item.kind]} · {item.dateLabel}, {item.timeLabel}
                </Detail>
                <Detail label={item.kind === 'check-in' ? 'Status' : 'Status Hari Itu'}>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.lateLabel && item.kind === 'check-in' ? <span className="tabular-nums text-muted">{item.lateLabel}</span> : null}
                    {item.earlyLeaveLabel && item.kind === 'check-out' ? (
                      <span className="tabular-nums text-muted">{item.earlyLeaveLabel}</span>
                    ) : null}
                  </span>
                </Detail>
                <Detail label="Cabang">{item.branchName ?? '—'}</Detail>
                <Detail label="Jarak dari cabang">
                  <span className={item.isOutside ? 'inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400' : undefined}>
                    {item.isOutside ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                    {item.distanceLabel ?? '—'}
                    {item.isOutside ? ' (di luar area)' : ''}
                  </span>
                </Detail>
                <Detail label="Akurasi GPS">{item.accuracyLabel ?? '—'}</Detail>
                <Detail label="Lokasi">
                  {item.mapHref ? (
                    <a
                      href={item.mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-sm font-medium text-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      Buka di peta
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                    </a>
                  ) : (
                    '—'
                  )}
                </Detail>
                {item.note ? (
                  <div className="sm:col-span-2">
                    <Detail label="Catatan">{item.note}</Detail>
                  </div>
                ) : null}
              </dl>
            </Dialog.Body>
            <Dialog.Footer>
              {/* One full-width child, so the stepper sits left and the actions right; a justify-between
                  class on the footer itself would tie with its own justify-end on specificity. */}
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <IconButton label="Foto sebelumnya" variant="outline" size="lg" onClick={() => move(-1)} disabled={selected === 0}>
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                  <span className="px-1 text-sm tabular-nums text-muted">
                    {(selected ?? 0) + 1} dari {items.length}
                  </span>
                  <IconButton
                    label="Foto berikutnya"
                    variant="outline"
                    size="lg"
                    onClick={() => move(1)}
                    disabled={selected === items.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </IconButton>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <ButtonLink href={item.attendanceHref} variant="outline">
                    Lihat di Absensi
                  </ButtonLink>
                  <Button onClick={close}>Tutup</Button>
                </div>
              </div>
            </Dialog.Footer>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-text">{children}</dd>
    </div>
  );
}
