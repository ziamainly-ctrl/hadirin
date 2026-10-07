'use client';

import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Plus } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import IconButton from '@/components/ui/IconButton';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import type { PaymentMethod } from '@/lib/queries/payment-methods';
import { PAYMENT_METHOD_CODES, PAYMENT_METHOD_TYPES } from '@/lib/constants/statuses';
import type { PaymentMethodCode, PaymentMethodType } from '@/lib/constants/statuses';

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

// Midtrans enabled_payments codes (docs.midtrans.com/docs/snap-advanced-feature) with a
// human-readable label for the CMS — the code itself is never translated.
const CODE_LABELS: Record<PaymentMethodCode, string> = {
  other_qris: 'QRIS',
  gopay: 'GoPay',
  shopeepay: 'ShopeePay',
  bca_va: 'BCA Virtual Account',
  bni_va: 'BNI Virtual Account',
  bri_va: 'BRI Virtual Account',
  echannel: 'Mandiri E-Channel',
  permata_va: 'Permata Virtual Account',
  credit_card: 'Kartu Kredit',
};

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  QRIS: 'QRIS',
  EWALLET: 'E-Wallet',
  VA: 'Virtual Account',
  CARD: 'Kartu',
};

const CODE_OPTIONS = PAYMENT_METHOD_CODES.map((value) => ({ value, label: CODE_LABELS[value] }));
const TYPE_OPTIONS = PAYMENT_METHOD_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));

// id-ID decimal comma ("0,7%"), not the raw "0.70%" the numeric column used to print.
const PERCENT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

function formatFee(adminFeeFlat: number, adminFeePct: number): string {
  const parts: string[] = [];
  if (adminFeeFlat > 0) parts.push(RUPIAH.format(adminFeeFlat));
  if (Number(adminFeePct) > 0) parts.push(`${PERCENT.format(Number(adminFeePct))}%`);
  return parts.length > 0 ? parts.join(' + ') : 'Gratis';
}

export interface PaymentMethodFormDialogProps {
  /** Present → PATCHes /api/platform/payment-methods/[id] (edit). Absent → POSTs /api/platform/payment-methods (create). */
  method?: PaymentMethod;
  /**
   * sortOrder to send when creating (appends to the end of the current list).
   * upsertPaymentMethodSchema requires sortOrder on every write, but drag
   * (SortablePaymentMethodsTable below) is what actually controls it after creation —
   * same approach as plans/plan-form-dialog.tsx.
   */
  nextSortOrder?: number;
}

interface MethodFormState {
  code: PaymentMethodCode;
  name: string;
  type: PaymentMethodType;
  logoUrl: string;
  adminFeeFlat: string;
  adminFeePct: string;
  isActive: boolean;
}

function toFormState(method?: PaymentMethod): MethodFormState {
  return {
    code: method?.code ?? PAYMENT_METHOD_CODES[0],
    name: method?.name ?? '',
    type: method?.type ?? PAYMENT_METHOD_TYPES[0],
    logoUrl: method?.logoUrl ?? '',
    adminFeeFlat: method ? String(method.adminFeeFlat) : '0',
    adminFeePct: method ? String(method.adminFeePct) : '0',
    isActive: method?.isActive ?? true,
  };
}

/**
 * Self-contained trigger + modal, same shape as plans/plan-form-dialog.tsx and
 * app/app/branches/branch-form-dialog.tsx. Fields mirror upsertPaymentMethodSchema
 * (lib/validators/payment-methods.ts) minus sortOrder (see PaymentMethodFormDialogProps).
 */
export default function PaymentMethodFormDialog({ method, nextSortOrder = 0 }: PaymentMethodFormDialogProps) {
  const isEdit = Boolean(method);
  const router = useRouter();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MethodFormState>(() => toFormState(method));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openDialog() {
    setForm(toFormState(method));
    setFieldErrors({});
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        type: form.type,
        // Always sent (never omitted) even when blank: upsertPaymentMethodSchema has no
        // .nullable() for logoUrl, so updatePaymentMethod only touches logo_url when the
        // key is present — omitting it on edit would make a previously-set logo
        // un-clearable through this form.
        logoUrl: form.logoUrl.trim(),
        adminFeeFlat: Number(form.adminFeeFlat),
        adminFeePct: Number(form.adminFeePct),
        isActive: form.isActive,
        sortOrder: method ? method.sortOrder : nextSortOrder,
      };
      const res = isEdit
        ? await fetch(`/api/platform/payment-methods/${method?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/platform/payment-methods', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();

      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        show(json.error?.message ?? 'Gagal menyimpan metode pembayaran.', 'error');
        return;
      }

      show(isEdit ? 'Metode pembayaran berhasil diperbarui.' : 'Metode pembayaran berhasil ditambahkan.', 'success');
      closeDialog();
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={isEdit ? 'secondary' : 'primary'}
        size={isEdit ? 'sm' : 'md'}
        onClick={openDialog}
        // Every row says "Edit": the name tells a screen-reader user which method this changes.
        aria-label={isEdit ? `Edit metode ${method?.name}` : undefined}
      >
        {isEdit ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {isEdit ? 'Edit' : 'Tambah Metode'}
      </Button>

      <Dialog open={open} onClose={closeDialog} title={isEdit ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran'}>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {/* Pairs go side by side only from sm: at phone width "BCA Virtual Account" was
              clipped inside a half-width select and "Biaya Admin Tetap (Rp)" wrapped to two
              lines, knocking its input out of line with the one beside it. */}
          <Dialog.Body className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
              <Select
                label="Kode Midtrans"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value as PaymentMethodCode }))}
                options={CODE_OPTIONS}
                error={fieldErrors.code}
              />
              <Select
                label="Jenis"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PaymentMethodType }))}
                options={TYPE_OPTIONS}
                error={fieldErrors.type}
              />
            </div>

            <Input
              label="Nama"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={fieldErrors.name}
              maxLength={80}
              hint="Nama yang dilihat pelanggan saat memilih metode pembayaran."
              required
            />

            <Input
              label="URL Logo (opsional)"
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              error={fieldErrors.logoUrl}
              maxLength={500}
              placeholder="https://..."
            />

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
              <Input
                label="Biaya Tetap (Rp)"
                type="number"
                min={0}
                value={form.adminFeeFlat}
                onChange={(e) => setForm((f) => ({ ...f, adminFeeFlat: e.target.value }))}
                error={fieldErrors.adminFeeFlat}
                required
              />
              <Input
                label="Biaya Persentase (%)"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.adminFeePct}
                onChange={(e) => setForm((f) => ({ ...f, adminFeePct: e.target.value }))}
                error={fieldErrors.adminFeePct}
                required
              />
            </div>

            <Checkbox
              label="Aktif"
              description="Hanya metode aktif yang muncul di halaman pembayaran pelanggan."
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="ghost" onClick={closeDialog}>
              Batal
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {isEdit ? 'Simpan' : 'Tambah'}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog>
    </>
  );
}

function SortablePaymentMethodRow({ method }: { method: PaymentMethod }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: method.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    // Table.Row takes the ref useSortable needs (React 19 passes ref as a prop), so the row
    // keeps the shared hover state instead of a copy of it.
    <Table.Row ref={setNodeRef} style={style}>
      <Table.Cell narrow>
        <IconButton
          label="Seret untuk mengurutkan"
          size="sm"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </Table.Cell>
      {/* The customer-facing name with the Midtrans code under it: the old separate Kode
          column mostly repeated the name ("QRIS" / "QRIS") and pushed Status and Aksi off
          a tablet screen. */}
      <Table.Cell>
        <span className="block font-medium text-text">{method.name}</span>
        <span className="mt-0.5 block font-mono text-xs text-muted">{method.code}</span>
      </Table.Cell>
      <Table.Cell className="text-muted">{TYPE_LABELS[method.type]}</Table.Cell>
      <Table.Cell className="text-right">{formatFee(method.adminFeeFlat, method.adminFeePct)}</Table.Cell>
      <Table.Cell>
        <Badge tone={method.isActive ? 'success' : 'neutral'}>{method.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
      </Table.Cell>
      <Table.Cell className="text-right">
        <PaymentMethodFormDialog method={method} />
      </Table.Cell>
    </Table.Row>
  );
}

export interface SortablePaymentMethodsTableProps {
  paymentMethods: PaymentMethod[];
}

/**
 * Drag-to-reorder list (PRD.md P3, @dnd-kit/core + @dnd-kit/sortable — TRD.md §3). Same
 * optimistic-mirror-then-resync approach as plans/plan-form-dialog.tsx's SortablePlansTable.
 */
export function SortablePaymentMethodsTable({ paymentMethods: initialMethods }: SortablePaymentMethodsTableProps) {
  const [methods, setMethods] = useState(initialMethods);
  // Adjust state during render rather than in an effect — same reasoning as
  // plans/plan-form-dialog.tsx's SortablePlansTable.
  const [prevInitialMethods, setPrevInitialMethods] = useState(initialMethods);
  if (initialMethods !== prevInitialMethods) {
    setPrevInitialMethods(initialMethods);
    setMethods(initialMethods);
  }
  const router = useRouter();
  const { show } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = methods.findIndex((m) => m.id === active.id);
    const newIndex = methods.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(methods, oldIndex, newIndex);
    setMethods(reordered);
    try {
      const res = await fetch('/api/platform/payment-methods/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((m) => m.id) }),
      });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal mengubah urutan metode pembayaran.', 'error');
        setMethods(initialMethods);
        return;
      }
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
      setMethods(initialMethods);
    }
  }

  return (
    // Fixed id: dnd-kit numbers its accessibility ids from a module-level counter, which
    // differs between the server render and hydration (a mismatch logged on every load).
    <DndContext id="payment-methods-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Table aria-label="Daftar metode pembayaran">
        <Table.Head>
          <Table.Row>
            <Table.HeadCell narrow>
              <span className="sr-only">Urutan</span>
            </Table.HeadCell>
            <Table.HeadCell>Metode</Table.HeadCell>
            <Table.HeadCell>Jenis</Table.HeadCell>
            <Table.HeadCell className="text-right">Biaya Admin</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell className="text-right">Aksi</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <SortableContext items={methods.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <Table.Body>
            {methods.map((method) => (
              <SortablePaymentMethodRow key={method.id} method={method} />
            ))}
          </Table.Body>
        </SortableContext>
      </Table>
    </DndContext>
  );
}
