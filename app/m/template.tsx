import PageTransition from '@/components/shared/motion/PageTransition';

// Route enter for the employee app (see components/shared/motion/PageTransition). The layout's
// <main> is a flex column and its pages are written against that (Page is `lg:h-full`, a centered
// card is `my-auto`), so the wrapper is a flex column that fills it and passes the sizing on.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition className="flex min-h-0 flex-1 flex-col">{children}</PageTransition>;
}
