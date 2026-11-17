# Pandemic: contract gaps (S11 part 7c)

Where pack contract v1 (`boardcore/docs/11-engine-contract.md`) and the SDK were awkward for this pack and its
add-ons, as pinned at `e0c5d98` (S11 part 7b review fixes). First pass: S11 part 4 (`c1d7e54`); the old texts of
the closed gaps are in git history. Mechanics are described generically, with no rulebook text. Severity:
**high** (a leak, a fault, or a rule that can't be played), **medium** (works, but the pack carries machinery the
engine or SDK should own), **low** (cosmetic, or one line of pack code). The new generic gaps are also written up
in `GAPS-FOR-PUBLIC.md`, for the public docs.

## Closed by parts 7a and 7b

| Gap | Closed by | What the pack does now |
| --- | --- | --- |
| **G1** (high) out-of-turn cards from a hidden hand | the `window` phase kind, Q65's interim shape | Each response window is a `window` phase; its actors come from public information only (with closed hands, every player with cards while an event card is unaccounted for), every actor gets Pass and the phase's 30-second deadline. The leak check finds nothing; the old excuse is gone. |
| **G2** (high) an action that needs another seat's answer | the interrupt queue | A take asks the other seat for a card from its own hand or a refusal (`give`); a give, a move of another pawn and an event on another player ask for consent. The asker's prompt names only what it can see; the leak check finds nothing; the old excuse is gone. |
| **G3** (medium, in part) no history for `resampleHidden` | — (pack state) | The infection deck keeps its segments known as sets (`infSegs`) and each seat's known top cards (`infKnown`), so the resampler shuffles only within what a seat doesn't know. The piles of the player deck are still kept for the resampler only. |
| **G6** (medium) reveal bookkeeping by hand | hidden zones and the zone reader | Decks, hands, a Forecast and the Bio-Terrorist's cards are zones; a read through the reader marks the reveal. The `touched` counter is gone. Two reveals the reader can't see are explicit (an add-on's `reveal` operation, below N6). |
| **G9** (low) display fields | manifest fields | `complexity`, `tags`, `playtime` filled on the base; `tags` on each add-on. |
| Switchable modules inside one bundle | add-ons as their own packs (D41, D81) | Five add-on packs with `addon: { base, range }`, their own options and presets, `after` and `conflictsWith`, type-checked against `src/points.d.ts`. |

## Still open

**G4. Teams for the one-against-all mode (medium).** Unchanged: the room's teams are fixed before setup draws
the Bio-Terrorist's seat, and Q68 is still (d). The outcome names the winners only (him alone, or the players).

**G5. Everyone loses together (low).** Unchanged: `winners: []` is shown as a shared first place.

**G7. Many plies for windows that are almost always passed (medium, was low).** Worse with the interim window:
with closed hands every player with cards is an actor of every window and must pass it (or wait out the
30-second deadline), up to 7 windows a turn (before the draw, inside two epidemics, between two special cards,
before each infection card). A 4-seat closed-hand game is about 200 to 270 plies, most of them passes. Q65's full
shape (an engine-run "may respond" offer, closed by the engine when nobody plays) would remove them.

**G8. One seat, several roles (low).** Unchanged: the solo rules aren't built.

## New in part 7c

**N1. Every point call copies the whole state (medium, performance).** As 7 Wonders N1. Every prompt of the
actions phase calls `actions` and `eventCheck` (and `steps` on each step), every move `onEnter` and `blockLeave`,
every infection `infectCubes`: each a deep, frozen copy of the base's state per add-on. Sandboxed play costs 40
to 100 ms a ply with add-ons. *Suggest:* a lazily copied or structurally shared input, or a documented budget per
point.

**N2. A base can't end the runner early (medium).** When the players win or lose, the runner still walks every
remaining round (rounds are fixed at `start`: here the player deck's length over two, plus a margin), entering
every phase and calling every add-on's `seats` and `begin`, though each returns nothing. A game lost in round 1
costs one call 8 interrupt checks with no add-ons and about 600 to 850 of 2,000 with the Bio-Terrorist (measured
in the sandbox); the costliest call of the kit games (827) is such an end. *Suggest:* `ctx.end()` (or the
runner stopping when `status` has an outcome), so a base with an early end needn't keep its record by hand.

**N3. A window can't be opened inside a phase (low).** "Wait for the others' events" in the middle of a player's
actions would be a window; a window is a phase, so the base asks each other player in seat order through the
queue instead (`respond`, Pass by default), one at a time.

**N4. The kit's random player walks picks only (medium, tooling).** `legalActions` (so `playRandom`, `playBoth`
and `leakCheck`) returns nothing for an `order`, `subset` or `amounts` step, and the game then stops silently,
with no outcome and no suspension. Forecast was first an `order` step and every game that played it stopped
there. It is now a series of picks. Repro: a pack whose only prompt is `{ kind: "order", options: [a, b] }`;
`playRandom` returns after ply 0 with `outcome: null` and `suspended: null`. *Suggest:* walk every step kind
with `someSteps`, as `choicesReadsHidden` already does, or suspend with a reason.

**N5. A point can't return a prompt (low).** A scoring point's result must be `Json`, and `Prompt`'s types have no
index signature, so the `steps` point (an add-on action's next prompt) is declared `prompt: Json` and both sides
cast. *Suggest:* make `Prompt` (and `Option`) assignable to `Json`.

**N6. An event effect can't mark a reveal (low).** A phase effect may carry `reveal`; an event effect may not.
The Bio-Terrorist's `onEnter` (a pawn entering a city tells everyone whether he is there) and capture (his
hand goes to the discards) need one, so the base declares a `reveal` operation. *Suggest:* `reveal` on event
and menu effects, as on phase effects.

**N7. A one-against-all add-on needs the base designed for it (note).** 11 §10's test (an add-on only if the base
declares hidden information, an end point that may name a lone winner and every other point the mode needs) was
met because the base was written with the Bio-Terrorist in mind: the seats that get a pawn (`pawnSeats`, a
drawing modifier), held infection cards (`held` zones and `hold`/`unhold`), an `outcome` point, flare-outs in the
`diseases` registry, `onEnter`. A base author decides up front which such variants can be add-ons. *Suggest:* say
so in the authoring guide, with this list as the example.

**N8. The first phase of round 1 begins inside setup (low).** As 7 Wonders N7: the Bio-Terrorist's `start` phase
begins before his slice exists, so its `begin` makes the slice and deals his two cards, and `setup` keeps the
slice it is handed.

## Test-kit numbers

Run 2026-11-15 at `e0c5d98`, Node 22, through `tools/kit` and the published kit (`@boardcore/testkit`:
`playRandom`, `verifyReplay`, `interleaved`, `leakCheck`). Random play loses fast (outbreaks or the cube supply).

| Room | Plies | Trusted s (ms/ply) | Sandboxed s (ms/ply) | Costliest call (checks of 2,000) |
| --- | --- | --- | --- | --- |
| 2 seats, base, introductory (open hands) | 49 | 0.32 (6.6) | 3.05 (62) | 7 |
| 4 seats, base, 6 epidemics | 220 | 0.66 (3.0) | 9.01 (41) | 8 |
| 5 seats, roles | 31 | 0.28 (9.0) | 3.08 (99) | 22 |
| 3 seats, events | 24 | 0.12 (4.8) | 1.67 (70) | 10 |
| 4 seats, Virulent Strain | 203 | 0.82 (4.0) | 13.1 (65) | 19 |
| 3 seats, Mutation | 249 | 0.91 (3.7) | 12.6 (51) | 7 |
| 4 seats, Bio-Terrorist | 201 | 1.54 (7.7) | 13.0 (65) | 539 |
| 5 seats, roles + events + VS + Mutation, 7 epidemics | 175 | 0.88 (5.0) | 12.2 (70) | 42 |
| 5 seats, roles + events + VS + Bio-Terrorist | 133 | 0.69 (5.2) | 10.7 (80) | 827 |

- **Games:** the 9 rooms above in both adapters with equal state hashes every ply, each BGN verified in both; 52
  more random games in the trusted adapter (every seat count, two each: 2 to 4 for the base, events, Virulent
  Strain and Mutation, 2 to 5 for the roles and for roles + events + VS + Mutation, 3 to 5 for the Bio-Terrorist
  alone and with roles, events and VS); interleaving: 3 trusted rooms of roles + events + VS + Mutation, 3 trusted
  rooms of the Bio-Terrorist, 2 sandboxed rooms of the base, each equal to the same game played alone. Every
  outcome is cooperative (every player wins or loses together) or the Bio-Terrorist's alone; none suspended.
- **Leak check** (the published kit: two worlds, D82's resampled view, public clocks, choices that read a hidden
  zone, quiet actions), closed hands, **no kind excused**: 11 trusted games (the base at 2, 3 and 4 seats, each
  add-on alone, the Bio-Terrorist at 3 and 5 seats, all four with Mutation and with the Bio-Terrorist at 5),
  1,032 sampled states, 4,177 worlds, 2,330 quiet actions, **no findings**; plus one game run identically in the
  sandbox (same report as trusted). While porting it found three Bio-Terrorist actions that name the city he was
  in (a local infection, a sabotage, a charter's sighting) and weren't marked reveals; they are now.
- **A87:** the 0.1.0 game in `test/fixtures` (4 seats, On the Brink and Virulent Strain as options) replays on
  0.1.0 and fails at ply 0 on 1.0.0, a different pack.
- **Faults:** none. The costliest sandboxed calls are game ends in Bio-Terrorist rooms (N2).
- `pnpm check` (both games, every test) takes about 3 min 45 s.

## Engine bugs

None found in the engine. N4 is a test-kit limitation with a repro above.

## Re-checked at `f03102d` (2026-11-17)

Boardcore's part 7c with part 7b's PR #117 fixes merged in. Nothing in these packs needed a change: no add-on's
`describe` read its prefixed ids, no phase is a pick with an `apply`, no pack has `onLeave` (so the Continue
prompt after a leave never comes up), and the tests already start games with the handle's options (`h.options`).
Every test, the kit in both adapters and the leak checks pass.

## PR #118 review (2026-11-17)

- **X7 was not used here.** Boardcore's runner took `ended` from part 7c on, but this base never passed it, so
  a game won or lost early still walked every remaining round in the action that ended it (the "game ends"
  costliest calls above). It passes `ended` now (the outcome is set). The runner itself also checked `ended`
  only after a departed seat's recorded answer had run; fixed in boardcore at the new pin.
- No new contract gap: the free-action and Bio-Terrorist spotting bugs were this pack's own (RULES-AUDIT.md).

Re-checked at `d0b034a` (boardcore with the runner's `ended` check before a recorded answer).
