import { CheckCircle2, Camera, MapPin } from 'lucide-react';

/**
 * Static hero visual (PRD.md/landing redesign): a simplified, decorative recreation of
 * the real /m check-in screen (app/m/page.tsx + check-in-card.tsx) — shift info, geofence
 * line, selfie prompt, primary button, and the "on time" result — not a photo or a literal
 * screenshot, and not any other product's design. Pure markup, no state: this never needs
 * to be interactive, so it stays a plain Server Component nested in the marketing page.
 *
 * Everything inside is sized in em, so the one font-size on the root scales the whole phone:
 * a fixed 16px (a 300px phone) below lg, and from lg up a clamp() of the viewport's width and
 * height, so the mock grows with the window (up to the width the hero column holds) and shrinks to
 * fit a 1024x600 window instead of needing a scroll. Neutral surfaces only: the green is a small icon accent, never a fill.
 *
 * Centered on its own (phones, tablets); `lg:ml-auto` pins it to the container's right edge,
 * the same edge as the header's Sign up button, instead of floating mid-column.
 */
export default function CheckInPreview() {
  // Sizes are in em of the root's font-size (a text size like text-[0.75em] goes on an inner
  // span, never on the box that carries padding or margin, whose em would then shrink with it).
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-[18.75em] max-w-full rounded-[2.5em] border border-border bg-surface p-[0.75em] text-base shadow-xl lg:mr-0 lg:ml-auto lg:text-[length:clamp(14px,min(1.5vw,2.9vh),21px)]"
    >
      <div className="rounded-[2em] border border-border bg-accent/40 p-[1.25em]">
        <div className="flex items-center justify-between gap-[0.75em]">
          <div>
            <p className="text-[0.75em] font-medium text-muted">Hari ini</p>
            <p className="text-[0.875em] font-semibold text-text">Shift Pagi · 08.00–17.00</p>
          </div>
          <span className="flex h-[2.25em] w-[2.25em] shrink-0 items-center justify-center rounded-full border border-border bg-accent text-status-present">
            <CheckCircle2 className="h-[1.25em] w-[1.25em]" />
          </span>
        </div>

        <div className="mt-[1.25em] flex items-center gap-[0.5em] rounded-[0.625em] border border-border bg-surface px-[0.75em] py-[0.5em] text-muted">
          <MapPin className="h-[0.875em] w-[0.875em] shrink-0 text-text" />
          <span className="text-[0.75em]">Kantor Pusat · jarak 12 m</span>
        </div>

        <div className="mt-[1.5em] flex flex-col items-center gap-[0.75em]">
          <div className="flex h-[5em] w-[5em] items-center justify-center rounded-full border-2 border-dashed border-primary/40 text-primary">
            <Camera className="h-[1.75em] w-[1.75em]" />
          </div>
          <div className="w-full rounded-[0.625em] bg-primary px-[1em] py-[0.75em] text-center text-primary-fg">
            <span className="text-[0.875em] font-semibold">Absen Masuk</span>
          </div>
        </div>

        <div className="mt-[1em] flex items-center justify-center gap-[0.375em] rounded-[0.625em] border border-border bg-accent px-[0.75em] py-[0.5em] text-text">
          <CheckCircle2 className="h-[0.875em] w-[0.875em] shrink-0 text-status-present" />
          <span className="text-[0.75em] font-medium">Tepat waktu — tercatat 08.02</span>
        </div>
      </div>
    </div>
  );
}
