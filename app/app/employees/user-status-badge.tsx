import Badge from '@/components/ui/Badge';
import type { UserRole } from '@/lib/constants/roles';
import type { UserStatus } from '@/lib/constants/statuses';
import { ROLE_LABELS, USER_STATUS_LABELS } from './employee-labels';

// Both chips are the shared Badge: a neutral gray chip with a hairline border, and (for a
// status) a small colored dot. The product owner wants no tinted fills, so the only color is
// the dot, and the word stays the primary cue (never color alone). `align-middle` keeps a chip
// with a dot and one without on the same line in the detail grid: an inline-flex chip aligns
// by its first item's baseline, and the empty dot has none, which pushed "Aktif" 2px lower
// than "Karyawan".
const STATUS_TONE = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
} as const satisfies Record<UserStatus, 'success' | 'neutral'>;

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge tone="neutral" dot={false} className="align-middle">
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} className="align-middle">
      {USER_STATUS_LABELS[status]}
    </Badge>
  );
}
