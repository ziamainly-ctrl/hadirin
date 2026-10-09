'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import FitPager from '@/components/shared/FitPager';
import { useToast } from '@/components/ui/Toast';
import { NOTIFICATION_EVENT_TRIGGERS } from '@/lib/constants/events';
import type { NotificationEventTrigger } from '@/lib/constants/events';
import { NOTIFICATION_CHANNELS } from '@/lib/constants/statuses';
import type { NotificationChannel } from '@/lib/constants/statuses';

export interface TemplateEditorTemplate {
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
}

export interface TemplateEditorProps {
  /** This org's own overrides. */
  existingTemplates: TemplateEditorTemplate[];
  /** Platform defaults (org_id IS NULL) — what is sent when the org has no override. */
  defaultTemplates: TemplateEditorTemplate[];
}

const EVENT_LABELS: Record<NotificationEventTrigger, string> = {
  LATE_CHECK_IN: 'Karyawan terlambat',
  MISSING_CHECK_OUT: 'Lupa check-out',
  REQUEST_SUBMITTED: 'Pengajuan baru masuk',
  REQUEST_REVIEWED: 'Pengajuan disetujui/ditolak',
  INVOICE_CREATED: 'Tagihan baru',
  INVOICE_PAID: 'Pembayaran diterima',
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
};

// The {{variables}} each event actually passes to lib/notify.ts (see the notify() call
// sites under app/api: attendance/check-in, cron/close-day, attendance-requests,
// cron/billing, payments/midtrans/notification). An unknown {{name}} renders as an
// empty string, so listing the real ones here is what keeps a template from silently
// sending blanks.
const EVENT_VARIABLES: Record<NotificationEventTrigger, { key: string; label: string }[]> = {
  LATE_CHECK_IN: [
    { key: 'employee_name', label: 'Nama karyawan' },
    { key: 'branch_name', label: 'Cabang' },
    { key: 'check_in_time', label: 'Jam check-in' },
    { key: 'late_minutes', label: 'Menit terlambat' },
    { key: 'manager_name', label: 'Nama penerima' },
  ],
  MISSING_CHECK_OUT: [
    { key: 'employee_name', label: 'Nama karyawan' },
    { key: 'work_date', label: 'Tanggal kerja' },
    { key: 'app_url', label: 'Tautan aplikasi' },
  ],
  REQUEST_SUBMITTED: [
    { key: 'employee_name', label: 'Nama karyawan' },
    { key: 'request_type', label: 'Jenis pengajuan' },
    { key: 'date_range', label: 'Tanggal' },
    { key: 'reason', label: 'Alasan' },
    { key: 'manager_name', label: 'Nama penerima' },
  ],
  REQUEST_REVIEWED: [
    { key: 'request_type', label: 'Jenis pengajuan' },
    { key: 'date_range', label: 'Tanggal' },
    { key: 'status_label', label: 'Hasil (disetujui/ditolak)' },
    { key: 'reviewer_name', label: 'Nama peninjau' },
    { key: 'review_note', label: 'Catatan peninjau' },
  ],
  INVOICE_CREATED: [
    { key: 'invoice_code', label: 'Kode tagihan' },
    { key: 'plan_name', label: 'Nama paket' },
    { key: 'period', label: 'Periode' },
    { key: 'total_amount', label: 'Total' },
    { key: 'due_date', label: 'Jatuh tempo' },
    { key: 'pay_url', label: 'Tautan bayar' },
  ],
  INVOICE_PAID: [
    { key: 'invoice_code', label: 'Kode tagihan' },
    { key: 'total_amount', label: 'Total' },
    { key: 'payment_method', label: 'Metode bayar' },
    { key: 'plan_expires_at', label: 'Paket berlaku sampai' },
  ],
};

const EVENT_OPTIONS = NOTIFICATION_EVENT_TRIGGERS.map((value) => ({ value, label: EVENT_LABELS[value] }));
const CHANNEL_OPTIONS = NOTIFICATION_CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] }));

interface FormState {
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  subject: string;
  body: string;
}

function findTemplate(
  templates: TemplateEditorTemplate[],
  eventTrigger: NotificationEventTrigger,
  channel: NotificationChannel,
): TemplateEditorTemplate | undefined {
  return templates.find((t) => t.eventTrigger === eventTrigger && t.channel === channel);
}

// Client leaf: upserts via PATCH /api/notification-templates, keyed by (eventTrigger,
// channel) — there is no numeric id (TRD.md §6), so "editing" is just re-submitting
// the same pair with a new subject/body. No delete: this resource is upsert-only.
export default function TemplateEditor({ existingTemplates, defaultTemplates }: TemplateEditorProps) {
  const router = useRouter();
  const { show } = useToast();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Picking an event/channel pair always shows what is sent today: the org's own
  // override if there is one, else the platform default as a starting point. It used
  // to open blank, so the admin wrote from scratch without knowing the current text.
  function formFor(eventTrigger: NotificationEventTrigger, channel: NotificationChannel): FormState {
    const source = findTemplate(existingTemplates, eventTrigger, channel) ?? findTemplate(defaultTemplates, eventTrigger, channel);
    return { eventTrigger, channel, subject: source?.subject ?? '', body: source?.body ?? '' };
  }

  const [form, setForm] = useState<FormState>(() => formFor('LATE_CHECK_IN', 'EMAIL'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasOverride = Boolean(findTemplate(existingTemplates, form.eventTrigger, form.channel));

  function selectPair(eventTrigger: NotificationEventTrigger, channel: NotificationChannel) {
    setForm(formFor(eventTrigger, channel));
    setFieldErrors({});
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? form.body.length;
    const end = el?.selectionEnd ?? form.body.length;
    const next = form.body.slice(0, start) + token + form.body.slice(end);
    setForm((f) => ({ ...f, body: next }));
    // Put the caret right after the inserted token once React has re-rendered.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await fetch('/api/notification-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventTrigger: form.eventTrigger,
          channel: form.channel,
          subject: form.channel === 'EMAIL' ? form.subject : undefined,
          body: form.body,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        show(json.error?.message ?? 'Gagal menyimpan template.', 'error');
        return;
      }
      show('Template notifikasi disimpan.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // One set of "insert variable" chips, rendered in two places: inside the form below lg (right
  // under the text box they act on) and in the side column from lg up.
  const variableChips = (
    <div className="flex flex-wrap gap-2">
      {EVENT_VARIABLES[form.eventTrigger].map((variable) => (
        <Button
          key={variable.key}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertVariable(variable.key)}
          title={`{{${variable.key}}}`}
        >
          {variable.label}
        </Button>
      ))}
    </div>
  );

  // lg: the form takes the left column and grows its text box to the available height; the side
  // column (data to insert, templates already changed) scrolls on its own. That keeps the page
  // inside one viewport on desktop (TRD.md §14). Below lg everything stacks and the page scrolls.
  // `contents` on the aside lets its children join the mobile stack as separate blocks, ahead
  // of the form, exactly as the page always ordered them.
  return (
    <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_16rem] lg:grid-rows-[minmax(0,1fr)]">
      <aside className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col lg:gap-4 fit-gap">
        <Card className="hidden shrink-0 lg:block">
          <h2 className="text-sm font-semibold text-text">Data Otomatis</h2>
          <p className="fit-hide-short mb-3 mt-1 text-pretty text-sm text-muted">Ketuk untuk menyisipkannya ke isi pesan.</p>
          {variableChips}
        </Card>

        {existingTemplates.length > 0 ? (
          <section className="flex flex-col gap-2 lg:min-h-0 lg:flex-1" aria-labelledby="saved-templates-title">
            <div className="shrink-0">
              <h2 id="saved-templates-title" className="text-sm font-semibold text-text">
                Template yang Sudah Diubah
              </h2>
              <p className="fit-hide-short text-pretty text-sm text-muted">Pilih salah satu untuk membukanya lagi.</p>
            </div>
            {/* Desktop: paginated to the room left under "Data Otomatis" (FitPager), so the side column never scrolls. */}
            <FitPager label="Template yang sudah diubah" noun="template" className="flex flex-col gap-2 fit-gap" frameClassName="lg:min-h-0 lg:flex-1">
              {existingTemplates.map((template) => {
                const isSelected = template.eventTrigger === form.eventTrigger && template.channel === form.channel;
                return (
                  <button
                    key={`${template.eventTrigger}:${template.channel}`}
                    type="button"
                    onClick={() => selectPair(template.eventTrigger, template.channel)}
                    aria-pressed={isSelected}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-input border bg-surface px-3 py-2 text-left text-sm text-text transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${isSelected ? 'border-primary' : 'border-border'}`}
                  >
                    <span className="min-w-0">{EVENT_LABELS[template.eventTrigger]}</span>
                    <Badge tone="neutral" dot={false}>
                      {CHANNEL_LABELS[template.channel]}
                    </Badge>
                  </button>
                );
              })}
            </FitPager>
          </section>
        ) : null}
      </aside>

      <Card className="flex flex-col lg:col-start-1 lg:row-start-1 lg:min-h-0 lg:max-h-[46rem]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Kejadian"
              value={form.eventTrigger}
              onChange={(e) => selectPair(e.target.value as NotificationEventTrigger, form.channel)}
              options={EVENT_OPTIONS}
              error={fieldErrors.eventTrigger}
            />
            <Select
              label="Kanal"
              value={form.channel}
              onChange={(e) => selectPair(form.eventTrigger, e.target.value as NotificationChannel)}
              options={CHANNEL_OPTIONS}
              error={fieldErrors.channel}
            />
          </div>
          <p className="-mt-2 text-sm text-muted">
            {hasOverride
              ? 'Organisasi Anda sudah memakai template sendiri untuk kejadian dan kanal ini.'
              : 'Saat ini memakai template bawaan Hadirin. Ubah lalu simpan untuk memakai versi Anda sendiri.'}
          </p>
          {form.channel === 'EMAIL' ? (
            <Input
              label="Subjek"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              error={fieldErrors.subject}
              maxLength={200}
            />
          ) : null}
          {/* Plain Textarea rather than the Tiptap rich-text editor dependency
             (TRD.md §3) — deliberate scope simplification; WhatsApp bodies are plain
             text anyway, so only EMAIL would ever benefit from rich formatting. From lg the
             Textarea's own wrapper and the textarea grow to fill the card (min 80px). */}
          <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:[&>div]:min-h-0 lg:[&>div]:flex-1 lg:[&_textarea]:min-h-20 lg:[&_textarea]:flex-1 lg:[&_textarea]:resize-none">
            <Textarea
              ref={bodyRef}
              label="Isi Pesan"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              error={fieldErrors.body}
              hint={
                form.channel === 'EMAIL' ? 'Email boleh memakai tag HTML sederhana, misalnya <p> dan <strong>.' : undefined
              }
              rows={8}
              required
            />
          </div>
          <div className="-mt-2 flex flex-col gap-2 lg:hidden">
            <p className="text-sm text-muted">Sisipkan data otomatis — ketuk untuk menambahkannya ke isi pesan:</p>
            {variableChips}
          </div>
          <div className="flex border-t border-border pt-4">
            <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
              Simpan Template
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
