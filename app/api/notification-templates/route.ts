import { apiOk, apiError, handleApiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { upsertTemplateSchema } from '@/lib/validators/notification-templates';
import { getOrganizationPlanContext } from '@/lib/queries/organizations';
import { listOrgTemplateOverrides, upsertOrgTemplateOverride } from '@/lib/queries/notification-templates';

// GET/PATCH /api/notification-templates — TRD.md §6, tenant override CRUD gated on
// `features.template_override` (paid plans only; ERD.md §1.1 plans seed). PATCH is
// really an upsert: upsertOrgTemplateOverride() keys the create-or-replace on
// (eventTrigger, channel) via uq_notif_tpl_scope, not a numeric id, so this model has
// no [id] route.

// GET — this org's template overrides (`/app/settings/notifications`).
export async function GET() {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);

    const org = await getOrganizationPlanContext(orgId);
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');
    if (!org.features.template_override) {
      return apiError(403, 'PLAN_UPGRADE_REQUIRED', 'Custom notification templates require a paid plan.');
    }

    const templates = await listOrgTemplateOverrides(orgId);
    return apiOk({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH { eventTrigger, channel, subject?, body } — create-or-replace this org's
// override for that event+channel. No cache bust here: TRD.md §10's
// `tpl:{org}:{event}:{channel}` key isn't wired up anywhere yet (lib/notify.ts calls
// getEffectiveTemplate() directly, uncached), so there is nothing to invalidate.
export async function PATCH(request: Request) {
  try {
    const { orgId } = await requireActiveSession(['OWNER', 'ADMIN']);

    const org = await getOrganizationPlanContext(orgId);
    if (!org) return apiError(500, 'INTERNAL_ERROR', 'Organization not found.');
    if (!org.features.template_override) {
      return apiError(403, 'PLAN_UPGRADE_REQUIRED', 'Custom notification templates require a paid plan.');
    }

    const body = upsertTemplateSchema.parse(await request.json());
    const template = await upsertOrgTemplateOverride(orgId, body);

    return apiOk({ template });
  } catch (error) {
    return handleApiError(error);
  }
}
