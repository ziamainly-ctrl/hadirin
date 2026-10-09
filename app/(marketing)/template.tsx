import PageTransition from '@/components/shared/motion/PageTransition';

// Route enter for the public pages (see components/shared/motion/PageTransition). The layout's
// <main> is a flex column and each page's PageSection is `flex-1` + `justify-center` inside it, so
// the wrapper is a flex column that fills <main> and the section keeps centering in the free height.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition className="flex flex-1 flex-col">{children}</PageTransition>;
}
