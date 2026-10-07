// One shared column for every settings page. Each page used to center itself at its own
// max-width (3xl for the forms, 4xl for the hub and billing), so the "Pengaturan" /
// "Organisasi" / "Tagihan" headings jumped sideways when moving between sibling pages.
// Now the column is fixed here and form-style pages fill it with a two-column grid.
// Left-aligned (no mx-auto): every other admin page starts its title at the sidebar's
// edge, so a centered settings column made the heading jump on every navigation.
// lg:h-full hands the shell's one-viewport height down to the Page frame inside, so each
// settings page keeps its title fixed and never scrolls the window (TRD.md §14).
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-4xl lg:h-full">{children}</div>;
}
