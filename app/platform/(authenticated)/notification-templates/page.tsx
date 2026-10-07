import type { Metadata } from 'next';
import { listGlobalTemplates } from '@/lib/queries/notification-templates';
import TemplateForm from './template-form';

export const metadata: Metadata = { title: 'Template Notifikasi' };

/**
 * Server Component (TRD.md §5): calls listGlobalTemplates() directly — the same call
 * GET /api/platform/notification-templates makes. These rows (org_id IS NULL) are the
 * fallback every org falls back to when it has no override of its own
 * (lib/queries/notification-templates.ts), so unlike the tenant-side editor
 * (app/app/settings/notifications), there is no features.template_override gate here —
 * this page is what defines that global default (PRD.md P4).
 */
export default async function NotificationTemplatesPage() {
  const templates = await listGlobalTemplates();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-text">Template Notifikasi</h1>
      <p className="mt-1 text-sm text-muted">
        Kelola template notifikasi default untuk seluruh organisasi. Organisasi dengan paket yang mendukung
        kustomisasi dapat menimpa template ini dengan template mereka sendiri.
      </p>

      <div className="mt-6">
        <TemplateForm existingTemplates={templates} />
      </div>
    </div>
  );
}
