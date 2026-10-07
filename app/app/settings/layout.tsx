// One shared column for every settings page. Each page used to center itself at its own
// max-width (3xl for the forms, 4xl for the hub and billing), so the "Pengaturan" /
// "Organisasi" / "Billing" headings jumped sideways when moving between sibling pages.
// Now the column is fixed here and form-style pages narrow their own cards inside it.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-4xl">{children}</div>;
}
