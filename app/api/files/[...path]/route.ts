import { NextResponse } from 'next/server';
import { handleApiError, apiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { fetchPrivateBlob } from '@/lib/blob';
import { getLogByIdInOrg } from '@/lib/queries/attendance';
import { getRequestWithRequesterInOrg } from '@/lib/queries/attendance-requests';

// Streams a private Blob file after a role + tenant check (TRD.md §15, AGENTS.md domain
// rule: no direct Blob URLs anywhere in the client — only this authenticated proxy).
// /api/files/attendance-logs/:id/check-in|check-out
// /api/files/attendance-requests/:id/attachment
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { userId, orgId, role } = await requireActiveSession();
    const [resource, idStr, which] = (await params).path;
    const id = Number(idStr);
    if (!resource || !Number.isInteger(id) || id <= 0 || !which) {
      return apiError(404, 'NOT_FOUND', 'File not found');
    }

    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    let fileUrl: string | null = null;

    if (resource === 'attendance-logs') {
      const log = await getLogByIdInOrg(orgId, id);
      if (!log) return apiError(404, 'NOT_FOUND', 'File not found');
      const isOwner = log.userId === userId;
      const isManager = role === 'MANAGER' && log.ownerManagerId === userId;
      if (!isOrgWide && !isOwner && !isManager) return apiError(404, 'NOT_FOUND', 'File not found');
      fileUrl = which === 'check-in' ? log.checkInPhotoUrl : which === 'check-out' ? log.checkOutPhotoUrl : null;
    } else if (resource === 'attendance-requests' && which === 'attachment') {
      const reqRow = await getRequestWithRequesterInOrg(orgId, id);
      const isOwner = reqRow.userId === userId;
      const isManager = role === 'MANAGER' && reqRow.requesterManagerId === userId;
      if (!isOrgWide && !isOwner && !isManager) return apiError(404, 'NOT_FOUND', 'File not found');
      fileUrl = reqRow.attachmentUrl;
    }

    if (!fileUrl) return apiError(404, 'NOT_FOUND', 'File not found');

    const upstream = await fetchPrivateBlob(fileUrl);
    if (!upstream.ok || !upstream.body) return apiError(404, 'NOT_FOUND', 'File not found');

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
