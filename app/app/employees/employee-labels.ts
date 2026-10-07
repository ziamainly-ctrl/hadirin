import type { UserRole } from '@/lib/constants/roles';
import type { UserStatus } from '@/lib/constants/statuses';

// Role is not an attendance status (StatusBadge.tsx is reserved for AttendanceStatus),
// so it gets its own small label map — same pattern as RequestCard.tsx's local
// TYPE_LABELS. Shared by the list, the detail page and the form dialog (the chips
// themselves live in user-status-badge.tsx) so the three can't label the same role
// differently.
export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Pemilik',
  ADMIN: 'Admin',
  MANAGER: 'Manajer',
  EMPLOYEE: 'Karyawan',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Nonaktif',
};
