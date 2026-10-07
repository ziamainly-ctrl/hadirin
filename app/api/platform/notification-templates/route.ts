import { apiOk, handleApiError } from '@/lib/api-response';
import { requirePlatformSession } from '@/lib/auth';
import { upsertTemplateSchema } from '@/lib/validators/notification-templates';
import { listGlobalTemplates, upsertGlobalTemplate } from '@/lib/queries/notification-templates';

// GET /api/platform/notification-templates — platform CMS listing of every global
// default template (org_id IS NULL). Resolution order is "org override -> global
// default" (lib/queries/notification-templates.ts) — these rows are the fallback
// every org falls back to when it has no override of its own.
export async function GET() {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const templates = await listGlobalTemplates();
    return apiOk({ templates });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/platform/notification-templates — upsert the global default for one
// event+channel. Identified by {eventTrigger, channel}, not a numeric id — same
// non-numeric-id shape as the tenant override route, so no [id] file here either.
// No cache-bust: TRD.md §10's tpl:* cache isn't wired up anywhere yet (same
// already-identified gap as the tenant-side override route).
export async function PATCH(request: Request) {
  try {
    await requirePlatformSession(['SUPERADMIN']);
    const body = upsertTemplateSchema.parse(await request.json());

    const template = await upsertGlobalTemplate(body);
    return apiOk({ template });
  } catch (error) {
    return handleApiError(error);
  }
}
