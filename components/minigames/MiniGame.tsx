"use client";

import { useEffect, useRef, useState } from "react";
import { ROOM_BY_ID } from "@/lib/game/map";
import type { PlayerTask } from "@/lib/game/types";
import { DialGame } from "./DialGame";
import { MatchGame } from "./MatchGame";
import { TimingGame } from "./TimingGame";
import { WiresGame } from "./WiresGame";

export interface GameProps {
  theme: string;
  tint: string;
  onDone: () => void;
}

/**
 * The frame around every task mini-game. The station keeps running behind it,
 * so doing a task leaves you exposed, and Esc (or ×) walks away without finishing.
 */
export function MiniGame({ task, onDone, onClose }: { task: PlayerTask; onDone: () => void; onClose: () => void }) {
  const room = ROOM_BY_ID[task.room];
  const [won, setWon] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const done = () => {
    if (finished.current) return;
    finished.current = true;
    setWon(true);
    window.setTimeout(onDone, 650);
  };

  const props: GameProps = { theme: task.theme, tint: room.tint, onDone: done };

  return (
    <div className="absolute inset-0 z-20 flex overflow-y-auto rounded-2xl bg-abyss/80 p-2 backdrop-blur-sm sm:p-3" role="dialog" aria-label={task.label}>
      <div
        className="relative m-auto w-full max-w-md rounded-3xl border bg-deep p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]"
        style={{ borderColor: `${room.tint}66`, boxShadow: `0 0 60px -24px ${room.tint}` }}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: room.tint }}>
              {room.name}
            </p>
            <h2 className="text-lg font-semibold text-ink">{task.label}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Walk away from the task"
            className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-muted hover:bg-deep-3 hover:text-ink"
          >
            ×
          </button>
        </div>

        <div className={won ? "pointer-events-none opacity-60 transition" : ""}>
          {task.game === "dial" ? <DialGame {...props} /> : null}
          {task.game === "wires" ? <WiresGame {...props} /> : null}
          {task.game === "match" ? <MatchGame {...props} /> : null}
          {task.game === "timing" ? <TimingGame {...props} /> : null}
        </div>

        {won ? (
          <div className="absolute inset-0 grid place-items-center rounded-3xl">
            <p className="animate-rise rounded-2xl border border-kelp/60 bg-abyss/90 px-6 py-3 text-lg font-bold text-kelp shadow-[0_0_40px_-10px_#5be49b]">
              Task complete
            </p>
          </div>
        ) : (
          <p className="mt-2 text-center text-[11px] text-faint">The station doesn&apos;t stop while you work. Esc to walk away.</p>
        )}
      </div>
    </div>
  );
}
