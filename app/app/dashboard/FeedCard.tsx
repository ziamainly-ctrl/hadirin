import Link from 'next/link';
import { Activity, LogIn, LogOut, TriangleAlert } from 'lucide-react';
import { initials } from '@/lib/initials';
import DashCard from './DashCard';
import DashEmpty from './DashEmpty';
import { formatClock } from './model';
import type { PunchItem } from './model';

/**
 * "Aktivitas terbaru": the latest check-ins and check-outs of the board, newest first, each a link to
 * /app/live (the full stream). Initials, name, what happened and where, the time on the right; a late
 * arrival gets a small amber dot and one outside the geofence a small amber triangle (colour is never
 * the only cue: both are also in the words). Shows as many rows as the card has room for.
 */
export default function FeedCard({ items, timeZone, order }: { items: PunchItem[]; timeZone: string; order: number }) {
  return (
    <DashCard id="feed" title="Aktivitas terbaru" order={order} href="/app/live" hrefLabel="Live">
      {items.length === 0 ? (
        <div className="min-h-0 flex-1">
          <DashEmpty icon={Activity}>Belum ada check-in hari ini. Aktivitas muncul di sini begitu karyawan mulai absen.</DashEmpty>
        </div>
      ) : (
        <div className="dash-fit">
          <ul className="dash-rows dash-rows-36">
            {items.map((item) => {
              const Icon = item.kind === 'IN' ? LogIn : LogOut;
              const what = item.kind === 'IN' ? (item.late ? 'Masuk, terlambat' : 'Masuk') : 'Pulang';
              return (
                <li key={item.id}>
                  <Link
                    href="/app/live"
                    className="-mx-1.5 flex h-full items-center gap-2.5 rounded-input px-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-fg"
                    >
                      {initials(item.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{item.name}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-muted">
                        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {what}
                          {item.branchName ? ` · ${item.branchName}` : ''}
                        </span>
                      </span>
                    </span>
                    {item.outside ? (
                      <TriangleAlert className="h-4 w-4 shrink-0 text-warning" role="img" aria-label="Di luar area" />
                    ) : item.late ? (
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-warning" />
                    ) : null}
                    <time dateTime={item.at} className="w-11 shrink-0 text-right text-xs tabular-nums text-muted">
                      {formatClock(item.at, timeZone)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </DashCard>
  );
}
