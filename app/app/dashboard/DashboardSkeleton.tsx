import './dashboard.css';
import Skeleton from '@/components/ui/Skeleton';
import type { DashCardId } from './DashCard';

const CARDS: DashCardId[] = ['trend', 'status', 'hours', 'heat', 'attn', 'feed'];

/**
 * The dashboard while its numbers load (app/app/loading.tsx): the same grid, the same density tiers
 * and the same card boxes as <DashboardView> (dashboard.css), so a card that is hidden on a short
 * window is hidden here too and nothing jumps when the real page streams in. Blocks are sized like the
 * text they stand for (label 16px, number 28px, change 16px).
 */
export default function DashboardSkeleton() {
  return (
    <div className="dash" aria-busy="true">
      <span role="status" className="sr-only">
        Memuat data dashboard…
      </span>
      <div className="dash-kpis rounded-card border border-border bg-border">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="dash-kpi bg-surface">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="dash-kpi-num-skeleton w-14" />
            <Skeleton className="h-4 w-24 max-w-full" />
          </div>
        ))}
      </div>
      <div className="dash-cards">
        {CARDS.map((id) => (
          <div key={id} className={`dash-card dash-${id} rounded-card border border-border bg-surface`}>
            <div className="flex min-h-6 shrink-0 items-center justify-between gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="dash-chart" />
          </div>
        ))}
      </div>
    </div>
  );
}
