// NetworkMoth — visual system element, NOT a logo.
// Network graph in butterfly silhouette: nodes + edges + pulsing central node.
// Server Component — animations via SMIL + CSS keyframes, no hooks needed.

interface Props {
  color?:   string
  opacity?: number
  size?:    number   // width in px; height scales 10:7 with viewBox
  className?: string
}

// ── Geometry — viewBox 400 × 280, centre (200, 140) ─────────────────────────

const N = [
  // 0: central nucleus
  { x: 200, y: 140, r: 4.5 },

  // 1–9: left upper wing perimeter
  { x: 178, y: 124, r: 2.2 },
  { x: 155, y: 110, r: 2.0 },
  { x: 126, y:  98, r: 2.2 },
  { x:  98, y:  94, r: 1.8 },
  { x:  74, y: 104, r: 2.0 },
  { x:  58, y: 122, r: 1.8 },
  { x:  66, y: 148, r: 2.0 },
  { x:  98, y: 158, r: 2.0 },
  { x: 140, y: 154, r: 2.2 },

  // 10–11: left upper wing interior
  { x: 114, y: 120, r: 1.6 },
  { x: 150, y: 128, r: 1.8 },

  // 12–16: left lower wing
  { x: 178, y: 158, r: 2.0 },
  { x: 160, y: 176, r: 1.8 },
  { x: 150, y: 196, r: 1.6 },
  { x: 164, y: 210, r: 1.6 },
  { x: 184, y: 202, r: 1.8 },

  // 17–25: right upper wing (mirror x → 400 − x)
  { x: 222, y: 124, r: 2.2 },
  { x: 245, y: 110, r: 2.0 },
  { x: 274, y:  98, r: 2.2 },
  { x: 302, y:  94, r: 1.8 },
  { x: 326, y: 104, r: 2.0 },
  { x: 342, y: 122, r: 1.8 },
  { x: 334, y: 148, r: 2.0 },
  { x: 302, y: 158, r: 2.0 },
  { x: 260, y: 154, r: 2.2 },

  // 26–27: right upper wing interior
  { x: 286, y: 120, r: 1.6 },
  { x: 250, y: 128, r: 1.8 },

  // 28–32: right lower wing
  { x: 222, y: 158, r: 2.0 },
  { x: 240, y: 176, r: 1.8 },
  { x: 250, y: 196, r: 1.6 },
  { x: 236, y: 210, r: 1.6 },
  { x: 216, y: 202, r: 1.8 },
] as const;

const E: [number, number][] = [
  // centre → wing roots
  [0,1],[0,11],[0,12],[0,17],[0,27],[0,28],

  // left upper perimeter
  [1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,1],
  // left upper interior
  [1,11],[9,11],[2,10],[3,10],[4,10],[6,10],[7,10],[10,11],

  // left lower
  [12,13],[13,14],[14,15],[15,16],[16,12],

  // right upper perimeter
  [17,18],[18,19],[19,20],[20,21],[21,22],[22,23],[23,24],[24,25],[25,17],
  // right upper interior
  [17,27],[25,27],[18,26],[19,26],[20,26],[22,26],[23,26],[26,27],

  // right lower
  [28,29],[29,30],[30,31],[31,32],[32,28],
];

export default function NetworkMoth({
  color   = "#7B61FF",
  opacity = 1,
  size    = 500,
  className = "",
}: Props) {
  const w = size;
  const h = Math.round(size * 0.7);

  return (
    <svg
      viewBox="0 0 400 280"
      width={w}
      height={h}
      className={className}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <filter id="nm-core-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Edges ── */}
      {E.map(([a, b], i) => (
        <line
          key={i}
          x1={N[a].x} y1={N[a].y}
          x2={N[b].x} y2={N[b].y}
          stroke={color}
          strokeWidth="0.65"
          strokeOpacity="0.30"
        />
      ))}

      {/* ── Wing nodes — staggered opacity pulse ── */}
      {N.slice(1).map((n, i) => (
        <circle
          key={i + 1}
          cx={n.x} cy={n.y} r={n.r}
          fill={color}
          fillOpacity="0.72"
          className="moth-node"
          style={{ animationDelay: `${((i * 0.18) % 2).toFixed(2)}s` }}
        />
      ))}

      {/* ── Central nucleus — SMIL pulse ── */}
      <g filter="url(#nm-core-glow)">
        {/* outer bloom */}
        <circle cx={N[0].x} cy={N[0].y} r={N[0].r} fill={color} fillOpacity="0.18">
          <animate attributeName="r"            values="4;10;4"    dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.18;0;0.18" dur="2.8s" repeatCount="indefinite" />
        </circle>
        {/* solid core */}
        <circle cx={N[0].x} cy={N[0].y} r={N[0].r} fill={color}>
          <animate attributeName="r"            values="3.5;5.5;3.5" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.80;1;0.80"  dur="2.8s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
