import type { ChangeEvent } from 'react';
import Select from '@/components/ui/Select';

export interface BranchFilterOption {
  id: number | string;
  name: string;
}

export interface BranchFilterProps {
  branches: BranchFilterOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  allLabel?: string;
  className?: string;
}

/**
 * Controlled branch filter built from ui/Select. `branches` is supplied by
 * the caller — this component never fetches data itself.
 */
export default function BranchFilter({
  branches,
  value,
  onChange,
  label = 'Cabang',
  allLabel = 'Semua Cabang',
  className,
}: BranchFilterProps) {
  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value);
  }

  return (
    <Select label={label} value={value} onChange={handleChange} className={className}>
      <option value="">{allLabel}</option>
      {branches.map((branch) => (
        <option key={branch.id} value={String(branch.id)}>
          {branch.name}
        </option>
      ))}
    </Select>
  );
}
