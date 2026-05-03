"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdditiveBlending, Group, InstancedMesh, LineSegments, Mesh, Object3D } from "three";

// ─── Easing ───────────────────────────────────────────────────────────────────

const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(t, 1), 3);

// Smooth power ease — fast start, organic deceleration, no overshoot
function expandEase(t: number) {
  return 1 - Math.pow(1 - Math.min(t, 1), 2.8);
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Butterfly geometry (MothLogo.tsx → 3D, scale 1/60) ──────────────────────
// Formula: x_3d = (svgX - 100) / 60, y_3d = -(svgY - 60) / 60

// Approximate navbar logo world position — just outside top-left canvas corner
// Canvas visible range: x ±3.02, y ±1.15  (camera z=3, fov=42, 672×256px container)
// Logo is at ~(−6.1, 1.69) on desktop — we anchor to just outside the canvas edge
// so nodes visibly fly in from the logo direction on every screen size.
const NAV_X = -3.8;
const NAV_Y =  1.7;

// 13 left-side nodes (8 upper + 5 lower). Right wing is X-mirrored at runtime.
const L_WING: [number, number, number][] = [
  // Upper wing — nodes 1–8
  [-0.467,  0.417, 0.03], // apex       SVG [72,35]
  [-0.833,  0.250, 0.05], // outer-top  SVG [50,45]
  [-1.167,  0.000, 0.06], // outer-mid  SVG [30,60]
  [-0.917, -0.250, 0.05], // outer-low  SVG [45,75]
  [-0.583, -0.167, 0.04], // inner-low  SVG [65,70]
  [-0.333,  0.083, 0.02], // inner-mid  SVG [80,55]
  [-0.667,  0.083, 0.04], // mid        SVG [60,55]
  [-1.000,  0.167, 0.05], // far-out    SVG [40,50]
  // Lower wing — nodes 9–13
  [-0.367, -0.133, 0.02], //            SVG [78,68]
  [-0.667, -0.333, 0.04], //            SVG [60,80]
  [-0.833, -0.500, 0.05], //            SVG [50,90]
  [-0.500, -0.583, 0.05], //            SVG [70,95]
  [-0.200, -0.367, 0.02], //            SVG [88,82]
];

const IMPORTANCE = [
  1.00,                                                    // 0: centre
  0.85, 0.75, 0.80, 0.70, 0.65, 0.70, 0.75, 0.65,        // 1–8  left upper
  0.60, 0.65, 0.55, 0.60, 0.65,                           // 9–13 left lower
  0.85, 0.75, 0.80, 0.70, 0.65, 0.70, 0.75, 0.65,        // 14–21 right upper
  0.60, 0.65, 0.55, 0.60, 0.65,                           // 22–26 right lower
] as const;

// 56 edges derived from LEFT_WING_TRIANGLES + LEFT_LOWER_TRIANGLES (both wings)
const EDGES = [
  // ── Left upper (19 edges) ────────────────────────────────────────────────
  { a:  0, b:  1, s: 0.85 }, { a:  0, b:  6, s: 0.80 }, { a:  1, b:  6, s: 0.75 },
  { a:  0, b:  5, s: 0.75 }, { a:  5, b:  6, s: 0.70 },
  { a:  1, b:  2, s: 0.80 }, { a:  1, b:  7, s: 0.72 }, { a:  2, b:  7, s: 0.74 },
  { a:  2, b:  3, s: 0.78 }, { a:  3, b:  7, s: 0.70 },
  { a:  3, b:  8, s: 0.72 }, { a:  7, b:  8, s: 0.68 },
  { a:  4, b:  8, s: 0.65 }, { a:  3, b:  4, s: 0.75 },
  { a:  5, b:  7, s: 0.68 }, { a:  6, b:  7, s: 0.72 },
  { a:  4, b:  5, s: 0.70 }, { a:  4, b:  7, s: 0.62 },
  { a:  0, b:  4, s: 0.65 },
  // ── Left lower (9 edges) ─────────────────────────────────────────────────
  { a:  0, b:  9, s: 0.80 }, { a:  9, b: 13, s: 0.72 }, { a:  0, b: 13, s: 0.68 },
  { a:  9, b: 10, s: 0.70 }, { a: 10, b: 12, s: 0.65 }, { a:  9, b: 12, s: 0.62 },
  { a: 10, b: 11, s: 0.68 }, { a: 11, b: 12, s: 0.70 }, { a: 12, b: 13, s: 0.65 },
  // ── Right upper (19 edges — node IDs +13 from left upper) ────────────────
  { a:  0, b: 14, s: 0.85 }, { a:  0, b: 19, s: 0.80 }, { a: 14, b: 19, s: 0.75 },
  { a:  0, b: 18, s: 0.75 }, { a: 18, b: 19, s: 0.70 },
  { a: 14, b: 15, s: 0.80 }, { a: 14, b: 20, s: 0.72 }, { a: 15, b: 20, s: 0.74 },
  { a: 15, b: 16, s: 0.78 }, { a: 16, b: 20, s: 0.70 },
  { a: 16, b: 21, s: 0.72 }, { a: 20, b: 21, s: 0.68 },
  { a: 17, b: 21, s: 0.65 }, { a: 16, b: 17, s: 0.75 },
  { a: 18, b: 20, s: 0.68 }, { a: 19, b: 20, s: 0.72 },
  { a: 17, b: 18, s: 0.70 }, { a: 17, b: 20, s: 0.62 },
  { a:  0, b: 17, s: 0.65 },
  // ── Right lower (9 edges — node IDs +13 from left lower) ─────────────────
  { a:  0, b: 22, s: 0.80 }, { a: 22, b: 26, s: 0.72 }, { a:  0, b: 26, s: 0.68 },
  { a: 22, b: 23, s: 0.70 }, { a: 23, b: 25, s: 0.65 }, { a: 22, b: 25, s: 0.62 },
  { a: 23, b: 24, s: 0.68 }, { a: 24, b: 25, s: 0.70 }, { a: 25, b: 26, s: 0.65 },
] as const;

// ─── Node builder ─────────────────────────────────────────────────────────────

type BNode = {
  start:      [number, number, number];
  end:        [number, number, number];
  phase:      number;
  delay:      number;
  importance: number;
};

function clusterAt(i: number): [number, number, number] {
  const θ = (i * 137.508 * Math.PI) / 180;
  const r = 0.028 + (i % 5) * 0.016;
  return [NAV_X + Math.cos(θ) * r, NAV_Y + Math.sin(θ) * r, 0];
}

function buildNodes(): BNode[] {
  const nodes: BNode[] = [{
    start:      [NAV_X, NAV_Y, 0],
    end:        [0, 0.04, 0],
    phase:      0,
    delay:      0,
    importance: 1,
  }];

  // Left wing (ids 1–13)
  L_WING.forEach((a, i) => {
    nodes.push({
      start:      clusterAt(i + 1),
      end:        [a[0], a[1], a[2]],
      phase:      (i + 1) * 0.72,
      delay:      0.04 + (i / 12) * 0.22,
      importance: IMPORTANCE[i + 1],
    });
  });

  // Right wing (ids 14–26) — X-mirror
  L_WING.forEach((a, i) => {
    nodes.push({
      start:      clusterAt(i + 14),
      end:        [-a[0], a[1], a[2]],
      phase:      (i + 1) * 0.72,
      delay:      0.06 + (i / 12) * 0.22,
      importance: IMPORTANCE[i + 14],
    });
  });

  return nodes;
}

// ─── Visualization ────────────────────────────────────────────────────────────

const TOTAL_NODES = 27;
const WING_COUNT  = 26;
const EXPAND_DUR  = 1.85;
const IDLE_SPEED  = 0.50;

function NetworkVisualization() {
  const nodes = useMemo(buildNodes, []);
  const edges = useMemo(() => EDGES, []);

  const meshRef   = useRef<InstancedMesh>(null);
  const linesRef  = useRef<LineSegments>(null);
  const centreRef = useRef<Mesh>(null);
  const glowRef   = useRef<Mesh>(null);
  const groupRef  = useRef<Group>(null);
  const dummy     = useMemo(() => new Object3D(), []);

  const phase   = useRef<"expand" | "idle">("expand");
  const tExp    = useRef(0);
  const pulseT  = useRef(0); // 0–1 heartbeat intensity

  const curPos = useRef(new Float32Array(TOTAL_NODES * 3));
  const mouse  = useRef({ tx: 0, ty: 0, x: 0, y: 0, lastMove: 0 });

  const linePos = useMemo(() => new Float32Array(edges.length * 6), [edges.length]);
  const lineCol = useMemo(() => new Float32Array(edges.length * 6), [edges.length]);

  useEffect(() => {
    const id = setTimeout(() => { tExp.current = 0; }, 300);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.tx = Math.max(-0.5, Math.min(0.5,  (e.clientX / window.innerWidth  - 0.5) * 1.2));
      mouse.current.ty = Math.max(-0.29, Math.min(0.26, -(e.clientY / window.innerHeight - 0.5) * 0.8));
      mouse.current.lastMove = performance.now();
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useFrame(({ clock }, delta) => {
    const t  = clock.elapsedTime;
    const ph = phase.current;

    if (ph === "expand") {
      tExp.current = Math.min(tExp.current + delta / EXPAND_DUR, 1);
      if (tExp.current >= 1) phase.current = "idle";
    }

    const tE = tExp.current;

    // Heartbeat: 0 → 1 → 0 every 2 s. Starts only after expand settles.
    pulseT.current = ph === "idle" ? (Math.sin(t * Math.PI) + 1) / 2 : 0;

    // ── World positions ──────────────────────────────────────────────────────
    nodes.forEach((n, i) => {
      const raw = (tE - n.delay) / (1 - n.delay + 0.001);
      const nT  = expandEase(Math.max(0, raw));

      let x = lerp(n.start[0], n.end[0], nT);
      let y = lerp(n.start[1], n.end[1], nT);
      let z = lerp(n.start[2], n.end[2], nT);

      if (ph === "idle" && i > 0) {
        const lt = t * IDLE_SPEED + n.phase;
        y += Math.sin(lt)        * 0.032;
        z += Math.cos(lt * 0.82) * 0.011;
      }

      curPos.current[i * 3]     = x;
      curPos.current[i * 3 + 1] = y;
      curPos.current[i * 3 + 2] = z;
    });

    // ── Wing node instanced mesh ─────────────────────────────────────────────
    for (let i = 1; i <= WING_COUNT; i++) {
      const n   = nodes[i];
      const raw = (tE - n.delay) / (1 - n.delay + 0.001);
      const nT  = expandEase(Math.max(0, raw));

      const lt     = t * IDLE_SPEED + n.phase;
      const breath = ph === "idle" ? 1 + Math.sin(lt * 0.85) * 0.20 : 1;
      // Distribution: each node activates softly at its own slow cadence
      const dist   = ph === "idle" ? Math.max(0, Math.sin(t * 0.22 + i * 1.618)) * 0.18 : 0;
      const sBase  = 0.012 + n.importance * 0.008;
      const s      = lerp(0, sBase * breath * (1 + dist), nT);

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

    // ── Edges ────────────────────────────────────────────────────────────────
    const globalAlpha = easeOutCubic(tE);

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

      // Edges directly connected to centre glow with the heartbeat
      // (centre is always the `a` endpoint in EDGES — `b` is never 0)
      const isCenter   = e.a === 0;
      const pulseBoost = isCenter ? pulseT.current * 0.42 : 0;
      const flow = ph === "idle"
        ? 0.30 + Math.sin(t * 1.8 + i * 0.45) * 0.28 + pulseBoost
        : globalAlpha;
      const bright = (0.18 + e.s * 0.48) * flow;

      lineCol[o]   = bright * 0.65; lineCol[o+1] = bright * 0.55; lineCol[o+2] = bright * 0.98;
      lineCol[o+3] = bright * 0.65; lineCol[o+4] = bright * 0.55; lineCol[o+5] = bright * 0.98;
    }

    if (linesRef.current) {
      linesRef.current.geometry.attributes.position.needsUpdate = true;
      linesRef.current.geometry.attributes.color.needsUpdate    = true;
    }

    // ── Centre nucleus ────────────────────────────────────────────────────────
    const cT = expandEase(Math.max(0, tE));
    const cx = curPos.current[0],
          cy = curPos.current[1],
          cz = curPos.current[2];

    centreRef.current?.position.set(cx, cy, cz);
    glowRef.current?.position.set(cx, cy, cz);

    const p = pulseT.current;
    // Nucleus: slow micro-breathe + heartbeat pulse (1 → 1.15 at peak)
    const breathCentre = ph === "idle"
      ? (1 + Math.sin(t * 1.15) * 0.04 + Math.cos(t * 0.58) * 0.02) * (1 + p * 0.15)
      : 1;
    // Glow halo blooms more strongly on pulse
    const breathGlow = breathCentre * (1 + p * 0.55);
    centreRef.current?.scale.setScalar(lerp(0, breathCentre, cT));
    glowRef.current?.scale.setScalar(lerp(0, breathGlow, cT));

    // ── Cursor follow ────────────────────────────────────────────────────────
    // nearBottom: 0 at y = -0.12, ramps to 1 at y = -0.26 (lower canvas boundary)
    const nearBottom = Math.max(0, Math.min(1, (-mouse.current.y - 0.12) / 0.17));
    const lerpSpeed  = 0.022 * (1 - nearBottom * 0.5); // decelerates to 0.011 at boundary
    mouse.current.x += (mouse.current.tx - mouse.current.x) * lerpSpeed;
    mouse.current.y += (mouse.current.ty - mouse.current.y) * lerpSpeed;

    if (groupRef.current) {
      const still     = (performance.now() - mouse.current.lastMove) / 1000;
      const driftFade = ph === "idle" ? Math.max(0, Math.min(1, (still - 0.4) / 1.4)) : 0;
      const drift     = driftFade * 0.042;
      // micro-float kicks in near lower boundary — slow horizontal oscillation
      const floatX    = Math.sin(t * 0.33 + 0.8) * nearBottom * 0.022;
      groupRef.current.position.x = mouse.current.x + Math.cos(t * 0.38) * drift + floatX;
      groupRef.current.position.y = mouse.current.y + Math.sin(t * 0.27) * drift * 0.55;
      // breathing scale: ±2.8% pulse, fades in/out with nearBottom
      groupRef.current.scale.setScalar(1 + Math.sin(t * 0.70) * nearBottom * 0.028);
    }
  });

  return (
    <group ref={groupRef}>

      {/* Wing nodes — 26 instances, 1 draw call */}
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

      {/* Edges — 56 segments, 1 draw call */}
      <lineSegments ref={linesRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
          <bufferAttribute attach="attributes-color"    args={[lineCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.65}
          toneMapped={false}
        />
      </lineSegments>

      {/* Centre nucleus */}
      <mesh ref={centreRef}>
        <sphereGeometry args={[0.045, 16, 16]} />
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
        <sphereGeometry args={[0.18, 16, 16]} />
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

const MASK_H = "linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)";
const MASK_V = "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)";

const NetworkScene = () => (
  <div
    className="absolute pointer-events-none"
    style={{
      inset: "0 -120px",
      WebkitMaskImage: `${MASK_H}, ${MASK_V}`,
      maskImage:        `${MASK_H}, ${MASK_V}`,
      WebkitMaskComposite: "source-in",
      maskComposite:       "intersect",
    }}
  >
    <Canvas
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 3.0], fov: 42 }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.06} />
      <NetworkVisualization />
    </Canvas>
  </div>
);

export default NetworkScene;
