import { NextResponse } from 'next/server';
import { handleApiError, apiError } from '@/lib/api-response';
import { requireActiveSession } from '@/lib/auth';
import { fetchPrivateBlob } from '@/lib/blob';
import { isStoredFileForSubject, servedImageContentType, type StoredFileSlot } from '@/lib/stored-file';
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
      return apiError(404, 'NOT_FOUND', 'Berkas tidak ditemukan');
    }

    const isOrgWide = role === 'OWNER' || role === 'ADMIN';
    let fileUrl: string | null = null;
    let slot: StoredFileSlot | null = null;
    let subjectUserId = 0;

    if (resource === 'attendance-logs') {
      const log = await getLogByIdInOrg(orgId, id);
      if (!log) return apiError(404, 'NOT_FOUND', 'Berkas tidak ditemukan');
      const isOwner = log.userId === userId;
      const isManager = role === 'MANAGER' && log.ownerManagerId === userId;
      if (!isOrgWide && !isOwner && !isManager) return apiError(404, 'NOT_FOUND', 'Berkas tidak ditemukan');
      slot = which === 'check-in' ? 'check-in' : which === 'check-out' ? 'check-out' : null;
      fileUrl = slot === 'check-in' ? log.checkInPhotoUrl : slot === 'check-out' ? log.checkOutPhotoUrl : null;
      subjectUserId = log.userId;
    } else if (resource === 'attendance-requests' && which === 'attachment') {
      const reqRow = await getRequestWithRequesterInOrg(orgId, id);
      const isOwner = reqRow.userId === userId;
      const isManager = role === 'MANAGER' && reqRow.requesterManagerId === userId;
      if (!isOrgWide && !isOwner && !isManager) return apiError(404, 'NOT_FOUND', 'Berkas tidak ditemukan');
      slot = 'attachment';
      fileUrl = reqRow.attachmentUrl;
      subjectUserId = reqRow.userId;
    }

    // Role access proves the caller may see this row. It does not prove the stored URL
    // points at this subject's file. Refuse before the Blob token is attached.
    if (!slot || !fileUrl || !isStoredFileForSubject(fileUrl, orgId, subjectUserId, slot)) {
      return apiError(404, 'NOT_FOUND', 'Berkas tidak ditemukan');
    }

    const upstream = await fetchPrivateBlob(fileUrl);
    const contentType = servedImageContentType(upstream.headers.get('content-type'));
    if (!upstream.ok || !upstream.body || !contentType) {
      await upstream.body?.cancel();
      return apiError(404, 'NOT_FOUND', 'Berkas tidak ditemukan');
    }

    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
