// NetworkMoth — butterfly silhouette as a minimal network graph.
// Design principle: silhouette first, connections second.
// viewBox 400×280, centre (200, 136). Upper apex y=65, lower tips y=228.

interface Props {
  color?:    string
  opacity?:  number
  size?:     number
  className?: string
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
// r = radius  |  o = fillOpacity
const C = { x: 200, y: 136 };   // nucleus

const NODES = [
  // Left upper wing — fan arc from inner-lower → inner-upper
  { x: 172, y: 110, r: 2.6, o: 0.82 },  // 0  inner shoulder
  { x: 144, y:  80, r: 2.2, o: 0.64 },  // 1  upper mid
  { x: 112, y:  65, r: 2.0, o: 0.54 },  // 2  apex (highest point)
  { x:  82, y:  75, r: 1.8, o: 0.44 },  // 3  outer upper
  { x:  62, y: 112, r: 1.8, o: 0.38 },  // 4  outer mid — widest point
  { x:  70, y: 148, r: 1.8, o: 0.40 },  // 5  outer lower
  { x: 102, y: 166, r: 2.0, o: 0.54 },  // 6  lower mid
  { x: 148, y: 160, r: 2.4, o: 0.72 },  // 7  inner lower

  // Right upper wing — exact mirror (x → 400 − x)
  { x: 228, y: 110, r: 2.6, o: 0.82 },  // 8  inner shoulder
  { x: 256, y:  80, r: 2.2, o: 0.64 },  // 9
  { x: 288, y:  65, r: 2.0, o: 0.54 },  // 10 apex
  { x: 318, y:  75, r: 1.8, o: 0.44 },  // 11 outer upper
  { x: 338, y: 112, r: 1.8, o: 0.38 },  // 12 outer mid
  { x: 330, y: 148, r: 1.8, o: 0.40 },  // 13 outer lower
  { x: 298, y: 166, r: 2.0, o: 0.54 },  // 14 lower mid
  { x: 252, y: 160, r: 2.4, o: 0.72 },  // 15 inner lower

  // Left lower wing — 4-node teardrop, sweeps down-left from center
  { x: 178, y: 160, r: 2.0, o: 0.62 },  // 16 root
  { x: 156, y: 186, r: 1.8, o: 0.50 },  // 17 outer upper
  { x: 148, y: 212, r: 1.6, o: 0.38 },  // 18 outer lower
  { x: 166, y: 228, r: 1.5, o: 0.30 },  // 19 tip

  // Right lower wing — exact mirror
  { x: 222, y: 160, r: 2.0, o: 0.62 },  // 20 root
  { x: 244, y: 186, r: 1.8, o: 0.50 },  // 21 outer upper
  { x: 252, y: 212, r: 1.6, o: 0.38 },  // 22 outer lower
  { x: 234, y: 228, r: 1.5, o: 0.30 },  // 23 tip
];

// ── Edges — [i, j, weight] ────────────────────────────────────────────────────
// weight 0 = 0.55 (centre spokes)
// weight 1 = 0.26 (inner perimeter + diagonals)
// weight 2 = 0.11 (outer perimeter)
// -1 = centre node
type Edge = [number | -1, number | -1, 0 | 1 | 2];

const EDGES: Edge[] = [
  // ── centre spokes — left upper ──
  [-1,  0, 0],   // → inner shoulder
  [-1,  2, 0],   // → apex
  [-1,  4, 0],   // → outer mid (wingspan width)
  [-1,  7, 0],   // → inner lower

  // ── centre spokes — right upper ──
  [-1,  8, 0],
  [-1, 10, 0],
  [-1, 12, 0],
  [-1, 15, 0],

  // ── centre spokes — lower wings ──
  [-1, 16, 1],   // → left lower root
  [-1, 20, 1],   // → right lower root

  // ── left upper wing perimeter ──
  [0,  1, 1],  [1,  2, 1],  [2,  3, 1],
  [3,  4, 2],  [4,  5, 2],  [5,  6, 2],
  [6,  7, 1],  [7,  0, 1],

  // ── left upper wing — interior diagonals ──
  [0,  6, 1],   // shoulder → lower mid
  [1,  5, 2],   // cross-chord

  // ── right upper wing perimeter ──
  [8,  9, 1],  [9, 10, 1],  [10, 11, 1],
  [11, 12, 2], [12, 13, 2], [13, 14, 2],
  [14, 15, 1], [15,  8, 1],

  // ── right upper wing — interior diagonals ──
  [8,  14, 1],
  [9,  13, 2],

  // ── left lower wing — teardrop (root → outer → tip → back to root) ──
  [16, 17, 1], [17, 18, 2], [18, 19, 2], [19, 16, 1],

  // ── right lower wing — mirror ──
  [20, 21, 1], [21, 22, 2], [22, 23, 2], [23, 20, 1],
];

const SO = [0.55, 0.26, 0.11] as const;   // stroke-opacity by weight

function nx(i: number | -1) { return i === -1 ? C.x : NODES[i].x; }
function ny(i: number | -1) { return i === -1 ? C.y : NODES[i].y; }

export default function NetworkMoth({
  color     = "#7B61FF",
  opacity   = 1,
  size      = 500,
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
        <filter id="nm-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="5" result="blur" />
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
          x1={nx(a)} y1={ny(a)}
          x2={nx(b)} y2={ny(b)}
          stroke={color}
          strokeWidth="0.7"
          strokeOpacity={SO[w]}
        />
      ))}

      {/* ── Wing nodes — staggered CSS pulse ──────────────────────────────── */}
      {NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y} r={n.r}
          fill={color}
          fillOpacity={n.o}
          className="moth-node"
          style={{ animationDelay: `${((i * 0.25) % 2.5).toFixed(2)}s` }}
        />
      ))}

      {/* ── Central nucleus ───────────────────────────────────────────────── */}
      <g filter="url(#nm-glow)">
        {/* bloom ring */}
        <circle cx={C.x} cy={C.y} r="5" fill={color} fillOpacity="0.22">
          <animate attributeName="r"            values="5;16;5"       dur="3s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.22;0;0.22"  dur="3s" repeatCount="indefinite" />
        </circle>
        {/* solid core */}
        <circle cx={C.x} cy={C.y} r="5" fill={color}>
          <animate attributeName="r"            values="4;6.5;4"      dur="3s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.85;1;0.85"  dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
