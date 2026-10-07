import type { Metadata } from 'next';
import { listGlobalTemplates } from '@/lib/queries/notification-templates';
import Page from '@/components/shared/Page';
import TemplateForm from './template-form';

export const metadata: Metadata = { title: 'Template Notifikasi' };

/**
 * Server Component (TRD.md §5): calls listGlobalTemplates() directly — the same call
 * GET /api/platform/notification-templates makes. These rows (org_id IS NULL) are the
 * fallback every org falls back to when it has no override of its own
 * (lib/queries/notification-templates.ts), so unlike the tenant-side editor
 * (app/app/settings/notifications), there is no features.template_override gate here —
 * this page is what defines that global default (PRD.md P4).
 *
 * Same left-aligned header as every other /platform page (it used to be a centered
 * max-w-2xl column, the only page whose title didn't line up with the rest).
 */
export default async function NotificationTemplatesPage() {
  const templates = await listGlobalTemplates();

  return (
    <Page>
      <Page.Header
        title="Template Notifikasi"
        description="Template default untuk seluruh organisasi. Organisasi yang paketnya mendukung kustomisasi dapat menggantinya dengan template mereka sendiri."
      />
      {/* The saved list and the editor are two independently scrolling panes inside the body
          (see template-form.tsx), so neither the page nor the Save button ever scrolls away. */}
      <Page.Body>
        <TemplateForm existingTemplates={templates} />
      </Page.Body>
    </Page>
  );
}
