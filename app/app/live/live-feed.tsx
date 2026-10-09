import Link from 'next/link';
import { LogIn, LogOut, TriangleAlert } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import FitPager from '@/components/shared/FitPager';
import SelfieLink from '@/components/shared/SelfieLink';
import { formatClock } from '@/app/m/format';
import { formatMinutes } from '@/app/app/attendance/format';
import { formatRelative } from '@/lib/relative-time';
import { initials } from '@/lib/initials';
import type { PunchEvent } from '@/lib/queries/live';

export interface LiveFeedProps {
  events: PunchEvent[];
  timeZone: string;
  /** The instant the server rendered this feed: relative times ("3 mnt lalu") are measured from
   * it, so the server markup and the client's hydration agree exactly. */
  nowMs: number;
  /** OWNER/ADMIN can open an employee's page from the feed; a MANAGER has no such page. */
  linkNames: boolean;
}

// Server Component: the whole feed is plain markup. The page re-renders it on every
// router.refresh() (components/shared/AutoRefresh), so nothing here needs state.
export default function LiveFeed({ events, timeZone, nowMs, linkNames }: LiveFeedProps) {
  return (
    // Desktop: the feed is paginated to the height of its card (no scroll bar); a phone scrolls the page.
    <FitPager
      as="ul"
      label="Aktivitas check-in dan check-out hari ini"
      noun="aktivitas"
      className="divide-y divide-border"
      frameClassName="lg:min-h-0 lg:flex-1"
      footerClassName=""
    >
        {events.map((event) => {
          const isIn = event.kind === 'IN';
          const at = new Date(event.at);
          const kindLabel = isIn ? 'Check-in' : 'Check-out';
          const Icon = isIn ? LogIn : LogOut;
          const name = <span className="truncate font-medium text-text">{event.name}</span>;
          return (
            <li key={`${event.logId}-${event.kind}`} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-fg"
              >
                {initials(event.name)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                  {linkNames ? (
                    <Link
                      href={`/app/employees/${event.userId}`}
                      className="min-w-0 truncate rounded-sm font-medium text-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {event.name}
                    </Link>
                  ) : (
                    name
                  )}
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {kindLabel}
                  </span>
                </p>
                <p className="truncate text-xs text-muted">{event.branchName ?? 'Cabang tidak tercatat'}</p>
                {(isIn && event.status === 'LATE' && event.lateMinutes > 0) ||
                (!isIn && event.earlyLeaveMinutes > 0) ||
                event.isOutside ? (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {isIn && event.status === 'LATE' && event.lateMinutes > 0 ? (
                      <Badge tone="warning">Terlambat {formatMinutes(event.lateMinutes)}</Badge>
                    ) : null}
                    {!isIn && event.earlyLeaveMinutes > 0 ? (
                      <span className="text-muted">Pulang awal {formatMinutes(event.earlyLeaveMinutes)}</span>
                    ) : null}
                    {event.isOutside ? (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Luar area
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <p className="text-sm font-semibold tabular-nums text-text">{formatClock(event.at, timeZone)}</p>
                <p className="text-xs text-muted">{formatRelative(nowMs, at.getTime(), timeZone)}</p>
                {event.hasPhoto ? <SelfieLink logId={event.logId} kind={isIn ? 'check-in' : 'check-out'} /> : null}
              </div>
            </li>
          );
        })}
    </FitPager>
  );
}
