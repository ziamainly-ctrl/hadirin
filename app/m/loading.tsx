import Card from '@/components/ui/Card';
import Page from '@/components/shared/Page';
import Skeleton from '@/components/ui/Skeleton';

// Shown the instant a tab is tapped, while that tab's server render is in flight: on a slow phone
// connection the previous screen otherwise just sits there, and the person taps again. One neutral
// placeholder serves every /m page (a title, a line of description, a few cards); the header and
// the tab bar belong to layout.tsx, so they stay put and the active tab already moves.
export default function Loading() {
  return (
    <Page aria-busy="true">
      <div className="flex shrink-0 flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Page.Body>
        <span className="sr-only" role="status">
          Memuat…
        </span>
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </Page.Body>
    </Page>
  );
}
