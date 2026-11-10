export type RoomId = "dock" | "comms" | "lab" | "mess" | "reactor" | "medbay" | "hydro";
export type LocationId = RoomId | `c-${string}`;

export type Role = "crew" | "killer" | "accomplice";
export type Side = "crew" | "killer";

export interface Point {
  x: number;
  y: number;
}

export type PactStyle = "greedy" | "honest" | "loyal" | "paranoid" | "schemer";

export interface Persona {
  id: string;
  name: string;
  color: string;
  job: string;
  /** How they talk, given to the model and used by the scripted voice. */
  voice: string;
  /** How they react to a pact offer from the player when the player is the killer. */
  pactStyle: PactStyle;
}

export interface Character extends Persona {
  isPlayer: boolean;
  role: Role;
  alive: boolean;
  ejected: boolean;
  pos: Point;
  loc: LocationId;
  /** Remaining waypoints to walk. */
  path: Point[];
  /** Game minute until which the character stays put doing a task. */
  busyUntil: number;
  killCooldownUntil: number;
  /** AI killer: id it is hunting. */
  huntTarget?: string;
  /** AI: heading to the camera desk to watch the feeds. */
  errand?: "cams";
}

/** Ground truth: where someone was, from..to (game minutes). to=null while ongoing. */
export interface Segment {
  who: string;
  loc: LocationId;
  from: number;
  to: number | null;
}

export interface KillEvent {
  killer: string;
  victim: string;
  loc: LocationId;
  pos: Point;
  t: number;
  round: number;
}

export interface Body {
  victim: string;
  loc: LocationId;
  pos: Point;
  t: number;
  foundBy?: string;
  foundAt?: number;
}

export type PactKind = "vouch" | "swap";

export interface Pact {
  kind: PactKind;
  /** The killer at the time of the pact. */
  killer: string;
  partner: string;
  t: number;
  /** False when the partner only pretended to agree and will expose it. */
  sincere: boolean;
  broken: boolean;
}

export interface PactOffer {
  from: string;
  to: string;
  t: number;
  outcome: "accepted-vouch" | "accepted-swap" | "refused";
}

export interface Claim {
  loc: LocationId;
  from: number;
  to: number;
}

export interface TranscriptLine {
  speaker: string;
  text: string;
  /** Places and times the speaker claimed, checked against the truth at the end. */
  claims?: Claim[];
  /** Who the line is aimed at, if anyone. */
  to?: string;
  kind: "statement" | "question" | "reply" | "vote" | "system";
}

export interface MeetingRecord {
  round: number;
  t: number;
  calledBy: string;
  reason: "body" | "emergency";
  body?: Body;
  transcript: TranscriptLine[];
  votes: Record<string, string>;
  ejected?: string;
}

/** Someone sitting at the camera desk, from..to. */
export interface CamSession {
  who: string;
  from: number;
  to: number | null;
}

export interface PlayerTask {
  id: string;
  label: string;
  room: RoomId;
  pos: Point;
  progress: number;
  done: boolean;
}

export type Phase = "roam" | "meeting" | "pact" | "over";

export interface GameState {
  seed: number;
  rng: number;
  t: number;
  round: number;
  roundStart: number;
  phase: Phase;
  characters: Character[];
  segments: Segment[];
  kills: KillEvent[];
  bodies: Body[];
  pacts: Pact[];
  pactOffers: PactOffer[];
  meetings: MeetingRecord[];
  tasks: PlayerTask[];
  clues: string[];
  emergencyUsed: boolean;
  camSessions: CamSession[];
  /** Set when the sim wants the UI to open something. */
  pending?: { kind: "meeting"; calledBy: string; reason: "body" | "emergency"; body?: Body } | { kind: "pact"; from: string; to: string };
  winner?: Side;
  endReason?: string;
  log: string[];
}
