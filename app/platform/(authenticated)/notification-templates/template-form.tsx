'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import FitPager from '@/components/shared/FitPager';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { NOTIFICATION_EVENT_TRIGGERS } from '@/lib/constants/events';
import type { NotificationEventTrigger } from '@/lib/constants/events';
import { NOTIFICATION_CHANNELS } from '@/lib/constants/statuses';
import type { NotificationChannel } from '@/lib/constants/statuses';

export interface GlobalTemplateSummary {
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
}

export interface TemplateFormProps {
  existingTemplates: GlobalTemplateSummary[];
}

// Same wording as the tenant editor (app/app/settings/notifications/template-editor.tsx),
// so an event has one name on both sides; "Pengajuan Direview" also mixed in English.
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

const EVENT_OPTIONS = NOTIFICATION_EVENT_TRIGGERS.map((value) => ({ value, label: EVENT_LABELS[value] }));
const CHANNEL_OPTIONS = NOTIFICATION_CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] }));

interface FormState {
  eventTrigger: NotificationEventTrigger;
  channel: NotificationChannel;
  subject: string;
  body: string;
}

const EMPTY_FORM: FormState = { eventTrigger: 'LATE_CHECK_IN', channel: 'EMAIL', subject: '', body: '' };

function toFormState(template: GlobalTemplateSummary): FormState {
  return {
    eventTrigger: template.eventTrigger,
    channel: template.channel,
    subject: template.subject ?? '',
    body: template.body,
  };
}

/**
 * Platform CMS counterpart of app/app/settings/notifications/template-editor.tsx — same
 * shape (pick a saved template below to load it, or start from EMPTY_FORM; one
 * Select-driven form upserts by eventTrigger+channel, there is no numeric id, TRD.md §6).
 * PATCHes /api/platform/notification-templates instead of the tenant route, and carries
 * no features.template_override gate (unlike the tenant page): these rows ARE the global
 * defaults every org without its own override falls back to
 * (lib/queries/notification-templates.ts, PRD.md P4).
 */
// The list follows the event order of the Kejadian select (then Email before WhatsApp)
// instead of DB insertion order, so both channels of one event sit next to each other.
function sortTemplates(templates: GlobalTemplateSummary[]): GlobalTemplateSummary[] {
  const rank = (t: GlobalTemplateSummary) =>
    NOTIFICATION_EVENT_TRIGGERS.indexOf(t.eventTrigger) * 10 + NOTIFICATION_CHANNELS.indexOf(t.channel);
  return [...templates].sort((a, b) => rank(a) - rank(b));
}

export default function TemplateForm({ existingTemplates: unsortedTemplates }: TemplateFormProps) {
  const existingTemplates = sortTemplates(unsortedTemplates);
  const router = useRouter();
  const { show } = useToast();
  // Start on the first saved template, not a blank form: EMPTY_FORM's event+channel pair
  // (Keterlambatan · Email) already exists, so a blank start showed that row as selected
  // while its subject and body looked empty.
  const [form, setForm] = useState<FormState>(() => (existingTemplates[0] ? toFormState(existingTemplates[0]) : EMPTY_FORM));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const editorRef = useRef<HTMLDivElement>(null);

  // Picking an event or channel that already has a template loads its saved text, so the
  // form always shows what "Simpan" is about to overwrite. A new pair keeps whatever has
  // been typed, to start the new template from it.
  function selectPair(eventTrigger: NotificationEventTrigger, channel: NotificationChannel) {
    const existing = existingTemplates.find((t) => t.eventTrigger === eventTrigger && t.channel === channel);
    setForm((f) => (existing ? toFormState(existing) : { ...f, eventTrigger, channel }));
    setFieldErrors({});
  }

  function loadForEdit(template: GlobalTemplateSummary) {
    setForm(toFormState(template));
    setFieldErrors({});
    // Below lg the editor sits under the list: without this, tapping a template changed
    // a form that was off-screen and nothing on screen seemed to happen.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // The list item whose event+channel the form currently points at — saving upserts on
  // exactly that pair, so this is the row that will be overwritten.
  const selectedKey = `${form.eventTrigger}:${form.channel}`;
  const existsAlready = existingTemplates.some((t) => `${t.eventTrigger}:${t.channel}` === selectedKey);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFieldErrors({});
    try {
      const res = await fetch('/api/platform/notification-templates', {
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
      show('Template default berhasil disimpan.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    // Two panes from lg, both bound to the page body's height: the saved list on the left
    // scrolls inside itself, the editor card on the right keeps its Save button in view (its
    // textarea gives up height first). Stacked on smaller screens, where the page scrolls.
    <div className="grid gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)]">
      <section className="flex min-w-0 flex-col gap-2 lg:min-h-0" aria-labelledby="saved-templates-heading">
        <h2 id="saved-templates-heading" className="text-base font-semibold text-text">
          Template Tersimpan
        </h2>
        {existingTemplates.length > 0 ? (
          <>
            <p className="text-sm text-muted">Pilih salah satu untuk mengubahnya.</p>
            {/* Desktop: paginated to the height of the pane (FitPager); -m-1 + p-1 keep the focus ring of
                an edge item from being clipped by the pager's own overflow box. */}
            <FitPager
              as="ul"
              label="Template tersimpan"
              noun="template"
              className="flex flex-col gap-2 fit-gap lg:-m-1 lg:p-1"
              frameClassName="lg:min-h-0 lg:flex-1"
            >
              {existingTemplates.map((template) => {
                const key = `${template.eventTrigger}:${template.channel}`;
                const selected = key === selectedKey;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => loadForEdit(template)}
                      aria-pressed={selected}
                      className={`flex min-h-11 w-full items-center justify-between lg:min-h-10 lg:pointer-coarse:min-h-11 gap-2 rounded-input border px-3 py-2 text-left text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                        selected ? 'border-primary bg-accent font-medium' : 'border-border bg-surface hover:bg-accent'
                      }`}
                    >
                      <span className="min-w-0 truncate">{EVENT_LABELS[template.eventTrigger]}</span>
                      <Badge tone="neutral" dot={false} className="shrink-0">
                        {CHANNEL_LABELS[template.channel]}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </FitPager>
          </>
        ) : (
          <p className="text-sm text-muted">Belum ada template. Buat yang pertama lewat formulir ini.</p>
        )}
      </section>

      <div ref={editorRef} className="flex min-w-0 scroll-mt-20 flex-col lg:min-h-0">
        <Card className="flex min-h-0 flex-col lg:max-h-full lg:overflow-y-auto">
          <Card.Header>
            <h2 className="text-base font-semibold text-text">{existsAlready ? 'Ubah Template' : 'Template Baru'}</h2>
          </Card.Header>
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
            {form.channel === 'EMAIL' ? (
              <Input
                label="Subjek"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                error={fieldErrors.subject}
                maxLength={200}
              />
            ) : null}
            <Textarea
              label="Isi Pesan"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              error={fieldErrors.body}
              // The old hint named {{nama}}, which no template actually uses — the real
              // placeholders are English snake_case keys (db/seed.sql, lib/notify.ts).
              hint="Teks dalam {{...}}, misalnya {{employee_name}}, otomatis diganti dengan data asli saat pesan dikirim."
              rows={8}
              wrapperClassName="lg:min-h-0 lg:flex-auto"
              className="min-h-28 font-mono leading-relaxed lg:flex-auto [@media(min-width:1024px)_and_(max-height:700px)]:min-h-16"
              required
            />
            <Button type="submit" isLoading={isSubmitting} className="self-start">
              Simpan Template
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
