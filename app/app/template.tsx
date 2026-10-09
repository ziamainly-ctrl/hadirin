import PageTransition from '@/components/shared/motion/PageTransition';

// Remounted by Next whenever the section changes (/app/live -> /app/kalender), so every sidebar
// move plays the route enter (components/shared/motion/PageTransition). It sits inside the layout's
// scroll wrapper, so the sidebar never animates, and lg:h-full hands that wrapper's definite height
// down to the Page frame inside (Page is `lg:h-full`), exactly as the wrapper does for a bare child.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition className="lg:h-full">{children}</PageTransition>;
}
