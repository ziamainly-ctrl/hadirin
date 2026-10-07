import type { Metadata } from 'next';
import TodayView from './today-view';

export const metadata: Metadata = { title: 'Hari ini' };

// The /m "today" screen. The body lives in ./today-view so /check-in (the marketing site's
// check-in page) renders the identical screen.
export default function TodayPage() {
  return <TodayView />;
}
