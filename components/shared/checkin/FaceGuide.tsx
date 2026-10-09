import { useId } from 'react';
import { OVAL } from './light-meter';
import './checkin.css';

const W = 300;
const H = 400;

/**
 * The oval over the viewfinder: everything outside it is dimmed, so the eye goes to "put your face
 * here". The ellipse is the same one light-meter.ts measures the light in (OVAL, as fractions of
 * the 3:4 frame), so the hint "terlalu gelap" is about exactly the face the guide asks for. While
 * the light is good it breathes slowly; otherwise it is a dashed outline. Decorative: the same
 * instruction is in the hint chip and the page text.
 */
export default function FaceGuide({ ready }: { ready: boolean }) {
  const id = `ci-oval-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const cx = OVAL.cx * W;
  const cy = OVAL.cy * H;
  const rx = OVAL.rx * W;
  const ry = OVAL.ry * H;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <mask id={id}>
          <rect width={W} height={H} fill="white" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="black" />
        </mask>
      </defs>
      {/* A viewfinder is black in both themes, so this overlay is too (not a theme token). 50 %: face-capture
          guidance (Incode) keeps the dim at 50 % or more so the silhouette stays clear on a bright frame. */}
      <rect width={W} height={H} fill="black" fillOpacity="0.5" mask={`url(#${id})`} />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeDasharray={ready ? undefined : '7 7'}
        strokeOpacity={ready ? 0.9 : 0.75}
        className={ready ? 'ci-guide-ready' : undefined}
      />
    </svg>
  );
}
