/**
 * Original character art: chunky deep-sea divers in brass porthole helmets.
 * One SVG source is used everywhere: inline in the UI as icons, and rasterised for the canvas.
 * Each diver has a silhouette accessory so they're recognisable without relying on colour.
 */

export type Accessory = "crest" | "antenna" | "visor" | "cross" | "dish" | "stripe";

export interface DiverLook {
  suit: string;
  accessory: Accessory;
}

export const LOOKS: Record<string, DiverLook> = {
  you: { suit: "#E8ECF6", accessory: "stripe" },
  mara: { suit: "#FF6FA5", accessory: "crest" },
  juno: { suit: "#FFD25C", accessory: "antenna" },
  tobias: { suit: "#5B8DFF", accessory: "visor" },
  ines: { suit: "#3FE0A0", accessory: "cross" },
  kenji: { suit: "#FF9A4D", accessory: "dish" },
};

export function lookOf(id: string): DiverLook {
  return LOOKS[id] ?? { suit: "#9AA4BF", accessory: "stripe" };
}

/** Mix a hex colour toward black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function accessorySvg(a: Accessory, suit: string): string {
  switch (a) {
    case "crest": // a fin running over the helmet
      return `<path d="M22 11 C27 2 37 1 42 6 C38 7 33 9 30 13 Z" fill="${suit}" stroke="#0A0E18" stroke-width="1.5" stroke-linejoin="round"/>`;
    case "antenna": // a bulb on a wire
      return `<path d="M27 9 Q24 4 22 1.5" stroke="#2A3148" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="21.5" cy="3" r="4.2" fill="#FFF3B0" stroke="#0A0E18" stroke-width="1.3"/><circle cx="20.5" cy="2" r="1.3" fill="#FFFFFF"/>`;
    case "visor": // a security visor bar across the porthole
      return `<rect x="29" y="18.5" width="17" height="4" rx="2" fill="${suit}" stroke="#0A0E18" stroke-width="1.2"/>`;
    case "cross": // medic cross on the chest
      return `<path d="M30 39 h4 v-4 h3 v4 h4 v3 h-4 v4 h-3 v-4 h-4 Z" fill="#F8FAFF" stroke="#0A0E18" stroke-width="0.8"/>`;
    case "dish": // comms headset: band over the helmet, ear cup, mic boom
      return `<path d="M20.5 15 Q26 4.5 36 6.5" stroke="#2A3148" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="15.5" y="15" width="8" height="11" rx="3.5" fill="#E7ECF8" stroke="#0A0E18" stroke-width="1.3"/><path d="M19.5 25.5 Q21 32 28 32.5" stroke="#2A3148" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="28.5" cy="32.5" r="2" fill="#E7ECF8" stroke="#0A0E18" stroke-width="1"/>`;
    case "stripe": // a hazard stripe on the suit
      return `<rect x="21" y="40" width="22" height="3.2" rx="1.6" fill="#5CE1E6"/>`;
  }
}

/**
 * A diver facing right, in a 64x64 box. `dead` lays the diver on its side with a dark visor.
 * `uid` keeps gradient ids unique when several icons share a page.
 */
export function diverSvg(id: string, opts: { uid?: string; dead?: boolean; glow?: boolean } = {}): string {
  const { suit, accessory } = lookOf(id);
  const uid = opts.uid ?? id;
  const dark = shade(suit, -0.35);
  const darker = shade(suit, -0.55);
  const visorGlow = opts.dead ? "#1A2033" : suit;
  const body = `
  <ellipse cx="32" cy="58" rx="15" ry="3.2" fill="#000" opacity="0.35"/>
  <rect x="13" y="29" width="9" height="19" rx="4" fill="#3A4462" stroke="#0A0E18" stroke-width="1.5"/>
  <rect x="15" y="31" width="2.2" height="14" rx="1.1" fill="#56618A"/>
  <rect x="24" y="47" width="7" height="9" rx="3.2" fill="${darker}" stroke="#0A0E18" stroke-width="1.5"/>
  <rect x="34" y="47" width="7" height="9" rx="3.2" fill="${darker}" stroke="#0A0E18" stroke-width="1.5"/>
  <rect x="19" y="29" width="26" height="22" rx="10" fill="${suit}" stroke="#0A0E18" stroke-width="1.6"/>
  <path d="M21 46 Q32 50 43 46" stroke="${dark}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <rect x="40" y="33" width="9" height="6" rx="3" fill="${dark}" stroke="#0A0E18" stroke-width="1.4"/>
  ${accessory === "cross" || accessory === "stripe" ? accessorySvg(accessory, suit) : ""}
  <circle cx="32" cy="21" r="14" fill="url(#brass-${uid})" stroke="#0A0E18" stroke-width="1.8"/>
  <path d="M21 13 Q26 7.5 33 7.6" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.45"/>
  <circle cx="37" cy="21" r="8.6" fill="#1B2236" stroke="#D9AE5E" stroke-width="2.4"/>
  <circle cx="37" cy="21" r="8.6" fill="none" stroke="#7A5424" stroke-width="0.8" opacity="0.8"/>
  <circle cx="37" cy="21" r="6.6" fill="url(#visor-${uid})"/>
  <path d="M33.5 17.5 Q35.5 15.2 38.5 15.6" stroke="#FFFFFF" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="${opts.dead ? 0.25 : 0.85}"/>
  <circle cx="21.5" cy="15" r="1.3" fill="#D9AE5E" stroke="#5C4521" stroke-width="0.6"/>
  <circle cx="21" cy="25.5" r="1.3" fill="#D9AE5E" stroke="#5C4521" stroke-width="0.6"/>
  <circle cx="27" cy="33.4" r="1.2" fill="#D9AE5E" stroke="#5C4521" stroke-width="0.6"/>
  <circle cx="44" cy="12" r="2.6" fill="#FFF3C4" opacity="${opts.dead ? 0 : 1}"/>
  ${accessory !== "cross" && accessory !== "stripe" ? accessorySvg(accessory, suit) : ""}`;

  const glow = opts.glow
    ? `<circle cx="32" cy="32" r="30" fill="url(#halo-${uid})"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="brass-${uid}" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="${shade(suit, 0.45)}"/><stop offset="0.5" stop-color="${suit}"/><stop offset="1" stop-color="${shade(suit, -0.4)}"/>
    </radialGradient>
    <radialGradient id="visor-${uid}" cx="0.4" cy="0.4" r="0.7">
      <stop offset="0" stop-color="${visorGlow}" stop-opacity="${opts.dead ? 0.2 : 0.75}"/><stop offset="1" stop-color="#0B1020"/>
    </radialGradient>
    <radialGradient id="halo-${uid}"><stop offset="0" stop-color="${suit}" stop-opacity="0.28"/><stop offset="1" stop-color="${suit}" stop-opacity="0"/></radialGradient>
  </defs>
  ${glow}
  ${opts.dead ? `<g transform="rotate(-90 32 40) translate(0 4)" opacity="0.92">${body}</g>` : body}
</svg>`;
}

export function diverDataUrl(id: string, opts: Parameters<typeof diverSvg>[1] = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(diverSvg(id, opts))}`;
}
