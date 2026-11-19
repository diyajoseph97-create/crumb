// Flat, modernist cut-out shapes (arches, circles, quarter-rounds) in paired
// colours, after Chandigarh's architecture. Used wherever a recipe has no photo
// and as the small mark on empty states. No colour is "the" brand colour: each
// recipe gets one light/dark pairing from its id.
import type { CSSProperties, ReactNode } from "react";

export const PAIRS = [
  { bg: "#EFC6B4", a: "#C8502A", b: "#1F4D36" }, // blush · terracotta · forest
  { bg: "#B9D0EA", a: "#2C4C9C", b: "#F4EFE6" }, // sky · cobalt · cream
  { bg: "#F0DCA0", a: "#1F4D36", b: "#C8502A" }, // butter · forest · terracotta
  { bg: "#CFDCC3", a: "#1F4D36", b: "#EFC6B4" }, // sage · forest · blush
  { bg: "#E6DED0", a: "#C8502A", b: "#2C4C9C" }, // stone · terracotta · cobalt
];

export function pairFor(seed: number) {
  return PAIRS[seed % PAIRS.length];
}

/** A composition filling a 100 × (100·ratio) box. */
export function Composition({ seed, ratio = 1, className = "", style }: { seed: number; ratio?: number; className?: string; style?: CSSProperties }) {
  const W = 100;
  const H = Math.round(100 * ratio);
  const { bg, a, b } = pairFor(seed);
  const kind = Math.floor(seed / PAIRS.length) % 6;
  let art: ReactNode;
  if (ratio < 0.5) {
    const n = 4;
    art = (
      <>
        {Array.from({ length: n }, (_, i) => {
          const x = 8 + i * 17;
          return <path key={i} d={`M${x} ${H} V${H * 0.55} A6.5 6.5 0 0 1 ${x + 13} ${H * 0.55} V${H} Z`} fill={i % 2 ? b : a} />;
        })}
        <circle cx={86} cy={H * 0.28} r={5} fill={a} />
      </>
    );
  } else switch (kind) {
    case 0: // doorway arch with a sun
      art = (
        <>
          <path d={`M30 ${H} V${H * 0.5} A20 20 0 0 1 70 ${H * 0.5} V${H} Z`} fill={a} />
          <circle cx={74} cy={H * 0.22} r={11} fill={b} />
        </>
      );
      break;
    case 1: // big circle, quarter-round in the corner
      art = (
        <>
          <circle cx={58} cy={H * 0.46} r={30} fill={a} />
          <path d={`M0 ${H} V${H - 34} A34 34 0 0 1 34 ${H} Z`} fill={b} />
        </>
      );
      break;
    case 2: // two half-moons facing each other (the Assembly roof)
      art = (
        <>
          <path d={`M14 ${H * 0.62} A24 24 0 0 1 62 ${H * 0.62} Z`} fill={a} />
          <path d={`M38 ${H * 0.62} A24 24 0 0 0 86 ${H * 0.62} Z`} fill={b} />
          <rect x={14} y={H * 0.62} width={72} height={3} fill={a} />
        </>
      );
      break;
    case 3: // stripe band and a rising half-circle
      art = (
        <>
          <rect x={0} y={H * 0.68} width={W} height={H * 0.32} fill={a} />
          <path d={`M26 ${H * 0.68} A24 24 0 0 1 74 ${H * 0.68} Z`} fill={b} />
        </>
      );
      break;
    case 4: // quarter-round from the top-right, small dot
      art = (
        <>
          <path d={`M${W} 0 V60 A60 60 0 0 1 ${W - 60} 0 Z`} fill={a} />
          <circle cx={28} cy={H * 0.72} r={9} fill={b} />
        </>
      );
      break;
    default: // stacked pill and circle
      art = (
        <>
          <rect x={22} y={H * 0.3} width={56} height={H * 0.6} rx={28} fill={a} />
          <circle cx={50} cy={H * 0.3} r={16} fill={b} />
        </>
      );
  }
  return (
    <svg className={`composition ${className}`} style={style} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width={W} height={H} fill={bg} />
      {art}
    </svg>
  );
}

/** The small mark for empty states and the welcome screen: a sun over an arch. */
export function Mark({ className = "", tone = 0 }: { className?: string; tone?: number }) {
  const { a, b } = PAIRS[tone % PAIRS.length];
  return (
    <svg className={`mark ${className}`} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M14 64 V34 A18 18 0 0 1 50 34 V64 Z" fill={a} />
      <circle cx={47} cy={14} r={9} fill={b} />
    </svg>
  );
}
