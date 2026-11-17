# Pandemic (`boardcore/pandemic`) and its On the Brink add-ons

A cooperative game for 2 to 4 players (5 with the roles add-on), on Boardcore's phase runner, hidden zones and
interrupt queue (S11 part 7). The base is version 1.0.0; each On the Brink module is its own add-on pack in this
repository, type-checked against the base's published points (`src/points.d.ts`). Every rule is checked, with
its rulebook page, in [RULES-AUDIT.md](RULES-AUDIT.md); contract gaps are in [CONTRACT-GAPS.md](CONTRACT-GAPS.md).

| Pack | What it adds | Options and presets |
|---|---|---|
| `boardcore/pandemic` | The base game | `epidemics` 4–7 (7 needs the roles add-on), `openHands` |
| `boardcore/pandemic-roles` | 6 roles, a 5th player, the legendary game | — |
| `boardcore/pandemic-events` | 8 events; 2 events per seat | — |
| `boardcore/pandemic-virulent-strain` | Its 8 epidemic cards replace the normal ones | presets `epidemics: 5` |
| `boardcore/pandemic-mutation` | A purple disease, Mutation cards | presets `epidemics: 5`; after VS; conflicts with the Bio-Terrorist |
| `boardcore/pandemic-bioterrorist` | One seat plays against the others | `seat`: `last` or `random`; presets `epidemics: 5`; after VS; conflicts with Mutation |

Hands are open with 4 epidemics (introductory) or with `openHands`, private otherwise.

## The base

- `src/data.ts`: the map (48 cities, colours, links, populations), the base roles and events, the rate track.
- `src/engine.ts`: state helpers, cubes and outbreaks, moves, cards, cures, the infection deck, and `applyOps`,
  the operations an add-on's handler may return (`PDOp` in `points.d.ts`).
- `src/actions.ts`: the base actions, the base roles' abilities and the base events.
- `src/index.ts`: the points, the phases, the questions, the view, the text, setup and the contract functions.
- `src/resample.ts`: `resampleHidden` for the base's zones.

**Phases** (one round is one player's turn): `actions` (turns) → `beforeDraw` (window) → `draw` → `special1`,
`epidemic1` (a window inside an epidemic, Resilient Population only), `intensify1` → `between` (window between two
special cards) → `special2`, `epidemic2`, `intensify2` → `hands` → `infect` → `w1`/`i1` … `w5`/`i5` (a window, then
one infection card) → `next`. Once the game is over every phase is empty.

**Response windows (G1).** Each window phase's actors are the seats that may hold a playable event by public
information: with open hands, the holders; with closed hands, every player with cards while an event card is
unaccounted for (not in the discards, out of the game or stored), plus any seat with a stored event. Every actor
gets the same prompt shape and the runner's Pass, with a 30-second phase deadline. During his actions the
current player may wait for the others' events (`call`): each other player is asked in seat order.

**Questions to a seat (G2).** A take (Share Knowledge, the Epidemiologist) asks the other seat for a card from
its own hand, or to refuse; a give, a Dispatcher or Airlift move of another pawn, Special Orders and New
Assignment on another player ask for consent. The asker's prompt never lists the other hand; the action is paid
when the other seat agrees.

**Hidden zones.** Both decks are face-down zones, hands are zones seen by their owner (or by all with open
hands), a Forecast is a zone seen by its player, and the Bio-Terrorist's infection cards are a `held` zone seen by
him. The infection deck keeps the segments the table knows as sets (`infSegs`) and the top cards each seat has
looked at (`infKnown`), so `resampleHidden` keeps both. A card a pending question commits from a hand (the card a
consent gives, the event it spends, the city card a dispatched direct or charter flight pays) stays in that hand
in every world, at a fresh place, so a world never offers an answer its own `apply` can't play
(`test/resample-worlds.test.ts`). Left open: the view shows a pending question's seat and kind only, so the kit's
resampler check still lists the question's own arguments, and a one-card hand a question commits whole, as kept.

## The add-ons

Each add-on hooks in only through the base's points: registries (`roles`, `events`, `diseases`), modifiers,
events, scoring points, and phases. See the head comment of each `packs/pandemic-*/src/index.ts`. The events,
Virulent Strain and Bio-Terrorist add-ons carry a copy of the map (`src/map.ts`), checked against the base's by a
test, since an add-on imports nothing but the SDK.

**The Bio-Terrorist is an add-on**, not a derived pack (11 §10 "one against all"): the base declares
`hiddenInformation`, an `outcome` point whose first answer may replace the base's result with a lone winner, the
seats that get a pawn (`pawnSeats`, which draws), the `held` zones and their operations, `onEnter`, `cureGoal`
and the `diseases` registry with flare-outs. The add-on's phases (`start` before round 1's actions, `bt1` … `bt6`
before `next`) carry his secret turn; his location is in its slice, redrawn by its `resampleHidden`.

## Not built

- **The Lab challenge** comes from *Pandemic: In the Lab*, not On the Brink; no supplied book covers it.
- **Solo, Survival, scenarios and puzzles** (separate downloads): not built.
- **Teams** for the Bio-Terrorist mode: the room's teams are fixed before setup draws his seat (Q68 (d)); the
  outcome names the winners only.
