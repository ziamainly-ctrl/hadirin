import type { ChangeEvent } from 'react';
import Input from '@/components/ui/Input';

export interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}

/**
 * Controlled two-date filter built from ui/Input. It never fetches data
 * itself — the caller (a Client Component holding the filter state) owns the
 * values, so this stays a plain Server Component rendering client leaves.
 */
export default function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'Dari',
  toLabel = 'Sampai',
  className,
}: DateRangeFilterProps) {
  function handleFromChange(e: ChangeEvent<HTMLInputElement>) {
    onFromChange(e.target.value);
  }

  function handleToChange(e: ChangeEvent<HTMLInputElement>) {
    onToChange(e.target.value);
  }

  // Two equal columns at every width: on a 360px phone both dates still fit side by side
  // (a wrapping flex row left "Sampai" alone on its own line with a ragged right edge). From sm up
  // each date is as wide as the Cabang / Status selects beside it (min-w-42, 168px), so the filter
  // row is four controls of one width instead of 156 / 156 / 176 / 160px, and the four still fit one
  // line beside the 240px sidebar at 1024px (4 x 168 + 3 x 12 = 708 of 736).
  return (
    <div className={`grid grid-cols-2 items-end gap-3 ${className ?? ''}`}>
      <Input type="date" label={fromLabel} value={from} max={to || undefined} onChange={handleFromChange} className="sm:min-w-42" />
      <Input type="date" label={toLabel} value={to} min={from || undefined} onChange={handleToChange} className="sm:min-w-42" />
    </div>
  );
}
