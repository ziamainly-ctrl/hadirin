import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';
import Sidebar from '@/components/shared/Sidebar';
import { navItemsForRole } from '@/lib/constants/admin-nav';

// Server Component: reads the session directly (TRD.md §5), no self-fetch. Uses
// requireSession() (not requireActiveSession()) and redirects explicitly instead of
// throwing, so a stale /app tab sends a must-change-password user to the right place
// instead of an error page (proxy.ts only checked that a session cookie exists at all).
//
// Who sees what: OWNER/ADMIN get the 19-item org-wide menu, MANAGER the 12-item team subset
// (lib/constants/admin-nav.ts). An EMPLOYEE has no business in the admin shell at all (they live
// in /m and /check-in), so they are sent there instead of being shown a manager menu whose pages
// would only answer 403.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { role, context } = await requireSession();
  if (context.mustChangePassword) redirect('/change-password');
  if (role === 'EMPLOYEE') redirect('/m');

  const items = navItemsForRole(role);

  return (
    <ToastProvider>
      <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden">
        <Sidebar items={items} logout={{ url: '/api/auth/logout', redirectTo: '/' }} />
        {/* min-w-0 lets wide tables scroll inside their own wrapper instead of widening the
            page; the inner max-w keeps tiles and tables from stretching edge to edge on a
            2000px+ monitor; the column is centered in the space beside the sidebar. */}
        <main className="fit-pad min-w-0 flex-1 overflow-x-hidden p-4 pt-16 lg:h-dvh lg:p-5 lg:pt-5">
          {/* lg:h-full + overflow-y-auto: on desktop the shell is exactly one viewport tall and the page
              never scrolls; pages built on components/shared/Page keep their header fixed and scroll
              only their own body. This wrapper is the safety net for any page that is still taller.
              Its lg:p-1 (taken out of main's padding, so the gutter is still 24px) is room for the
              3px focus ring of a control that sits flush with the page edge: overflow-y-auto also
              clips on x, and the ring of the first filter or the header button was cut off. */}
          <div className="mx-auto w-full max-w-[1600px] lg:h-full lg:overflow-y-auto lg:p-1">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
