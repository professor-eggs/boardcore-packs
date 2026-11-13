# 7 Wonders: contract gaps (S11 part 4, first pass)

Where pack contract v1 (`boardcore/docs/11-engine-contract.md`) and the SDK as pinned (S11 part 1, `c1d7e54`) were awkward for this pack or couldn't express the game. Each finding says what the pack does instead, how bad it is, and a suggested change. Mechanics are described generically, with no rulebook text. Severity: **high** (a leak, a fault, or a rule that can't be played), **medium** (works, but the pack carries machinery the engine or SDK should own), **low** (cosmetic, or one line of pack code).

## Findings

**G1. A simultaneous pick, resolved together, then per-seat interrupts one at a time (medium).** Every seat picks at once and the picks stay hidden until the last one arrives. Resolving them may queue questions to single seats (build from the discard pile, copy a neighbour's leader, take a coin loss as debt), asked in turn, and only then do the hands pass. v1 has no phase or interrupt primitive, so the pack writes its own phase registry, pick store (`picks` in the state), resolution loop and interrupt queue (`src/flow.ts`, about 250 lines), and add-ons plug into that private machinery. *Suggest:* ship SDK11.7's phase runner and interrupt queue with a "simultaneous hidden pick" phase kind (each seat's pick held hidden until every actor has picked, then one resolve callback), so a pack declares the phase instead of writing the loop.

**G2. `resampleHidden` has no history to work from (medium for tutors, low for the leak check).** A seat knows which cards it passed to its neighbour, and so most of that neighbour's next hand. The state keeps no record of that (no rule needs it), so `resampleHidden` redraws every other hand from the pooled unseen cards of their age. The worlds it makes are a superset of the worlds the seat thinks possible: fine for D52's leak check, but a D82 tutor or a search bot sampling them reasons with less than the player knows. Keeping per-seat knowledge in the state only for the test kit would change every state hash and every replay. *Suggest:* let `resampleHidden` take what the seat has seen (its own event stream or committed views since the start, which Match already has), or add an optional pack function that folds each view into a per-seat "knowledge" value kept outside the hashed state.

**G3. `resampleHidden` must repeat setup's random choices (low).** Which guilds and which black cards go into later ages' decks is drawn at setup and hidden. To redraw it the pack had to lift deck building out of `setupState` into `buildDecks` so both can call it (same draw order, so no game changed). *Suggest:* an SDK "deck from a pool" helper (choose k of a pool, then shuffle) that a pack calls in both places; or document the pattern in the authoring guide.

**G4. Teams are a room fact, but this game's team play is an option (medium).** The room header carries each seat's `team`, and D79 checks that teammates share a place. The pack's team mode is an option that pairs neighbours in seat order itself and ignores `SeatInfo.team`, and its result stays individual (each seat placed by its own points). A room that sets header teams for a team game would get an outcome that splits teammates, which is a `PackFault`; a room that sets no teams can't show the pairs as teams. *Suggest:* let a pack say in its manifest which options imply teams and how they are formed (or let `setup` refuse a seat list whose teams don't match its options), so the header and the pack can't disagree; and let an outcome name places per team.

**G5. A tie broken by a second number doesn't show (low).** Places use points, then coins; `scores` is one number per seat and is the points, so a surface can print "1st Ann (42), 2nd Bo (42)" with no reason given. *Suggest:* allow `scores` to hold a short list (primary, then tie-breakers) or add an optional `tiebreak` per seat for display.

**G6. Interrupt answers are flagged as reveals wholesale (low).** The pack marks every interrupt answer `reveal` (some do read hidden cards, such as building from the face-down discard), so none of them can be drafted or undone, including ones that reveal nothing (choosing how much of a coin loss becomes debt). Telling them apart needs per-interrupt bookkeeping the pack doesn't keep. *Suggest:* G7 in the Pandemic findings (an SDK hidden-zone accessor that marks a reveal when hidden data is read) would make this exact for free.

**G7. Extension points are names only (low, S11.7).** The pack declares 17 points in `extensionPoints` (name and combine), but signatures live in comments and add-ons are in the same bundle, switched by options; nothing checks a handler against its point. This is the shape S11 part 7 replaces; listed so the pack is ported then.

**G8. Leaving a game of three or more (low, S11.6).** The pack has no `onLeave`, so with 3 to 8 seats a resign is refused until S11.6 decides what a resign does. A simultaneous-pick game can simply continue with a bot picking for the seat; the pack has no way to say it prefers that.

**G9. Display fields can't be filled yet (low).** S11 part 4 asks for `complexity`, `tags` and `playtime`, but the pinned Boardcore (part 1) has no such manifest fields, so the manifest leaves them out until the submodule moves past part 2.

## Test-kit numbers

Run 2026-11-13 on the pinned Boardcore, Node 22, through `tools/kit` (which wraps `@boardcore/testkit`). The kit has no published two-worlds or D82 check yet (S11.9 publishes them), so `tools/kit` adds both: for every sampled state it resamples each seat's world and compares the seat's view, prompt and the public actors; for every sampled action that draws nothing and isn't a reveal it replays the action in each observer's world and compares that observer's view, `describe` text and actors.

| Configuration | Plies | Trusted s (ms/ply) | Sandboxed s (ms/ply) | Costliest call (checks of 2,000) |
| --- | --- | --- | --- | --- |
| 3 seats, base | 54 | 0.28 (5.2) | 2.83 (52) | 9 |
| 4 seats, B sides | 72 | 0.37 (5.1) | 4.47 (62) | 10 |
| 5 seats, Leaders + Cities + Wonder Pack | 143 | 1.11 (7.8) | 12.6 (88) | 20 |
| 6 seats, Cities team play, random sides | 131 | 0.98 (7.5) | 14.2 (108) | 24 |
| 7 seats, Leaders + promos + Wonder Pack | 168 | 1.27 (7.5) | 17.1 (102) | 16 |
| 8 seats, Cities team play + Leaders | 200 | 1.56 (7.8) | 22.9 (114) | 23 |

- **Games:** 6 games in both adapters with equal state hashes every ply, each BGN verified in both; 18 more random games in the trusted adapter (3 per configuration); interleaving: two trusted runs of 3 rooms and one sandboxed run of 2 rooms (each room its own QuickJS runtime), all equal to the same games played alone. Every game ended with an outcome carrying `places` and `scores` for every seat; none suspended.
- **Leak and D82 checks:** 6 trusted games (one per configuration), 196 sampled states, 1,125 resampled worlds, 2,454 quiet actions, **no findings**; plus one game run identically in the sandbox (same report as trusted).
- **Faults:** none. No budget or memory fault in QuickJS; the costliest call used 24 interrupt checks of the 2,000 budget. The ms/ply figures include the kit's own work per ply (walking every legal action through `choices` to pick one, and `view` and `describe` for every seat); the sandboxed figure is about 13 times the trusted one, mostly copying the state (the full card lists of eight cities) across the QuickJS boundary on each of the many calls a `decide` makes.
- `pnpm check` (both packs, all tests) takes about 2 min 45 s, nearly all of it these sandboxed games.

## Bugs fixed in this pass

- None in the rules. The outcome now gives D79's `places` (points, then coins, ties shared) and `scores` (points); the old text-only ranking ignored the coin tie-break when listing the order.
