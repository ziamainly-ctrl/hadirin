import './checkin.css';

/**
 * The animated tick of the result screen: the ring draws, then the tick, then one soft pulse
 * leaves the circle (checkin.css). With reduced motion it is simply the finished tick. The colour
 * is the semantic success accent: an icon, never a panel.
 */
export default function SuccessCheck({ size = 'lg', className }: { size?: 'sm' | 'lg'; className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center text-success ${size === 'sm' ? 'h-8 w-8' : 'h-16 w-16'} ${className ?? ''}`}>
      <span aria-hidden="true" className="ci-check-pulse absolute inset-1 rounded-full border-2 border-success" />
      <svg viewBox="0 0 64 64" className="relative h-full w-full" aria-hidden="true">
        <circle className="ci-check-circle" cx="32" cy="32" r="26" strokeWidth="4" pathLength="100" />
        <path className="ci-check-tick" d="M20 33.5 28.5 42 44.5 24" strokeWidth="4.5" pathLength="100" />
      </svg>
    </span>
  );
}
