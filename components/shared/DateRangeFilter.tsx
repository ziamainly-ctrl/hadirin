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

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className ?? ''}`}>
      <Input type="date" label={fromLabel} value={from} max={to || undefined} onChange={handleFromChange} />
      <Input type="date" label={toLabel} value={to} min={from || undefined} onChange={handleToChange} />
    </div>
  );
}
