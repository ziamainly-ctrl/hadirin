import { CheckCircle2, Camera, MapPin } from 'lucide-react';

/**
 * Static hero visual (PRD.md/landing redesign): a simplified, decorative recreation of
 * the real /m check-in screen (app/m/page.tsx + check-in-card.tsx) — shift info, geofence
 * line, selfie prompt, primary button, and the "on time" result — not a photo or a literal
 * screenshot, and not any other product's design. Pure markup, no state: this never needs
 * to be interactive, so it stays a plain Server Component nested in the marketing page.
 */
export default function CheckInPreview() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[300px] rounded-[2.5rem] border border-black/10 bg-surface p-3 shadow-xl dark:border-white/10"
    >
      <div className="rounded-[2rem] border border-black/5 bg-bg p-5 dark:border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Hari ini</p>
            <p className="text-sm font-semibold text-text">Shift Pagi · 08.00–17.00</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-present/15 text-status-present">
            <CheckCircle2 className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-input border border-black/5 bg-surface px-3 py-2 text-xs text-muted dark:border-white/5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
          Kantor Pusat · dalam radius 100 m
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-primary/40 text-primary">
            <Camera className="h-7 w-7" />
          </div>
          <div className="w-full rounded-input bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-fg">
            Absen Masuk
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 rounded-input bg-status-present/10 px-3 py-2 text-xs font-medium text-status-present">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Tepat waktu — tercatat 08.02
        </div>
      </div>
    </div>
  );
}
