# 7 Wonders (pack `boardcore/seven-wonders`)

Private, local-only build of 7 Wonders (1st edition) with **Leaders**, **Cities** and the **Wonder Pack** as
switchable add-ons. Mechanics only: card names and numbers, no rulebook text or art. Not for distribution.

## Options

| option | effect |
| --- | --- |
| `leaders` | Leader draft (4 each, passed right), a recruitment phase at the start of each age, 6 starting coins, Rome, 4 guilds, 6-value coins (coins are just numbers here). |
| `cities` | 1 black card per player per age (8-card hands), debt tokens, diplomacy, masks, docks, Petra, Byzantium, 3 guilds, 6 leaders (with `leaders`). Allows 8 players: set up like 7 (9 guilds, 7 black cards), deal 7, play 6. |
| `teamPlay` | Cities team play for 4, 6 or 8 seats (needs `cities`). Adjacent pairs in seat order; teammates do not fight; conflict tokens are doubled; diplomacy still fights but both sides take one fewer token. |
| `leaderPromos` | The Leaders goodies Louis, Stevie and Esteban join the leader pool (needs `leaders`). |
| `wonderPack` | The Great Wall, Stonehenge, Manneken Pis; Abu Simbel only when `leaders` is on. |
| `sideB` / `randomSides` | Wonder sides (default A). |

Seats: 3 to 7 (8 needs `cities`). Seat order is the table: a seat's left is the previous seat, its right the next.

## How a game runs

- **Turn**: every seat picks at once (hidden until all have picked): a card, then *build* / *wonder stage* /
  *discard for 3 coins*, then a payment plan when coins go to neighbours or the bank. Plans are every cheapest
  split between the left neighbour, the right neighbour and the bank (Bilkis).
- **Resolution**: payments, then cards, then immediate effects; then interrupts (one seat at a time:
  Halicarnassus/Solomon/Great Wall discard builds, the Courtesans' Guild, Rome's extra leaders, Abu Simbel),
  then coin losses (Cities: each seat chooses how much to pay and takes the rest as debt), then hands pass.
- **Age end**: the last card is discarded (Babylon B plays it first), diplomacy and the Great Wall B take seats
  out, then military (1/3/5 per win, -1 per loss).
- **Scoring**: military, coins/3, debt, wonder, civic, commerce, guilds, science (squares + 7 per set, wilds and
  masks chosen for the best score), leaders, black cards. Ties: most coins, then shared.

## Code map and hooks

- `src/hooks.ts`: the add-on kernel (`chain`, `collect`, `first` points; D41/SP1).
- `src/engine.ts`: state, payments, military, scoring, and `POINTS` (the declared extension points, also in the
  pack's `extensionPoints`): `decks`, `setup`, `ageStart`, `ageEnd`, `effects`, `stageEffects`, `payment`,
  `freeBuild`, `onBuild`, `endTurn`, `settleLoss`, `conflictSeats`, `shields`, `conflict`, `science`, `score`,
  `seatCheck`.
- `src/flow.ts`: the phase loop. Phases and interrupts are registries; add-ons add their own.
- `src/data.ts`: every card, wonder and leader as data (effects are tagged values interpreted by the base or by the
  add-on that owns the tag).
- `src/addons/leaders.ts`: phases `draft`, `recruit`; interrupts `extraLeader`, `courtesan`; hooks `setup`,
  `decks`, `ageStart`, `effects`, `payment` (discounts, Bilkis), `freeBuild` (Ramses), `onBuild`, `endTurn`
  (Hatshepsut), `conflict` (Tomyris, Nero), `score`.
- `src/addons/cities.ts`: interrupt `debt`; hooks `decks`, `payment` (docks, Architect Cabinet), `freeBuild`
  (Caligula), `onBuild` (losses, diplomacy, neighbour coins, Diocletian), `settleLoss`, `endTurn` (Berenice),
  `ageEnd` + `conflictSeats` (diplomacy), `shields` (Semiramis), `score` (debt, Mourners).
- `src/addons/wonder-pack.ts`: interrupt `entomb`; hooks `stageEffects` (Manneken Pis copies), `onBuild`,
  `ageEnd` + `conflictSeats` (Great Wall B), `shields`, `score` (Stonehenge, Abu Simbel).

## Gaps and stubs

- **Rules audit**: `RULES-AUDIT.md` checks every rule, card, wonder stage and leader against the player aid,
  the concise reference, and the later references Xavier supplied (leaders lists, the Cities parts list,
  the 10-page card/wonder tables, the Cities+Leaders cheatsheet, and Wonder Pack board photos). Player-count
  copies and some wonder stage costs are still unverified there.
- **Cities team play** is built (`teamPlay`): adjacent pairs, no teammate fights, doubled tokens, diplomacy
  still fights with one fewer token. Combined team scores are not used (the cheatsheet says most points wins;
  seats stay individual). The host still cannot pick arbitrary seat pairings at room time (C7); the option
  always pairs neighbours in seat order.
- **2-player variant** (the Free City): not built (seat minimum 3). The concise sheet only says "see rules".
- Simplifications: the Courtesans' Guild copies a leader's lasting and scoring effects, not one-off coins;
  Olympia B's copied guild, masks and wild science symbols are chosen at the end for the best score; Manneken
  Pis A copies the neighbour's stage effects even if that neighbour hasn't built that stage.
