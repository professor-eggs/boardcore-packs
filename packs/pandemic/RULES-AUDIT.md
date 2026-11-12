# Pandemic pack: rules audit

Checked against:
- **B**: the base rulebook (`pandemic-1.pdf`, 8 pages)
- **O**: the On the Brink rulebook (`otb-1.pdf`, 8 pages)
- **S**: the Bio-Terrorist location sheet (`otb-2.pdf`)
- **C**: the card list from the TTS save (`pandemic-cards/cards.json`). Its text is paraphrased, so where it disagrees with B or O, the rulebook wins.
- **Z**: the Z-Man product pages. They list components, plus links to the Solo, Survival, scenario and puzzle downloads.

Status:
- **matching**: the pack already did this.
- **fixed**: the pack did it differently before this audit.
- **added**: the pack didn't do it before.
- **blocked**: the engine or the scope stops it; the reason is given.

Tests: `test/rules.test.ts` (one test per fixed or added rule) and `test/pandemic.test.ts`.

## Components and map

| Item | Source | Status |
|---|---|---|
| 48 cities, 12 per colour, names and colours | B p1-3, C | matching. All 48 names and colours match C. |
| Connections (both ways) | B p2-3 board pictures | matching. Checked region by region on 300 dpi renders. The board isn't printed alone in B, but every link that is visible matches. |
| Populations (first player only) | B p2-6 (some), C (all 48) | added: `POPULATION`, all 48 equal to C. Chicago and Lima tie (9,121,000). |
| Infection rate track 2-2-2-3-3-4-4 | B p3 board | matching |
| 24 cubes per colour, 12 purple (the Petri dishes) | B p1, O p1/p4/p7 | matching. The 5 Petri dishes are storage; their effect is the supply limit. |
| 6 research stations; a 7th moves one already built | B p4 | matching |
| 7 base roles, 6 OTB roles, Bio-Terrorist role | B p8, O p1/p8, C | matching (names match C) |
| 5 base events, 8 OTB events | B p7, O p1-2, C | matching (names match C) |
| 8 Virulent Strain epidemics, 3 Mutation events, 2 Mutation cards | O p1/p3/p4, C | matching |

## Setup

| Item | Source | Status |
|---|---|---|
| One station in Atlanta, all pawns in Atlanta | B p2 | matching |
| 9 infections (3×3, 3×2, 3×1 cubes) | B p3 | matching |
| Quarantine Specialist and Medic don't act during setup | B p8 | fixed: setup placements now ignore roles (always 18 cubes) |
| Hands by player count: 2→4, 3→3, 4→2; 5 (OTB)→2 | B p2, O p2 | matching |
| 4/5/6 epidemics; 7 (legendary, OTB) | B p3, O p2 | matching |
| Equal piles, 1 epidemic each, smaller piles at the bottom | B p3 | matching; now tested |
| First player: highest city population in hand | B p3 | added (was: seat order) |
| Introductory game: open hands. Standard/Heroic: private hands, open-hands option | B p7 | added: per-viewer hands plus an `openHands` option |
| OTB: 2 events per player chosen at random, the rest unseen | O p2 | matching |
| Legendary: the rate stays at 4 when the 7th epidemic comes | O p2 | matching |
| "Try a challenge with 1 fewer epidemic" | O p2 | advice only, not a rule. Left to the player. |
| Combining: VS with Mutation or with the BT, never Mutation with the BT | O p2, O p5 | matching (setup refuses Mutation + BT) |

## Actions (B p4-5)

| Action | Status |
|---|---|
| Drive/Ferry, Direct, Charter, Shuttle | matching |
| Build (card, or the Operations Expert without one; moving a station when all 6 are out) | matching |
| Treat (1 cube, or all of a cured colour; Medic all) | matching |
| Share Knowledge (the card of the city you're in; the Researcher any card; hand limit at once) | matching. "Both agree" is left to the table, see blocked. |
| Discover a Cure (5 cards of a colour at a station; eradication when none are left) | fixed: cards are picked one at a time. Before, it offered only the first 10 sets of 5. |

## Roles

| Role | Source | Status |
|---|---|---|
| Contingency Planner: take a discarded event as an action; 1 at a time; removed from the game when played | B p8, C | matching |
| Dispatcher: other pawns as his own (he pays); any pawn, his own too, to a city with a pawn; never the Operations Expert's move | B p8, C | fixed: he can now move his own pawn to another pawn |
| Medic | B p8, C | matching |
| Operations Expert | B p8, C | matching |
| Quarantine Specialist (no cubes and no outbreaks in her city and next to it) | B p8, C | matching |
| Researcher | B p8, C | matching |
| Scientist (4 cards; with Complex Molecular Structure, 5) | B p8, O p3 | matching |
| Archivist (hand limit 8; once a turn, the card of her city from the discards) | O p8, C | fixed: the hand limit is checked after the take |
| Containment Specialist (on entering, 1 of each colour with 2 or more; also when moved by others) | O p8, C | matching |
| Epidemiologist (once a turn, free, take a city card from a player there) | O p8, C | fixed: the hand limit is checked after the take |
| Field Operative (once a turn, a cube onto the card; 3 samples stand in for 2 cards; samples may go back at any time) | O p8, C | fixed: sampling can eradicate; cards are picked; a purple cure with samples is allowed. Added: "return samples". |
| Generalist (5 actions) | O p8, C | matching |
| Troubleshooter (look at "rate" cards at turn start; a Direct Flight shows the card and keeps it, also with Special Orders, not when others move her) | O p8, C | fixed: there was a once-a-turn limit, now removed. The peek uses the current rate (1 under the Travel Ban), with no extra card for Rate Effect. |

## Events

| Event | Source | Status |
|---|---|---|
| Any time, not an action, any player, never between drawing and resolving a card; between two epidemics drawn together | B p7 | fixed: there are now windows between infection cards and between two drawn epidemics |
| Airlift (with permission) | B p7, C | fixed: respects Government Interference |
| Forecast, Government Grant, One Quiet Night | C | matching. The card text isn't legible in B. |
| Resilient Population (any time, also between Infect and Intensify) | C, O p4 | fixed: only this event may be played inside an epidemic, and it can't take a Mutation card |
| Borrowed Time (+2 actions; not right after drawing it) | O p2, C | matching. C says "the current player"; the card says "take", so it is played on your own turn. |
| Commercial Travel Ban (rate 1 until the *current* player's next turn) | O p1 card, C | fixed: it was in front of whoever played it. C says "this player"; the card says the current player, which wins. |
| Mobile Hospital (this turn, 1 cube from each city the current player drives or ferries to; Containment Specialist first) | O p2, C | fixed: anyone may play it; the current player picks the colour; it counts as treating for Government Interference |
| New Assignment (swap a role for an unused one; the current player to or from the Generalist: 5 actions) | O p2, C | fixed: the Generalist case is added |
| Rapid Vaccine Deployment (straight after a cure, 1-5 cubes, every affected city next to another one, ≥1 cube from each) | O p2, C | fixed: you now pick the cubes, with the exact connection rule, and the turn waits for it after a last-action cure. It used to remove cubes greedily. |
| Re-examined Research (a chosen player takes a city card from the discards, then the hand limit) | O p1 card, C | fixed: you now choose the player, and the hand limit is applied |
| Remote Treatment (2 cubes anywhere) | O p1 card, C | matching |
| Special Orders (the current player moves 1 other pawn as his own, paying like the Dispatcher; movement powers apply) | O p2, C | fixed: anyone may play it for the current player; it respects Government Interference |

## Turn, draws, infections

| Item | Source | Status |
|---|---|---|
| Draw 2 together; fewer than 2 left loses | B p6 | fixed: it used to lose only when the deck was empty mid-draw |
| Epidemic: Increase, Infect from the bottom (3 cubes, top up then outbreak), Intensify; cards out of the game, not replaced | B p6, C | matching |
| Hand limit 7 after the epidemics, discard or play events | B p6-7 | matching |
| Infect one card at a time; events between cards | B p6-7 (Airlift example) | fixed: it used to draw all cards at once |
| Outbreak: a cube to each neighbour; chain reactions after the current outbreak; no city twice per card | B p7 | fixed: now breadth first (it was depth first) |
| Eradicated colours get no cubes | B p5 | matching |
| One Quiet Night skips the next Infect step | C | matching |

## Win and loss

| Item | Source | Status |
|---|---|---|
| Win at once on the 4th cure | B p4 | matching |
| Lose at 8 outbreaks, an empty cube supply, too few player cards | B p1/p7 | matching |

## Virulent Strain (O p3)

| Item | Status |
|---|---|
| Shuffle the 8, use 4-7, unseen remainder | matching |
| Strain = most cubes after the first VS Infect step; ties random; never purple | matching |
| Immediate effects before Intensify (Hidden Pocket, Unacceptable Loss, Uncounted Populations) | fixed: Loss and Uncounted used to happen after Intensify |
| Continuing effects for the rest of the game | fixed: they used to stop at the cure. Now only Complex Molecular Structure stops at the cure (as its card says), and Rate Effect stops at eradication. |
| Chronic Effect (infection only, not epidemics or outbreaks) | matching |
| Complex Molecular Structure (+1 card; Scientist 5; Field Operative 4 + samples) | matching |
| Government Interference: leaving needs a strain cube treated there this turn by the current player. Removing doesn't count; Mobile Hospital does. Dispatcher, Airlift and Special Orders moves are blocked the same way. | fixed: it used to check the moving pawn's own treats, and Airlift ignored it |
| Rate Effect: +1 card if a strain city was drawn, unless eradicated. Not for Mutation-drawn cards, not for the Troubleshooter's peek. | fixed: the extra card is now a full infection (Chronic Effect and purple apply) |
| Slippery Slope: 2 outbreak steps | matching |

## Mutation (O p4)

| Item | Status |
|---|---|
| 2 Mutation cards start in the infection discard (not shuffled in) | matching. C says "shuffled in"; O wins. |
| 3 Mutation events shuffled in after dealing, before the piles | matching |
| No replacement card for a Mutation event | matching |
| A Mutation event before an epidemic drawn with it; two Mutation events in the player's order | added |
| Threatens and Spreads do nothing if purple is eradicated | fixed: they used to draw bottom cards anyway |
| Intensifies: +1 on each city with exactly 2 | matching |
| A Mutation card in infections: the bottom card gets 1 purple only; it counts as 1 draw | matching |
| An infection draw on a city with purple: both colours | fixed: purple is now placed per card, in the same step (it used to come after all the draws) |
| Purple cure: 5 cards of any colour, ≥1 a purple city (Scientist, Field Operative too) | fixed: cards are picked with the constraint enforced |
| Win: 5 cures, or 4 cures with no purple on the board | matching |

## Bio-Terrorist (O p5-7, S)

| Item | Status |
|---|---|
| 3 or 4 seats; 5 (BT + 4) allowed, not recommended | fixed: 6 seats are refused |
| Chosen randomly, by role card, or by volunteer | added: `bioterroristSeat` = `last` (volunteer) or `random`. Dealing the role card is the same as random. |
| 2 events per seat, counting him | fixed: he wasn't counted |
| 2 infection cards after the 9 infections; first player among the others; then his secret start | matching |
| His turn after each player's Infect step: 2 actions + 1 Drive/Ferry, each action at most twice (Drive 3) | matching |
| No player events on his turn, none for him on theirs | matching (O p7 etiquette) |
| Draw: hand limit 7, over it one card goes to the infection discard | fixed: drawing at 7 used to be blocked. UNVERIFIED wording: "discard the 8th card" is taken as discarding one card of his choice. |
| Direct and Charter: sighting at the destination / the city left; flight type and action not revealed; a drive is silent | fixed: the log used to name the flight and announce drives. S and C say "announce destination" for Charter; O p6 wins. |
| Hidden actions once a turn, only unspotted: Infect Locally, Infect Remotely (purple only, may be his city), Sabotage (card of the city's colour) | matching |
| Spotted when sharing a city; capture as an action; whole hand discarded | matching |
| Captured: only Draw or Escape. Escape: discard, move, sighting, then the turn goes on (the extra move too) | matching; now tested |
| Purple flare-out: 2 back, 1 to each neighbour, chain rule | matching, now through `outbreakSource` |
| Infections on purple cities place both; epidemics their colour only | matching |
| Hand size public, cards hidden; location sheet | added: a per-turn location sheet in his view only |
| He wins if the players lose with purple on the board; everyone loses with none; he's out if purple is eradicated | matching |

## Blocked or not built

| Item | Source | Why |
|---|---|---|
| Lab challenge | brief | Not in O. It belongs to *In the Lab*, which none of the supplied books covers. Stub in `addons/lab.ts`, refuses to start. |
| "With permission" (Share, Epidemiologist, Dispatcher, Airlift, Special Orders, New Assignment) | B p4/p8, O p8 | The engine's moves are single-seat paths, with no consent prompt to a second seat mid-action. The acting player decides; agreement is social. |
| Solo rules | Z (download) | Not built: one seat leading 3 roles with a shared hand and an archive. The pack's loop is one pawn per seat. That's a pack refactor, not an engine block. |
| Survival rules, scenarios, puzzles | Z (downloads) | Tournament and preset-deck formats (a Game Master, multiple teams), out of scope |
| In the Lab, State of Emergency content in C | C | Out of scope |
| Both colours placed on a purple city: which colour goes first | O p4 | Not stated. The card's colour is placed first, then purple. |
| New Assignment from the Contingency Planner or Field Operative: what happens to the stored event or samples | O | Not stated. The stored event goes to the discards; samples go back to the supply. |
