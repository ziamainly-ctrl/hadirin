import PageTransition from '@/components/shared/motion/PageTransition';

// Route enter for the platform console (see app/app/template.tsx: same shell, same sizing).
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition className="lg:h-full">{children}</PageTransition>;
}
