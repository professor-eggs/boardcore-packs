# 7 Wonders: contract gaps (S11 part 7c)

Where pack contract v1 (`boardcore/docs/11-engine-contract.md`) and the SDK were awkward for this pack and its
add-ons, as pinned at `e0c5d98` (S11 part 7b review fixes). First pass: S11 part 4 (`c1d7e54`); the old texts of
the closed gaps are in git history. Mechanics are described generically, with no rulebook text. Severity:
**high** (a leak, a fault, or a rule that can't be played), **medium** (works, but the pack carries machinery the
engine or SDK should own), **low** (cosmetic, or one line of pack code). The new generic gaps are also written up
in `GAPS-FOR-PUBLIC.md`, for the public docs.

## Closed by parts 7a and 7b

| Gap | Closed by | What the pack does now |
| --- | --- | --- |
| **G1** (O7) simultaneous pick, then per-seat questions | the phase runner's pick phase and interrupt queue | Each turn is a `pick` phase; `src/flow.ts` (about 250 lines) is gone. Questions go through the queue, the add-ons' with their own kinds. |
| **G3** (O4) resampling repeats setup's draws | `sample` (11 §3) | `buildDecks` draws the guilds with `sample`; Cities draws its black cards with `sample` in the `decks` point, which `draws`. |
| **G6** (O8) every answer a reveal | the zone reader | Only a call that reads a zone some seat can't see is a reveal (a discard-pile build); a debt answer is quiet unless it ends the turn (N5). |
| **G7** (O9) points were names only | typed points, add-ons as their own packs | `src/points.d.ts` declares 15 points; the three add-ons are packs type-checked against it. |
| **G8** (O10) leaving a game of three or more | the default `concede` | No `onLeave`: a seat that leaves is played by a stand-in bot, which is what this game wants. |
| **G9** (O13) display fields | manifest fields | `complexity`, `tags`, `playtime` filled. |

## Still open

**G2 (O3). `resampleHidden` has no history to work from (medium for tutors, low for the leak check).** Unchanged:
a seat knows what it passed on, the state doesn't. The Leaders draft adds the same case (the leaders a seat
passed on are redrawn like any other).

**G4. Teams are a room fact, but this game's team play is an option (medium).** Unchanged; Q68 is still (d), so
team play stays a base option that pairs neighbours itself, and the result stays individual.

**G5. A tie broken by a second number doesn't show (low).** Unchanged.

## New in part 7c

**N1. Every point call copies the whole state (medium, performance).** Each handler gets a deep, frozen copy of
the base's state. A point called on every build or every pricing check would copy eight cities each time, so
the hot-path rules stay in the base: payment discounts, free builds, a bank purchase, masks and neighbour coins
are base effect kinds that add-ons put on cards or leaders, and the base reads them itself. *Suggest:* a lazily
copied or structurally shared input, or a documented budget per point.

**N2. An event can't ask a question (medium).** `onBuild` returns operations and a slice, never a question, so an
add-on whose effect needs a seat's choice records it in its slice and asks from an auto phase of its own
anchored before every base phase where the event can fire: 8 such phases for Cities, 9 for the Wonder Pack, 9
for Leaders (plus 7 for Esteban). *Suggest:* let an event's effect carry `ask`, queued when the base's current
phase call returns.

**N3. Add-ons can't read each other (low).** An add-on sees the base's state and its own slice only. The Cities
leaders live in the Leaders add-on's data but carry `cities:*` kinds that Cities reads from the seat's public
extras; this works only because the base publishes recruited leaders as extras. *Suggest:* name this pattern in
the authoring guide (a base exposes cross-add-on facts as public state).

**N4. Registries aren't visible to an add-on's handlers (low).** A handler gets the state, which holds card ids,
not the composed card registry; the base passes each city's cards with their effects in the `onBuild` and
`score` arguments so add-ons can count, for example, symbols on cards of one colour. *Suggest:* the composed
registries (frozen, loaded once) in every handler's input.

**N5. An add-on's question can make the base's next phase run inside an answer (high until fixed; fixed in the
base).** The base passed the hands in the auto phase after each turn, reading them directly: harmless after a
pick (whose resolve is a reveal), but with Cities a debt answer comes between, and that answer then ran the
pass, so a quiet action changed what each seat sees. The kit's leak check found it (`quietView`, 6 seats, Cities
with team play). The base now reads the passed hands through `ctx.zones.items`, which marks the action a reveal.
*Suggest:* the authoring guide says to read every hidden zone through the reader in a `begin`, since any phase
may come to run inside another member's answer.

**N6. An empty pick phase resolves at once and marks a reveal (low).** Esteban's phases (one before each turn)
are pick phases with no seats almost always; each resolves at once as a reveal, which costs a handler call per
turn and makes the action before it a reveal, so the leak check sees fewer quiet actions. *Suggest:* a pick
phase with no seats is skipped without a reveal.

**N7. The first add-on phase begins before its slice exists (low).** The draft is the first phase of round 1, so
it begins inside the base's setup, before the add-on's setup has made its slice: its `seats` handler gets
`null` and returns `null` (every seat). *Suggest:* document it next to the `slice` handed to `setup`.

**N8. A question's default is computed twice (low).** An add-on builds a question's `default` from the state in a
`begin`, and the prompt from the base's view in `choices`; the two must agree or the composer faults. Abu
Simbel and the Courtesans' Guild list a seat's leaders both ways. *Suggest:* let a question's default be "the
first enabled option" when none is given.

**N9. An add-on's prompt sees only the base's view (low).** Recruiting can build a wonder stage with a leader,
priced like a card's stage build; the base had to publish each seat's stage-building ways (with payment plans)
in its view so the Leaders add-on could offer them. A base must foresee every such need. *Suggest:* nothing in
the contract; the authoring guide could say a base with a "build with another card" rule publishes its ways.

## Test-kit numbers

Run 2026-11-15 at `e0c5d98`, Node 22, through `tools/kit` and the published kit (`@boardcore/testkit`:
`playRandom`, `verifyReplay`, `interleaved`, `leakCheck`).

| Room | Plies | Trusted s (ms/ply) | Sandboxed s (ms/ply) | Costliest call (checks of 2,000) |
| --- | --- | --- | --- | --- |
| 3 seats, base | 54 | 0.27 (4.9) | 3.89 (72) | 4 |
| 4 seats, base, B sides | 75 | 1.17 (15.5) | 6.80 (91) | 5 |
| 7 seats, base, random sides | 127 | 1.25 (9.8) | 15.2 (119) | 8 |
| 4 seats, Leaders + promos | 96 | 0.76 (7.9) | 9.58 (100) | 34 |
| 6 seats, Cities, team play | 131 | 1.02 (7.8) | 13.2 (101) | 40 |
| 5 seats, Wonder Pack | 90 | 0.56 (6.2) | 9.74 (108) | 29 |
| 3 seats, all three + promos | 83 | 0.78 (9.4) | 6.81 (82) | 54 |
| 8 seats, all three + promos, team play, B sides | 199 | 2.46 (12.4) | 35.1 (176) | 167 |

- **Games:** the 8 rooms above in both adapters with equal state hashes every ply, each BGN verified in both; 54
  more random games in the trusted adapter (every seat count from 3 to 7, or 8 with Cities, two each, for the
  base alone, each add-on alone and all three); interleaving: 3 trusted rooms of all three add-ons, 3 trusted
  rooms of the base, 2 sandboxed rooms of all three, each equal to the same game played alone. Every game ended
  with `places` and `scores` for every seat; none suspended.
- **Leak check** (the published kit: two worlds, D82's resampled view, public clocks, choices that read a hidden
  zone, quiet actions): 7 trusted games (base at 3 and 5 seats, Leaders, Cities with team play, Wonder Pack with
  Leaders, all three at 7 and at 8), 231 sampled states, 1,270 worlds, 2,660 quiet actions, **no findings**
  after N5's fix; plus one game run identically in the sandbox (same report as trusted).
- **Faults:** none; the costliest sandboxed call used 167 interrupt checks of 2,000 (8 seats, all add-ons).
  Composing costs: the sandboxed figure is now 10 to 15 times the trusted one, and the 8-seat all-add-ons room
  is about 1.5 times the base's per ply (N1).
- `pnpm check` (both games, every test) takes about 3 min 45 s.

## Engine bugs

None found. N5 was the base's own bug, found by the kit.

## Re-checked at `f03102d` (2026-11-17)

Boardcore's part 7c with part 7b's PR #117 fixes merged in. Changes that touch these packs: an add-on's
`describe` now gets its own ids without the `<add-on id>:` prefix, so Leaders' strip of it is gone; a pick
phase's `apply` runs at the resolve (no phase here has one, every pick phase uses `resolve`); a leave that leaves
work gives a Continue prompt (no pack here has `onLeave`, and no test plays on after a resign); Match refuses a
game whose options differ from the handle's (the tests already start games with `h.options`). Every test, the kit
in both adapters and the leak checks pass unchanged otherwise.

## PR #118 review (2026-11-17)

- The phantom turn 7, the Leaders' recruitment order and Hatshepsut in a recruitment were this pack's own bugs
  (RULES-AUDIT.md). No new contract gap. Boardcore's runner now checks `ended` before a departed seat's recorded
  answer; this base never ends early, so nothing changes here.

Re-checked at `d0b034a` (boardcore with the runner's `ended` check before a recorded answer).
