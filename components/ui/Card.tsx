import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  shadow?: boolean;
}

function Card({ className, shadow = false, children, ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border border-black/5 bg-surface p-4 dark:border-white/5 ${shadow ? 'shadow-sm' : ''} ${className ?? ''}`}
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
