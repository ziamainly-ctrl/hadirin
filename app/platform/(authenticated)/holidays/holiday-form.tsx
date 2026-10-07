'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

/**
 * Add-holiday form for the platform CMS (national holidays only, org_id always NULL —
 * app/api/platform/holidays/route.ts, PRD.md P5). There is no edit endpoint for
 * holidays, only create (this form) and delete (DeleteHolidayButton below) — both live
 * in this one file since this CMS section only gets a single client file.
 */
export default function HolidayForm() {
  const router = useRouter();
  const { show } = useToast();

  const [holidayDate, setHolidayDate] = useState('');
  const [name, setName] = useState('');
  const [isCollectiveLeave, setIsCollectiveLeave] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
      setHolidayDate('');
      setName('');
      setIsCollectiveLeave(false);
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card shadow>
      <Card.Header>
        <h2 className="text-sm font-semibold text-text">Tambah Hari Libur</h2>
      </Card.Header>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          label="Tanggal"
          type="date"
          value={holidayDate}
          onChange={(e) => setHolidayDate(e.target.value)}
          error={fieldErrors.holidayDate}
          required
        />
        <Input
          label="Nama"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          maxLength={120}
          placeholder="Contoh: Hari Kemerdekaan RI"
          required
        />
        <Checkbox
          label="Cuti bersama"
          checked={isCollectiveLeave}
          onChange={(e) => setIsCollectiveLeave(e.target.checked)}
        />
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Tambah
        </Button>
      </form>
    </Card>
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
        variant="ghost"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        className="gap-1.5 text-destructive"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Hapus
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Hapus hari libur?"
        description={`Hapus hari libur "${holidayName}"? Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Hapus"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
