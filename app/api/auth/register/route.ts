import { z } from 'zod';
import { apiCreated, apiError, handleApiError } from '@/lib/api-response';
import { setSessionCookie, hashPassword } from '@/lib/auth';
import { withTx } from '@/lib/db';
import { nameSchema, emailSchema, passwordSchema } from '@/lib/validators/common';
import { slugify } from '@/lib/slug';
import { getPlanByCode } from '@/lib/queries/plans';
import { getOrganizationBySlug, insertOrganizationTx } from '@/lib/queries/organizations';
import { insertUserTx } from '@/lib/queries/users';
import { registerRatelimit } from '@/lib/redis';

const bodySchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

const TRIAL_DAYS = 14;

// PRD.md US-07 / S3 — creates an org on STARTER TRIAL + its OWNER, in one transaction
// (TRD.md §6), then logs the owner straight in.
export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { success } = await registerRatelimit.limit(ip);
    if (!success) return apiError(429, 'RATE_LIMITED', 'Too many signups from this network. Try again later.');

    const body = bodySchema.parse(await request.json());

    const plan = await getPlanByCode('STARTER');
    if (!plan) return apiError(500, 'INTERNAL_ERROR', 'Starter plan is not configured.');

    const baseSlug = slugify(body.companyName) || 'org';
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5 && (await getOrganizationBySlug(slug)); attempt++) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const passwordHash = await hashPassword(body.password);

    const { organization, user } = await withTx(async (client) => {
      const organization = await insertOrganizationTx(client, {
        planId: plan.id,
        name: body.companyName,
        slug,
        trialEndsAt,
      });
      const user = await insertUserTx(client, {
        orgId: organization.id,
        branchId: null,
        shiftId: null,
        managerId: null,
        employeeCode: null,
        name: body.name,
        email: body.email,
        phone: null,
        passwordHash,
        role: 'OWNER',
        position: null,
        joinedAt: new Date().toISOString().slice(0, 10),
      });
      return { organization, user };
    });

    await setSessionCookie({ kind: 'user', sub: user.id, org: organization.id, role: user.role });

    return apiCreated({ organization, user });
  } catch (error) {
    return handleApiError(error);
  }
}
