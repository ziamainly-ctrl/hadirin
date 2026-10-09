'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { monthOf } from '@/lib/insights/calendar-grid';
import { calendarHref } from './calendar-url';
import HolidayForm from './holiday-form';

export interface AddHolidayDialogProps {
  /** Date the field starts on (the opened day, or today). */
  defaultDate: string;
  /** Month on screen, so a new holiday in another month takes the person there. */
  month: string;
  branchId?: number;
}

/** "Tambah Libur" in the page header (OWNER/ADMIN). */
export default function AddHolidayDialog({ defaultDate, month, branchId }: AddHolidayDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleCreated(holidayDate: string) {
    setOpen(false);
    const target = monthOf(holidayDate);
    if (target !== month) router.push(calendarHref({ month: target, branchId }));
    else router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tambah Libur
      </Button>
      {/* Remounted on every open, so the form never shows the previous attempt. */}
      {open ? (
        <Dialog open onClose={() => setOpen(false)} title="Tambah Libur Perusahaan" size="sm">
          <Dialog.Body>
            <HolidayForm defaultDate={defaultDate} onCreated={handleCreated} onCancel={() => setOpen(false)} />
          </Dialog.Body>
        </Dialog>
      ) : null}
    </>
  );
}
