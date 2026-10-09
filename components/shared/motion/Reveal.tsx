import type { CSSProperties, ElementType, HTMLAttributes } from 'react';

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  /** Position in the group (0, 1, 2 ...). Each step starts 40ms later, and the index caps at 6, so
   * the last item starts 240ms in and a grid of any size is settled in well under half a second. */
  index?: number;
  /** Element to render. Default div. */
  as?: ElementType;
}

/**
 * Staggered enter for a tile, a card, a row of a list: fades in and rises 8px (the `reveal`
 * utility in app/globals.css). A Server Component with no JS: the delay comes from the `--i` custom
 * property, so it works for server-rendered pages as is.
 *
 *   <div className="grid grid-cols-4 gap-3">
 *     {tiles.map((t, i) => <Reveal key={t.id} index={i}><StatTile {...t} /></Reveal>)}
 *   </div>
 *
 * Use it for the 4 to 12 things that make up the first screen, not for every table row (a long
 * list would animate off-screen). The animation uses `backwards` fill, so once it ends the element
 * is back to its own styles (a hover transform on the child still works), and under
 * prefers-reduced-motion it collapses to the final state at once.
 *
 * To stagger the children of a parent without wrapping each one, put `stagger` on the parent
 * (`<div className="stagger grid ...">`), same effect by :nth-child.
 */
export default function Reveal({ index = 0, as: Tag = 'div', className, style, children, ...rest }: RevealProps) {
  return (
    <Tag className={`reveal ${className ?? ''}`} style={{ '--i': index, ...style } as CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}
