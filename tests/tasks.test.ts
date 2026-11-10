import { describe, expect, it } from "vitest";
import { locationAt } from "@/lib/game/map";
import { newGame, TASK_DEFS } from "@/lib/game/setup";
import { completeTask, nearbyTask, tick } from "@/lib/game/sim";

describe("task mini-games", () => {
  it("every task has a known mini-game and a theme", () => {
    for (const defs of Object.values(TASK_DEFS)) {
      for (const d of defs) {
        expect(["dial", "wires", "match", "timing"]).toContain(d.game);
        expect(d.theme.length).toBeGreaterThan(0);
      }
    }
    for (let seed = 1; seed < 30; seed++) for (const t of newGame(seed).tasks) expect(t.game).toBeDefined();
  });

  it("holding Use at a task no longer completes it; only the mini-game does", () => {
    const s = newGame(4);
    const you = s.characters[0]!;
    const task = s.tasks[0]!;
    you.pos = { ...task.pos };
    you.loc = locationAt(task.pos)!;
    expect(nearbyTask(s)?.id).toBe(task.id);
    for (let i = 0; i < 100; i++) tick(s, { dir: null, use: true });
    expect(task.done).toBe(false);
    completeTask(s, task.id);
    expect(task.done).toBe(true);
  });

  it("crew get a sonar log for a task; the killer, faking it, doesn't", () => {
    const crew = newGame(4, "crew");
    for (let i = 0; i < 300 && crew.phase === "roam"; i++) tick(crew, { dir: null, use: false }); // let some history build up
    completeTask(crew, crew.tasks[0]!.id);
    expect(crew.clues.length).toBe(1);

    const killer = newGame(4, "killer");
    for (let i = 0; i < 300 && killer.phase === "roam"; i++) tick(killer, { dir: null, use: false });
    completeTask(killer, killer.tasks[0]!.id);
    expect(killer.tasks[0]!.done).toBe(true);
    expect(killer.clues.length).toBe(0);
  });

  it("finishing the same task twice does nothing", () => {
    const s = newGame(8);
    for (let i = 0; i < 300 && s.phase === "roam"; i++) tick(s, { dir: null, use: false });
    completeTask(s, s.tasks[1]!.id);
    completeTask(s, s.tasks[1]!.id);
    expect(s.clues.length).toBe(1);
  });
});
