export interface RankBadgeProps {
  rank: number;
  large?: boolean;
}

/**
 * The rank as a number in a circle: filled for the top three, outlined for the rest. Neutral
 * tokens only (no gold/silver/bronze panels, the owner's rule), and the number is the signal, so
 * it never depends on colour.
 */
export default function RankBadge({ rank, large = false }: RankBadgeProps) {
  const top = rank >= 1 && rank <= 3;
  const size = large ? 'h-10 w-10 text-base' : 'h-7 w-7 text-xs';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ${size} ${
        top ? 'bg-primary text-primary-fg' : 'border border-border bg-accent text-text'
      }`}
      aria-label={`Peringkat ${rank}`}
    >
      {rank}
    </span>
  );
}
