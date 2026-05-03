"use client";

export type MothVariant = "default" | "gensyn" | "keeper" | "ens" | "lukso" | "core";

interface Props {
  size?: number;
  variant?: MothVariant;
  score?: number | null;
  glowColor?: string;
  animDelay?: string;
  animated?: boolean;
  className?: string;
  /**
   * 0 = elite  (score ≥ 90): denser nodes, stronger pulse, premium glow
   * 1 = active (score ≥ 75): standard
   * 2 = emerging (score ≥ 60): softer fill, slower pulse
   * 3 = low    (score  < 60): minimal nodes, very soft
   */
  density?: 0 | 1 | 2 | 3;
}

// ── Geometry ──────────────────────────────────────────────────────────────────
const THORAX_CX = 100;
const THORAX_CY = 60;

const BODY = { cx: THORAX_CX, cy: THORAX_CY + 10, rx: 6, ry: 16 };
const HEAD = { cx: THORAX_CX, cy: THORAX_CY - 14, r: 5 };

const LEFT_WING_NODES = [
  [100, 55],
  [72,  35],
  [50,  45],
  [30,  60],
  [45,  75],
  [65,  70],
  [80,  55],
  [60,  55],
  [40,  50],
];

const LEFT_WING_TRIANGLES: [number, number, number][] = [
  [0, 1, 6], [0, 6, 5], [1, 2, 7], [7, 2, 3],
  [7, 3, 8], [8, 3, 4], [5, 7, 6], [5, 4, 7],
  [0, 5, 4],
];

const LEFT_LOWER_NODES = [
  [100, 60],
  [78,  68],
  [60,  80],
  [50,  90],
  [70,  95],
  [88,  82],
];

const LEFT_LOWER_TRIANGLES: [number, number, number][] = [
  [0, 1, 5], [1, 2, 4], [2, 3, 4], [1, 4, 5],
];

const GENSYN_EXTRA_NODES = [
  [55, 48], [66, 42], [44, 58], [58, 62], [72, 52],
];

const LUKSO_ANCHOR_NODES = [
  [85, 100], [100, 110], [115, 100],
  [92, 105], [108, 105],
];

// Inner wing nodes added for elite tier — must stay symmetric
const ELITE_EXTRA_NODES_LEFT = [
  [86, 43],
  [68, 32],
  [55, 53],
  [77, 64],
];

// ── Colour per score ──────────────────────────────────────────────────────────
export function scoreColor(score: number): string {
  if (score >= 90) return "#A78BFA";
  if (score >= 75) return "#7B61FF";
  if (score >= 60) return "#A78BFA";
  return "#FF4060";
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MothLogo({
  size = 120,
  variant = "default",
  score = null,
  glowColor,
  animDelay = "0s",
  animated = true,
  className = "",
  density = 1,
}: Props) {
  const color = glowColor ?? (score !== null ? scoreColor(score) : "#7B61FF");
  const cid   = color.replace("#", "");

  // Wing fill — brighter at elite, quieter at low
  const wingOpacity = density === 0 ? 0.44 : density === 1 ? 0.32 : density === 2 ? 0.22 : 0.14;
  const strokeWidth = 0.7;

  // Pulse — elite is tighter and faster; low is slow and barely visible
  const pulseDur   = density === 0 ? "2.0s" : density === 1 ? "2.8s" : density === 2 ? "3.6s" : "4.8s";
  const pulseMaxR  = density === 0 ? 28 : density === 1 ? 22 : density === 2 ? 18 : 14;
  const coreMaxR   = density === 0 ? 7  : density === 1 ? 6  : density === 2 ? 5.5 : 5;
  const pulseMaxOp = density === 0 ? 0.65 : density === 1 ? 0.5 : density === 2 ? 0.35 : 0.22;

  // Score backing opacity — slightly lower for elite so nucleus glow bleeds through
  const backingPeak = density === 0 ? 0.62 : 0.76;

  function mirrorX(pts: number[][]): number[][] {
    return pts.map(([x, y]) => [200 - x, y]);
  }
  function mirrorTriangles(nodes: number[][], tris: [number, number, number][]) {
    return { nodes: mirrorX(nodes), tris };
  }

  const rightWing  = mirrorTriangles(LEFT_WING_NODES, LEFT_WING_TRIANGLES);
  const rightLower = mirrorTriangles(LEFT_LOWER_NODES, LEFT_LOWER_TRIANGLES);

  function polyPts(nodes: number[][], indices: number[]) {
    return indices.map((i) => nodes[i].join(",")).join(" ");
  }

  function renderTriangles(
    nodes: number[][],
    tris: [number, number, number][],
    opacity: number,
    key: string
  ) {
    return tris.map((tri, i) => (
      <polygon
        key={`${key}-${i}`}
        points={polyPts(nodes, tri)}
        fill={color}
        fillOpacity={opacity * 0.45}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity * 1.6}
      />
    ));
  }

  function renderNodes(nodes: number[][], r = 1.5, outerStart = 2) {
    return nodes.map(([x, y], i) => {
      const isOuter = i >= outerStart;
      return (
        <circle
          key={i}
          cx={x} cy={y} r={isOuter ? r * 0.85 : r}
          fill={color}
          fillOpacity={isOuter ? 0.55 : 0.95}
          filter={!isOuter ? `url(#nglow-${cid})` : undefined}
          className={animated ? "moth-node" : ""}
          style={animated ? { animationDelay: `${parseFloat(animDelay) + i * 0.12}s` } : {}}
        />
      );
    });
  }

  function keeperCurves() {
    const curves = [
      `M 100,55 Q 72,35 50,45`, `M 100,55 Q 65,38 40,50`,
      `M 100,55 Q 70,65 45,75`, `M 100,60 Q 75,72 50,90`,
    ];
    const mirrored = curves.map((d) => d.replace(/(\d+),(\d+)/g, (_, x, y) => `${200 - +x},${+y}`));
    return [...curves, ...mirrored].map((d, i) => (
      <path key={i} d={d} stroke={color} strokeWidth={0.8} strokeOpacity={0.35} fill="none" />
    ));
  }

  function ensRecords() {
    const lines = [
      { x1: 78, x2: 122, y: 86, o: 0.55 },
      { x1: 82, x2: 118, y: 93, o: 0.38 },
      { x1: 87, x2: 113, y: 100, o: 0.24 },
    ];
    return (
      <>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y} x2={l.x2} y2={l.y}
            stroke={color} strokeWidth={0.7} strokeOpacity={l.o} strokeDasharray="2 2" />
        ))}
        <circle cx={75} cy={86} r={1.2} fill={color} fillOpacity={0.7} />
        <circle cx={125} cy={86} r={1.2} fill={color} fillOpacity={0.7} />
      </>
    );
  }

  function luksoAnchors() {
    return (
      <>
        <line x1={100} y1={78} x2={100} y2={112} stroke={color} strokeWidth={0.8} strokeOpacity={0.5} />
        <line x1={85} y1={106} x2={115} y2={106} stroke={color} strokeWidth={0.8} strokeOpacity={0.5} />
        {renderNodes(LUKSO_ANCHOR_NODES, 2)}
        <polygon points="92,98 108,98 100,112" fill={color} fillOpacity={0.15}
          stroke={color} strokeWidth={0.6} strokeOpacity={0.6} />
      </>
    );
  }

  const wingsClass = animated ? "moth-wings" : "";
  const wingsStyle = animated ? { animationDelay: animDelay } : {};

  return (
    <svg
      viewBox="0 0 200 120"
      width={size}
      height={size * 0.6}
      className={className}
      aria-label="Composia moth logo"
    >
      <defs>
        {/* Standard nucleus glow */}
        <filter id={`glow-${cid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Node dot glow */}
        <filter id={`nglow-${cid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/*
          Score backing gradient — dark radial fill centered on the nucleus.
          Dims the wing content behind the score number so the digit reads cleanly.
          Lower peak opacity for elite so the nucleus glow still bleeds through.
        */}
        <radialGradient id={`sbg-${cid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#050508" stopOpacity={backingPeak} />
          <stop offset="55%"  stopColor="#050508" stopOpacity={backingPeak * 0.45} />
          <stop offset="100%" stopColor="#050508" stopOpacity="0" />
        </radialGradient>

        {/* Elite-only: wide soft bloom behind nucleus for premium "presence" */}
        {density === 0 && (
          <filter id={`ebloom-${cid}`} x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" />
          </filter>
        )}
      </defs>

      {/*
        ── Layer order (painter's algorithm) ──────────────────────────────
        1. Elite aura       — large faint halo behind the whole shape
        2. Wing triangles   — mesh fill
        3. Wing nodes       — dot network
        4. Variant extras   — protocol-specific elements
        5. Score backing    — dark radial fade clears space for the digit
        6. Elite bloom      — wide soft glow, pre-nucleus
        7. Body + Head
        8. Nucleus rings    — pulse, halo, core dot
      */}

      {/* 1 — Elite aura: faint outer ring that gives top agents "presence" */}
      {density === 0 && (
        <ellipse
          cx={THORAX_CX} cy={THORAX_CY}
          rx={60} ry={42}
          fill="none"
          stroke={color}
          strokeWidth={0.6}
          strokeOpacity={0.07}
        />
      )}

      {/* 2 — Wing triangles */}
      <g className={wingsClass} style={wingsStyle}>
        {renderTriangles(LEFT_WING_NODES,   LEFT_WING_TRIANGLES,  wingOpacity,       "uwl")}
        {renderTriangles(rightWing.nodes,   rightWing.tris,       wingOpacity,       "uwr")}
        {renderTriangles(LEFT_LOWER_NODES,  LEFT_LOWER_TRIANGLES, wingOpacity * 0.7, "lwl")}
        {renderTriangles(rightLower.nodes,  rightLower.tris,      wingOpacity * 0.7, "lwr")}
        {variant === "keeper" && keeperCurves()}
      </g>

      {/* 3 — Wing nodes */}
      {renderNodes(LEFT_WING_NODES)}
      {renderNodes(rightWing.nodes)}
      {density < 3 && renderNodes(LEFT_LOWER_NODES.slice(1))}
      {density < 3 && renderNodes(rightLower.nodes.slice(1))}

      {/* 4 — Variant-specific and density extras */}
      {variant === "gensyn" && renderNodes(GENSYN_EXTRA_NODES)}
      {variant === "gensyn" && renderNodes(mirrorX(GENSYN_EXTRA_NODES))}
      {density === 0 && renderNodes(ELITE_EXTRA_NODES_LEFT)}
      {density === 0 && renderNodes(mirrorX(ELITE_EXTRA_NODES_LEFT))}
      {variant === "ens"   && ensRecords()}
      {variant === "lukso" && luksoAnchors()}

      {/*
        5 — Score backing.
        Dark radial gradient ellipse centered on the nucleus.
        Painted after wings/nodes, before body+nucleus, so it clears
        the wing content behind the digit without touching the nucleus glow.
        Size covers the score text area (roughly ±24px around centre).
      */}
      <ellipse
        cx={THORAX_CX} cy={THORAX_CY}
        rx={28} ry={22}
        fill={`url(#sbg-${cid})`}
      />

      {/* 6 — Elite bloom: wide diffuse glow that lifts the nucleus luminosity */}
      {density === 0 && (
        <circle
          cx={THORAX_CX} cy={THORAX_CY} r={16}
          fill={color} fillOpacity={0.10}
          filter={`url(#ebloom-${cid})`}
        />
      )}

      {/* 7 — Body + Head */}
      <ellipse
        cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry}
        fill={color} fillOpacity={0.15}
        stroke={color} strokeWidth={0.8} strokeOpacity={0.8}
      />
      <circle
        cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r}
        fill={color} fillOpacity={0.25}
        stroke={color} strokeWidth={0.8} strokeOpacity={0.9}
      />

      {/* 8 — Nucleus: pulse ring → outer halo → inner core */}
      <circle cx={THORAX_CX} cy={THORAX_CY} r={10} fill="none"
        stroke={color} strokeWidth={0.8} strokeOpacity={0}>
        {animated && <>
          <animate attributeName="r"
            values={`10;${pulseMaxR};10`}
            dur={pulseDur} repeatCount="indefinite" />
          <animate attributeName="stroke-opacity"
            values={`${pulseMaxOp};0;${pulseMaxOp}`}
            dur={pulseDur} repeatCount="indefinite" />
        </>}
      </circle>

      <circle
        cx={THORAX_CX} cy={THORAX_CY} r={10}
        fill={color} fillOpacity={0.14}
        stroke={color} strokeWidth={1.4} strokeOpacity={1}
        filter={`url(#glow-${cid})`}
      />

      <circle cx={THORAX_CX} cy={THORAX_CY} r={5} fill={color} fillOpacity={0.85}>
        {animated && <>
          <animate attributeName="r"
            values={`4;${coreMaxR};4`}
            dur={pulseDur} repeatCount="indefinite" />
          <animate attributeName="fill-opacity"
            values="0.75;1;0.75"
            dur={pulseDur} repeatCount="indefinite" />
        </>}
      </circle>

      {score !== null && (
        <text
          x={THORAX_CX} y={THORAX_CY + 4}
          textAnchor="middle" fontSize="9"
          fontFamily="monospace" fontWeight="bold"
          fill={color} fillOpacity={0.0}
        />
      )}
    </svg>
  );
}
