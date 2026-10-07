'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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

const EVENT_LABELS: Record<NotificationEventTrigger, string> = {
  LATE_CHECK_IN: 'Keterlambatan',
  MISSING_CHECK_OUT: 'Lupa Check-out',
  REQUEST_SUBMITTED: 'Pengajuan Baru',
  REQUEST_REVIEWED: 'Pengajuan Direview',
  INVOICE_CREATED: 'Tagihan Baru',
  INVOICE_PAID: 'Pembayaran Diterima',
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

/**
 * Platform CMS counterpart of app/app/settings/notifications/template-editor.tsx — same
 * shape (pick a saved template below to load it, or start from EMPTY_FORM; one
 * Select-driven form upserts by eventTrigger+channel, there is no numeric id, TRD.md §6).
 * PATCHes /api/platform/notification-templates instead of the tenant route, and carries
 * no features.template_override gate (unlike the tenant page): these rows ARE the global
 * defaults every org without its own override falls back to
 * (lib/queries/notification-templates.ts, PRD.md P4).
 */
export default function TemplateForm({ existingTemplates }: TemplateFormProps) {
  const router = useRouter();
  const { show } = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function loadForEdit(template: GlobalTemplateSummary) {
    setForm({
      eventTrigger: template.eventTrigger,
      channel: template.channel,
      subject: template.subject ?? '',
      body: template.body,
    });
    setFieldErrors({});
  }

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
    <div className="flex flex-col gap-6">
      {existingTemplates.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-text">Template Tersimpan</h2>
          {existingTemplates.map((template) => (
            <button
              key={`${template.eventTrigger}:${template.channel}`}
              type="button"
              onClick={() => loadForEdit(template)}
              className="flex items-center justify-between gap-2 rounded-input border border-border bg-surface px-3 py-2 text-left text-sm text-text transition hover:bg-accent"
            >
              <span>{EVENT_LABELS[template.eventTrigger]}</span>
              <Badge className="bg-primary/10 text-primary">{CHANNEL_LABELS[template.channel]}</Badge>
            </button>
          ))}
        </div>
      ) : null}

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Select
            label="Kejadian"
            value={form.eventTrigger}
            onChange={(e) => setForm((f) => ({ ...f, eventTrigger: e.target.value as NotificationEventTrigger }))}
            options={EVENT_OPTIONS}
            error={fieldErrors.eventTrigger}
          />
          <Select
            label="Kanal"
            value={form.channel}
            onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as NotificationChannel }))}
            options={CHANNEL_OPTIONS}
            error={fieldErrors.channel}
          />
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
            hint="Placeholder {{nama}} dan sejenisnya didukung."
            rows={6}
            required
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Simpan Template
          </Button>
        </form>
      </Card>
    </div>
  );
}
