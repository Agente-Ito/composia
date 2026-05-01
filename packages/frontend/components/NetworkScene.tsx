"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, InstancedMesh, LineSegments, Mesh, Object3D } from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

type BNode = {
  id: number;
  anchor: readonly [number, number, number];
  pos: [number, number, number];
  phase: number;       // deterministic float offset (index × 0.72)
  importance: number;  // 0–1, drives colour intensity
};

type BEdge = { a: number; b: number; strength: number };

// ─── Butterfly geometry ───────────────────────────────────────────────────────
//
// Coordinate space: centre (0,0,0).  One unit ≈ 28 % of viewport half-height.
// Left side defined explicitly; right side is an exact X-mirror.
//
// Index map
//   0        = centre body
//   1–5      = left upper forewing  (lu_root · lu_inner · lu_tip · lu_outer · lu_base)
//   6–9      = left lower hindwing  (ll_root · ll_inner · ll_outer · ll_tip)
//   10–14    = right upper forewing (mirror of 1–5)
//   15–18    = right lower hindwing (mirror of 6–9)

const L_UPPER: ReadonlyArray<readonly [number, number, number]> = [
  [-0.12,  0.10, 0.01],  // 1  lu_root   — inner attachment near body
  [-0.20,  0.54, 0.05],  // 2  lu_inner  — interior vein junction
  [-0.56,  1.04, 0.10],  // 3  lu_tip    — forewing apex (highest point)
  [-1.10,  0.56, 0.08],  // 4  lu_outer  — outer corner (widest span)
  [-1.04,  0.10, 0.04],  // 5  lu_base   — outer trailing edge at body level
];

const L_LOWER: ReadonlyArray<readonly [number, number, number]> = [
  [-0.12, -0.10, 0.01],  // 6  ll_root
  [-0.36, -0.40, 0.05],  // 7  ll_inner
  [-0.86, -0.34, 0.06],  // 8  ll_outer
  [-0.48, -0.84, 0.08],  // 9  ll_tip  — hindwing lower apex
];

// Importance per node — drives brightness; tips are highlighted
const IMPORTANCE: readonly number[] = [
  1.00,                             // 0  centre
  0.68, 0.62, 0.94, 0.76, 0.66,   // 1–5  left upper  (tip=0.94, outer=0.76)
  0.64, 0.58, 0.56, 0.88,          // 6–9  left lower  (tip=0.88)
  0.68, 0.62, 0.94, 0.76, 0.66,   // 10–14 right upper (mirror)
  0.64, 0.58, 0.56, 0.88,          // 15–18 right lower (mirror)
];

// ─── Build node list ──────────────────────────────────────────────────────────

function buildNodes(): BNode[] {
  const left = [...L_UPPER, ...L_LOWER];
  const nodes: BNode[] = [
    { id: 0, anchor: [0, 0, 0], pos: [0, 0, 0], phase: 0, importance: 1 },
  ];

  // Left side: ids 1–9
  left.forEach((a, i) => {
    nodes.push({
      id: i + 1,
      anchor: a,
      pos: [a[0], a[1], a[2]],
      phase: (i + 1) * 0.72,
      importance: IMPORTANCE[i + 1],
    });
  });

  // Right side: ids 10–18  — X axis mirror
  left.forEach((a, i) => {
    nodes.push({
      id: i + 10,
      anchor: [-a[0], a[1], a[2]],
      pos: [-a[0], a[1], a[2]],
      phase: (i + 1) * 0.72,   // identical phase → perfectly synchronised mirror
      importance: IMPORTANCE[i + 10],
    });
  });

  return nodes; // order: 0, 1…9, 10…18
}

// ─── Edge list ────────────────────────────────────────────────────────────────
//
// Left upper forewing forms a closed triangular outline with interior veins.
// Left lower hindwing forms a smaller angular diamond.
// Right side mirrors left (node indices shifted +9 for non-centre).

const EDGES: readonly BEdge[] = [
  // ── left upper forewing ─────────────────────────────────────────────────
  { a: 0, b: 1, strength: 0.90 },  // centre  → lu_root
  { a: 0, b: 5, strength: 0.80 },  // centre  → lu_base   (trailing edge root)
  { a: 1, b: 3, strength: 0.86 },  // lu_root → lu_tip    (leading costal vein)
  { a: 3, b: 4, strength: 0.78 },  // lu_tip  → lu_outer
  { a: 4, b: 5, strength: 0.72 },  // lu_outer→ lu_base   (outer trailing edge)
  { a: 5, b: 0, strength: 0.65 },  // lu_base → centre    (trailing edge closes)
  { a: 1, b: 2, strength: 0.70 },  // lu_root → lu_inner  (inner vein)
  { a: 2, b: 3, strength: 0.74 },  // lu_inner→ lu_tip
  { a: 2, b: 4, strength: 0.68 },  // lu_inner→ lu_outer  (cross vein)
  { a: 1, b: 4, strength: 0.58 },  // diagonal strengthener

  // ── left lower hindwing ─────────────────────────────────────────────────
  { a: 0, b: 6, strength: 0.88 },  // centre  → ll_root
  { a: 6, b: 7, strength: 0.72 },  // ll_root → ll_inner
  { a: 7, b: 8, strength: 0.68 },  // ll_inner→ ll_outer
  { a: 7, b: 9, strength: 0.76 },  // ll_inner→ ll_tip    (main vein)
  { a: 8, b: 9, strength: 0.65 },  // ll_outer→ ll_tip
  { a: 6, b: 8, strength: 0.58 },  // ll_root → ll_outer  (base edge)

  // ── right upper forewing  (mirror: non-centre indices + 9) ──────────────
  { a:  0, b: 10, strength: 0.90 },
  { a:  0, b: 14, strength: 0.80 },
  { a: 10, b: 12, strength: 0.86 },
  { a: 12, b: 13, strength: 0.78 },
  { a: 13, b: 14, strength: 0.72 },
  { a: 14, b:  0, strength: 0.65 },
  { a: 10, b: 11, strength: 0.70 },
  { a: 11, b: 12, strength: 0.74 },
  { a: 11, b: 13, strength: 0.68 },
  { a: 10, b: 13, strength: 0.58 },

  // ── right lower hindwing ────────────────────────────────────────────────
  { a:  0, b: 15, strength: 0.88 },
  { a: 15, b: 16, strength: 0.72 },
  { a: 16, b: 17, strength: 0.68 },
  { a: 16, b: 18, strength: 0.76 },
  { a: 17, b: 18, strength: 0.65 },
  { a: 15, b: 17, strength: 0.58 },
];

// ─── Geometry buffers ─────────────────────────────────────────────────────────

function buildEdgeGeometry(nodes: BNode[], edges: readonly BEdge[]) {
  const linePos = new Float32Array(edges.length * 6);
  const lineCol = new Float32Array(edges.length * 6);
  const hi  = new Color("#EDEFF6");  // bright white — strong edges
  const lo  = new Color("#4A5070");  // dim blue-grey — weak edges
  const tmp = new Color();

  for (let i = 0; i < edges.length; i++) {
    const e  = edges[i];
    const sa = nodes[e.a];
    const sb = nodes[e.b];
    const o  = i * 6;
    linePos[o]     = sa.pos[0]; linePos[o + 1] = sa.pos[1]; linePos[o + 2] = sa.pos[2];
    linePos[o + 3] = sb.pos[0]; linePos[o + 4] = sb.pos[1]; linePos[o + 5] = sb.pos[2];
    tmp.copy(lo).lerp(hi, e.strength * 0.85 + 0.10).toArray(lineCol, o);
    tmp.copy(lo).lerp(hi, e.strength * 0.85 + 0.10).toArray(lineCol, o + 3);
  }

  return { linePos, lineCol };
}

const NODE_COUNT = 18; // wing nodes only (excludes centre)

// ─── Animated network ─────────────────────────────────────────────────────────

function NetworkVisualization() {
  const nodes    = useMemo(buildNodes, []);
  const edges    = useMemo(() => EDGES, []);
  const geometry = useMemo(() => buildEdgeGeometry(nodes, edges), [nodes, edges]);

  const nodesInstRef = useRef<InstancedMesh>(null);
  const linesRef     = useRef<LineSegments>(null);
  const centerRef    = useRef<Mesh>(null);
  const glowRef      = useRef<Mesh>(null);
  const tmpObj       = useMemo(() => new Object3D(), []);

  useFrame(({ clock }) => {
    const t  = clock.elapsedTime * 0.48;
    const lp = geometry.linePos;
    const lc = geometry.lineCol;

    // ── wing nodes: float + visible breathing scale ─────────────────────────
    for (let i = 1; i < nodes.length; i++) {
      const n  = nodes[i];
      const lt = t + n.phase;

      n.pos[1] = n.anchor[1] + Math.sin(lt)        * 0.055;
      n.pos[2] = n.anchor[2] + Math.cos(lt * 0.82) * 0.014;

      const breath = 1 + Math.sin(lt * 0.85) * 0.22;
      const s = (0.030 + n.importance * 0.024) * breath;

      tmpObj.position.set(n.pos[0], n.pos[1], n.pos[2]);
      tmpObj.scale.setScalar(s);
      tmpObj.updateMatrix();
      nodesInstRef.current?.setMatrixAt(i - 1, tmpObj.matrix);
    }

    if (nodesInstRef.current) {
      nodesInstRef.current.instanceMatrix.needsUpdate = true;
    }

    // ── edges: position + flow pulse rippling through network ───────────────
    for (let i = 0; i < edges.length; i++) {
      const e  = edges[i];
      const sa = nodes[e.a];
      const sb = nodes[e.b];
      const o  = i * 6;
      lp[o]     = sa.pos[0]; lp[o + 1] = sa.pos[1]; lp[o + 2] = sa.pos[2];
      lp[o + 3] = sb.pos[0]; lp[o + 4] = sb.pos[1]; lp[o + 5] = sb.pos[2];

      // flow: each edge pulses at a different phase → ripple from centre out
      const flow   = 0.28 + Math.sin(t * 2.2 + i * 0.55) * 0.22;
      const bright = (0.18 + e.strength * 0.55) * flow;
      lc[o]     = bright; lc[o + 1] = bright; lc[o + 2] = bright;
      lc[o + 3] = bright; lc[o + 4] = bright; lc[o + 5] = bright;
    }

    if (linesRef.current) {
      linesRef.current.geometry.attributes.position.needsUpdate = true;
      linesRef.current.geometry.attributes.color.needsUpdate    = true;
    }

    // ── centre breathing ────────────────────────────────────────────────────
    const breath = 1 + Math.sin(t * 1.15) * 0.08 + Math.cos(t * 0.58) * 0.03;
    centerRef.current?.scale.setScalar(breath);
    glowRef.current?.scale.setScalar(breath);
  });

  const centre = nodes[0];

  return (
    <>
      {/* Wing nodes — instanced spheres with emissive glow */}
      <instancedMesh
        ref={nodesInstRef}
        args={[undefined, undefined, NODE_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial
          color="#EDEFF6"
          emissive="#EDEFF6"
          emissiveIntensity={0.9}
          transparent
          opacity={0.82}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Wing edges */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[geometry.linePos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[geometry.lineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </lineSegments>

      {/* Centre body — core with emissive */}
      <mesh ref={centerRef} position={centre.pos}>
        <sphereGeometry args={[0.06, 20, 20]} />
        <meshStandardMaterial
          color="#7B61FF"
          emissive="#7B61FF"
          emissiveIntensity={1.6}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </mesh>

      {/* Centre body — soft glow halo */}
      <mesh ref={glowRef} position={centre.pos}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshBasicMaterial
          color="#7B61FF"
          transparent
          opacity={0.07}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </>
  );
}

// ─── Scene wrapper ─────────────────────────────────────────────────────────────

const NetworkScene = () => (
  <div className="absolute inset-0 pointer-events-none">
    <Canvas
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 3.5], fov: 40 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.08} />
      <NetworkVisualization />
    </Canvas>
  </div>
);

export default NetworkScene;
