import PageTransition from '@/components/shared/motion/PageTransition';

// Route enter for login / register / change-password: only the form card's content moves (the
// header and the card frame belong to the layout and stay put).
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
