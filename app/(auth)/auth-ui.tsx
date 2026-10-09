import Link from 'next/link';

// Pieces the three auth forms share (login, register, change-password), so their rhythm can't
// drift: the form's gap, the title block and the "other screen" line under the button.

/** The form's flex column. The gap tightens with the window's height (clamp) so the longest
 * form (register, four fields) still fits the card on a 1024x600 desktop window. */
export const AUTH_FORM_CLASS = 'flex flex-col gap-4 lg:gap-[clamp(0.625rem,calc(5vh-1.25rem),1rem)]';

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
      <p className="fit-hide-tiny mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

/** "Belum punya akun? Daftar gratis". The link's tap area grows (py-2 cancelled by -my-2, py-3 by
 * -my-3 on touch, so the line doesn't get taller) to a comfortable thumb target. */
export function AuthSwitch({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <p className="text-center text-sm text-muted">
      {text}{' '}
      <Link href={href} className="-my-2 inline-block rounded-sm py-2 pointer-coarse:-my-3 pointer-coarse:py-3 font-medium text-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {label}
      </Link>
    </p>
  );
}
