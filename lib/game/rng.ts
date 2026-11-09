/** mulberry32: tiny seeded PRNG. State is a single uint32 kept in GameState, so games replay exactly. */
export function next(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(state: { rng: number }, maxExclusive: number): number {
  return Math.floor(next(state) * maxExclusive);
}

export function pick<T>(state: { rng: number }, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick from empty list");
  return items[int(state, items.length)]!;
}

export function shuffle<T>(state: { rng: number }, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(state, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
