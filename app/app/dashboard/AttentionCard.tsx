import Link from 'next/link';
import { CalendarCheck, ChevronRight, CircleCheck, ClockAlert, MapPinOff } from 'lucide-react';
import DashCard from './DashCard';
import { buildAttentionRows } from './model';
import type { AttentionData, AttentionId } from './model';

const ICONS = { pending: CalendarCheck, late: ClockAlert, outside: MapPinOff } satisfies Record<AttentionId, typeof CalendarCheck>;
// One small dot per row that needs action: the only colour on the card.
const DOT: Record<AttentionId, string> = { pending: 'bg-info', late: 'bg-warning', outside: 'bg-warning' };

/**
 * "Perlu perhatian": requests waiting, people late, people outside the geofence. Rows with something to
 * act on come first and each links to the page that owns it; the second line (who, how long) shows
 * only while the card is tall enough. All clear says so in one calm row instead of three zeros.
 */
export default function AttentionCard({ data, order }: { data: AttentionData; order: number }) {
  const rows = buildAttentionRows(data);
  const actionable = rows.filter((r) => r.count > 0).length;
  return (
    <DashCard id="attn" title="Perlu perhatian" order={order} hint={actionable > 0 ? `${actionable} hal` : undefined}>
      {rows.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center gap-2.5 text-sm text-muted">
          <CircleCheck className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
          <p>
            <span className="font-medium text-text">Semua aman.</span> Tidak ada permintaan, keterlambatan, atau check-in di luar area.
          </p>
        </div>
      ) : (
        <div className="dash-fit">
          <ul className="dash-rows dash-rows-attn">
            {rows.map((row) => {
              const Icon = ICONS[row.id];
              const quiet = row.count === 0;
              return (
                <li key={row.id}>
                  <Link
                    href={row.href}
                    className="group -mx-1.5 flex h-full items-center gap-2.5 rounded-input px-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-input border border-border text-muted">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {quiet ? null : <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-surface ${DOT[row.id]}`} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${quiet ? 'text-muted' : 'font-medium text-text'}`}>{row.title}</span>
                      {row.sub ? <span className="dash-attn-sub block truncate text-xs text-muted">{row.sub}</span> : null}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100"
                      aria-hidden="true"
                    />
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
