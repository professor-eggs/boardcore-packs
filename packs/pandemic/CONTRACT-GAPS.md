# Pandemic: contract gaps (S11 part 7c)

Where pack contract v1 (`boardcore/docs/11-engine-contract.md`) and the SDK were awkward for this pack and its
add-ons, as pinned at `e0c5d98` (S11 part 7b review fixes). First pass: S11 part 4 (`c1d7e54`); the old texts of
the closed gaps are in git history. Mechanics are described generically, with no rulebook text. Severity:
**high** (a leak, a fault, or a rule that can't be played), **medium** (works, but the pack carries machinery the
engine or SDK should own), **low** (cosmetic, or one line of pack code). The new generic gaps are also written up
in `GAPS-FOR-PUBLIC.md`, for the public docs.

## After the fold (3.0.0, 2026-11-21)

The owner decided to remove add-on packs; the five modules are options of this pack, called through an in-pack
kernel (`src/kernel.ts`). The entries below are kept as written; this is what became of each.

| Entry | Now |
| --- | --- |
| "Switchable modules inside one bundle" (closed by add-ons) | Open again in a new form: the modules are options in one bundle. What the manifest can't say is in "New with options" below. |
| **N1** every point call copies the whole state | **Moot.** The hooks are plain function calls on the state itself. Measured below. |
| **N5** a point can't return a prompt | **Moot.** A hook's result is a TypeScript type, `Prompt` included. |
| **N6** an event effect can't mark a reveal | **Moot** as a contract gap. The pack keeps its own `reveal` operation. |
| **N7** a one-against-all add-on needs the base designed for it | **Moot**: he is a module of the pack. The list is still what the pack needs for him. |
| **N8** the first phase of round 1 begins inside setup | **Moot**: setup makes every slice before the runner starts. |
| **G1, G2, G3, G6** (closed) and **G4, G5, G7, G8, N2, N3, N4** | Unchanged: none is about add-ons. |
| "A free role ability out of turn" (2.0.0 audit) | **Closed in the pack**, as that entry foresaw: the kernel's actions hook marks an ability `anyTime`, the windows outside an epidemic, the wait and the hand-limit discard offer it, and its holder is a window actor (public). Left: N3. |

### New with options

**O1. An option can't need, exclude or bound another (medium).** Same gap as public Q106, with more cases. The
manifest has one seat range and one independent schema per option, so four rules live in `setup` and are found
only when the game starts, with the room's options already fixed (README "Option rules"): two options that
exclude each other, an option that needs 3 seats, a seat count and an option value that each need another
option. As add-ons the first was a create-time refusal with a named reason. *Suggest:* per-option `requires`,
`conflicts` and seat bounds in the manifest, checked at create.

**O2. A default can't depend on another option (low).** Three add-ons preset one base option (still editable).
`setup` can't tell a default from a choice, so the presets are gone and each option's description says what to
set. *Suggest:* an "auto" value an option may declare, resolved by the pack.

**O3. Every expansion's option is on every create form (note).** A host can no longer leave a module off the
server, and a fix to one module is a new version and hash of the whole game (the persona's range must still hold).

**O4. One fault name (note).** A fault names the pack, never the module.

### Measured (2026-11-21, Node 22, this host busy with other work)

One move sandboxed is the mover's prompt walked (2.2 `choices` calls), its `view` and the `apply`, on QuickJS
handles, 3 seeded games a room, the faster of two alternated passes; 2.0.0 composed with its add-ons against 3.0.0
with the same modules as options, on the same games (equal ply for ply).

| Room | Plies | 2.0.0 + add-ons, ms a move (apply) | 3.0.0 options, ms a move (apply) |
| --- | --- | --- | --- |
| 4 seats, base | 633 | 9.5 (3.2) | 9.1 (3.1) |
| 5 seats, roles | 760 | 11.1 (4.0) | 9.7 (3.3) |
| 3 seats, events | 460 | 10.2 (3.5) | 8.9 (3.0) |
| 4 seats, Virulent Strain | 479 | 11.3 (3.4) | 9.1 (3.1) |
| 4 seats, Bio-Terrorist | 603 | 13.1 (4.8) | 9.7 (3.2) |
| 5 seats, roles + events + VS + Mutation | 568 | 15.5 (4.9) | 10.7 (3.6) |
| 5 seats, roles + events + VS + Bio-Terrorist | 712 | 18.3 (6.5) | 10.6 (3.6) |

- A room with every module now costs what the base alone costs (about 10 ms a move); the composer's share was up
  to 8 ms a move (42%). The costliest sandboxed call fell from 21 to 47 interrupt checks to 5 to 7.
- The kit's "ms/ply" in the table further down (40 to 100) is a whole kit ply: the Match's own calls, every
  seat's view and a state hash each ply. On this host today that is 59 against 59 ms for the base and 54 to 62
  against 43 to 50 ms with four modules. Most of N1's figure was never the copies.
- Bundle: 131 KB (2.0.0: 94 KB for the base, plus five add-on bundles).

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
- **Resampled worlds** (PR #109 second review's failed search: a world had redrawn a card a pending consent
  gives): every legal action of every actor applied in each seat's world, 10 trusted games (all four add-ons with
  Mutation at 4 seats, roles + events + VS + Bio-Terrorist at 3, the base at 2), 2,600 worlds, 42,991 actions,
  **no faults**; the kit's resampler check keeps no hand card at a state with a committed card, but a one-card
  hand the question commits whole. The view shows a pending question's seat and kind only, so that check still
  lists the question's arguments as kept (a gap for G3: the asked seat and the log know them, the view doesn't).
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

## 2nd-edition rules audit, 2.0.0 (2026-11-17)

No new gap in the public contract. The audit's three fixes were this pack's own (RULES-AUDIT.md). One limit is
this pack's design, written here because closing it touches how the response windows are built:

- **A free role ability out of turn** (low). On the Brink lets one role give back what it holds at any time, as
  freely as an event, which is not an action. The base's response windows (G1) list only event cards, and an
  add-on reaches them only through the `events` registry. So the ability is offered on its owner's own turn only,
  after the last action as well. Closing it needs a base point that adds non-card options to a window, with the
  same public-information rule for who is an actor (a stored-on-role ability is public, so its holder would always
  be an actor). That point would belong to the pack, not the engine; nothing is carried to the public docs.
