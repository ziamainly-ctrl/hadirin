import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Mail, MessageCircle, ScrollText } from 'lucide-react';
import { requireSession } from '@/lib/auth';
import { ORG_WIDE_ROLES } from '@/lib/constants/roles';
import { getNotificationStatusCounts, listNotificationFeed } from '@/lib/queries/notification-log-feed';
import type { NotificationFeedRow } from '@/lib/queries/notification-log-feed';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import type { NotificationLogStatus } from '@/lib/constants/statuses';
import { describeNotificationFailure } from '@/lib/insights/notification-failure';
import { maskRecipient } from '@/lib/insights/mask';
import Badge from '@/components/ui/Badge';
import ButtonLink from '@/components/ui/ButtonLink';
import Pagination from '@/components/ui/Pagination';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/shared/EmptyState';
import LinkTabs from '@/components/shared/LinkTabs';
import Page from '@/components/shared/Page';
import { CHANNEL_LABELS, eventLabel } from './labels';

export const metadata: Metadata = { title: 'Log Notifikasi' };

// One server chunk; the client fit pager (components/shared/FitPager) splits it into screen-sized pages.
const PAGE_SIZE = 100;

interface NotificationLogPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type StatusFilter = Extract<NotificationLogStatus, 'SENT' | 'FAILED'>;

function parseStatus(value: string | undefined): StatusFilter | undefined {
  return value === 'SENT' || value === 'FAILED' ? value : undefined;
}

function logHref(status: StatusFilter | undefined): string {
  return status ? `/app/log-notifikasi?status=${status}` : '/app/log-notifikasi';
}

function formatWhen(iso: string, timeZone: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/**
 * What the organization has sent (OWNER, ADMIN): channel, event, recipient, outcome. The raw
 * `error` text of a failed send is infrastructure detail (an SMTP host and port, a gateway
 * message), so it never reaches this page's output: lib/insights/notification-failure.ts turns it
 * into a short reason first. Recipients are shown by name plus a masked address or number.
 */
export default async function NotificationLogPage({ searchParams }: NotificationLogPageProps) {
  // OWNER and ADMIN only. Any other role (a MANAGER who typed the URL) goes to the dashboard instead of
  // an error page; nothing below runs before this check.
  const { orgId, role } = await requireSession();
  if (!ORG_WIDE_ROLES.includes(role)) redirect('/app');
  const params = await searchParams;
  const status = parseStatus(firstValue(params.status));
  const page = Math.max(1, Math.floor(Number(firstValue(params.page))) || 1);

  const [org, counts] = await Promise.all([getOrganizationPlanContext(orgId), getNotificationStatusCounts(orgId)]);
  const timeZone = org?.timezone ?? 'Asia/Jakarta';
  const matching = status === 'SENT' ? counts.sent : status === 'FAILED' ? counts.failed : counts.total;

  // A page past the end (a stale bookmark, or the filter shrank the list): go to the last real page.
  const lastPage = Math.max(1, Math.ceil(matching / PAGE_SIZE));
  if (page > lastPage) {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (lastPage > 1) query.set('page', String(lastPage));
    const queryString = query.toString();
    redirect(queryString ? `/app/log-notifikasi?${queryString}` : '/app/log-notifikasi');
  }

  const rows = matching === 0 ? [] : await listNotificationFeed(orgId, { status, page, pageSize: PAGE_SIZE });
  const sendsAlerts = Boolean(org?.features.email_alerts || org?.features.whatsapp_alerts);

  const tabs: ReadonlyArray<{ label: string; value: StatusFilter | undefined; count: number }> = [
    { label: 'Semua', value: undefined, count: counts.total },
    { label: 'Terkirim', value: 'SENT', count: counts.sent },
    { label: 'Gagal', value: 'FAILED', count: counts.failed },
  ];

  return (
    <Page>
      <Page.Header
        title="Log Notifikasi"
        description="Riwayat email dan WhatsApp yang dikirim Hadirin atas nama organisasi Anda, lengkap dengan hasil pengirimannya."
      />

      <Page.Toolbar>
        <LinkTabs
          aria-label="Filter status"
          activeKey={status ?? 'ALL'}
          items={tabs.map((tab) => ({ key: tab.value ?? 'ALL', label: tab.label, href: logHref(tab.value), count: tab.count }))}
        />
      </Page.Toolbar>

      <Page.Body>
        {counts.total === 0 ? (
          sendsAlerts ? (
            <EmptyState
              icon={ScrollText}
              message="Belum ada notifikasi terkirim. Notifikasi pertama muncul saat ada karyawan terlambat, pengajuan baru, atau tagihan."
              action={
                <ButtonLink href="/app/settings/notifications" variant="outline">
                  Atur Notifikasi
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              icon={ScrollText}
              message={`Paket ${org?.planName ?? 'Anda'} tidak mengirim notifikasi email atau WhatsApp, jadi log ini kosong. Naikkan paket untuk mendapat pemberitahuan keterlambatan dan pengajuan.`}
              action={
                <ButtonLink href="/app/settings/billing" variant="outline">
                  Lihat Paket
                </ButtonLink>
              }
            />
          )
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            message="Tidak ada notifikasi dengan status ini. Pilih Semua untuk melihat seluruh riwayat."
            action={
              <ButtonLink href="/app/log-notifikasi" variant="outline">
                Tampilkan Semua
              </ButtonLink>
            }
          />
        ) : (
          <>
            <FeedList rows={rows} timeZone={timeZone} />
            <div className="hidden min-h-0 flex-col sm:flex">
              <Table aria-label="Riwayat notifikasi">
                <Table.Head>
                  <Table.Row>
                    <Table.HeadCell>Waktu</Table.HeadCell>
                    <Table.HeadCell>Peristiwa</Table.HeadCell>
                    <Table.HeadCell priority={1}>Penerima</Table.HeadCell>
                    <Table.HeadCell priority={2}>Saluran</Table.HeadCell>
                    <Table.HeadCell>Hasil</Table.HeadCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {rows.map((row) => {
                    const failure = row.status === 'FAILED' ? describeNotificationFailure(row.error) : null;
                    return (
                      <Table.Row key={row.id}>
                        <Table.Cell className="tabular-nums">{formatWhen(row.createdAt, timeZone)}</Table.Cell>
                        <Table.Cell>{eventLabel(row.eventTrigger)}</Table.Cell>
                        <Table.Cell>
                          <span className="block max-w-56 truncate font-medium" title={row.userName ?? undefined}>
                            {row.userName ?? 'Penerima dihapus'}
                          </span>
                          <span className="block text-xs text-muted">{maskRecipient(row.channel, row.recipient)}</span>
                        </Table.Cell>
                        <Table.Cell>
                          <ChannelChip channel={row.channel} />
                        </Table.Cell>
                        <Table.Cell wrap className="min-w-48" title={failure?.hint}>
                          <StatusCell status={row.status} reason={failure?.reason ?? null} />
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table>
            </div>
            {counts.failed > 0 && status !== 'SENT' ? (
              <p className="shrink-0 text-xs text-muted">
                Pesan yang gagal tidak dikirim ulang otomatis. Periksa kontak penerima di halaman Karyawan; masalah di sisi layanan
                pengiriman ditangani Hadirin.
              </p>
            ) : null}
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={matching}
              basePath="/app/log-notifikasi"
              searchParams={{ status }}
              className="shrink-0"
            />
          </>
        )}
      </Page.Body>
    </Page>
  );
}

function ChannelChip({ channel }: { channel: NotificationFeedRow['channel'] }) {
  const Icon = channel === 'EMAIL' ? Mail : MessageCircle;
  return (
    <Badge dot={false} className="gap-1.5 border border-border bg-accent text-text">
      <Icon className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
      {CHANNEL_LABELS[channel] ?? channel}
    </Badge>
  );
}

// A failed row is the same neutral row with red text (never a red panel): the word "Gagal" and the
// reason carry it, the dot is only a hint.
function StatusCell({ status, reason }: { status: NotificationFeedRow['status']; reason: string | null }) {
  if (status === 'FAILED') {
    return (
      <div className="flex flex-col gap-1">
        {/* Not tone="danger": that chip pins text-text and a second text color class would tie with it. */}
        <Badge className="gap-1.5 border border-border bg-accent text-destructive">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
          Gagal terkirim
        </Badge>
        {reason ? <span className="text-xs text-destructive">{reason}</span> : null}
      </div>
    );
  }
  if (status === 'SENT') return <Badge tone="success">Terkirim</Badge>;
  return <Badge tone="neutral">Dalam antrean</Badge>;
}

// Phones: five columns do not fit 360px, so each message is a small card.
function FeedList({ rows, timeZone }: { rows: NotificationFeedRow[]; timeZone: string }) {
  return (
    <ul className="divide-y divide-border rounded-card border border-border bg-surface sm:hidden" aria-label="Riwayat notifikasi">
      {rows.map((row) => {
        const failure = row.status === 'FAILED' ? describeNotificationFailure(row.error) : null;
        return (
          <li key={row.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-text">{eventLabel(row.eventTrigger)}</p>
                <p className="text-xs tabular-nums text-muted">{formatWhen(row.createdAt, timeZone)}</p>
              </div>
              <StatusCell status={row.status} reason={null} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 text-text">
                <span className="break-words font-medium">{row.userName ?? 'Penerima dihapus'}</span>
                <span className="block text-xs text-muted">{maskRecipient(row.channel, row.recipient)}</span>
              </p>
              <ChannelChip channel={row.channel} />
            </div>
            {failure ? (
              <p className="text-xs text-destructive">
                {failure.reason}. <span className="text-muted">{failure.hint}</span>
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
