# Alibi

**A deep-sea social deduction game where every suspect is an AI agent with its own memory, and the killer lies.**

Six divers are sealed inside Halcyon-9, a research station 300 metres down, while a storm rages
above. One of them is killing the others. Walk the station, do tasks for true sonar logs, find the
body, then question the crew at the emergency meeting. Their alibis come from what they actually
saw. The killer's comes from a cover story.

**The twist is pacts.** The killer can corner you and offer a deal: vouch for them and win on their
side, or **take the knife** and swap roles. Refuse, and you know who did it, but can you convince
the others? Play as the killer and you can make the same offer. Some divers accept, some refuse,
and some only pretend so they can expose you at the next meeting.

**▶ Play it: [alibi-delta-lac.vercel.app](https://alibi-delta-lac.vercel.app)**

## How to play

| | |
|---|---|
| Move | WASD / arrow keys, or click or tap where to go |
| Task | stand on a yellow ring, hold **E** / Space / the Use button |
| Report a body | **R** |
| Emergency meeting | **M** in the Mess Hall, once per game |
| Kill (killer) | **K** when you're alone with someone |
| Offer a deal (killer) | **Q** when you're alone with someone |

- The camera follows you through the station; the minimap (top right) shows where you are and your open tasks.
- Every room is furnished and solid: a moon pool with a docked sub, a sonar wall, jellyfish tanks, a pulsing reactor
  core, sick-bay beds, kelp rows. You and the crew walk around it all.
- You only see people in the same room or tube as you.
- Each finished task pulls one **true** sonar log ("Kenji was in Reactor 02:31–02:40").
- The storm clears after three meetings. If the killer is still aboard, the killer's side wins.
  The killer's side also wins once it equals the crew in number.
- At the end, **Who lied** checks every alibi against where people really were.

## How the agents work

```mermaid
flowchart LR
  sim["Simulation<br/>(deterministic, seeded)"] -->|ground truth:<br/>who was where, when| mem[Per-agent memory]
  mem --> ctx["Context builder<br/>memory · secrets · cover story ·<br/>contradictions noticed"]
  ctx -->|structured JSON| api["/api/agent<br/>builds the prompt server-side"]
  api --> gemini[Gemini<br/>structured output]
  gemini --> judge{"Consistency judge"}
  judge -->|innocent placed somewhere<br/>they never went| scripted[Scripted voice]
  judge -->|ok| line[Line in the meeting]
  ctx -.->|no key · 429 · timeout| scripted
  scripted --> line
```

- **The simulation decides the truth, and the model only does the talking.** Movement, kills and
  sightings are plain TypeScript with a seeded RNG, so a game replays exactly. Nothing about *what
  happened* comes from an LLM.
- **Each character only knows what it saw.** Memory is computed from who shared a room with whom,
  and for how long. An innocent's prompt never contains the killer's secrets. That's tested.
- **The killer gets a cover story.** It's the true route, except the stretch around the kill is moved
  to a room nobody else was in at the time, so no single witness can disprove it. Only careful
  cross-checking can.
- **Contradictions are computed, not hallucinated.** When Mara claims the Bio Lab and Juno was in the
  Bio Lab then without seeing her, the sim detects it and gives it to Juno as "things you noticed".
  A test checks that a truthful alibi is never flagged.
- **Innocents can't lie by accident.** If the model places an innocent somewhere they never went, the
  line is replaced, and an innocent's checkable claims are always their real movements.
- **It works with no key at all.** A scripted voice builds alibis, challenges and votes from the same
  data. It's used offline, and line by line whenever Gemini fails, so a demo never breaks.

## Running it

```bash
npm install
cp .env.example .env.local   # add GEMINI_API_KEY, or leave it empty for scripted voices
npm run dev
```

```bash
npm test          # 27 tests: simulation, memory, judge, pacts, win rules, director fallbacks, rate limits
npm run typecheck
npm run lint
npm run build
```

### Deploying to Vercel

1. Import the repo in Vercel (framework: Next.js, no extra settings).
2. Add the environment variables `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`,
   `RATE_LIMIT_PER_MINUTE` and `DAILY_REQUEST_CAP`.
3. Deploy. The title screen badge shows **Gemini live** or **Scripted voices**.

**Keeping it free:** create the key in a Google Cloud project with **no billing account**. The free
tier then stops at its quota instead of charging, and the game switches to scripted voices on 429s.
The in-app limits (per-IP per minute, per day) are per server instance. They act as a brake, not a
billing guarantee.

## Security notes

- The browser never sends a prompt. It sends structured game context (validated with zod, with
  length caps), and the server writes the prompt. So `/api/agent` can't be used as a free,
  general-purpose Gemini proxy.
- The API key stays on the server. Gemini error bodies are logged server-side, never returned.
- Player chat goes into prompts as quoted speech, and the system prompt treats it as dialogue, not
  instructions. The worst a prompt injection can do is make a character say something odd. It can't
  change the game state, which the simulation owns.
- It's single-player, so the full game state lives in the browser. Someone with devtools can see the
  killer. That's fine for a single-player game and would move server-side for multiplayer.

## Project layout

```
lib/game/     simulation: map + pathfinding, tick, memory, judge, pacts, win rules (no React, no AI)
lib/ai/       context builder, prompts + response schemas, Gemini director, scripted fallback voice
lib/server/   Gemini client and rate limits (server-only)
app/api/agent route: validate → limit → prompt → Gemini → validate output
components/   canvas station view, HUD, meeting, pact dialog, title and end screens
tests/        vitest
```

## Notes

- All art is drawn in code on a canvas: original divers, station and setting.
- Best on desktop. On phones the map is small but tap-to-move works.
- Ideas for later: multiplayer with server-held state, sabotage events, replay viewer for the
  "what really happened" timeline, voice lines.
