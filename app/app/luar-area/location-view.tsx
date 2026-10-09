import Link from 'next/link';
import { ExternalLink, TriangleAlert } from 'lucide-react';
import Table from '@/components/ui/Table';
import ReviewCardList from '@/components/shared/ReviewCardList';
import SelfieLink from '@/components/shared/SelfieLink';
import { formatClock } from '@/app/m/format';
import { WEAK_ACCURACY_M } from '@/lib/insights-constants';
import { formatWorkDate } from '@/lib/insights-format';
import { formatAccuracy, formatMeters, mapsUrl, radiusMultiple } from '@/lib/geo-link';
import type { LocationEventRow } from '@/lib/queries/insights';

// Server-rendered body of /app/luar-area: a phone card list plus a <Table> that is a direct flex
// child of Page.Body (rows scroll inside the card, head pinned, pager stays in view).

const NUM = 'text-right tabular-nums';

function punchLabel(kind: LocationEventRow['kind']): string {
  return kind === 'IN' ? 'Masuk' : 'Keluar';
}

/** "-6.22829, 106.85410": five decimals is ~1 m, which is as precise as the GPS fix itself. */
function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function MapLink({ row }: { row: LocationEventRow }) {
  const href = mapsUrl(row.lat, row.lng);
  if (!href) return <span className="text-muted">—</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-sm font-medium text-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:py-2.5"
    >
      Buka di peta
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
    </a>
  );
}

function EmployeeLink({ id, name }: { id: number; name: string }) {
  return (
    <Link
      href={`/app/employees/${id}`}
      className="block max-w-56 truncate rounded-sm font-medium text-text hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      title={name}
    >
      {name}
    </Link>
  );
}

function Distance({ row }: { row: LocationEventRow }) {
  if (row.distanceM === null) return <span className="text-muted">—</span>;
  const multiple = row.radiusM ? radiusMultiple(row.distanceM, row.radiusM) : 0;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className={`inline-flex items-center gap-1 font-medium ${row.isOutside ? 'text-amber-700 dark:text-amber-400' : ''}`}>
        {row.isOutside ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
        {formatMeters(row.distanceM)}
      </span>
      {row.radiusM ? (
        <span className="text-xs text-muted">
          batas {formatMeters(row.radiusM)}
          {multiple > 0 ? ` · ${String(multiple).replace('.', ',')}x` : ''}
        </span>
      ) : null}
    </span>
  );
}

function Accuracy({ row }: { row: LocationEventRow }) {
  const weak = row.accuracyM !== null && row.accuracyM > WEAK_ACCURACY_M;
  return (
    <span className={weak ? 'font-medium text-amber-700 dark:text-amber-400' : undefined}>
      {formatAccuracy(row.accuracyM)}
      {weak ? <span className="sr-only"> (lemah)</span> : null}
    </span>
  );
}

function PhotoCell({ row }: { row: LocationEventRow }) {
  return row.hasPhoto ? (
    <SelfieLink logId={row.logId} kind={row.kind === 'IN' ? 'check-in' : 'check-out'} />
  ) : (
    <span className="text-muted">—</span>
  );
}

export default function LocationView({ rows, timeZone }: { rows: LocationEventRow[]; timeZone: string }) {
  return (
    <>
      <ReviewCardList
        aria-label="Audit lokasi absen"
        items={rows.map((row) => ({
          key: `${row.logId}-${row.kind}`,
          title: <EmployeeLink id={row.userId} name={row.name} />,
          subtitle: `${formatWorkDate(row.workDate)} · ${punchLabel(row.kind)} ${formatClock(row.at, timeZone)}`,
          badge: <Distance row={row} />,
          facts: [
            { label: 'Cabang', value: row.branchName ?? '—' },
            { label: 'Akurasi', value: <Accuracy row={row} /> },
          ],
          footer: (
            <>
              <MapLink row={row} />
              {row.hasPhoto ? <SelfieLink logId={row.logId} kind={row.kind === 'IN' ? 'check-in' : 'check-out'} /> : null}
            </>
          ),
        }))}
      />
      <div className="hidden min-h-0 flex-col sm:flex">
        <Table aria-label="Audit lokasi absen">
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Waktu</Table.HeadCell>
              <Table.HeadCell>Karyawan</Table.HeadCell>
              <Table.HeadCell priority={1}>Absen</Table.HeadCell>
              <Table.HeadCell priority={2}>Cabang</Table.HeadCell>
              <Table.HeadCell className={NUM}>Jarak</Table.HeadCell>
              <Table.HeadCell priority={3} className={NUM}>Akurasi</Table.HeadCell>
              <Table.HeadCell>Lokasi</Table.HeadCell>
              <Table.HeadCell>Foto</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={`${row.logId}-${row.kind}`}>
                <Table.Cell>
                  <span className="block leading-tight">{formatWorkDate(row.workDate)}</span>
                  <span className="block text-xs text-muted">{formatClock(row.at, timeZone)}</span>
                </Table.Cell>
                <Table.Cell>
                  <EmployeeLink id={row.userId} name={row.name} />
                </Table.Cell>
                <Table.Cell>{punchLabel(row.kind)}</Table.Cell>
                <Table.Cell>
                  <span className="block max-w-40 truncate" title={row.branchName ?? undefined}>
                    {row.branchName ?? '—'}
                  </span>
                </Table.Cell>
                <Table.Cell className={NUM}>
                  <Distance row={row} />
                </Table.Cell>
                <Table.Cell className={NUM}>
                  <Accuracy row={row} />
                </Table.Cell>
                <Table.Cell>
                  <MapLink row={row} />
                  <span className="block text-xs tabular-nums text-muted">{formatCoordinates(row.lat, row.lng)}</span>
                </Table.Cell>
                <Table.Cell>
                  <PhotoCell row={row} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </>
  );
}
