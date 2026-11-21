# 7 Wonders (pack `boardcore/seven-wonders` 3.0.0)

Private, local-only build of 7 Wonders, **2nd edition** since 2.0.0 (1.0.0 was the 1st edition; there is no
option for it). Since 3.0.0 the three expansions are **options of this pack**: **Leaders**, **Cities** and the
**Wonder Pack**. The owner decided on 2026-11-21 to remove add-on packs from Boardcore, so the three add-on
packs of 1.x and 2.x (`boardcore/seven-wonders-leaders`, `-cities`, `-wonder-pack`) are retired at their last
versions and their code lives here, one module each. The expansions are the 1st edition, by the owner's choice;
their values were checked against his reference sheets on 2026-11-18 (RULES-AUDIT.md). Mechanics only: card
names and numbers, no rulebook text or art. Not for distribution.

## Options

| option | effect |
| --- | --- |
| `leaders` | The Leaders expansion: a leader draft before Age I, a recruitment at the start of each age, Roma, four guilds. Every city starts with 6 coins instead of 3. |
| `leaderPromos` | Louis, Stevie and Esteban join the leaders. Needs `leaders`. |
| `cities` | The Cities expansion: black cards (one per seat and age, seven at eight seats), debt, diplomacy, three guilds, Petra and Byzantium, the Cities leaders (with `leaders`). Needed for 8 seats (set up like 7: 9 guilds). |
| `wonderPack` | The Great Wall, Stonehenge and Manneken Pis; Abu Simbel too when `leaders` is on. |
| `sideB` / `randomSides` | Wonder sides (default A). `randomSides` wins when both are on. |
| `teamPlay` | Team play for 4, 6 or 8 seats: adjacent pairs in seat order, teammates do not fight, conflict tokens doubled (Q68 is still (d): seats stay individual in the result). With Cities, a diplomacy seat still fights and both sides take one fewer token. |

All default to off. Seat order is the table: a seat's left is the previous seat, its right the next.

2.x had a `startCoins` option (3 by default, which the Leaders add-on preset to 6). An option has one default and
`setup` can't tell a default from a chosen value, so the preset has no equivalent: the option is gone, and the
coins follow the rule (3, or 6 with Leaders).

## Option rules

`setup` refuses these, each with a message that says what to change. Nothing checks them when the room is
created yet (public Q106), so today a room with a refused mix is made and filled, and the refusal comes at start.

| rule | refused when | message |
| --- | --- | --- |
| Seats | fewer than 3 players, or more than 8 | "7 Wonders needs 3 to 7 players, or 8 with the Cities expansion" |
| The eighth seat needs Cities | 8 players and `cities` off | "8 players need the Cities expansion: switch Cities on, or play with 3 to 7 players" |
| Team play needs pairs | `teamPlay` on at 3, 5 or 7 players | "Team play needs 4, 6 or 8 players (8 with the Cities expansion)" |
| The promo leaders need Leaders | `leaderPromos` on and `leaders` off | "The promo leaders need the Leaders expansion: switch Leaders on, or the promo leaders off" |

Not refused, because the game is still whole:

- `wonderPack` without `leaders`: Abu Simbel is left in the box (its stages entomb leaders).
- `cities` without `leaders`, or the reverse: the six Cities leaders are dealt only when both are on.
- `sideB` with `randomSides`: the sides are random.
- Team play at 8 without Cities is refused by the eighth-seat rule, which is checked first.

As manifest rules for Q106, these are: `seats.max` 7 unless `cities`; `teamPlay` requires an even seat count
from 4; `leaderPromos` requires `leaders`.

## How a game runs

Each age is a round of the phase runner. With no expansion on: `deal`, `ready`, `turn1`/`end1` ...
`turn7`/`end7`, `last`, `war`. With everything on:
`draft1` `draft2` `draft3` `recruit` `deal` `ready`, then `freezeN` `turnN` `debtN` `endN` for each turn,
`last` `debtWar` `war`. The order is fixed per mix of expansions (a pick phase with nobody to pick is passed
over: the draft in Ages II and III, `freezeN` without Esteban).

- **turnN** (a simultaneous hidden pick): a card, then *build* / *wonder stage* / *discard for 3 coins*, then a
  payment plan when coins go to neighbours or the bank. Picks stay hidden until the last seat picks; then
  payments, cards and immediate effects resolve together.
- **Questions to one seat** go through the interrupt queue: the discard-pile build (boards, Solomon), the
  Courtesans' Guild's copy, Roma's extra leader, Abu Simbel's entombing, and Cities' debt choice. A build
  that raises one puts it on `state.pending`; it is asked as soon as the pick that built it resolves (also a
  recruitment, so before the deal), in a fixed order: discard-pile builds, copies, extra leaders, entombings.
  A question raised by an answer is asked at once, except a copy while an entombing is queued (its default
  names a neighbour's leader, which the entombing could turn off): that one is asked when the next phase begins.
- **debtN, debtWar** (Cities): each seat that must lose coins is asked how many it pays; the rest is debt (-1
  point each). A seat with no coins takes it all as debt. They are phases of their own because the answers must
  be in before the end of the turn runs. Without Cities a seat pays what it can (`ready`, `endN`, `war`). A loss
  raised in a recruitment is settled at `ready`, before the first turn, with or without Cities.
- **endN**: the end-of-turn coins (Hatshepsut, Berenice; each reads the turn as it ended), then the hands pass
  (unless Esteban froze them).
- **war**: the last cards are discarded, diplomacy tokens and the Great Wall B take their seats out, then the
  conflicts.
- **Leaders**: `draft1`..`draft3` (hidden picks before Age I's deal), `recruit` (a hidden pick before each
  age's deal: recruit, build a stage with the leader, or discard it for 3 coins), and `freezeN` before each turn
  for Esteban.
- **Scoring**: military, coins/3, wonder, civic, commerce, guilds, science (best choice of wilds and masks),
  black cards, then each expansion's lines (leaders, debt, Stonehenge, entombed leaders). The outcome (D79):
  places by points, then coins, ties shared; scores are the points.

### What changed in play from 2.x with the add-ons

The rules and every card value are as audited. Two things moved, both because the add-ons could only ask a
question from a phase of their own:

- What a recruitment raises (Solomon's discard-pile build, Roma's extra leader, an entombing, a debt choice) is
  asked before the age's cards are dealt. In 2.x the discard-pile build came after the deal, the others before
  the first turn, and the debt choice after the first turn.
- A discard-pile build raised by Roma's extra leader (Solomon) is asked at once. In 2.x it came after the hands
  had passed.

Option ids in actions lost their add-on prefix (`l:Nero`, `pay:2`), the expansions' state is `state.leaders`,
`state.cities` and `state.wonderPack`, and their views `view.leaders` and `view.cities`. A game recorded by
2.x names add-ons in its header and doesn't replay on 3.0.0.

## Code map

- `src/types.d.ts`: the shapes every module shares (effects, cards, boards, the state, the view). A global script.
- `src/kernel.ts`: the in-pack kernel. `Expansion` is what a module may add (cards, boards, deck changes, its own
  part of the state, `onBuild`, end-of-turn coins, the conflict hooks, scoring lines, questions, its view and
  text, its resampler); `makeLib` is the content of one mix. No registry and no points: the rules loop over
  the modules switched on, in the order Leaders, Cities, Wonder Pack, and TypeScript checks each call.
- `src/index.ts`: the pack (`definePack`). `makeGame` builds one mix's phases, in order, and its `phaseRunner`;
  the eight mixes are made when the pack loads and a state's `sets` picks its mix. `checkOptions` (the option
  rules), `buildDecks` (setup and `resampleHidden` draw alike with `sample`), `outcomeOf`.
- `src/engine.ts`: effects, payments, building, `askPending`, losses, military, scoring.
- `src/resample.ts`: `resampleBase` (other hands, the discard pile, stage cards, later decks).
- `src/expansions/leaders.ts`, `cities.ts`, `wonder-pack.ts` and their `-data.ts`: the modules. Effects the base
  rules read use the base's kinds; each module's own kinds are `leaders:*`, `cities:*`, `wp:*`. A recruited
  leader is a public extra on its seat, so Cities reads the Cities leaders' kinds there.

SDK surface used: `definePack`, `phaseRunner` (with no `point` and no `applyOps`), `zone`, `contents`, `withItems`,
`canSee`, `sample`, `shuffle`, `idiv`, `compareStrings`, and the types. Nothing of the add-on API.

## Tests

`test/base.test.ts` (rules of the base), `test/second-edition.test.ts` (each 2nd-edition card and wonder change:
cost, production, effect, chain, copies), `test/expansions.test.ts` (rules of each expansion, the questions a
build raises, and the option rules: every mix and every refusal), `test/reference-sheets.test.ts` (the values
the owner's reference sheets settled), `test/kit-games.test.ts` and `test/kit-checks.test.ts` (the test kit:
both adapters, replays, every seat count with every mix of the expansions, the leak check with every mix,
interleaved rooms), `test/fixtures.test.ts` (A87: a game recorded by 0.1.0).

## Gaps and stubs

- `RULES-AUDIT.md` checks every rule, card, wonder stage and leader against the references Xavier supplied.
  Its "1.0.0" section lists what the port changed; its "2nd edition (2.0.0)" section lists every edition change,
  and "2nd-edition sources (2.2.0)" checks every base card (cost, copies, chain, effect) and stage against
  2nd-edition sources, with the few values left for the owner to check on his cards. "3.0.0" says what the fold
  into options changed, and the testing record follows it.
- `CONTRACT-GAPS.md`: where the contract was awkward, with the test-kit numbers; `GAPS-FOR-PUBLIC.md`: the
  generic gaps in words, to carry into the public docs. Both were written for the add-on packs: entries about
  points, slices and add-on phases are marked moot, not deleted.
- Team play keeps seats individual in the result (G4). The 2-player variant is not built (the 2nd edition dropped it).
- Simplifications: the Courtesans' Guild copies a leader's lasting and scoring effects, not one-off coins;
  masks and wild science symbols are chosen at the end for the best score; Manneken
  Pis A copies the neighbour's stage effects even if that neighbour hasn't built that stage (7w-5 says so), and
  each of its stages costs what the copied stage costs, fixed when the boards are dealt.
