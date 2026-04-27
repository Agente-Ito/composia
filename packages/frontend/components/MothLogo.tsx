"use client";

export type MothVariant = "default" | "gensyn" | "keeper" | "lukso" | "core";

interface Props {
  size?: number;
  variant?: MothVariant;
  /** When provided, renders the score number floating in the nucleus */
  score?: number | null;
  /** Colour derived from score – overrides the variant default */
  glowColor?: string;
  /** CSS animation-delay for the float / pulse so tiles feel async */
  animDelay?: string;
  animated?: boolean;
  className?: string;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
// All coordinates are in a 200×120 viewBox (moth facing forward, wings spread).
// Origin (100, 60) = thorax / body centre.

const THORAX_CX = 100;
const THORAX_CY = 60;

// Body (abdomen) — vertical ellipse
const BODY = { cx: THORAX_CX, cy: THORAX_CY + 10, rx: 6, ry: 16 };

// Head
const HEAD = { cx: THORAX_CX, cy: THORAX_CY - 14, r: 5 };

// Antennae
const ANTENNAE = [
  { x1: 97, y1: 46, x2: 82, y2: 20 },
  { x1: 103, y1: 46, x2: 118, y2: 20 },
];

// ── Wing polygons ─────────────────────────────────────────────────────────────
// Each wing is defined as a set of triangles (network mesh).
// Left wing: mirrored via scaleX(-1) from center.

// Upper-left wing triangulation anchor points
const LEFT_WING_NODES = [
  [100, 55], // thorax
  [72,  35], // apex
  [50,  45], // outer-top
  [30,  60], // outer-mid
  [45,  75], // outer-low
  [65,  70], // inner-low
  [80,  55], // inner-mid
  [60,  55], // mid
  [40,  50], // far-out
];

const LEFT_WING_TRIANGLES: [number, number, number][] = [
  [0, 1, 6], [0, 6, 5], [1, 2, 7], [7, 2, 3],
  [7, 3, 8], [8, 3, 4], [5, 7, 6], [5, 4, 7],
  [0, 5, 4], // bottom fill
];

// Lower-left wing (smaller, swept back)
const LEFT_LOWER_NODES = [
  [100, 60],  // attach point
  [78,  68],
  [60,  80],
  [50,  90],
  [70,  95],
  [88,  82],
];

const LEFT_LOWER_TRIANGLES: [number, number, number][] = [
  [0, 1, 5], [1, 2, 4], [2, 3, 4], [1, 4, 5],
];

// ── Extra nodes per variant ───────────────────────────────────────────────────
const GENSYN_EXTRA_NODES = [
  [55, 48], [66, 42], [44, 58], [58, 62], [72, 52],
];

const KEEPER_EXTRA_NODES: [number, number][] = []; // keeper gets curve lines instead

const LUKSO_ANCHOR_NODES = [
  [85, 100], [100, 110], [115, 100],
  [92, 105], [108, 105],
];

// ── Colour per score ──────────────────────────────────────────────────────────
export function scoreColor(score: number): string {
  if (score >= 90) return "#00FF88";
  if (score >= 75) return "#00D4FF";
  if (score >= 60) return "#FFC033";
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
}: Props) {
  const color = glowColor ?? (score !== null ? scoreColor(score) : "#00D4FF");
  const wingOpacity = 0.22;
  const strokeWidth = 0.6;

  // Mirror helpers
  function mirrorX(pts: number[][]): number[][] {
    return pts.map(([x, y]) => [200 - x, y]);
  }
  function mirrorTriangles(nodes: number[][], tris: [number, number, number][]) {
    const mn = mirrorX(nodes);
    return { nodes: mn, tris };
  }

  const rightWing   = mirrorTriangles(LEFT_WING_NODES, LEFT_WING_TRIANGLES);
  const rightLower  = mirrorTriangles(LEFT_LOWER_NODES, LEFT_LOWER_TRIANGLES);

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

  function renderNodes(nodes: number[][], r = 1.5) {
    return nodes.map(([x, y], i) => (
      <circle
        key={i}
        cx={x} cy={y} r={r}
        fill={color}
        fillOpacity={0.9}
        className={animated ? "moth-node" : ""}
        style={animated ? { animationDelay: `${parseFloat(animDelay) + i * 0.12}s` } : {}}
      />
    ));
  }

  // ── Keeper variant: curved spine lines on wings ───────────────────────────
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

  // ── Lukso anchor ─────────────────────────────────────────────────────────
  function luksoAnchors() {
    return (
      <>
        {/* vertical anchor line from body */}
        <line x1={100} y1={78} x2={100} y2={112} stroke={color} strokeWidth={0.8} strokeOpacity={0.5} />
        {/* horizontal crossbar */}
        <line x1={85} y1={106} x2={115} y2={106} stroke={color} strokeWidth={0.8} strokeOpacity={0.5} />
        {renderNodes(LUKSO_ANCHOR_NODES, 2)}
        {/* small down-triangles */}
        <polygon points="92,98 108,98 100,112" fill={color} fillOpacity={0.15} stroke={color} strokeWidth={0.6} strokeOpacity={0.6} />
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
        <filter id={`glow-${color.replace("#", "")}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Wings group – animated pulse ────────────────────────────────── */}
      <g className={wingsClass} style={wingsStyle}>
        {/* Upper left wing */}
        {renderTriangles(LEFT_WING_NODES, LEFT_WING_TRIANGLES, wingOpacity, "uwl")}
        {/* Upper right wing */}
        {renderTriangles(rightWing.nodes, rightWing.tris, wingOpacity, "uwr")}
        {/* Lower left wing */}
        {renderTriangles(LEFT_LOWER_NODES, LEFT_LOWER_TRIANGLES, wingOpacity * 0.7, "lwl")}
        {/* Lower right wing */}
        {renderTriangles(rightLower.nodes, rightLower.tris, wingOpacity * 0.7, "lwr")}

        {/* Keeper: fluid curves overlaid */}
        {variant === "keeper" && keeperCurves()}
      </g>

      {/* ── Wing nodes (always visible, glow animated) ────────────────── */}
      {renderNodes(LEFT_WING_NODES)}
      {renderNodes(rightWing.nodes)}
      {renderNodes(LEFT_LOWER_NODES.slice(1))}
      {renderNodes(rightLower.nodes.slice(1))}

      {/* ── Gensyn: extra dense nodes on nucleus ─────────────────────── */}
      {variant === "gensyn" && renderNodes(GENSYN_EXTRA_NODES.map(([x, y]) => [x, y]))}
      {variant === "gensyn" && renderNodes(mirrorX(GENSYN_EXTRA_NODES))}

      {/* ── Lukso: anchor structure below body ───────────────────────── */}
      {variant === "lukso" && luksoAnchors()}

      {/* ── Antennae ─────────────────────────────────────────────────── */}
      {ANTENNAE.map((a, i) => (
        <line
          key={i}
          x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
          stroke={color} strokeWidth={0.7} strokeOpacity={0.7}
        />
      ))}
      {/* Antenna tip nodes */}
      <circle cx={82} cy={20} r={1.5} fill={color} fillOpacity={0.9} />
      <circle cx={118} cy={20} r={1.5} fill={color} fillOpacity={0.9} />

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <ellipse
        cx={BODY.cx} cy={BODY.cy} rx={BODY.rx} ry={BODY.ry}
        fill={color} fillOpacity={0.15}
        stroke={color} strokeWidth={0.8} strokeOpacity={0.8}
      />

      {/* ── Head ─────────────────────────────────────────────────────── */}
      <circle
        cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r}
        fill={color} fillOpacity={0.25}
        stroke={color} strokeWidth={0.8} strokeOpacity={0.9}
      />

      {/* ── Nucleus (thorax core) — brightest element ─────────────────── */}
      <circle
        cx={THORAX_CX} cy={THORAX_CY} r={10}
        fill={color} fillOpacity={0.12}
        stroke={color} strokeWidth={1.2} strokeOpacity={1}
        filter={`url(#glow-${color.replace("#", "")})`}
      />
      <circle
        cx={THORAX_CX} cy={THORAX_CY} r={5}
        fill={color} fillOpacity={0.6}
      />

      {/* ── Score overlay ─────────────────────────────────────────────── */}
      {score !== null && (
        <text
          x={THORAX_CX}
          y={THORAX_CY + 4}
          textAnchor="middle"
          fontSize="9"
          fontFamily="monospace"
          fontWeight="bold"
          fill={color}
          fillOpacity={0.0} // score is shown outside SVG in the tile
        />
      )}
    </svg>
  );
}
