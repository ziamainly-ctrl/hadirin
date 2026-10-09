import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import { requirePageRole } from '@/lib/page-guard';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { listGlobalTemplates, listOrgTemplateOverrides } from '@/lib/queries/notification-templates';
import type { NotificationTemplate } from '@/lib/queries/notification-templates';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/shared/EmptyState';
import Page from '@/components/shared/Page';
import TemplateEditor from './template-editor';
import type { TemplateEditorTemplate } from './template-editor';

export const metadata: Metadata = { title: 'Notifikasi' };

// Only the fields the editor needs cross into the client bundle.
function toEditorTemplate(template: NotificationTemplate): TemplateEditorTemplate {
  return {
    eventTrigger: template.eventTrigger,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
  };
}

// Server Component (TRD.md §5). OWNER/ADMIN only, then further gated by the org's
// plan feature flag (features.template_override) rather than an additional role check.
export default async function NotificationSettingsPage() {
  const { orgId } = await requirePageRole(['OWNER', 'ADMIN']);

  const org = await getOrganizationPlanContext(orgId);
  if (!org) throw new Error('Organization not found');

  const header = (
    <Page.Header
      title="Notifikasi"
      description="Sesuaikan isi pesan email dan WhatsApp yang dikirim ke tim Anda."
    />
  );

  if (!org.features.template_override) {
    return (
      <Page>
        {header}
        <Page.Body>
          <Card>
            {/* A next step instead of a dead end: the plans page shows which tier unlocks this. */}
            <EmptyState
              icon={Lock}
              message={`Paket ${org.planName} memakai template notifikasi bawaan Hadirin. Mengubah isi pesan tersedia di paket yang lebih tinggi.`}
              action={
                <ButtonLink href="/pricing" variant="outline">
                  Lihat Paket
                </ButtonLink>
              }
            />
          </Card>
        </Page.Body>
      </Page>
    );
  }

  const [templates, defaults] = await Promise.all([listOrgTemplateOverrides(orgId), listGlobalTemplates()]);

  return (
    <Page>
      {header}
      <Page.Body>
        <TemplateEditor
          existingTemplates={templates.map(toEditorTemplate)}
          defaultTemplates={defaults.filter((t) => t.isActive).map(toEditorTemplate)}
        />
      </Page.Body>
    </Page>
  );
}
