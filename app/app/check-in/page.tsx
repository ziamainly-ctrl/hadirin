import type { Metadata } from 'next';
import TodayView from '@/app/m/today-view';

export const metadata: Metadata = { title: 'Check-in Saya' };

/**
 * The same check-in screen as /m and the public /check-in, inside the admin shell: an owner,
 * admin or manager who tracks their own attendance clocks in here without leaving the dashboard.
 * Nothing about the check-in itself lives in this file (first-run setup, GPS panel, camera,
 * errors are all TodayView / CheckInCard), so the three entry points can never drift apart.
 *
 * `host="app"` is TodayView's own preset for the admin shell (it sets --today-chrome, the height the
 * mobile top bar and page padding spend above the card). The wrapper adds the two desktop values the
 * selfie viewfinder (components/shared/SelfieCamera) sizes itself from: from lg the shell has no
 * header or footer, just the page padding plus TodayView's own title and card rows, so the viewfinder
 * is 100dvh minus 14rem (the marketing page needs 19rem: it carries the site header and footer, /m
 * has its tab bar). TodayView frames itself with a Page, so it is NOT wrapped in a second one; the
 * wrapper is a definite-height flex column so that Page's body, not the window, absorbs a short screen.
 * The role gate is app/app/layout.tsx (EMPLOYEE goes to /m); TodayView calls requireSession().
 */
export default function AdminCheckInPage() {
  return (
    <div className="flex flex-col lg:h-full lg:min-h-0 lg:[--today-chrome-wide:14rem] lg:[--vf-min:8rem]">
      {/* ml-0!: TodayView centers itself (mx-auto) for the marketing page and /m; in the admin shell the
          title lines up with every other page's title at the left edge, like the marketing page does
          with its own `!` override. */}
      <TodayView host="app" className="ml-0! lg:flex-1" />
    </div>
  );
}
