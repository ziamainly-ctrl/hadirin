import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Page from '@/components/shared/Page';
import RequestForm from './request-form';

export const metadata: Metadata = { title: 'Ajukan Baru' };

// Thin Server Component shell (TRD.md R1) — all state and the POST live in the client
// component below it. The back link mirrors app/app/employees/[id]'s "Kembali ke …" link
// (the tab bar has no "back"); h-10 so it is a real touch target on a phone. The link and the
// title stay fixed while the form scrolls inside the phone column on a short desktop window.
export default function NewRequestPage() {
  return (
    <Page>
      {/* On a short desktop window the back link moves up beside the title (one row instead of
          two), which is what lets the whole form fit without scrolling. */}
      <div className="flex shrink-0 flex-col gap-1 [@media(min-width:1024px)_and_(max-height:860px)]:flex-row-reverse [@media(min-width:1024px)_and_(max-height:860px)]:items-center [@media(min-width:1024px)_and_(max-height:860px)]:justify-between [@media(min-width:1024px)_and_(max-height:860px)]:gap-4">
        <Link
          href="/m/requests"
          className="inline-flex h-10 w-fit items-center gap-1.5 rounded-input text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke Pengajuan
        </Link>
        <Page.Header
          title="Ajukan Baru"
          description="Atasan Anda akan meninjau pengajuan ini."
        />
      </div>
      <Page.Body>
        <RequestForm />
      </Page.Body>
    </Page>
  );
}
