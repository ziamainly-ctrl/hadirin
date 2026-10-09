import { Camera } from 'lucide-react';

export interface SelfieLinkProps {
  logId: number;
  kind: 'check-in' | 'check-out';
  className?: string;
}

/**
 * Link to one punch's selfie, served through the role + tenant checked files route
 * (app/api/files/[...path], AGENTS.md: selfies are private; the Blob URL itself never reaches a
 * page). It is the only control in a table cell or feed row, so it gets a padded hit area (the
 * bare 16px icon was too small to tap: 40px on a touch screen, with negative margins keeping the
 * row height) and a visible focus ring. Opens in a new tab.
 */
export default function SelfieLink({ logId, kind, className }: SelfieLinkProps) {
  const label = `Lihat foto ${kind}`;
  return (
    <a
      href={`/api/files/attendance-logs/${logId}/${kind}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={`-m-1.5 inline-flex rounded-input p-1.5 pointer-coarse:-m-3 pointer-coarse:p-3 text-muted transition-colors hover:bg-accent hover:text-text focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className ?? ''}`}
    >
      <Camera className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
