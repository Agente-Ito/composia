"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, Group, InstancedMesh, LineSegments, Mesh, Object3D } from "three";

// ─── Easing ───────────────────────────────────────────────────────────────────

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(t, 1), 3);
const easeOutBack  = (t: number) =>
  1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

// Smooth travel (70%) → slight organic overshoot (30%)
function expandEase(t: number) {
  const c = Math.min(t, 1);
  return c <= 0.70
    ? easeOutCubic(c / 0.70) * 0.90
    : 0.90 + easeOutBack((c - 0.70) / 0.30) * 0.10;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Butterfly geometry ───────────────────────────────────────────────────────

// Navbar logo world-space position (top-left corner, camera z=4.2 fov=42)
const NAV_X = -2.35;
const NAV_Y =  1.52;

const L_UPPER = [
  [-0.07,  0.20, 0.01],  // shoulder
  [-0.44,  0.66, 0.06],  // inner arc
  [-0.88,  0.86, 0.10],  // apex
  [-1.42,  0.44, 0.08],  // outer-mid (high enough for moth silhouette)
  [-0.96, -0.14, 0.04],  // outer-base
] as const;

const L_LOWER = [
  [-0.07, -0.18, 0.01],  // root
  [-0.38, -0.40, 0.05],  // lower-mid
  [-0.80, -0.52, 0.06],  // lower-outer
  [-0.50, -0.88, 0.08],  // tip
] as const;

const IMPORTANCE = [
  1.00,
  0.68, 0.62, 0.94, 0.76, 0.66,
  0.64, 0.58, 0.56, 0.88,
  0.68, 0.62, 0.94, 0.76, 0.66,
  0.64, 0.58, 0.56, 0.88,
] as const;

const EDGES = [
  { a: 0, b: 1,  s: 0.90 }, { a: 0, b: 5,  s: 0.80 },
  { a: 1, b: 3,  s: 0.86 }, { a: 3, b: 4,  s: 0.78 },
  { a: 4, b: 5,  s: 0.72 }, { a: 5, b: 0,  s: 0.65 },
  { a: 1, b: 2,  s: 0.70 }, { a: 2, b: 3,  s: 0.74 },
  { a: 2, b: 4,  s: 0.68 }, { a: 1, b: 4,  s: 0.58 },
  { a: 0, b: 6,  s: 0.88 }, { a: 6, b: 7,  s: 0.72 },
  { a: 7, b: 8,  s: 0.68 }, { a: 7, b: 9,  s: 0.76 },
  { a: 8, b: 9,  s: 0.65 }, { a: 6, b: 8,  s: 0.58 },
  { a: 0, b: 10, s: 0.90 }, { a: 0, b: 14, s: 0.80 },
  { a: 10, b: 12, s: 0.86 }, { a: 12, b: 13, s: 0.78 },
  { a: 13, b: 14, s: 0.72 }, { a: 14, b: 0,  s: 0.65 },
  { a: 10, b: 11, s: 0.70 }, { a: 11, b: 12, s: 0.74 },
  { a: 11, b: 13, s: 0.68 }, { a: 10, b: 13, s: 0.58 },
  { a: 0,  b: 15, s: 0.88 }, { a: 15, b: 16, s: 0.72 },
  { a: 16, b: 17, s: 0.68 }, { a: 16, b: 18, s: 0.76 },
  { a: 17, b: 18, s: 0.65 }, { a: 15, b: 17, s: 0.58 },
] as const;

// ─── Node builder ─────────────────────────────────────────────────────────────

type BNode = {
  start:      [number, number, number]; // navbar cluster position
  end:        [number, number, number]; // final butterfly position
  phase:      number;                   // idle breathing offset
  delay:      number;                   // expand stagger 0–0.42
  importance: number;
};

// Golden-angle spiral for natural cluster scatter around NAV point
function clusterAt(i: number): [number, number, number] {
  const θ = (i * 137.508 * Math.PI) / 180;
  const r = 0.028 + (i % 5) * 0.016;
  return [NAV_X + Math.cos(θ) * r, NAV_Y + Math.sin(θ) * r, 0];
}

function buildNodes(): BNode[] {
  const wings = [...L_UPPER, ...L_LOWER];
  const total = wings.length; // 9

  // Centre (id 0) — flies first, no delay
  const nodes: BNode[] = [{
    start:      [NAV_X, NAV_Y, 0],
    end:        [0, 0, 0],
    phase:      0,
    delay:      0,
    importance: 1,
  }];

  // Left wing nodes (ids 1–9)
  wings.forEach((a, i) => {
    nodes.push({
      start:      clusterAt(i + 1),
      end:        [a[0], a[1], a[2]],
      phase:      (i + 1) * 0.72,
      delay:      0.05 + (i / (total - 1)) * 0.37,
      importance: IMPORTANCE[i + 1],
    });
  });

  // Right wing nodes (ids 10–18) — X-mirror, interleaved stagger
  wings.forEach((a, i) => {
    nodes.push({
      start:      clusterAt(i + 10),
      end:        [-a[0], a[1], a[2]],
      phase:      (i + 1) * 0.72,
      delay:      0.08 + (i / (total - 1)) * 0.37,
      importance: IMPORTANCE[i + 10],
    });
  });

  return nodes;
}

// ─── Visualization ────────────────────────────────────────────────────────────

const WING_COUNT  = 18;
const EXPAND_DUR  = 1.85; // seconds
const IDLE_SPEED  = 0.46;

function NetworkVisualization() {
  const nodes = useMemo(buildNodes, []);
  const edges = useMemo(() => EDGES, []);

  const meshRef   = useRef<InstancedMesh>(null);
  const linesRef  = useRef<LineSegments>(null);
  const centreRef = useRef<Mesh>(null);
  const glowRef   = useRef<Mesh>(null);
  const groupRef  = useRef<Group>(null);
  const dummy     = useMemo(() => new Object3D(), []);

  // Animation state
  const phase  = useRef<"expand" | "idle">("expand");
  const tExp   = useRef(0);

  // Current world positions for all 19 nodes (for edge drawing)
  const curPos = useRef(new Float32Array(19 * 3));

  // Mouse parallax (target + smoothed current)
  const mouse  = useRef({ tx: 0, ty: 0, x: 0, y: 0 });

  // Geometry buffers — allocated once
  const linePos = useMemo(() => new Float32Array(edges.length * 6), [edges.length]);
  const lineCol = useMemo(() => new Float32Array(edges.length * 6), [edges.length]);

  // Start expand immediately (300 ms logo-pause before motion begins)
  useEffect(() => {
    const id = setTimeout(() => { tExp.current = 0; }, 300);
    return () => clearTimeout(id);
  }, []);

  // Mouse parallax listener
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.tx =  (e.clientX / window.innerWidth  - 0.5) * 0.13;
      mouse.current.ty = -(e.clientY / window.innerHeight - 0.5) * 0.09;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(({ clock }, delta) => {
    const t  = clock.elapsedTime;
    const ph = phase.current;

    // ── Advance expand ───────────────────────────────────────────────────
    if (ph === "expand") {
      tExp.current = Math.min(tExp.current + delta / EXPAND_DUR, 1);
      if (tExp.current >= 1) phase.current = "idle";
    }

    const tE = tExp.current;

    // ── Compute current positions for all nodes ──────────────────────────
    nodes.forEach((n, i) => {
      // Per-node progress: starts only after its stagger delay
      const raw  = (tE - n.delay) / (1 - n.delay + 0.001);
      const nT   = expandEase(Math.max(0, raw));

      let x = lerp(n.start[0], n.end[0], nT);
      let y = lerp(n.start[1], n.end[1], nT);
      let z = lerp(n.start[2], n.end[2], nT);

      // Idle organic breathing (wing nodes only)
      if (ph === "idle" && i > 0) {
        const lt = t * IDLE_SPEED + n.phase;
        y += Math.sin(lt)        * 0.026;
        z += Math.cos(lt * 0.82) * 0.009;
      }

      curPos.current[i * 3]     = x;
      curPos.current[i * 3 + 1] = y;
      curPos.current[i * 3 + 2] = z;
    });

    // ── Update wing node instanced mesh ──────────────────────────────────
    for (let i = 1; i <= WING_COUNT; i++) {
      const n   = nodes[i];
      const raw = (tE - n.delay) / (1 - n.delay + 0.001);
      const nT  = expandEase(Math.max(0, raw));

      const lt     = t * IDLE_SPEED + n.phase;
      const breath = ph === "idle" ? 1 + Math.sin(lt * 0.85) * 0.20 : 1;
      const sBase  = 0.013 + n.importance * 0.009;
      const s      = lerp(0, sBase * breath, nT); // scale in from zero

      dummy.position.set(
        curPos.current[i * 3],
        curPos.current[i * 3 + 1],
        curPos.current[i * 3 + 2],
      );
      dummy.scale.setScalar(Math.max(s, 0));
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i - 1, dummy.matrix);
    }
    if (meshRef.current) meshRef.current.instanceMatrix.needsUpdate = true;

    // ── Update edges ─────────────────────────────────────────────────────
    const globalAlpha = easeOutCubic(tE); // edges fade in with overall expand

    for (let i = 0; i < edges.length; i++) {
      const e  = edges[i];
      const ax = curPos.current[e.a * 3],
            ay = curPos.current[e.a * 3 + 1],
            az = curPos.current[e.a * 3 + 2];
      const bx = curPos.current[e.b * 3],
            by = curPos.current[e.b * 3 + 1],
            bz = curPos.current[e.b * 3 + 2];

      const o = i * 6;
      linePos[o]   = ax; linePos[o+1] = ay; linePos[o+2] = az;
      linePos[o+3] = bx; linePos[o+4] = by; linePos[o+5] = bz;

      // Flow pulse ripples during idle; flat during expand
      const flow = ph === "idle"
        ? 0.28 + Math.sin(t * 2.2 + i * 0.55) * 0.22
        : globalAlpha;
      const bright = (0.18 + e.s * 0.48) * flow;

      // Purple-tinted edges (brand secondary #A78BFA ≈ 0.65, 0.55, 0.98)
      lineCol[o]   = bright * 0.65; lineCol[o+1] = bright * 0.55; lineCol[o+2] = bright * 0.98;
      lineCol[o+3] = bright * 0.65; lineCol[o+4] = bright * 0.55; lineCol[o+5] = bright * 0.98;
    }

    if (linesRef.current) {
      linesRef.current.geometry.attributes.position.needsUpdate = true;
      linesRef.current.geometry.attributes.color.needsUpdate    = true;
    }

    // ── Centre nucleus ────────────────────────────────────────────────────
    const cRaw = (tE - 0) / (1 - 0 + 0.001);
    const cT   = expandEase(Math.max(0, cRaw));
    const cx   = curPos.current[0],
          cy   = curPos.current[1],
          cz   = curPos.current[2];

    centreRef.current?.position.set(cx, cy, cz);
    glowRef.current?.position.set(cx, cy, cz);

    const breathCentre = ph === "idle"
      ? 1 + Math.sin(t * 1.15) * 0.08 + Math.cos(t * 0.58) * 0.03
      : 1;
    const centreScale = lerp(0, breathCentre, cT);
    centreRef.current?.scale.setScalar(centreScale);
    glowRef.current?.scale.setScalar(centreScale);

    // ── Mouse parallax (smooth damp) ─────────────────────────────────────
    mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.04;
    mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.04;
    if (groupRef.current) {
      groupRef.current.position.x = mouse.current.x;
      groupRef.current.position.y = mouse.current.y;
    }
  });

  return (
    <group ref={groupRef}>

      {/* Wing nodes — instanced, 1 draw call */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, WING_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 7, 7]} />
        <meshStandardMaterial
          color="#A78BFA"
          emissive="#7B61FF"
          emissiveIntensity={1.4}
          transparent
          opacity={0.90}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {/* Edges — 1 draw call */}
      <lineSegments ref={linesRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[lineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.55}
          toneMapped={false}
        />
      </lineSegments>

      {/* Centre nucleus */}
      <mesh ref={centreRef}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial
          color="#7B61FF"
          emissive="#7B61FF"
          emissiveIntensity={2.2}
          transparent
          opacity={0.95}
          toneMapped={false}
        />
      </mesh>

      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial
          color="#7B61FF"
          transparent
          opacity={0.07}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

    </group>
  );
}

// ─── Canvas wrapper ───────────────────────────────────────────────────────────

const NetworkScene = () => (
  <div className="absolute inset-0 pointer-events-none">
    <Canvas
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.06} />
      <NetworkVisualization />
    </Canvas>
  </div>
);

export default NetworkScene;
