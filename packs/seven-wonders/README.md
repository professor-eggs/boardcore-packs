# 7 Wonders (pack `boardcore/seven-wonders` 1.0.0) and its add-ons

Private, local-only build of 7 Wonders (1st edition). Since 1.0.0 the expansions are separate add-on packs of
this base, each chosen per room: **Leaders** (`boardcore/seven-wonders-leaders`), **Cities**
(`boardcore/seven-wonders-cities`) and the **Wonder Pack** (`boardcore/seven-wonders-wonder-pack`), each
`addon: { base: "boardcore/seven-wonders", range: "^1.0.0" }`. Mechanics only: card names and numbers, no rulebook
text or art. Not for distribution.

## Options

| pack | option | effect |
| --- | --- | --- |
| base | `sideB` / `randomSides` | Wonder sides (default A). |
| base | `teamPlay` | Team play for 4, 6 or 8 seats: adjacent pairs in seat order, teammates do not fight, conflict tokens doubled. A base option (Q68 is still (d)); it no longer needs Cities. With Cities, a diplomacy seat still fights and both sides take one fewer token. |
| base | `startCoins` | Starting coins (default 3; Leaders presets 6). |
| Leaders | `promos` | Louis, Stevie and Esteban join the leaders. |

Seats: 3 to 7, 8 with Cities in the room (set up like 7: 9 guilds, 7 black cards). Seat order is the table: a
seat's left is the previous seat, its right the next. Abu Simbel is dealt only when Leaders is in the room too.

## How a game runs

Each age is a round of the phase runner: `deal`, `ready`, `turn1`/`end1` ... `turn7`/`end7`, `last`, `war`.

- **turnN** (a simultaneous hidden pick): a card, then *build* / *wonder stage* / *discard for 3 coins*, then a
  payment plan when coins go to neighbours or the bank. Picks stay hidden until the last seat picks; then
  payments, cards and immediate effects resolve together.
- **Questions to one seat** go through the interrupt queue: the base's discard-pile build (boards, Solomon),
  and the add-ons' questions (Cities' debt, the Courtesans' Guild, Roma's extra leader, Abu Simbel's entomb),
  which each add-on asks from its own auto phases anchored before `turn1`, each `endN` and `war`.
- **endN**: coin losses settle (the `lossRule` slot: the base pays what it can; Cities asks), the `endTurn`
  event, then the hands pass (unless the `passes` point says not: Esteban).
- **war**: the last cards are discarded, the `ageEnd` event (diplomacy, the Great Wall B), then the conflicts.
- **Leaders** adds `draft1`..`draft3` (hidden picks before Age I's deal) and `recruit` (a hidden pick after
  each deal), and `freezeN` before each turn for Esteban.
- **Scoring**: military, coins/3, wonder, civic, commerce, guilds, science (best choice of wilds and masks),
  black cards, plus the add-ons' lines (debt, leaders, Stonehenge, entombed leaders). The outcome (D79): places
  by points, then coins, ties shared; scores are the points.

## Code map

- `src/points.d.ts`: the published point declarations (`BoardcorePoints["boardcore/seven-wonders"]`) and the
  shapes add-ons use (effects, cards, wonders, extras, operations). A global script: add-ons are type-checked
  against it.
- `src/index.ts`: the base on `defineBase` and `phaseRunner`; `buildDecks` (setup and `resampleHidden` draw alike
  with `sample`); `outcomeOf`.
- `src/engine.ts`: effects, payments, building, operations (`applyOps`), military, scoring.
- `src/resample.ts`: `resampleBase` (other hands, the discard pile, stage cards, later decks).
- `../seven-wonders-leaders/src/`, `../seven-wonders-cities/src/`, `../seven-wonders-wonder-pack/src/`: the add-ons.
  Effects the base reads use the base's kinds; each add-on's own kinds are `leaders:*`, `cities:*`, `wp:*`. A
  recruited leader is a public extra on its seat (`grant`), so Cities can read the Cities leaders' kinds.

## Tests

`test/base.test.ts` (rules of the base), `test/addons.test.ts` (rules of the add-ons), `test/kit-games.test.ts`
and `test/kit-checks.test.ts` (the test kit: both adapters, replays, every seat count with and without each
add-on, the leak check, interleaved rooms), `test/fixtures.test.ts` (A87: a game recorded by 0.1.0).

## Gaps and stubs

- `RULES-AUDIT.md` checks every rule, card, wonder stage and leader against the references Xavier supplied;
  player-count copies and some stage costs are still unverified. Its "1.0.0" section lists what changed.
- `CONTRACT-GAPS.md`: where the contract was awkward, with the test-kit numbers; `GAPS-FOR-PUBLIC.md`: the
  generic gaps in words, to carry into the public docs.
- Team play keeps seats individual in the result (G4). The 2-player variant is not built.
- Simplifications: the Courtesans' Guild copies a leader's lasting and scoring effects, not one-off coins;
  Olympia B's copied guild, masks and wild science symbols are chosen at the end for the best score; Manneken
  Pis A copies the neighbour's stage effects even if that neighbour hasn't built that stage.
