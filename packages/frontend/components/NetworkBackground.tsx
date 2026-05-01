"use client";

import React, { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCentral: boolean;
};

const NODE_COUNT = 25;
const COLOR = "#7B61FF";
const LINE_DISTANCE = 160;
const SHADOW_BLUR = 18;

const NetworkBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const nodesRef = useRef<Node[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement ?? document.body;
    const devicePixelRatio = window.devicePixelRatio || 1;

    const setCanvasSize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, rect.width * devicePixelRatio);
      canvas.height = Math.max(1, rect.height * devicePixelRatio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const createNodes = () => {
      const width = canvas.width / devicePixelRatio;
      const height = canvas.height / devicePixelRatio;
      const nodes: Node[] = [];

      for (let i = 0; i < NODE_COUNT; i += 1) {
        const isCentral = i === 0;
        nodes.push({
          x: isCentral ? width / 2 : Math.random() * width,
          y: isCentral ? height / 2 : Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          radius: isCentral ? 4.5 : 2 + Math.random() * 1.8,
          isCentral,
        });
      }

      nodesRef.current = nodes;
    };

    const updateNodes = () => {
      const width = canvas.width / devicePixelRatio;
      const height = canvas.height / devicePixelRatio;

      nodesRef.current.forEach((node) => {
        if (node.isCentral) {
          node.vx *= 0.98;
          node.vy *= 0.98;
        }

        node.x += node.vx;
        node.y += node.vy;

        if (node.x <= 0 || node.x >= width) node.vx *= -1;
        if (node.y <= 0 || node.y >= height) node.vy *= -1;

        node.x = Math.min(Math.max(node.x, 0), width);
        node.y = Math.min(Math.max(node.y, 0), height);
      });
    };

    const draw = () => {
      const width = canvas.width / devicePixelRatio;
      const height = canvas.height / devicePixelRatio;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.shadowColor = COLOR;
      ctx.shadowBlur = SHADOW_BLUR;
      ctx.strokeStyle = COLOR;
      ctx.fillStyle = COLOR;
      ctx.lineWidth = 0.9;

      const nodes = nodesRef.current;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < LINE_DISTANCE) {
            const alpha = 1 - distance / LINE_DISTANCE;
            ctx.globalAlpha = alpha * 0.35;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }
      }

      nodes.forEach((node) => {
        ctx.globalAlpha = node.isCentral ? 1 : 0.8;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    };

    const animate = () => {
      updateNodes();
      draw();
      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    setCanvasSize();
    createNodes();
    animate();

    window.addEventListener("resize", setCanvasSize);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(setCanvasSize);
      resizeObserverRef.current.observe(parent);
    }

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", setCanvasSize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default NetworkBackground;
