"use client";

import { useEffect, useRef } from "react";
import { CAMERA_ROOMS } from "@/lib/game/map";
import type { GameState } from "@/lib/game/types";
import { drawCameraFeed } from "@/lib/render";

/**
 * The security desk: four live feeds. The game keeps running while you watch,
 * so you're exposed at the desk, and every camera's red light tells the station someone is looking.
 */
export function CameraView({ state, onLeave }: { state: GameState; onLeave: () => void }) {
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let raf = 0;
    const frame = (now: number) => {
      canvases.current.forEach((canvas, i) => {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawCameraFeed(ctx, stateRef.current, CAMERA_ROOMS[i]!, i, w, h, now / 1000);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onLeave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLeave]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-2 rounded-2xl border border-line-strong bg-abyss/95 p-2.5 backdrop-blur" role="dialog" aria-label="Security camera feeds">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-coral shadow-[0_0_8px_#ff5d73]" />
          Security feeds · Comms desk
        </p>
        <button
          onClick={onLeave}
          className="rounded-lg border border-line-strong px-3 py-1 text-xs font-medium text-ink hover:bg-deep-3"
        >
          Leave · Esc / C / move
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        {CAMERA_ROOMS.map((room, i) => (
          <canvas
            key={room}
            ref={(el) => {
              canvases.current[i] = el;
            }}
            className="h-full w-full rounded-xl border border-line bg-black"
            aria-label={`Camera ${i + 1}`}
          />
        ))}
      </div>
      <p className="px-1 text-[11px] text-faint">
        While you watch, every camera&apos;s red light is on. The killer can see someone is looking, and you&apos;re not moving.
      </p>
    </div>
  );
}
