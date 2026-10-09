import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';
import DashboardSkeleton from './dashboard/DashboardSkeleton';

// Shown the instant "Dashboard" is pressed, while the server resolves the session and the numbers: the
// previous screen otherwise just sits there and the person presses again. The title is a placeholder
// (the greeting names the signed-in person), and the body is the same grid, density tiers and card boxes
// as the loaded dashboard (app/app/dashboard/dashboard.css), so nothing jumps when the real page streams
// in. Every other /app page has its own loading.tsx next to its page.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <div className="flex shrink-0 flex-col gap-1">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="fit-hide-short h-5 w-96 max-w-full" />
      </div>
      <Page.Body>
        <DashboardSkeleton />
      </Page.Body>
    </Page>
  );
}
