// Composia logo — diurnal moth.
//
// A network organism active in light. Wings are a node graph;
// the nucleus is the identity core; antennae are signal receivers.
//
// Color tiers:
//   #DCE0EF white  — most nodes (light-catching surface)
//   #B8AEF0 violet — active structural anchors
//   #8AB0D8 blue   — depth nodes (trailing edges, shadow zones)
//   #D48878 red    — signal nodes (rare — lower outer tips only)
//   #6258E8 core   — nucleus (identity)
//
// Server Component — zero React hooks

type Pt = readonly [number, number];

const COL = {
  white:  '#DCE0EF',
  violet: '#B8AEF0',
  blue:   '#8AB0D8',
  red:    '#D48878',
  core:   '#6258E8',
} as const;
type NodeColor = keyof typeof COL;

// ── Node positions — viewbox 120 × 80, symmetric around x = 60 ─────────────
//
// Moth silhouette: broad rounded forewing, compact hindwing.
// UL3/UR3 are the wing apices — lower than the upper arc UL2/UR2
// because moth forewings have an angled apex, not a top corner.

const P = {
  C:   [60, 40] as Pt,

  // Upper-left wing
  UL1: [48, 25] as Pt,   // inner shoulder
  UL2: [30, 10] as Pt,   // upper arc (highest point)
  UL3: [ 8, 22] as Pt,   // wing apex
  UL4: [ 8, 40] as Pt,   // outer trailing (same x as UL3 → vertical descent)
  UL5: [26, 48] as Pt,   // base shoulder

  // Lower-left wing (hindwing) — compact, partially tucked
  LL1: [44, 54] as Pt,   // inner hinge
  LL2: [24, 65] as Pt,   // outer tip (signal node)
  LL3: [38, 72] as Pt,   // lower base

  // Right mirrors (x → 120 − x)
  UR1: [72, 25] as Pt,  UR2: [ 90, 10] as Pt,  UR3: [112, 22] as Pt,
  UR4: [112, 40] as Pt, UR5: [ 94, 48] as Pt,

  LR1: [76, 54] as Pt,  LR2: [ 96, 65] as Pt,  LR3: [ 82, 72] as Pt,
} as const;

type K = keyof typeof P;
type Tri      = readonly [K, K, K];
type EdgeBend = readonly [K, K, number];

// ── Mirror helpers ────────────────────────────────────────────────────────────

function mk(k: K): K {
  if (k === "C") return "C";
  const s = String(k);
  if (s.startsWith("UL")) return s.replace("UL", "UR") as K;
  if (s.startsWith("LL")) return s.replace("LL", "LR") as K;
  return k;
}

function mirrorEdges(es: EdgeBend[]): EdgeBend[] {
  return es.map(([a, b, bend]) => [mk(a), mk(b), -bend]);
}

// ── 12 triangular faces ───────────────────────────────────────────────────────

const FACES: Tri[] = [
  ["C","UL1","UL2"], ["C","UL2","UL3"], ["C","UL3","UL4"], ["C","UL4","UL5"],
  ["C","LL1","LL2"], ["C","LL2","LL3"],
  ["C","UR1","UR2"], ["C","UR2","UR3"], ["C","UR3","UR4"], ["C","UR4","UR5"],
  ["C","LR1","LR2"], ["C","LR2","LR3"],
];

// ── Edges ─────────────────────────────────────────────────────────────────────
// UL3→UL4 has bend=7: both nodes share x=8, so the control point is pushed hard
// left, creating the rounded outer trailing edge characteristic of moth forewings.

const L_OUTLINE: EdgeBend[] = [
  ["C",   "UL1",  3],
  ["UL1", "UL2",  5],
  ["UL2", "UL3",  4],
  ["UL3", "UL4",  7],  // rounded trailing edge — most curvature
  ["UL4", "UL5",  4],
  ["UL5", "C",    3],
  ["C",   "LL1",  3],
  ["LL1", "LL2",  5],
  ["LL2", "LL3",  3],
  ["LL3", "C",    4],
];

const L_MESH: EdgeBend[] = [
  ["C",   "UL2",  2],  // long forewing diagonal
  ["UL1", "UL4",  3],  // cross-wing chord
  ["UL2", "UL5",  2],  // inner diagonal
  ["C",   "LL2",  2],  // hindwing diagonal
  ["LL1", "LL3",  2],  // hindwing cross
];

const ALL_OUTLINE: EdgeBend[] = [...L_OUTLINE, ...mirrorEdges(L_OUTLINE)];
const ALL_MESH:    EdgeBend[] = [...L_MESH,    ...mirrorEdges(L_MESH)];
const BRIDGES:     EdgeBend[] = [["UL5","LL1", 4], ["UR5","LR1", -4]];

// ── Quadratic bézier path ─────────────────────────────────────────────────────

function qPath([a, b, bend]: EdgeBend): string {
  const [ax, ay] = P[a];
  const [bx, by] = P[b];
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const cx = (mx - (dy / len) * bend).toFixed(2);
  const cy = (my + (dx / len) * bend).toFixed(2);
  return `M${ax},${ay} Q${cx},${cy} ${bx},${by}`;
}

// ── Per-node metadata ─────────────────────────────────────────────────────────

interface NodeStyle {
  r:       number;
  o:       number;
  color:   NodeColor;
  active?: true;
}

const META: Record<K, NodeStyle> = {
  C: { r: 4.5, o: 1.0, color: 'core' },  // rendered separately as nucleus

  // White — surface nodes, catch the most "light"
  UL2: { r: 1.7, o: 0.70, color: 'white' },           UR2: { r: 1.7, o: 0.70, color: 'white' },
  UL3: { r: 2.2, o: 0.84, color: 'white', active: true }, // apex — brightest
  UR3: { r: 2.2, o: 0.84, color: 'white', active: true },

  // Violet — structural anchors, active connection points
  UL1: { r: 2.5, o: 0.78, color: 'violet', active: true }, UR1: { r: 2.5, o: 0.78, color: 'violet', active: true },
  UL5: { r: 2.0, o: 0.68, color: 'violet', active: true }, UR5: { r: 2.0, o: 0.68, color: 'violet', active: true },
  LL1: { r: 2.0, o: 0.68, color: 'violet', active: true }, LR1: { r: 2.0, o: 0.68, color: 'violet', active: true },

  // Blue — depth, shadow zone, trailing edge
  UL4: { r: 1.5, o: 0.46, color: 'blue' }, UR4: { r: 1.5, o: 0.46, color: 'blue' },
  LL3: { r: 1.3, o: 0.40, color: 'blue' }, LR3: { r: 1.3, o: 0.40, color: 'blue' },

  // Red — signal events (rare, hindwing outer tips only)
  LL2: { r: 1.6, o: 0.58, color: 'red', active: true }, LR2: { r: 1.6, o: 0.58, color: 'red', active: true },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ComposiaLogoProps {
  /** Width in px; height scales at VH / VW ratio. */
  size?: number;
  /** SVG declarative pulse on the centre nucleus. */
  animated?: boolean;
  /** Renders "COMPOSIA" wordmark below. */
  showWordmark?: boolean;
  className?: string;
}

export function ComposiaLogo({
  size = 120,
  animated = false,
  showWordmark = false,
  className,
}: ComposiaLogoProps) {
  const VW = 120;
  const VH = showWordmark ? 96 : 80;
  const bodyKeys = (Object.keys(P) as K[]).filter((k) => k !== "C");

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={size}
      height={(size / VW) * VH}
      role="img"
      aria-label="Composia"
      className={className}
    >
      {/* ── 1. Wing fills — faint, straight polygons ──────────────────────── */}
      {FACES.map((t, i) => (
        <polygon
          key={`f${i}`}
          points={t.map((k) => P[k].join(",")).join(" ")}
          fill={COL.white}
          fillOpacity={0.022}
        />
      ))}

      {/* ── 2. Interior mesh — blue-tinted, suggests depth ────────────────── */}
      {ALL_MESH.map((e, i) => (
        <path key={`m${i}`} d={qPath(e)} fill="none"
          stroke="#A8C0DC" strokeWidth="0.44" strokeOpacity="0.14" strokeLinecap="round" />
      ))}

      {/* ── 3. Body bridges ───────────────────────────────────────────────── */}
      {BRIDGES.map((e, i) => (
        <path key={`b${i}`} d={qPath(e)} fill="none"
          stroke={COL.white} strokeWidth="0.50" strokeOpacity="0.18" strokeLinecap="round" />
      ))}

      {/* ── 4. Wing outline — white silhouette ────────────────────────────── */}
      {ALL_OUTLINE.map((e, i) => (
        <path key={`o${i}`} d={qPath(e)} fill="none"
          stroke={COL.white} strokeWidth="0.70" strokeOpacity="0.30" strokeLinecap="round" />
      ))}

      {/* ── 5. Antennae — feeler lines, violet tips ───────────────────────── */}
      <g>
        <path d="M 58,35 Q 44,17 37,8" fill="none"
          stroke={COL.white} strokeWidth="0.48" strokeOpacity="0.30" strokeLinecap="round" />
        <circle cx={37} cy={8} r={1.0} fill={COL.violet} fillOpacity={0.82} />

        <path d="M 62,35 Q 76,17 83,8" fill="none"
          stroke={COL.white} strokeWidth="0.48" strokeOpacity="0.30" strokeLinecap="round" />
        <circle cx={83} cy={8} r={1.0} fill={COL.violet} fillOpacity={0.82} />
      </g>

      {/* ── 6. Body nodes — colored by tier ───────────────────────────────── */}
      {bodyKeys.map((k) => {
        const { r, o, color, active } = META[k];
        const [cx, cy] = P[k];
        const fill = COL[color];
        return (
          <g key={k}>
            {active && (
              <circle cx={cx} cy={cy} r={r + 3.0} fill={fill}
                fillOpacity={color === 'red' ? 0.06 : 0.09} />
            )}
            <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={o} />
          </g>
        );
      })}

      {/* ── 7. Nucleus — elongated body blooms suggest moth thorax ────────── */}
      <g>
        <ellipse cx={60} cy={40} rx={13} ry={17} fill={COL.core} fillOpacity={0.016}>
          {animated && (
            <>
              <animate attributeName="rx" values="10;16;10" dur="3.2s" repeatCount="indefinite" />
              <animate attributeName="ry" values="13;20;13" dur="3.2s" repeatCount="indefinite" />
            </>
          )}
        </ellipse>
        <ellipse cx={60} cy={40} rx={8} ry={11} fill={COL.core} fillOpacity={0.044}>
          {animated && (
            <>
              <animate attributeName="rx" values="6;10;6" dur="3.2s" repeatCount="indefinite" />
              <animate attributeName="ry" values="8;13;8" dur="3.2s" repeatCount="indefinite" />
            </>
          )}
        </ellipse>
        <circle cx={60} cy={40} r={7} fill={COL.core} fillOpacity={0.09} />
        <circle cx={60} cy={40} r={4.5} fill={COL.core} fillOpacity={1.0}>
          {animated && (
            <>
              <animate attributeName="r" values="3.8;5.2;3.8" dur="3.2s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values="0.82;1;0.82" dur="3.2s" repeatCount="indefinite" />
            </>
          )}
        </circle>
      </g>

      {/* ── 8. Wordmark ───────────────────────────────────────────────────── */}
      {showWordmark && (
        <text
          x={VW / 2} y={VH - 4}
          textAnchor="middle"
          fontFamily="'Space Grotesk', sans-serif"
          fontWeight="600"
          fontSize="10"
          letterSpacing="3"
          fill={COL.white}
          fillOpacity="0.48"
        >
          COMPOSIA
        </text>
      )}
    </svg>
  );
}
