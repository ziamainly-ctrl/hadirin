import FitPager from '@/components/shared/FitPager';

export interface BarListItem {
  /** Stable React key when labels can repeat (two employees with the same name). */
  id?: string | number;
  label: string;
  value: number;
  color?: string;
}

export interface BarListProps {
  items: BarListItem[];
  formatValue?: (value: number) => string;
  className?: string;
  /** Desktop zero-scroll: paginate the bars to the height of the box this list sits in (a
   * height-bound flex column) instead of letting it grow. `label` names the pager, `noun` its count. */
  fit?: { label: string; noun?: string };
}

/**
 * Hand-rolled horizontal bar list (no charting dependency, same reasoning as
 * DonutChart.tsx) — each bar's width is proportional to the largest value in the list,
 * for ranking/comparison reads (e.g. "top N employees by lateness").
 */
export default function BarList({ items, formatValue, className, fit }: BarListProps) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const format = formatValue ?? ((value: number) => String(value));

  // One grid for the whole list (each <li> is a subgrid row): the label column is as wide as the
  // longest label (capped, then truncated) and the value column as wide as the longest value, so
  // every bar starts and ends at the same x and bar lengths stay comparable, and the bar still
  // gets the rest of a narrow card instead of a 40px sliver.
  const rows = (
    <>
      {items.map((item) => (
        <li key={item.id ?? item.label} className="col-span-3 grid grid-cols-subgrid items-center">
          <span className="max-w-32 truncate text-muted sm:max-w-44" title={item.label}>
            {item.label}
          </span>
          {/* bg-muted/20, not bg-accent: accent is almost the card color in light mode, so the
              track vanished and a short bar looked like a stray line. */}
          <span className="h-2 overflow-hidden rounded-full bg-muted/20">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(4, (item.value / max) * 100)}%`,
                backgroundColor: item.color ?? 'var(--color-primary)',
              }}
            />
          </span>
          <span className="whitespace-nowrap text-right font-semibold tabular-nums text-text">{format(item.value)}</span>
        </li>
      ))}
    </>
  );
  const gridClass = `grid grid-cols-[auto_minmax(3rem,1fr)_auto] content-start gap-x-3 gap-y-3 text-sm ${className ?? ''}`;

  if (fit) {
    return (
      <FitPager as="ul" label={fit.label} noun={fit.noun} className={gridClass} frameClassName="lg:min-h-0 lg:flex-1" footerClassName="mt-2 rounded-card border bg-surface">
        {rows}
      </FitPager>
    );
  }
  return <ul className={gridClass}>{rows}</ul>;
}
