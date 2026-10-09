import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * What a chart card shows before it has anything to chart: a small icon and one sentence that says what
 * will appear and when. Centered in the card body, sized so it still fits the shortest desktop card.
 */
export default function DashEmpty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 text-center">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent">
        <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
      </span>
      <p className="max-w-[18rem] text-xs text-muted">{children}</p>
    </div>
  );
}
