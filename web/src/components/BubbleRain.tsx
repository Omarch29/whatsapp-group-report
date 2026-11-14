"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";

type Props = { density?: number };

type Drop = { x: number; y: number; size: number; speed: number; mine: boolean; alpha: number };

const MINE = "#0a7a63";
const FALLBACK_THEIRS = "#1f2c34";

const spawn = (initial: boolean): Drop => ({
  x: Math.random(),
  y: initial ? Math.random() * 1.05 : -0.05,
  size: 4 + Math.random() * 10,
  speed: 0.0015 + Math.random() * 0.003,
  mine: Math.random() < 0.4,
  alpha: 0.25 + Math.random() * 0.5,
});

/** Small chat bubbles falling behind the hero; fills its (positioned) parent. */
export function BubbleRain({ density = 120 }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (reduced || !canvas || !ctx) return;

    const theirs =
      getComputedStyle(document.documentElement).getPropertyValue("--bubble").trim() || FALLBACK_THEIRS;
    const drops = Array.from({ length: density }, () => spawn(true));
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.width = Math.round(canvas.offsetWidth * dpr);
      h = canvas.height = Math.round(canvas.offsetHeight * dpr);
    };
    resize();

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of drops) {
        d.y += d.speed;
        if (d.y > 1.05) Object.assign(d, spawn(false));
        const s = d.size * dpr;
        // Fade out over the last stretch before recycling.
        ctx.globalAlpha = d.alpha * (1 - Math.max(0, d.y - 0.7) / 0.35);
        ctx.fillStyle = d.mine ? MINE : theirs;
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(d.x * w, d.y * h, s * 2.2, s, s * 0.45);
        else ctx.rect(d.x * w, d.y * h, s * 2.2, s);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const target = canvas.parentElement;
    const ro = typeof ResizeObserver === "undefined" || !target ? null : new ResizeObserver(resize);
    if (target) ro?.observe(target);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [reduced, density]);

  if (reduced) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
