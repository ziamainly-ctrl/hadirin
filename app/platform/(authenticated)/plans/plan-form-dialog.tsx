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
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import type { Plan } from '@/lib/queries/plans';
import { DEFAULT_PLAN_FEATURES } from '@/lib/constants/plan-features';
import type { PlanFeatures } from '@/lib/constants/plan-features';

const RUPIAH = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  export_xlsx: 'Export rekap XLSX',
  export_pdf: 'Export rekap PDF',
  email_alerts: 'Notifikasi email',
  whatsapp_alerts: 'Notifikasi WhatsApp',
  template_override: 'Kustomisasi template notifikasi',
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[];

export interface PlanFormDialogProps {
  /** Present → PATCHes /api/platform/plans/[id] (edit). Absent → POSTs /api/platform/plans (create). */
  plan?: Plan;
  /**
   * sortOrder to send when creating (appends to the end of the current list).
   * upsertPlanSchema requires sortOrder on every write, but drag (SortablePlansTable
   * below) is what actually controls it after creation — this dialog has no sortOrder
   * field of its own, matching the fields PRD.md P2 / the task call out for this form.
   */
  nextSortOrder?: number;
}

interface PlanFormState {
  code: string;
  name: string;
  priceMonthly: string;
  maxEmployees: string;
  maxBranches: string;
  features: PlanFeatures;
  isActive: boolean;
}

function toFormState(plan?: Plan): PlanFormState {
  return {
    code: plan?.code ?? '',
    name: plan?.name ?? '',
    priceMonthly: plan ? String(plan.priceMonthly) : '0',
    maxEmployees: plan ? String(plan.maxEmployees) : '1',
    maxBranches: plan ? String(plan.maxBranches) : '1',
    features: plan?.features ?? DEFAULT_PLAN_FEATURES,
    isActive: plan?.isActive ?? true,
  };
}

/**
 * Self-contained trigger + modal, same shape as app/app/branches/branch-form-dialog.tsx:
 * renders its own "Tambah Paket" / "Edit" Button and the Dialog it opens. Fields mirror
 * upsertPlanSchema (lib/validators/plans.ts) minus sortOrder (see PlanFormDialogProps).
 */
export default function PlanFormDialog({ plan, nextSortOrder = 0 }: PlanFormDialogProps) {
  const isEdit = Boolean(plan);
  const router = useRouter();
  const { show } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanFormState>(() => toFormState(plan));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openDialog() {
    setForm(toFormState(plan));
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
        priceMonthly: Number(form.priceMonthly),
        maxEmployees: Number(form.maxEmployees),
        maxBranches: Number(form.maxBranches),
        features: form.features,
        isActive: form.isActive,
        sortOrder: plan ? plan.sortOrder : nextSortOrder,
      };
      const res = isEdit
        ? await fetch(`/api/platform/plans/${plan?.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/platform/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();

      if (!res.ok) {
        setFieldErrors(json.error?.fields ?? {});
        show(json.error?.message ?? 'Gagal menyimpan paket.', 'error');
        return;
      }

      show(isEdit ? 'Paket berhasil diperbarui.' : 'Paket berhasil ditambahkan.', 'success');
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
        // Every row says "Edit": the name tells a screen-reader user (or voice control: the
        // label still starts with the visible word) which plan this button changes.
        aria-label={isEdit ? `Edit paket ${plan?.name}` : undefined}
      >
        {isEdit ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {isEdit ? 'Edit' : 'Tambah Paket'}
      </Button>

      <Dialog open={open} onClose={closeDialog} title={isEdit ? 'Edit Paket' : 'Tambah Paket'} size="lg">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <Dialog.Body className="flex flex-col gap-4">
            {/* Side by side only from sm (same as the payment-method dialog): at 360px the
                half-width fields clipped their own "Contoh: STARTER" placeholder. */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
              <Input
                label="Kode"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                error={fieldErrors.code}
                maxLength={30}
                placeholder="Contoh: STARTER"
                required
              />
              <Input
                label="Nama"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                error={fieldErrors.name}
                maxLength={60}
                placeholder="Contoh: Starter"
                required
              />
            </div>

            {/* Price, seats and branches in one row from sm (the dialog is size lg); on a phone the
                price takes a full row and the two limits share the next one. */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-start">
              <Input
                label="Harga per Bulan (Rp)"
                type="number"
                min={0}
                value={form.priceMonthly}
                onChange={(e) => setForm((f) => ({ ...f, priceMonthly: e.target.value }))}
                error={fieldErrors.priceMonthly}
                hint="0 untuk paket gratis."
                wrapperClassName="col-span-2 sm:col-span-1"
                required
              />
              <Input
                label="Maks. Karyawan"
                type="number"
                min={1}
                value={form.maxEmployees}
                onChange={(e) => setForm((f) => ({ ...f, maxEmployees: e.target.value }))}
                error={fieldErrors.maxEmployees}
                required
              />
              <Input
                label="Maks. Cabang"
                type="number"
                min={1}
                value={form.maxBranches}
                onChange={(e) => setForm((f) => ({ ...f, maxBranches: e.target.value }))}
                error={fieldErrors.maxBranches}
                required
              />
            </div>

            {/* Two columns from sm (the dialog is size lg): five single-line checkboxes stacked were
                the tallest part of the form and forced an inner scroll on a 1024x600 window.
                gap-y-3 between rows keeps them from reading as one block of text; on a touch screen
                each Checkbox row is already a 44px target, so no extra gap there. */}
            <fieldset className="grid gap-x-4 gap-y-3 border-0 p-0 sm:grid-cols-2 pointer-coarse:gap-y-0">
              <legend className="mb-2 p-0 text-sm font-medium text-text">Fitur</legend>
              {FEATURE_KEYS.map((key) => (
                <Checkbox
                  key={key}
                  label={FEATURE_LABELS[key]}
                  checked={form.features[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, features: { ...f.features, [key]: e.target.checked } }))
                  }
                />
              ))}
            </fieldset>

            <Checkbox
              label="Aktif"
              description="Hanya paket aktif yang tampil di halaman Harga dan bisa dipilih organisasi."
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

function SortablePlanRow({ plan }: { plan: Plan }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: plan.id });
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
      {/* Name with the code under it (one column instead of two), so the table fits a
          tablet without the Aksi column scrolling out of view. */}
      <Table.Cell>
        <span className="block font-medium text-text">{plan.name}</span>
        <span className="mt-0.5 block font-mono text-xs text-muted">{plan.code}</span>
      </Table.Cell>
      {/* Numbers right-aligned so digits line up under each other (Table is tabular-nums). */}
      <Table.Cell className="text-right">{plan.priceMonthly === 0 ? 'Gratis' : RUPIAH.format(plan.priceMonthly)}</Table.Cell>
      <Table.Cell className="text-right">{plan.maxEmployees}</Table.Cell>
      <Table.Cell className="text-right">{plan.maxBranches}</Table.Cell>
      <Table.Cell>
        <Badge tone={plan.isActive ? 'success' : 'neutral'}>{plan.isActive ? 'Aktif' : 'Nonaktif'}</Badge>
      </Table.Cell>
      <Table.Cell className="text-right">
        <PlanFormDialog plan={plan} />
      </Table.Cell>
    </Table.Row>
  );
}

export interface SortablePlansTableProps {
  plans: Plan[];
}

/**
 * Drag-to-reorder list (PRD.md P2, @dnd-kit/core + @dnd-kit/sortable — TRD.md §3). Keeps
 * a local mirror of the server list so a drag reflows immediately instead of waiting on
 * the network round trip, and resyncs it whenever the Server Component page sends a
 * fresh `plans` prop (e.g. after router.refresh() from PlanFormDialog's own save).
 */
export function SortablePlansTable({ plans: initialPlans }: SortablePlansTableProps) {
  const [plans, setPlans] = useState(initialPlans);
  // Adjust state during render rather than in an effect (React's own documented pattern
  // for "resync local state when a prop changes") — avoids the extra committed render an
  // effect-based resync would cause, and setPlans here can't cascade since it only ever
  // runs while initialPlans is actually different from last render's.
  const [prevInitialPlans, setPrevInitialPlans] = useState(initialPlans);
  if (initialPlans !== prevInitialPlans) {
    setPrevInitialPlans(initialPlans);
    setPlans(initialPlans);
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
    const oldIndex = plans.findIndex((p) => p.id === active.id);
    const newIndex = plans.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(plans, oldIndex, newIndex);
    setPlans(reordered);
    try {
      const res = await fetch('/api/platform/plans/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((p) => p.id) }),
      });
      const json = await res.json();
      if (!res.ok) {
        show(json.error?.message ?? 'Gagal mengubah urutan paket.', 'error');
        setPlans(initialPlans);
        return;
      }
      router.refresh();
    } catch {
      show('Tidak bisa terhubung ke server. Coba lagi.', 'error');
      setPlans(initialPlans);
    }
  }

  return (
    // Fixed id: dnd-kit numbers its accessibility ids from a module-level counter, which
    // differs between the server render and hydration (a mismatch logged on every load).
    <DndContext id="plans-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Table aria-label="Daftar paket">
        <Table.Head>
          <Table.Row>
            <Table.HeadCell narrow>
              <span className="sr-only">Urutan</span>
            </Table.HeadCell>
            <Table.HeadCell>Paket</Table.HeadCell>
            <Table.HeadCell className="text-right">Harga / Bulan</Table.HeadCell>
            <Table.HeadCell className="text-right">Maks. Karyawan</Table.HeadCell>
            <Table.HeadCell className="text-right">Maks. Cabang</Table.HeadCell>
            <Table.HeadCell>Status</Table.HeadCell>
            <Table.HeadCell className="text-right">Aksi</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <SortableContext items={plans.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <Table.Body>
            {plans.map((plan) => (
              <SortablePlanRow key={plan.id} plan={plan} />
            ))}
          </Table.Body>
        </SortableContext>
      </Table>
    </DndContext>
  );
}
