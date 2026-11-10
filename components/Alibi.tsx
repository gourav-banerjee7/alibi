"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Director, type DirectorStatus } from "@/lib/ai/director";
import { finishMeeting } from "@/lib/game/actions";
import { player } from "@/lib/game/rules";
import { newGame, type StartRole } from "@/lib/game/setup";
import { callMeeting, canCallEmergency, canUseCameras, isWatching, kill, killTarget, pactCandidate, startPlayerPact, startWatching, stopWatching, tick, visibleBody } from "@/lib/game/sim";
import type { Body, GameState, MeetingRecord } from "@/lib/game/types";
import { EndScreen } from "./EndScreen";
import { CameraView } from "./CameraView";
import { ActionBar, SidePanel, TopBar } from "./Hud";
import { Meeting } from "./Meeting";
import { PactDialog } from "./PactDialog";
import { StationView } from "./StationView";
import { TitleScreen } from "./TitleScreen";

type Overlay =
  | { kind: "meeting"; calledBy: string; reason: "body" | "emergency"; body?: Body; key: number }
  | { kind: "pact"; from: string; to: string; key: number }
  | null;

export function Alibi() {
  const [screen, setScreen] = useState<"title" | "play" | "end">("title");
  const [game, setGame] = useState<GameState | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<DirectorStatus | null>(null);
  const [, setFrame] = useState(0);
  const lastRole = useRef<StartRole>("crew");
  const useHeld = useRef(false);
  const lastClues = useRef(0);
  const [live, setLive] = useState<{ live: boolean; model: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then((d: { live: boolean; model: string | null }) => setLive(d))
      .catch(() => setLive({ live: false, model: null }));
  }, []);

  // One director per game, so fallback counts and rate-limit pauses are per game.
  const director = useMemo(() => (live && game ? new Director(live.live, live.model) : null), [live, game]);
  useEffect(() => {
    if (!director) {
      if (live) setStatus({ mode: live.live ? "live" : "offline", model: live.model, fallbacks: 0 });
      return;
    }
    setStatus(director.status);
    const off = director.onStatus(setStatus);
    return () => {
      off();
    };
  }, [director, live]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 4500);
  };

  const start = (role: StartRole) => {
    lastRole.current = role;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const g = newGame(seed, role);
    lastClues.current = 0;
    setGame(g);
    setOverlay(null);
    setScreen("play");
    showToast(player(g).role === "killer" ? "You are the killer. Nobody can know." : "You are crew. Someone aboard is a killer.");
  };

  // Called by the render loop a few times a second.
  const onFrame = useCallback(() => {
    setFrame((n) => n + 1);
    if (!game) return;
    if (game.clues.length > lastClues.current) {
      lastClues.current = game.clues.length;
      showToast(game.clues[game.clues.length - 1]!);
    }
    if (game.phase === "over") {
      setScreen("end");
      return;
    }
    const p = game.pending;
    if (p && !overlay) {
      setOverlay(p.kind === "meeting" ? { ...p, key: Date.now() } : { ...p, key: Date.now() });
    }
  }, [game, overlay]);

  // Dev-only hook for play-testing when the tab is throttled: fast-forward the sim, move the player.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !game) return;
    const w = window as unknown as { __alibi?: unknown };
    w.__alibi = {
      state: () => game,
      ff(minutes: number) {
        const end = game.t + minutes;
        while (game.phase === "roam" && game.t < end) tick(game, { dir: null, use: false });
        onFrameRef.current();
        return { t: game.t, phase: game.phase, pending: game.pending, kills: game.kills.length };
      },
      goto(x: number, y: number) {
        const you = player(game);
        you.pos = { x, y };
        you.path = [];
        tick(game, { dir: null, use: false });
        onFrameRef.current();
        return you.loc;
      },
      frame: () => onFrameRef.current(),
    };
    return () => {
      delete w.__alibi;
    };
  }, [game]);

  const report = useCallback(() => {
    if (!game || overlay) return;
    const body = visibleBody(game);
    if (body) callMeeting(game, "you", "body", body);
  }, [game, overlay]);

  const emergency = useCallback(() => {
    if (!game || overlay || !canCallEmergency(game)) return;
    callMeeting(game, "you", "emergency");
  }, [game, overlay]);

  const doKill = useCallback(() => {
    if (!game || overlay) return;
    const target = killTarget(game);
    if (target) {
      kill(game, player(game), target);
      showToast(`You killed ${target.name}. Walk away.`);
    }
  }, [game, overlay]);

  const toggleCameras = useCallback(() => {
    if (!game || overlay) return;
    if (isWatching(game, "you")) stopWatching(game);
    else if (canUseCameras(game)) startWatching(game);
    setFrame((n) => n + 1);
  }, [game, overlay]);

  const leaveCameras = useCallback(() => {
    if (!game) return;
    stopWatching(game);
    setFrame((n) => n + 1);
  }, [game]);

  const offer = useCallback(() => {
    if (!game || overlay) return;
    const c = pactCandidate(game);
    if (c) startPlayerPact(game, c.id);
  }, [game, overlay]);

  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.code === "KeyR") report();
      if (e.code === "KeyM") emergency();
      if (e.code === "KeyK") doKill();
      if (e.code === "KeyQ") offer();
      if (e.code === "KeyC") toggleCameras();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, report, emergency, doKill, offer, toggleCameras]);

  const meetingDone = (record: MeetingRecord) => {
    if (!game) return;
    finishMeeting(game, record);
    setOverlay(null);
    if (game.phase === "over") setScreen("end");
  };

  const pactDone = (summary: string) => {
    if (!game) return;
    if (game.phase === "pact") {
      game.phase = "roam";
      game.pending = undefined;
    }
    setOverlay(null);
    showToast(summary);
  };

  if (screen === "title" || !game) return <TitleScreen status={status} onStart={start} />;
  if (screen === "end") return <EndScreen state={game} onAgain={() => start(lastRole.current)} onTitle={() => setScreen("title")} />;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-4">
      <TopBar state={game} status={status} />
      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <StationView state={game} paused={overlay !== null} useHeld={useHeld} onFrame={onFrame} />
            {isWatching(game, "you") && !overlay ? <CameraView state={game} onLeave={leaveCameras} /> : null}
            {toast ? (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                <p className="animate-rise rounded-full border border-glow/30 bg-abyss/90 px-4 py-1.5 text-center text-sm text-ink shadow-[0_0_24px_-8px_#5ce1e6] backdrop-blur">{toast}</p>
              </div>
            ) : null}
          </div>
          <ActionBar state={game} useHeld={useHeld} onReport={report} onEmergency={emergency} onKill={doKill} onOffer={offer} onCameras={toggleCameras} />
        </div>
        <SidePanel state={game} />
      </div>

      {overlay?.kind === "meeting" && director ? (
        <Meeting key={overlay.key} state={game} director={director} pending={overlay} onDone={meetingDone} />
      ) : null}
      {overlay?.kind === "pact" && director ? (
        <PactDialog key={overlay.key} state={game} director={director} from={overlay.from} to={overlay.to} onClose={pactDone} />
      ) : null}
    </div>
  );
}
