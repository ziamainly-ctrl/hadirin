'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

/**
 * Add-holiday trigger + dialog for the platform CMS (national holidays only, org_id always
 * NULL — app/api/platform/holidays/route.ts, PRD.md P5). There is no edit endpoint for
 * holidays, only create (this dialog) and delete (DeleteHolidayButton below) — both live
 * in this one file since this CMS section only gets a single client file.
 *
 * A dialog opened from the page header, same as "Tambah Paket" / "Tambah Metode": the old
 * always-open side card stretched to the full content width below lg (a 700px-wide
 * "Tambah" button on a tablet) and squeezed the table next to it on a laptop.
 */
export default function HolidayForm() {
  const router = useRouter();
  const { show } = useToast();
  const [open, setOpen] = useState(false);

  const [holidayDate, setHolidayDate] = useState('');
  const [name, setName] = useState('');
  const [isCollectiveLeave, setIsCollectiveLeave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // An empty date would come back from the API as "Gunakan format TTTT-BB-HH." — a format
    // the picker (dd/mm/yyyy on most devices) never shows, so say what is actually missing.
    if (!holidayDate) {
      setFieldErrors({ holidayDate: 'Pilih tanggal hari libur.' });
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/platform/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holidayDate, name, isCollectiveLeave }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        show(json.error?.message ?? 'Gagal menambahkan hari libur.', 'error');
        return;
      }
      show('Hari libur berhasil ditambahkan.', 'success');
      setOpen(false);
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDialog() {
    setHolidayDate('');
    setName('');
    setIsCollectiveLeave(false);
    setFieldErrors({});
    setOpen(true);
  }

  return (
    <>
      <Button type="button" onClick={openDialog}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Tambah Hari Libur
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Tambah Hari Libur">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <Dialog.Body className="flex flex-col gap-4">
            <Input
              label="Tanggal"
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              error={fieldErrors.holidayDate}
              required
            />
            <Input
              label="Nama Hari Libur"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fieldErrors.name}
              maxLength={120}
              placeholder="Contoh: Hari Kemerdekaan RI"
              required
            />
            <Checkbox
              label="Cuti bersama"
              description="Centang untuk cuti bersama yang ditetapkan pemerintah (SKB 3 Menteri)."
              checked={isCollectiveLeave}
              onChange={(e) => setIsCollectiveLeave(e.target.checked)}
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Tambah
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog>
    </>
  );
}

export interface DeleteHolidayButtonProps {
  holidayId: number;
  holidayName: string;
}

/** Per-row delete for one national holiday — DELETE /api/platform/holidays/[id]. */
export function DeleteHolidayButton({ holidayId, holidayName }: DeleteHolidayButtonProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/platform/holidays/${holidayId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal menghapus hari libur.', 'error');
        return;
      }
      show('Hari libur berhasil dihapus.', 'success');
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="danger-ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        aria-label={`Hapus ${holidayName}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Hapus
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus hari libur?"
        // The title already asks the question; the body says what it affects instead of
        // repeating it.
        description={`"${holidayName}" akan dihapus dari kalender libur semua organisasi. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
