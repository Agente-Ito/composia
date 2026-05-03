"use client";

import React, { useEffect, useRef } from "react";

type Node = {
  anchorX: number;
  anchorY: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  active: boolean;
  phase: number;
  side: "left" | "right" | "center";
};

type Edge = readonly [number, number];

const COLORS = {
  background: "#0A0A0F",
  edge: "rgba(123,97,255,0.20)",
  active: "#7B61FF",
  secondary: "#A78BFA",
  surface: "#EDEFF6",
} as const;

const NODE_COUNT_PER_WING = 10;
const CENTRAL_RADIUS = 4.5;
const MAX_CONNECTION_DISTANCE = 90;
const SHADOW_BLUR = 12;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function hash2d(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function noise2d(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const n00 = hash2d(xi, yi);
  const n10 = hash2d(xi + 1, yi);
  const n01 = hash2d(xi, yi + 1);
  const n11 = hash2d(xi + 1, yi + 1);
  const u = fade(xf);
  const v = fade(yf);
  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);
  return lerp(nx0, nx1, v);
}

function createNodes(width: number, height: number): Node[] {
  const centerX = width / 2;
  const top = height * 0.18;
  const bottom = height * 0.82;
  const nodes: Node[] = [];

  nodes.push({
    anchorX: centerX,
    anchorY: height * 0.5,
    x: centerX,
    y: height * 0.5,
    radius: CENTRAL_RADIUS,
    color: COLORS.active,
    active: true,
    phase: 0,
    side: "center",
  });

  for (let side of ["left", "right"] as const) {
    for (let index = 0; index < NODE_COUNT_PER_WING; index += 1) {
      const t = index / (NODE_COUNT_PER_WING - 1);
      const wingHeight = lerp(top, bottom, t);
      const spread = lerp(width * 0.14, width * 0.34, t);
      const direction = side === "left" ? -1 : 1;
      const curvature = noise2d(t * 2.2, index * 0.7) * 0.32;
      const xBase = centerX + direction * spread;
      const x = xBase + direction * (noise2d(t * 3.3, index * 1.1) - 0.5) * 24;
      const y = wingHeight + (noise2d(t * 2.4, index * 1.4) - 0.5) * 18;
      const radius = lerp(1.2, 2.6, noise2d(index * 1.7, t * 2.0));
      const active = index === 0 || index === NODE_COUNT_PER_WING - 1 || index === Math.floor(NODE_COUNT_PER_WING / 2);
      const color = active ? COLORS.active : COLORS.secondary;

      nodes.push({
        anchorX: x,
        anchorY: y,
        x,
        y,
        radius,
        color,
        active,
        phase: Math.random() * Math.PI * 2,
        side,
      });
    }
  }

  return nodes;
}

function buildEdges(nodes: Node[]) {
  const edges: Edge[] = [];

  const centerIndex = 0;
  const wingNodes = nodes.slice(1);

  for (let i = 0; i < wingNodes.length; i += 1) {
    const current = wingNodes[i];
    const currentIndex = i + 1;
    edges.push([centerIndex, currentIndex]);

    for (let j = i + 1; j < wingNodes.length && j < i + 4; j += 1) {
      const compare = wingNodes[j];
      if (current.side !== compare.side) continue;
      edges.push([currentIndex, j + 1]);
    }
  }

  for (let i = 1; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (nodes[i].side !== nodes[j].side) continue;
      const dx = nodes[i].anchorX - nodes[j].anchorX;
      const dy = nodes[i].anchorY - nodes[j].anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < MAX_CONNECTION_DISTANCE * 0.95) {
        edges.push([i, j]);
      }
    }
  }

  return edges;
}

const NetworkButterfly: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const resizeRef = useRef<() => void>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement ?? document.body;
    const dpr = window.devicePixelRatio || 1;

    const setSize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * dpr);
      canvas.height = Math.max(1, rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = rect.width;
      const height = rect.height;
      nodesRef.current = createNodes(width, height);
      edgesRef.current = buildEdges(nodesRef.current);
    };

    const draw = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.shadowBlur = SHADOW_BLUR;
      ctx.shadowColor = COLORS.active;

      const center = nodes[0];
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(center.x, center.y, center.radius * 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = COLORS.edge;
      ctx.lineWidth = 0.8;
      ctx.lineCap = "round";

      edges.forEach(([a, b]) => {
        const n1 = nodes[a];
        const n2 = nodes[b];
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const alpha = Math.max(0.06, 0.32 - distance / MAX_CONNECTION_DISTANCE);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      });

      nodes.forEach((node, index) => {
        const floatX = Math.sin(time * 0.0008 + node.phase) * 1.2;
        const floatY = Math.cos(time * 0.0009 + node.phase) * 0.8;
        node.x = node.anchorX + floatX;
        node.y = node.anchorY + floatY;

        const pulse = node.active ? 1 + Math.sin(time * 0.002 + node.phase) * 0.12 : 1;
        const radius = node.radius * pulse;

        ctx.globalAlpha = node.active ? 1 : 0.72;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (node.active) {
          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = COLORS.active;
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    };

    const animate = (timestamp: number) => {
      draw(timestamp);
      requestRef.current = window.requestAnimationFrame(animate);
    };

    resizeRef.current = setSize;
    setSize();
    animate(0);

    window.addEventListener("resize", setSize);
    return () => {
      if (requestRef.current) {
        window.cancelAnimationFrame(requestRef.current);
      }
      window.removeEventListener("resize", setSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}
    />
  );
};

export default NetworkButterfly;
