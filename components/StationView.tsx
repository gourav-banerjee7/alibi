"use client";

import { useCallback, useEffect, useRef } from "react";
import { WORLD, locationAt } from "@/lib/game/map";
import { player } from "@/lib/game/rules";
import { STEP, tick, walkTo, type Input } from "@/lib/game/sim";
import type { GameState } from "@/lib/game/types";
import { drawStation } from "@/lib/render";

const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

interface Props {
  state: GameState;
  paused: boolean;
  useHeld: React.MutableRefObject<boolean>;
  /** Called a few times a second so the HUD can re-render, and whenever the phase changes. */
  onFrame: () => void;
}

export function StationView({ state, paused, useHeld, onFrame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keys = useRef(new Set<string>());
  const stateRef = useRef(state);
  stateRef.current = state;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (KEYS[e.code]) {
        keys.current.add(e.code);
        e.preventDefault();
      }
      if (e.code === "KeyE" || e.code === "Space") {
        useHeld.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      if (e.code === "KeyE" || e.code === "Space") useHeld.current = false;
    };
    const blur = () => {
      keys.current.clear();
      useHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [useHeld]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudTimer = 0;
    let lastPhase = stateRef.current.phase;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round((w * WORLD.height) / WORLD.width) * dpr;
      ctx.setTransform((canvas.width / WORLD.width), 0, 0, canvas.height / WORLD.height, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (!pausedRef.current && s.phase === "roam") {
        let dx = 0;
        let dy = 0;
        for (const k of keys.current) {
          const v = KEYS[k];
          if (v) {
            dx += v[0];
            dy += v[1];
          }
        }
        const len = Math.hypot(dx, dy);
        const input: Input = { dir: len > 0 ? { x: dx / len, y: dy / len } : null, use: useHeld.current };
        acc += dt;
        while (acc >= STEP && s.phase === "roam") {
          tick(s, input);
          acc -= STEP;
        }
      } else acc = 0;

      drawStation(ctx, s, now / 1000);

      hudTimer += dt;
      if (hudTimer > 0.15 || s.phase !== lastPhase) {
        hudTimer = 0;
        lastPhase = s.phase;
        onFrame();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [onFrame, useHeld]);

  const onPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (pausedRef.current || s.phase !== "roam") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = { x: ((e.clientX - rect.left) / rect.width) * WORLD.width, y: ((e.clientY - rect.top) / rect.height) * WORLD.height };
    if (!locationAt(p)) return;
    walkTo(player(s), p);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointer}
      className="block w-full touch-none select-none rounded-xl border border-sky-900/60 bg-[#02070f]"
      style={{ aspectRatio: `${WORLD.width} / ${WORLD.height}` }}
      aria-label="Station map. Move with WASD or arrow keys, or click where you want to go."
    />
  );
}
