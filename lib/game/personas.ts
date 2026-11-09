import type { Persona } from "./types";

export const PLAYER: Persona = {
  id: "you",
  name: "You",
  color: "#f5f5f4",
  job: "relief diver",
  voice: "",
  pactStyle: "loyal",
};

export const CREW: Persona[] = [
  {
    id: "mara",
    name: "Mara",
    color: "#f472b6",
    job: "marine biologist",
    voice: "Dry and sarcastic, precise about times, quick to point out holes in other people's stories.",
    pactStyle: "schemer",
  },
  {
    id: "juno",
    name: "Juno",
    color: "#facc15",
    job: "systems engineer",
    voice: "Anxious and talks too much, over-explains with technical detail, apologises a lot.",
    pactStyle: "greedy",
  },
  {
    id: "tobias",
    name: "Tobias",
    color: "#60a5fa",
    job: "station security chief",
    voice: "Clipped and authoritative, treats the meeting like an interrogation, quick to accuse.",
    pactStyle: "paranoid",
  },
  {
    id: "ines",
    name: "Ines",
    color: "#34d399",
    job: "station medic",
    voice: "Calm and warm, sticks to facts, notices how people are behaving.",
    pactStyle: "honest",
  },
  {
    id: "kenji",
    name: "Kenji",
    color: "#fb923c",
    job: "comms officer",
    voice: "Jokey and deflects with humour, but sharp when it matters.",
    pactStyle: "loyal",
  },
];

export const ALL_PERSONAS = [PLAYER, ...CREW];
