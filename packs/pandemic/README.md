# Pandemic (`boardcore/pandemic`), with On the Brink as options

A cooperative game for 2 to 4 players (5 with the On the Brink roles), on Boardcore's phase runner, hidden zones
and interrupt queue. **Edition: Pandemic 2nd edition (Z-Man, 2013) and On the Brink 2013 edition**, the owner's
copies; there is no option for the 1st edition. Version 3.0.0: the five On the Brink modules, which were add-on
packs up to 2.0.0, are folded into this pack as options (the owner's decision of 2026-11-21 to remove add-on
packs). The rules are the 2.0.0 ones: the fold was checked ply by ply against 2.0.0 with its add-ons
(RULES-AUDIT.md, "Fold into one pack"). Every rule is checked against the 2nd-edition rulebooks, with its source
and page, in [RULES-AUDIT.md](RULES-AUDIT.md) (with the items the owner still has to confirm);
`test/second-edition.test.ts` covers each 2nd-edition rule and each fix, `test/options.test.ts` each module.
Contract gaps are in [CONTRACT-GAPS.md](CONTRACT-GAPS.md).

| Option | Type, default | What it does |
|---|---|---|
| `epidemics` | 4 to 7, default 4 | 4 introductory, 5 standard, 6 heroic, 7 legendary |
| `openHands` | on or off, default off | Everyone sees every hand (always so with 4 epidemics) |
| `roles` | on or off, default off | On the Brink's 6 roles, a 5th player, the legendary game |
| `events` | on or off, default off | On the Brink's 8 events; the game uses 2 events per seat |
| `virulentStrain` | on or off, default off | Its 8 epidemic cards replace the normal ones |
| `mutation` | on or off, default off | A purple disease and the Mutation cards |
| `bioterrorist` | on or off, default off | One seat, without a pawn, plays against the others |
| `bioterroristSeat` | `last` or `random`, default `last` | Which seat he is: the last (a volunteer) or a random one |

Hands are open with 4 epidemics (introductory) or with `openHands`, private otherwise.

## Option rules

The manifest states one seat range (2 to 5) and one schema for all options; it can't say that an option needs
another, excludes another, or holds only at some seat counts. `setup` refuses each such case with the reason below
(`optionProblem` in `src/index.ts`; `test/options.test.ts`, "option rules"). A refusal reaches the room only when
the game starts: the start is refused and the room stays ready with its options fixed, so the players must make a
new room. Checking at create is the public side's (Q106).

| Rule | Refused when | The reason given |
|---|---|---|
| Mutation excludes the Bio-Terrorist | `mutation` and `bioterrorist` both on | "Mutation and the Bio-Terrorist can't be played together: switch one of them off" |
| The Bio-Terrorist needs 3 to 5 seats | `bioterrorist` on with 2 seats | "the Bio-Terrorist needs 3 to 5 seats (one is his, the others are the players): add a seat or switch him off" |
| A 5th player needs the roles | 5 players without `roles`. Players are the seats, less one with `bioterrorist`: 5 seats with him are 4 players and need no roles | "5 players need the On the Brink roles: switch that option on, or play with 2 to 4" |
| The legendary game needs the roles | `epidemics` 7 without `roles` | "7 epidemics (legendary) need the On the Brink roles: switch that option on, or choose 4 to 6 epidemics" |

Not refused, and worth knowing at create:

- **`bioterroristSeat` without `bioterrorist`** has no effect.
- **No presets.** As add-ons, Virulent Strain, Mutation and the Bio-Terrorist preset 5 epidemics (still
  editable). An option's default can't depend on another option, and `setup` can't tell a default from a choice,
  so the form's default stays 4: a challenge left at 4 is the introductory game with open hands. Each challenge's
  description says to set 5. The tests' rooms set 5 themselves (`test/rooms.ts`).
- **Order.** The modules always run in one order (roles, events, Virulent Strain, Mutation, Bio-Terrorist), which
  is what the add-ons' `after` lists gave.
- **Hidden information and teams** are the same for every room: the manifest already said
  `hiddenInformation: true` (closed hands) and declares no teams, with or without the Bio-Terrorist (see
  "The Bio-Terrorist" below).

## The base

- `src/data.ts`: the map (48 cities, colours, links, populations), the base roles and events, the rate track.
- `src/types.ts`: the state, the view and the operations (`PDOp`), shared by the base and the modules.
- `src/engine.ts`: state helpers, cubes and outbreaks, moves, cards, cures, the infection deck, and `applyOps`,
  the operations a module's handler may return.
- `src/actions.ts`: the base actions, the base roles' abilities and the base events.
- `src/kernel.ts`: the in-pack kernel, how the base calls the modules (below).
- `src/index.ts`: the option rules, the phases, the questions, the view, the text, setup and the contract
  functions. One game is made per set of modules switched on (32 at most), on first use.
- `src/resample.ts`: `resampleHidden` for the base's zones.

**Phases** (one round is one player's turn): `actions` (turns) → `beforeDraw` (window) → `draw` → `special1`,
`epidemic1` (a window inside an epidemic, Resilient Population only), `intensify1` → `between` (window between two
special cards) → `special2`, `epidemic2`, `intensify2` → `hands` → `infect` → `w1`/`i1` … `w5`/`i5` (a window, then
one infection card) → `next`. With the Bio-Terrorist: `start` before `actions` (round 1 only) and `bt1` … `bt6`
before `next`. Once the game is over the runner stops.

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

## The modules and the kernel

Each On the Brink module is one file under `src/expansions/` (`roles`, `events`, `virulent-strain`, `mutation`,
`bioterrorist`): a table of handlers by hook name, nearly as it was as an add-on pack. The base calls them through
`src/kernel.ts`, which does in plain code what the engine's composer did:

- **Hooks.** `hooks(mods)` gives the base one plain function per hook, running the handlers of the modules
  switched on, in order: lists (`roles`, `events`, `diseases`), modifiers (`actionLimit`, `handLimit`,
  `infectCubes`, …), events that return operations (`turnStart`, `onEnter`, `epidemic`, `act`, …) and first-answer
  hooks (`steps`, `eventCheck`, `outcome`). Nothing is copied or frozen: a handler gets the state itself.
- **Slices.** A module's own state is `state.slices[<module>]` (the travel ban, the strain, the Bio-Terrorist's
  city and sheet). A handler returns its new slice; the kernel puts it first among the handler's operations.
- **Phases.** A module's phases are the runner's own phases, placed before the base phase they name.
- **Views and text.** `view.modules[<module>]` is what a viewer sees of a slice; each module's lines go under the
  base's text and table.
- The engine never imports a module: the hooks are handed to it (`L.pts`), so a module can use the engine's helpers.

**The Bio-Terrorist** is one against all inside a cooperative game. The pack is built for it: `pawnSeats` says
which seats get a pawn (setup draws his seat when `bioterroristSeat` is `random`), the `held` zones and their
operations are his hand, `onEnter` and capture mark reveals, `outcome` may replace the base's result with a lone
winner, and the diseases have flare-outs. His phases (`start`, `bt1` … `bt6`) carry his secret turn; his location
is in his slice, redrawn by the module's `resampleHidden`. **For rooms without him nothing changes** now that
he is an option: `hiddenInformation` was already `true` for the closed hands, so the leak check, the D82 resample
check and the bots' worlds (personas and the Strong bot search resampled worlds) apply to every room as before;
with open hands a room still counts as hidden-information (both decks are hidden zones). The manifest declares no
teams: a seat's team can't be set at setup (Q68 (d)), so the outcome names the winners only.

## Not built

- **The Lab challenge** comes from *Pandemic: In the Lab*, not On the Brink; no supplied book covers it.
- **Solo, Survival, scenarios and puzzles** (separate downloads): not built.
- **Teams** for the Bio-Terrorist mode: the room's teams are fixed before setup draws his seat (Q68 (d)); the
  outcome names the winners only.
