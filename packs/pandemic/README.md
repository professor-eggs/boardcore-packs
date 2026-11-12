# Pandemic (`boardcore/pandemic`)

A cooperative game for 2 to 4 players (up to 5 with On the Brink), plus the Bio-Terrorist seat when that challenge is on.
The base game is always on. Each expansion module is an add-on that you switch on in the game options.

| Option | Type | What it does |
|---|---|---|
| `epidemics` | integer 4–7 | Epidemic cards: 4 introductory, 5 standard, 6 heroic, 7 legendary (7 needs `onTheBrink`) |
| `onTheBrink` | boolean | 6 more roles (Archivist, Containment Specialist, Epidemiologist, Field Operative, Generalist, Troubleshooter), 8 more events, 2 events per player, a 5th player |
| `virulentStrain` | boolean | The 8 Virulent Strain epidemic cards replace the normal ones. The strain is the colour with the most cubes after the first one. |
| `mutation` | boolean | A purple disease with the Mutation! infection cards and the 3 mutation events |
| `bioterrorist` | boolean | One seat is the hidden Bio-Terrorist (3–5 seats in all). Can't be combined with `mutation`. |
| `bioterroristSeat` | `last` / `random` | Who is the Bio-Terrorist: the last seat (a volunteer) or a random seat |
| `openHands` | boolean | Everyone sees every hand. Hands are always open with 4 epidemics (introductory); otherwise private |

The Lab challenge is a stub; see the gaps below. Every rule is checked, with its rulebook page, in
[RULES-AUDIT.md](RULES-AUDIT.md).

## Code map: what's yours and what plugs in

- `data.ts` holds the map (48 cities with their colours and links), the roles, the events and the infection rates.
- `engine.ts` holds the base rules and `POINTS`, the declared extension points. Each point's signature and combine rule is commented where it's declared.
  - Setup: `setup`, `playerCards`, `epidemics`, `roles`, `events`.
  - The turn: `actionLimit`, `handLimit`, `turnStart`, `betweenTurns`.
  - Movement: `onEnter`, `blockLeave`.
  - Infection: `preventCube`, `infectCubes`, `infectAlso`, `outbreakSteps`, `outbreakSource`, `infectCard`, `infectionRate`, `infectBonus`, `epidemic`.
  - Cards and cures: `drawCard`, `isEpidemic`, `drawChoice`, `payCard`, `cureCost`, `onCure`.
  - The end: `cureGoal`, `outcome`.
  - Other: `actors`, `view`, `seatCheck`.
- `hooks.ts` is the add-on kernel. The state holds only the ids of the add-ons that are switched on. Handlers are code in static tables, so the state stays plain JSON and replays cleanly.
- `addon.ts` defines what an add-on can supply:
  - `handlers`, a table of handlers or a function that takes the game context and returns one
  - `actions`, `events`, `phases`, `interrupts`
- `actions.ts` holds the base actions, the events, the turn loop (actors, prompt, act, settle) and the out-of-turn event window.
- `purple.ts` holds the purple disease, which Mutation and the Bio-Terrorist share.
- `addons/` has one file per expansion module. None of them edits the base. New behaviour goes only through points, registries, phases or interrupts.
- `index.ts` puts the context together from the options. It also holds the view, the status, the text and the timeout.

## How hidden information works

- **Hands:** private from 5 epidemics up (each view shows the others' hand sizes only), open with 4 epidemics or the `openHands` option. Discard piles are public; the order of both decks is hidden.
- **Bio-Terrorist view:** only his view shows his city, his hand and his location sheet (every action, by turn). Everyone sees his hand size, the cards he discards, purple cubes, sabotage and airport sightings, never which kind of flight or a drive.
- **Spotted and captured:** he's on the board while he shares a city with a player; a player there may capture him.
- **Replay:** `reveal` is set whenever a hidden card is read.

## The turn loop

Actions (events playable by anyone) → Draw: both cards at once, city and event cards to the hand, then the special cards in order (Mutation events before epidemics; two Mutation events in the player's order), with an event window between two of them; inside an epidemic only Resilient Population may be played between Infect and Intensify → hand limits → Infect: one card at a time, with an event window before each when anyone holds a playable event → between-turn phases (the Bio-Terrorist) → the next player.

## Stubbed, simplified or blocked

- **Lab challenge:** a stub in `addons/lab.ts`. It comes from *Pandemic: In the Lab*, not On the Brink, and none of the supplied books covers it. The stub refuses to start and is not in the options.
- **Agreement:** sharing cards, the Epidemiologist's take, Dispatcher, Airlift and Special Orders moves need the other player's agreement. The pack can't ask a second seat mid-action, so the acting player decides; players agree at the table.
- **Solo rules** (a separate Z-Man download): not built. One seat would control 3 roles with one shared hand and an archive; the pack's turn loop is one pawn per seat.
- **Survival rules, scenarios and puzzles** (separate downloads): tournament and preset formats, not built.

The full list, with sources, is in RULES-AUDIT.md.
