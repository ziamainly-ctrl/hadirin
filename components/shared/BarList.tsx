export interface BarListItem {
  label: string;
  value: number;
  color?: string;
}

export interface BarListProps {
  items: BarListItem[];
  formatValue?: (value: number) => string;
  className?: string;
}

/**
 * Hand-rolled horizontal bar list (no charting dependency, same reasoning as
 * DonutChart.tsx) — each bar's width is proportional to the largest value in the list,
 * for ranking/comparison reads (e.g. "top N employees by lateness").
 */
export default function BarList({ items, formatValue, className }: BarListProps) {
  const max = Math.max(1, ...items.map((item) => item.value));
  const format = formatValue ?? ((value: number) => String(value));

  return (
    <ul className={`flex flex-col gap-3 ${className ?? ''}`}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-muted" title={item.label}>
            {item.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-accent">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(4, (item.value / max) * 100)}%`,
                backgroundColor: item.color ?? 'var(--color-primary)',
              }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-text">{format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}
