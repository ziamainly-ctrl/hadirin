import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  shadow?: boolean;
  /** A card that acts like a button or a link (a tile you click): lifts 2px and darkens its border
   * on hover (the `hover-lift` utility in app/globals.css), settles back while pressed. Leave it
   * off for a plain content card so nothing that cannot be clicked looks clickable. */
  interactive?: boolean;
}

function Card({ className, shadow = false, interactive = false, children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-4 ${shadow ? 'shadow-sm' : ''} ${interactive ? 'hover-lift' : ''} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-3 flex items-center justify-between gap-2 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-3 flex items-center justify-end gap-2 ${className ?? ''}`} {...rest}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
