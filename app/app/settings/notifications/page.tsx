import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { listOrgTemplateOverrides } from '@/lib/queries/notification-templates';
import Card from '@/components/ui/Card';
import TemplateEditor from './template-editor';

export const metadata: Metadata = { title: 'Notifikasi' };

// Server Component (TRD.md §5). OWNER/ADMIN only, then further gated by the org's
// plan feature flag (features.template_override) rather than an additional role check.
export default async function NotificationSettingsPage() {
  const { orgId } = await requireSession(['OWNER', 'ADMIN']);

  const org = await getOrganizationPlanContext(orgId);
  if (!org) throw new Error('Organization not found');

  if (!org.features.template_override) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-semibold text-text">Notifikasi</h1>
        <Card className="mt-6">
          <p className="text-sm text-muted">Kustomisasi template notifikasi memerlukan paket berbayar.</p>
        </Card>
      </div>
    );
  }

  const templates = await listOrgTemplateOverrides(orgId);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-text">Notifikasi</h1>
      <p className="mt-1 text-sm text-muted">Kustomisasi isi notifikasi email dan WhatsApp untuk organisasi ini.</p>

      <div className="mt-6">
        <TemplateEditor existingTemplates={templates} />
      </div>
    </div>
  );
}
