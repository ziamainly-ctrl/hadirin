import Link from 'next/link';
import { Check, ChevronRight, Fingerprint } from 'lucide-react';
import ButtonLink from '@/components/ui/ButtonLink';
import Mascot from '@/components/shared/Mascot';
import Reveal from '@/components/shared/motion/Reveal';
import type { SetupStep } from './model';

/**
 * The dashboard of an organization with nothing to chart yet (no one on the board, no working day on
 * record): instead of five zeros and three empty charts, a calm "Mulai di sini" with the four steps
 * that fill it, the next one highlighted. Steps tick themselves off as the setup tables fill up. A
 * MANAGER cannot reach Cabang / Shift / Karyawan (admin-nav), so they get the one thing they can do
 * and who to ask for the rest.
 */
export default function OnboardingCard({ steps, orgWide }: { steps: SetupStep[]; orgWide: boolean }) {
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <Reveal
      as="section"
      aria-labelledby="dash-onboard-title"
      className="mx-auto my-auto grid w-full max-w-3xl gap-6 rounded-card border border-border bg-surface p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center md:p-6"
    >
      <div className="flex flex-col items-start gap-3">
        <Mascot framing="full" className="h-20 w-20 shrink-0" />
        <div>
          <h2 id="dash-onboard-title" className="text-lg font-semibold tracking-tight text-text">
            Mulai di sini
          </h2>
          <p className="mt-1 text-sm text-muted">
            {orgWide
              ? 'Dashboard terisi begitu ada karyawan yang absen. Empat langkah singkat ini menyiapkannya.'
              : 'Belum ada anggota tim yang terjadwal. Dashboard akan terisi begitu mereka mulai absen.'}
          </p>
        </div>
        {orgWide ? (
          <p className="text-xs text-muted" aria-live="polite">
            <span className="font-medium tabular-nums text-text">
              {doneCount} dari {steps.length}
            </span>{' '}
            langkah selesai
          </p>
        ) : null}
      </div>

      {orgWide ? (
        <ol className="flex flex-col gap-1.5">
          {steps.map((step, i) => {
            const isNext = next?.id === step.id;
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  className={`group flex items-center gap-3 rounded-input border px-3 py-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
                    isNext ? 'border-field bg-surface' : 'border-border bg-surface'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                      step.done ? 'bg-primary text-primary-fg' : isNext ? 'border-2 border-primary text-text' : 'border border-field text-muted'
                    }`}
                  >
                    {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${step.done ? 'text-muted line-through decoration-1' : 'text-text'}`}>
                      {step.title}
                      {step.done ? <span className="sr-only"> (selesai)</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">{step.hint}</span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">
            Minta pemilik atau admin menetapkan Anda sebagai atasan karyawan di menu Karyawan, lalu kembali ke sini. Sementara itu, absen Anda sendiri tetap bisa dicoba.
          </p>
          <ButtonLink href="/app/check-in" variant="primary">
            <Fingerprint className="h-4 w-4" aria-hidden="true" />
            Check-in Saya
          </ButtonLink>
        </div>
      )}
    </Reveal>
  );
}
