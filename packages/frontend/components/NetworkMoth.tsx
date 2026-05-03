// NetworkMoth — brand butterfly as a system visualization.
// Tri-color: active nodes #7B85E6, secondary nodes #A1A3B6, edges white/silver with flow pulse.
// viewBox 400×280, centre (200, 136).
import type React from "react";

interface Props {
  size?:     number
  opacity?:  number
  className?: string
}

const COL = {
  edge:      "#A78BFA",   // brand secondary purple
  secondary: "#A1A3B6",
  active:    "#7B61FF",   // brand primary purple
} as const;

const C = { x: 200, y: 136 };

type Node = { x: number; y: number; r: number; o: number; a?: boolean };

// ── Nodes ─────────────────────────────────────────────────────────────────────
const NODES: Node[] = [
  // Left upper wing
  { x: 174, y: 116, r: 3.2, o: 0.92, a: true  },  // 0  inner shoulder
  { x: 162, y: 106, r: 2.4, o: 0.68            },  // 1  shoulder companion
  { x: 156, y: 122, r: 2.0, o: 0.56            },  // 2  shoulder lower
  { x: 138, y:  82, r: 2.4, o: 0.66            },  // 3  upper inner
  { x: 112, y:  64, r: 2.8, o: 0.78, a: true  },  // 4  apex
  { x:  84, y:  68, r: 2.0, o: 0.54            },  // 5  apex outer
  { x:  58, y:  92, r: 1.8, o: 0.44            },  // 6  outer top
  { x:  48, y: 122, r: 1.8, o: 0.38            },  // 7  outer mid
  { x:  56, y: 152, r: 1.8, o: 0.40            },  // 8  outer lower
  { x:  84, y: 172, r: 2.0, o: 0.50            },  // 9  lower outer
  { x: 120, y: 176, r: 2.2, o: 0.60            },  // 10 lower mid
  { x: 154, y: 168, r: 3.0, o: 0.88, a: true  },  // 11 inner lower

  // Right upper wing — exact mirror (x → 400 − x)
  { x: 226, y: 116, r: 3.2, o: 0.92, a: true  },  // 12
  { x: 238, y: 106, r: 2.4, o: 0.68            },  // 13
  { x: 244, y: 122, r: 2.0, o: 0.56            },  // 14
  { x: 262, y:  82, r: 2.4, o: 0.66            },  // 15
  { x: 288, y:  64, r: 2.8, o: 0.78, a: true  },  // 16 apex
  { x: 316, y:  68, r: 2.0, o: 0.54            },  // 17
  { x: 342, y:  92, r: 1.8, o: 0.44            },  // 18
  { x: 352, y: 122, r: 1.8, o: 0.38            },  // 19
  { x: 344, y: 152, r: 1.8, o: 0.40            },  // 20
  { x: 316, y: 172, r: 2.0, o: 0.50            },  // 21
  { x: 280, y: 176, r: 2.2, o: 0.60            },  // 22
  { x: 246, y: 168, r: 3.0, o: 0.88, a: true  },  // 23

  // Left lower wing — 5-node teardrop
  { x: 178, y: 168, r: 2.4, o: 0.72, a: true  },  // 24 root
  { x: 155, y: 192, r: 1.8, o: 0.50            },  // 25
  { x: 144, y: 218, r: 1.6, o: 0.38            },  // 26
  { x: 158, y: 234, r: 1.4, o: 0.28            },  // 27 tip
  { x: 180, y: 226, r: 1.7, o: 0.42            },  // 28

  // Right lower wing — exact mirror
  { x: 222, y: 168, r: 2.4, o: 0.72, a: true  },  // 29 root
  { x: 245, y: 192, r: 1.8, o: 0.50            },  // 30
  { x: 256, y: 218, r: 1.6, o: 0.38            },  // 31
  { x: 242, y: 234, r: 1.4, o: 0.28            },  // 32 tip
  { x: 220, y: 226, r: 1.7, o: 0.42            },  // 33
];

// ── Edges — [i, j, weight] ────────────────────────────────────────────────────
type Edge = [number | -1, number | -1, 0 | 1 | 2];

const EDGES: Edge[] = [
  // centre spokes — left upper (7 and 11 removed: cross too harshly)
  [-1,  0, 0], [-1,  4, 0],
  // centre spokes — right upper (19 and 23 removed: mirrors of 7/11)
  [-1, 12, 0], [-1, 16, 0],
  // centre spokes — lower wings
  [-1, 24, 1], [-1, 29, 1],
  // left upper — main perimeter
  [0,  3, 1], [3,  4, 1], [4,  5, 1],
  [5,  6, 2], [6,  7, 2], [7,  8, 2],
  [8,  9, 1], [9, 10, 1], [10, 11, 1], [11, 0, 1],
  // left upper — shoulder sub-cluster
  [0,  1, 1], [1,  2, 2], [2, 11, 1],
  // left upper — interior diagonals
  [0, 10, 1], [3,  9, 2],
  // right upper — main perimeter
  [12, 15, 1], [15, 16, 1], [16, 17, 1],
  [17, 18, 2], [18, 19, 2], [19, 20, 2],
  [20, 21, 1], [21, 22, 1], [22, 23, 1], [23, 12, 1],
  // right upper — shoulder sub-cluster
  [12, 13, 1], [13, 14, 2], [14, 23, 1],
  // right upper — interior diagonals
  [12, 22, 1], [15, 21, 2],
  // left lower wing
  [24, 25, 1], [25, 26, 2], [26, 27, 2], [27, 28, 2], [28, 24, 1],
  // right lower wing
  [29, 30, 1], [30, 31, 2], [31, 32, 2], [32, 33, 2], [33, 29, 1],
];

// Base opacities per weight
const BASE_SO = [0.55, 0.32, 0.14] as const;

function nx(i: number | -1) { return i === -1 ? C.x : NODES[i].x; }
function ny(i: number | -1) { return i === -1 ? C.y : NODES[i].y; }

export default function NetworkMoth({
  size      = 800,
  opacity   = 1,
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
        <filter id="nm-node-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Wings group — breathes from body centre (200, 136) ──────────── */}
      <g style={{
        transformOrigin: '200px 136px',
        transformBox: 'view-box' as React.CSSProperties['transformBox'],
        animation: 'wing-breathe 4.2s ease-in-out infinite',
      }}>

      {/* ── Edges with flow pulse ─────────────────────────────────────────── */}
      {EDGES.map(([a, b, w], i) => {
        const baseO  = BASE_SO[w];
        const peakO  = Math.min(baseO * 2.4, 0.85);
        const dur    = 2.8 + (i % 5) * 0.22;
        const begin  = `${((i * 0.13) % dur).toFixed(2)}s`;
        return (
          <line
            key={i}
            x1={nx(a)} y1={ny(a)}
            x2={nx(b)} y2={ny(b)}
            stroke={COL.edge}
            strokeWidth={w === 0 ? 1.1 : 0.75}
            strokeOpacity={baseO}
          >
            <animate
              attributeName="stroke-opacity"
              values={`${baseO};${peakO};${baseO}`}
              dur={`${dur}s`}
              begin={begin}
              repeatCount="indefinite"
            />
          </line>
        );
      })}

      {/* ── Wing nodes ────────────────────────────────────────────────────── */}
      {NODES.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y} r={n.r}
          fill={n.a ? COL.active : COL.secondary}
          fillOpacity={n.o}
          filter={n.a ? "url(#nm-node-glow)" : undefined}
        >
          {n.a && (
            <>
              <animate attributeName="r"            values={`${n.r};${n.r * 1.35};${n.r}`} dur="2.6s" begin={`${(i * 0.18) % 2.6}s`} repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values={`${n.o};1;${n.o}`}               dur="2.6s" begin={`${(i * 0.18) % 2.6}s`} repeatCount="indefinite" />
            </>
          )}
        </circle>
      ))}

      </g>{/* end wings-breathe group */}

      {/* ── Central nucleus ───────────────────────────────────────────────── */}
      <g filter="url(#nm-glow)">
        {/* pulse ring */}
        <circle cx={C.x} cy={C.y} r="6" fill={COL.active} fillOpacity="0.18">
          <animate attributeName="r"            values="6;22;6"        dur="3s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.18;0;0.18"   dur="3s" repeatCount="indefinite" />
        </circle>
        {/* core dot */}
        <circle cx={C.x} cy={C.y} r="5" fill={COL.active}>
          <animate attributeName="r"            values="4;7;4"         dur="3s" repeatCount="indefinite" />
          <animate attributeName="fill-opacity" values="0.90;1;0.90"   dur="3s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}
