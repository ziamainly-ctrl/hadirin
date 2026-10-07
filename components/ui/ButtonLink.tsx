import Link from 'next/link';
import type { ComponentProps } from 'react';
import { buttonClasses } from './Button';
import type { ButtonSize, ButtonVariant } from './Button';

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * A next/link that looks like ui/Button. Use it for navigation (Daftar, Lihat Harga,
 * Pilih paket) instead of wrapping a <Button> in a <Link> — that nests an interactive
 * element inside another one, which is invalid HTML and doubles the tab stops.
 */
export default function ButtonLink({ variant = 'primary', size = 'md', className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...rest} />;
}
