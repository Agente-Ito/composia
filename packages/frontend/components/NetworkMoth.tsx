// NetworkMoth — visual system element.
// Butterfly silhouette as a network graph.
// Center = strongest. Mid = medium. Outer = faint.

interface Props {
  color?:   string
  opacity?: number
  size?:    number
  className?: string
}

// ── Nodes — viewBox 400×280, centre (200, 140) ───────────────────────────────
// o = fillOpacity  |  pulse = SMIL breathing  |  glow = filter
const NODES = [
  // ── Centre cluster ──────────────────────────────────────────────────────────
  { x: 200, y: 140, r: 5.0, o: 1.00, pulse: true,  glow: true  }, // 0  nucleus
  { x: 182, y: 126, r: 2.8, o: 0.88, pulse: true,  glow: false }, // 1  left inner
  { x: 218, y: 126, r: 2.8, o: 0.88, pulse: true,  glow: false }, // 2  right inner
  { x: 182, y: 156, r: 2.4, o: 0.78, pulse: false, glow: false }, // 3  left lower inner
  { x: 218, y: 156, r: 2.4, o: 0.78, pulse: false, glow: false }, // 4  right lower inner

  // ── Left upper wing ─────────────────────────────────────────────────────────
  { x: 162, y: 114, r: 2.4, o: 0.78, pulse: false, glow: false }, // 5  shoulder
  { x: 138, y: 102, r: 2.2, o: 0.64, pulse: false, glow: false }, // 6
  { x: 112, y:  94, r: 2.0, o: 0.52, pulse: false, glow: false }, // 7  apex
  { x:  88, y: 104, r: 1.8, o: 0.40, pulse: false, glow: false }, // 8  outer top
  { x:  76, y: 124, r: 1.8, o: 0.34, pulse: false, glow: false }, // 9  outer tip
  { x:  86, y: 148, r: 1.8, o: 0.38, pulse: false, glow: false }, // 10 outer lower
  { x: 112, y: 158, r: 2.0, o: 0.52, pulse: false, glow: false }, // 11 lower mid
  { x: 142, y: 150, r: 2.2, o: 0.66, pulse: false, glow: false }, // 12 inner lower
  { x: 124, y: 114, r: 1.8, o: 0.52, pulse: false, glow: false }, // 13 interior

  // ── Right upper wing (exact mirror x → 400−x) ───────────────────────────────
  { x: 238, y: 114, r: 2.4, o: 0.78, pulse: false, glow: false }, // 14 shoulder
  { x: 262, y: 102, r: 2.2, o: 0.64, pulse: false, glow: false }, // 15
  { x: 288, y:  94, r: 2.0, o: 0.52, pulse: false, glow: false }, // 16 apex
  { x: 312, y: 104, r: 1.8, o: 0.40, pulse: false, glow: false }, // 17 outer top
  { x: 324, y: 124, r: 1.8, o: 0.34, pulse: false, glow: false }, // 18 outer tip
  { x: 314, y: 148, r: 1.8, o: 0.38, pulse: false, glow: false }, // 19 outer lower
  { x: 288, y: 158, r: 2.0, o: 0.52, pulse: false, glow: false }, // 20 lower mid
  { x: 258, y: 150, r: 2.2, o: 0.66, pulse: false, glow: false }, // 21 inner lower
  { x: 276, y: 114, r: 1.8, o: 0.52, pulse: false, glow: false }, // 22 interior

  // ── Left lower wing ─────────────────────────────────────────────────────────
  { x: 180, y: 164, r: 2.0, o: 0.62, pulse: false, glow: false }, // 23
  { x: 164, y: 182, r: 1.8, o: 0.50, pulse: false, glow: false }, // 24
  { x: 156, y: 200, r: 1.6, o: 0.38, pulse: false, glow: false }, // 25
  { x: 168, y: 214, r: 1.6, o: 0.32, pulse: false, glow: false }, // 26
  { x: 184, y: 208, r: 1.8, o: 0.44, pulse: false, glow: false }, // 27

  // ── Right lower wing ────────────────────────────────────────────────────────
  { x: 220, y: 164, r: 2.0, o: 0.62, pulse: false, glow: false }, // 28
  { x: 236, y: 182, r: 1.8, o: 0.50, pulse: false, glow: false }, // 29
  { x: 244, y: 200, r: 1.6, o: 0.38, pulse: false, glow: false }, // 30
  { x: 232, y: 214, r: 1.6, o: 0.32, pulse: false, glow: false }, // 31
  { x: 216, y: 208, r: 1.8, o: 0.44, pulse: false, glow: false }, // 32
] as const;

// ── Edges — [from, to, weight] ────────────────────────────────────────────────
// weight 0 = centre-heavy (0.55)  |  1 = mid (0.28)  |  2 = outer-light (0.13)
const EDGES: [number, number, number][] = [
  // centre cluster — densest
  [0,1,0],[0,2,0],[0,3,0],[0,4,0],
  [1,2,0],[1,3,0],[2,4,0],[3,4,0],

  // centre → shoulders
  [0,5,0],[1,5,0],[0,14,0],[2,14,0],

  // centre → lower wing roots
  [3,23,0],[4,28,0],

  // left upper — perimeter
  [5,6,1],[6,7,1],[7,8,1],[8,9,2],[9,10,2],[10,11,2],[11,12,1],[12,1,1],
  // left upper — interior
  [5,13,1],[6,13,1],[7,13,1],[12,13,1],[13,1,1],

  // right upper — perimeter
  [14,15,1],[15,16,1],[16,17,1],[17,18,2],[18,19,2],[19,20,2],[20,21,1],[21,2,1],
  // right upper — interior
  [14,22,1],[15,22,1],[16,22,1],[21,22,1],[22,2,1],

  // left lower
  [23,24,1],[24,25,2],[25,26,2],[26,27,2],[27,23,1],

  // right lower
  [28,29,1],[29,30,2],[30,31,2],[31,32,2],[32,28,1],
];

const STROKE_OPACITY = [0.55, 0.28, 0.13] as const;

export default function NetworkMoth({
  color   = "#7B61FF",
  opacity = 1,
  size    = 500,
  className = "",
}: Props) {
  return (
    <svg
      viewBox="0 0 400 280"
      width={size}
      height={Math.round(size * 0.7)}
      className={className}
      style={{ opacity }}
      aria-hidden="true"
    >
      <defs>
        <filter id="nm-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Edges ─────────────────────────────────────────────────────────── */}
      {EDGES.map(([a, b, w], i) => (
        <line
          key={i}
          x1={NODES[a].x} y1={NODES[a].y}
          x2={NODES[b].x} y2={NODES[b].y}
          stroke={color}
          strokeWidth="0.7"
          strokeOpacity={STROKE_OPACITY[w]}
        />
      ))}

      {/* ── Regular nodes ─────────────────────────────────────────────────── */}
      {NODES.map((n, i) => {
        if (n.pulse) return null; // handled separately
        return (
          <circle
            key={i}
            cx={n.x} cy={n.y} r={n.r}
            fill={color}
            fillOpacity={n.o}
            className="moth-node"
            style={{ animationDelay: `${((i * 0.22) % 2.4).toFixed(2)}s` }}
          />
        );
      })}

      {/* ── Pulsing inner nodes (1–2) — subtle breathing ─────────────────── */}
      {[1, 2].map((i) => {
        const n = NODES[i];
        return (
          <circle key={`pulse-${i}`} cx={n.x} cy={n.y} r={n.r} fill={color}>
            <animate attributeName="fill-opacity"
              values={`${n.o};${Math.min(n.o + 0.12, 1)};${n.o}`}
              dur="3.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
            <animate attributeName="r"
              values={`${n.r};${n.r + 0.6};${n.r}`}
              dur="3.4s" begin={`${i * 0.6}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* ── Central nucleus — bloom + core ───────────────────────────────── */}
      <g filter="url(#nm-glow)">
        {/* expanding bloom ring */}
        <circle cx={NODES[0].x} cy={NODES[0].y} r="5" fill={color} fillOpacity="0.20">
          <animate attributeName="r"            values="5;14;5"      dur="3s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.20;0;0.20" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* solid core */}
        <circle cx={NODES[0].x} cy={NODES[0].y} r="5" fill={color}>
          <animate attributeName="r"            values="4;6;4"       dur="3s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.82;1;0.82" dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
