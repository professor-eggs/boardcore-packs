# Pandemic pack: rules audit (2nd edition)

The owner plays **Pandemic, 2nd edition (Z-Man, 2013)** with **On the Brink, 2013 edition**. Since 2.0.0 the
base and every On the Brink module are checked against those editions only; there is no option for the 1st edition (2008). This
file replaces the 1.0.0 audit. That audit cited the owner's PDFs, which turned out to be the same 2nd-edition
books, so its rows are folded in below. Mechanics only: names and numbers, never rulebook text.

Since 3.0.0 (2026-11-21) the five On the Brink modules are options of this one pack, no longer add-on packs. No
rule changed with the fold (see "Fold into one pack" in the testing record); "add-on" in the dated records below
means the module as it was packaged then.

## Sources

Each source's edition was checked before use.

| Key | Source | Edition, and how it was checked |
|---|---|---|
| **R2** | [Z-Man Pandemic rulebook (PDF)](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Pandemic_Rulebook.pdf), linked from the [Z-Man product page](https://zmangames.com/en/products/pandemic) | **2nd edition**: copyright line 2013, 7 roles including the Contingency Planner and Quarantine Specialist, 59 player cards (48 city, 6 epidemic, 5 event). 8 pages; cited as R2 p1-p8. |
| **R1** | [1st-edition rulebook (PDF, a library's copy)](https://aadl.org/files/catalog_guides/Pandemic_Rules.pdf) | **1st edition**: 5 roles, and the player "most recently sick" goes first. Used only for the "1st ed" column, never as a rules source. |
| **OTB** | [Z-Man On the Brink rulebook (PDF)](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/On-the-Brink_Rules_Web.pdf), linked from the [Z-Man product page](https://zmangames.com/en/products/pandemic-on-the-brink/) | **2013 edition**, judged by its contents: 6 new roles plus the Bio-Terrorist (7 role cards), 8 events, 5 Petri dishes and no revised Operations Expert. The 1st edition had a revised Operations Expert and 6 Petri dishes. Its copyright line still reads 2009 (owner check 1). 8 pages; cited as OTB p1-p8. |
| **SHEET** | [Bio-Terrorist location sheet (PDF)](https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Bio_Terroist_Location-Sheet.pdf) | From the same Z-Man page as OTB. |
| **MM** | [Retail contents list for On the Brink, ZMG71101](https://www.miniaturemarket.com/zmg71101.html) | Cross-check of the 2013 contents: 7 role cards with pawns, 8 events, 3 Mutation events, 5 Petri dishes, 1 epidemic card. |
| **BGG** | [BGG: building when all 6 stations are out](https://boardgamegeek.com/thread/1908661); [BGG: On the Brink 1st vs 2nd edition](https://boardgamegeek.com/thread/1906647) | Rules threads. BoardGameGeek refused automated reads (HTTP 403), so only search summaries were seen. They're used only for the owner checks, never to decide a rule. |

Status: **matching** (the code already did it), **fixed** (the code was wrong and is now fixed, test first),
**blocked** (the code can't do it; the reason is given). The "1st ed" column says where the 1st edition differs.
Each such row, and every fixed row, has a test in `test/second-edition.test.ts` (marked 2E).

## Components and map

| Item | Coded | 2nd edition | Source | 1st ed | Status |
|---|---|---|---|---|---|
| City cards | 48, 12 per colour | 48 city cards, 4 colours | R2 p1 | same | matching, 2E |
| Events (base) | Airlift, Forecast, Government Grant, One Quiet Night, Resilient Population | 5 event cards (59 player cards = 48 + 6 epidemics + 5 events) | R2 p1, p7 | same count | matching, 2E |
| Epidemic cards | 4-6 (7 with the `roles` option) | 6 in the box, of which 4, 5 or 6 are used; a 7th comes with On the Brink | R2 p3, OTB p2 | same | matching, 2E |
| Roles (base) | 7: Contingency Planner, Dispatcher, Medic, Operations Expert, Quarantine Specialist, Researcher, Scientist | 7 role cards with these names | R2 p1, p8 | 5 roles (no Contingency Planner, no Quarantine Specialist) | matching, 2E |
| Map connections | the `data.ts` edges | the board pictures: every link visible in R2 p2-p4 agrees, and the wrap-around Sydney–Los Angeles link is named | R2 p2-p4 | same map | matching |
| Populations | `POPULATION`, all 48 | printed on the city cards; the 7 shown in R2 agree (Essen 575,000; Khartoum 4,887,000; Bogota 8,702,000; Chicago 9,121,000; Moscow 15,512,000; New York 20,464,000; Manila 20,767,000) | R2 p2-p7 | not used for the first player | matching (the other 41 are owner check 2) |
| Cubes | 24 per colour; 12 purple | 96 cubes, 24 in each of 4 colours; 12 purple with On the Brink | R2 p1, OTB p4, p6 | same | matching |
| Research stations | 6; a 7th build moves one already on the board | 6; with all 6 out, take one from anywhere on the board | R2 p4 | same | matching |
| Infection rate track | 2-2-2-3-3-4-4 | 7 spaces, starting on the left-most 2 | R2 p3 board | same | matching |
| Outbreak track | the 8th outbreak loses | the marker reaching the last space (8) loses | R2 p1, p7 | same | matching |

## Setup

| Item | Coded | 2nd edition | Source | 1st ed | Status |
|---|---|---|---|---|---|
| Station and pawns | 1 station in Atlanta; every pawn in Atlanta | same | R2 p2 | same | matching |
| Initial infections | 3 cities × 3 cubes, 3 × 2, 3 × 1 (18 cubes); the cards go to the infection discards | same | R2 p3 | same | matching |
| Roles at setup | the Quarantine Specialist and Medic don't block setup cubes | the Quarantine Specialist doesn't affect setup cubes | R2 p8 | no Quarantine Specialist | matching, 2E |
| Roles dealt | at random; unused roles kept for New Assignment | shuffle the roles, deal 1 face up each, the rest out of the game (On the Brink's New Assignment draws on them) | R2 p2, OTB p2 | same | matching |
| Hands by seats | 2→4, 3→3, 4→2, 5→2 | same; 5 players with On the Brink | R2 p2, OTB p2 | same | matching |
| Difficulty | 4 introductory, 5 standard, 6 heroic, 7 legendary (`roles` option) | same; at the 7th epidemic the rate stays at 4 | R2 p3, OTB p2 | same | matching |
| Player deck | piles as equal as possible, 1 epidemic each, smaller piles at the bottom | same | R2 p3 | same | matching |
| First player | the highest city population in hand (a tie goes to the earlier seat) | the highest city population goes first | R2 p3 | the player most recently sick | matching, 2E (the tie is owner check 3) |
| Open hands | open with 4 epidemics; private with 5 or 6, with open hands as an option | introductory: cards face up; standard and heroic: private, open hands allowed for experienced groups | R2 p7 | | matching, 2E |

## Actions

| Action | Coded | 2nd edition | Source | Status |
|---|---|---|---|---|
| Drive / Ferry, Direct, Charter, Shuttle | as the rules give them | as coded | R2 p4 | matching |
| Build a research station | discard the city's card (the Operations Expert needs none); with 6 out, move one | same | R2 p4, p8 | matching |
| Treat disease | 1 cube, or all of a cured colour; one colour per action | same | R2 p4 | matching |
| Share Knowledge | give or take the card of the city both are in; both agree; the hand limit applies at once | same | R2 p4, p8 | matching |
| Discover a Cure | 5 cards of a colour at any station; eradicated if none of it is on the board | same | R2 p4, p8 | matching |
| Eradication | a cured colour with no cubes left; no more cubes of it are placed | same (the cure marker is flipped) | R2 p4, p6 | matching. The 1st ed put the cubes back in the box, which has the same effect. |

## Roles (base)

| Role | Coded | 2nd edition | Source | 1st ed | Status |
|---|---|---|---|---|---|
| Contingency Planner | as an action, takes an event from the player discards onto the role card (1 at a time, not in the hand); once played, it leaves the game | same | R2 p8 | not in the game | matching, 2E |
| Dispatcher | moves another pawn as his own (paying the cards himself), or any pawn to a city with another pawn; another player's pawn only if that player agrees; never with the Operations Expert's move | same | R2 p8 | the permission rule and both moves were there; the card's wording changed | matching, 2E |
| Medic | treats all cubes of a colour; removes cured-colour cubes where he is or enters, also on others' turns and when a cure is found; no cured-colour cubes are placed where he is | same | R2 p8 | the placement block wasn't written | matching, 2E |
| Operations Expert | builds with no card; once a turn, as an action, flies from a station to any city by discarding any city card | same | R2 p8 | the build only, no move | matching, 2E |
| Quarantine Specialist | no cubes and no outbreaks in her city and its neighbours | same | R2 p8 | not in the game | matching, 2E |
| Researcher | gives any of her city cards (never an event), on either player's turn; another player may take any of her city cards | same | R2 p8 | "any card" | matching, 2E |
| Scientist | 4 cards to cure (5 under Complex Molecular Structure) | same | R2 p8, OTB p3 | same | matching |

## Events (base)

| Event | Coded | 2nd edition | Source | Status |
|---|---|---|---|---|
| Timing | any time, not an action, by any player; never between drawing and resolving a card; allowed between two epidemics drawn together | same; Resilient Population may also be played between an epidemic's Infect and Intensify | R2 p7 | matching |
| Airlift | any pawn to any city; another player's pawn only if that player agrees | same | R2 p7 card | matching |
| Forecast | look at the top 6 infection cards and put them back in any order | same | R2 card pictures | matching |
| Government Grant | a station in any city, no card needed; with all 6 out, one is moved | a station anywhere, no card needed | R2 card pictures | matching (moving one when all 6 are out: owner check 4) |
| One Quiet Night | the next Infect Cities step is skipped | same | R2 p1 card | matching |
| Resilient Population | a city card from the infection discards leaves the game; also playable inside an epidemic | same | R2 p1 card | matching |

## Turn, epidemics, infections, the end

| Item | Coded | 2nd edition | Source | Status |
|---|---|---|---|---|
| Actions | 4 a turn (5 for the Generalist) | 4 | R2 p3 | matching |
| Draw | 2 cards together; fewer than 2 left loses; no reshuffle | same | R2 p6 | matching |
| Epidemic | the rate goes up 1; the bottom card gets 3 cubes (topped up to 3 then an outbreak; none if eradicated); the discards are shuffled onto the deck; two epidemics resolve one after the other | same | R2 p6 | matching |
| Epidemic cards after use | out of the game; no replacement card drawn | removed from the game | R2 p6 | matching, 2E (1st ed: to the player discards) |
| Hand limit | 7, checked after the epidemics and whenever a card is received; discard or play events | same; the role and reference cards don't count | R2 p6-p7 | matching |
| Infect cities | as many cards as the rate, one at a time; 1 cube each, and a 4th means an outbreak; none for an eradicated colour | same | R2 p6 | matching |
| Outbreaks | the marker moves 1; 1 cube on each neighbour; chain reactions come after, never twice in a city for one card | same | R2 p7 | matching |
| Win | all 4 cures, at once | same | R2 p7 | matching |
| Loss | 8 outbreaks; a cube that can't be placed; fewer than 2 player cards to draw | same | R2 p1, p7 | matching |

## On the Brink: roles, events, 5 players (OTB p2, p8)

| Item | Coded | 2013 edition | Source | Status |
|---|---|---|---|---|
| 5 players, legendary | `roles` option: a 5th seat with 2 cards; 7 epidemics, the rate stays at 4 | same | OTB p2 | matching |
| Event count | 2 per seat from the 13 (the Bio-Terrorist's seat counts); the rest unseen | same | OTB p2, p5 | matching |
| Archivist | hand limit 8; once a turn, as an action, takes her city's card from the player discards | same | OTB p8 | matching |
| Containment Specialist | on entering a city, 1 cube off each colour with 2 or more; also when moved by others; before Mobile Hospital | same | OTB p2, p8 | matching |
| Epidemiologist | once during her turn, not an action, any city card from a player in her city who agrees | same | OTB p8 | **fixed**: with no actions left, the take was no longer offered. A role's free ability now stays on offer after the last action. 2E. |
| Field Operative | once a turn, as an action, a cube from her city onto the card; 3 samples stand in for 2 cards; samples may go back to the supply at any time | same | OTB p8 | **fixed**: returning samples with no actions left was not offered (same cause as the Epidemiologist). Still **blocked** outside her own turn: the windows offer events only (CONTRACT-GAPS.md, 2.0.0). |
| Generalist | 5 actions | same | OTB p8 | matching |
| Troubleshooter | at the start of her turn, looks at as many infection cards as the rate; a Direct Flight shows the card and keeps it (also through Special Orders, not when moved by others) | same | OTB p3, p8 | matching |
| Borrowed Time | +2 actions, played during your own actions; not straight after drawing it | same | OTB p2 | matching |
| Commercial Travel Ban | the rate is 1 until the current player's next turn | same | OTB p1 card | matching |
| Mobile Hospital | this turn, 1 cube from each city the current player drives or ferries to (counts as treating for Government Interference) | same | OTB p1-p3 | matching |
| New Assignment | a chosen player swaps roles with an unused one; the current player swapping to or from the Generalist gets 5 actions this turn | same; the hand limit applies to anyone left with too many cards | OTB p2; R2 p6 | **fixed**: a player swapped off the Archivist with 8 cards kept all 8. The hand limit now applies at once. 2E. |
| Rapid Vaccine Deployment | right after a cure, 1-5 cubes of that disease; each affected city next to another affected one; ≥1 cube from each | same | OTB p2 | matching |
| Re-examined Research | a chosen player takes a city card from the player discards, then the hand limit applies | same | OTB p1 card | matching |
| Remote Treatment | any 2 cubes from the board | same | OTB p1 card | matching |
| Special Orders | this turn the current player moves 1 other pawn (with permission) as his own, paying the cards; movement powers apply | same | OTB p2 | matching |

## Virulent Strain (OTB p3)

| Item | Coded | 2013 edition | Status |
|---|---|---|---|
| Deck | 4-7 of the 8 drawn face down; the rest unseen | same | matching |
| The strain | the standard disease with the most cubes after the first one's Infect step; ties at random; never purple | same | matching |
| Chronic Effect | infections only: 2 cubes on a strain city with none | same | matching |
| Complex Molecular Structure | +1 card while uncured (Scientist 5, Field Operative 4 plus samples) | same | matching |
| Government Interference | leaving a strain city needs a strain cube treated there this turn by the current player (Mobile Hospital counts; removal doesn't); Dispatcher, Airlift and Special Orders moves are blocked too | same | matching |
| Hidden Pocket | if the strain is eradicated and a strain card is in the infection discards: no longer eradicated, and 1 cube on each such city | same | matching |
| Rate Effect | +1 infection card if a strain city was drawn, unless eradicated; not for the Troubleshooter's look or a Mutation card's draw | same | matching |
| Slippery Slope | a strain outbreak moves the marker 2 | same | matching |
| Unacceptable Loss | 4 strain cubes (or all that are left) leave the supply | same | matching |
| Uncounted Populations | +1 on each city with exactly 1 strain cube | same | matching |

## Mutation (OTB p4)

| Item | Coded | 2013 edition | Status |
|---|---|---|---|
| Purple supply | 12 cubes | same | matching |
| Mutation cards | 2, start in the infection discards | same | matching |
| Mutation events | 3, shuffled into the player cards after the deal; not replaced; resolved before an epidemic drawn with them; with two, the player picks the order | same | matching |
| Threatens / Spreads / Intensifies | 3 purple on the bottom card / 1 purple on each of the 3 bottom cards / +1 on each city with exactly 2 purple; nothing if purple is eradicated | same | matching. The names are coded without the leading "The" (display only: owner check 9). |
| Mutation card in infections | 1 purple (only) on the bottom card; counts as 1 draw | same | matching |
| Infection on a city with purple | both colours | same; the only time both are placed | matching |
| Resilient Population | can't take a Mutation card | same | matching |
| Purple cure | 5 cards of any colours, ≥1 of a city with purple (the Scientist and Field Operative too) | same | matching |
| Win | 5 cures, or 4 cures with no purple on the board | same | matching |

## Bio-Terrorist (OTB p5-p7, SHEET)

| Item | Coded | 2013 edition | Status |
|---|---|---|---|
| Seats | 3 or 4 counting him; 5 allowed; not with Mutation | same (5 not recommended) | matching |
| Choosing him | the option `bioterroristSeat`: the last seat (a volunteer) or a random one | at random, by the role card, or a volunteer | matching |
| Start | 2 infection cards after the 9 infections; the first player chosen among the others; a secret start city | same | matching |
| His turn | after each player's Infect Cities: 2 actions plus 1 free Drive/Ferry; each action at most twice (Drive 3 times) | same | matching |
| Actions | Draw; Drive; Direct and Charter with an airport sighting (flight type hidden); Infect Locally, Infect Remotely (purple only) and Sabotage, each once a turn and only while unspotted | same | matching |
| Hand limit | 7; the card that puts him over it (the 8th, just drawn) goes to the infection discards at once, without effect and with no choice | over 7, he discards the 8th card | **fixed** (2026-11-18): he chose the card before; owner check 5 resolved |
| Spotting, capture, escape | spotted when sharing a city; capture is an action and discards his whole hand; captured: Draw or Escape only, then his turn goes on | same | matching |
| Purple flare-out | 2 cubes back, 1 to each neighbour, no city twice | same (this challenge only) | matching |
| End | he wins if the players lose with purple on the board; everyone loses if there is none; he's out if purple is eradicated | same | matching |
| Events | none on his turn, and none for him | same (etiquette) | matching |

## Blocked or not built

| Item | Why |
|---|---|
| The Field Operative returning samples outside her own turn | The response windows offer events only (CONTRACT-GAPS.md, 2.0.0). She may return them at any point of her own turn. |
| The Lab challenge | It belongs to *In the Lab*, not On the Brink. Not built. |
| Solo, Survival, scenarios and puzzles | Separate Z-Man downloads, not built (the pack has one pawn per seat). |

## Owner to confirm

Items where a source is ambiguous, silent or contradicts itself, for the owner to check against his own copies.

1. **On the Brink edition.** The Z-Man PDF has the 2013 contents (7 role cards, 5 Petri dishes, no revised
   Operations Expert) but a 2009 copyright line. Check that your box has 5 Petri dishes and no Operations Expert card.
   **Resolved (2026-11-18):** the owner sent the Z-Man product page; its contents list 7 roles, 8 events and 5 Petri
   dishes, matching the 2013 edition.
2. **City populations.** R2 shows 7 of the 48 cards, and all 7 agree. Check the other 41, especially Chicago and
   Lima (both coded 9,121,000).
3. **First-player tie.** R2 doesn't say who goes first when two hands tie on population. Coded: the earlier seat.
4. **Government Grant with all 6 stations out.** The card says only "add a station". Coded as for the build
   action: one is moved from anywhere on the board. The BGG threads confirm the 6-station cap for building, not
   for the Grant.
5. **Bio-Terrorist over his hand limit.** OTB p6 says he discards the 8th card. Coded: he chooses which card goes.
   **Resolved (2026-11-18):** the owner's On the Brink rulebook PDF (md5 424745ec…) says his hand limit is 7 and, with
   more than 7, he must discard the 8th card to the infection discard pile, without effect. Now coded so: the card he
   just drew goes at once, with no question (`options.test.ts` "over his hand limit of 7").
6. **Troubleshooter under the Commercial Travel Ban.** She looks at as many cards as "the current infection rate".
   Coded as 1 while the ban holds.
7. **New Assignment on the Contingency Planner or the Field Operative.** Not stated. Coded: a stored event goes to
   the player discards, and samples go back to the supply.
8. **Both colours on a purple city: which first.** Not stated. Coded: the card's colour, then purple.
9. **Mutation event names.** Coded as "Mutation Threatens", "Mutation Spreads" and "Mutation Intensifies"; the
   cards read "The Mutation …!". This affects the display only.

## Testing record

### Step 1: rules audit (2026-11-17, commit 0d77b39)

- Edition: Pandemic 2nd edition (2013) and On the Brink 2013 edition, now written in the README and every manifest.
- Checked against R2 and OTB: every component, setup step, action, role, event, epidemic, infection and outbreak
  rule, the hand limit, cures, eradication, win and loss, and each On the Brink module (tables above).
- Wherever the 2nd edition differs from the 1st, the base already followed the 2nd: 7 roles, the Operations
  Expert, Dispatcher, Researcher and Medic, the first player, and epidemic cards leaving the game.
- Three rules were coded wrong and are fixed, test first: the Epidemiologist's free take with no actions left,
  the Field Operative's sample return with no actions left, and the hand limit after New Assignment.
- `test/second-edition.test.ts`: 14 tests, 11 for 2nd-edition rules and 3 for the fixes. The 3 failed before
  the fix.
- Versions: every Pandemic pack is now 2.0.0, because the game changed (new legal moves and a new discard
  question). The add-ons and the Medic persona have range `^2.0.0`.
- `pnpm check` at 0d77b39 passes: typecheck, then 160 tests passed and 1 skipped over 18 files, 7 Wonders included. The Pandemic packs have 89 tests: base 14, add-ons 20, second-edition 14, kit games 17, kit checks 13 (the two-worlds leak check and the D82 resampled view, trusted and sandboxed), resampled worlds 3, fixtures 1, PR #118 4, Medic 3.

## PR #118 review fixes (2026-11-17)

- **Every action costs an action.** Only a give or consent question's answer pays; every other action is paid at
  once, and a choice or discard answer never pays.
- **A Bio-Terrorist who starts where a pawn stands** is spotted at once.
- **The game stops where it ends** (boardcore s11 X7).

### 5a. Random-play fuzzing through the server and web client (2026-11-18)

Boardcore `pnpm fuzz` on the PR #121 branch (2480df1 plus this run's public fixes), with `FUZZ_EXTRA_PACKS` pointed at
the built base, the five On the Brink add-ons and the Medic, `FUZZ_GAMES=Pandemic`, `FUZZ_SEATS=2,3,4`,
`FUZZ_STRICT=1`, 3 workers. Add-ons (Bio-Terrorist included) and options switched at random on the form.

- Three runs, about 35 minutes: **39 episodes, 7,253 steps, 58 rooms, 30 games played to the end**. Runs 2 and 3,
  with the fixes: 27 episodes, 5,053 steps, 45 rooms, 24 games ended, **no failure**.
- Failure found: 1 signature in the harness's leak check, not a leak: a seat's own step options ("Drive to <city>",
  from its own prompt) matched the Bio-Terrorist's private held cards. Checked against the seat views; fixed in the
  public harness (a seat's own move controls are read apart).
- Also found: rooms that are created and filled but never start, each start a bare `PackFault`: the Bio-Terrorist at 2
  seats, and 7 epidemics without the roles add-on (115 refused starts over the runs). Same gap as public Q106.
- Notes left (explained in words): takebacks refused across revealed information, by design.

### 5b. Phone play (2026-11-18)

Playwright, iPhone 13 at deviceScaleFactor 1, scripted, one phone per seat: a full 2-player base game (introductory,
open hands) and a 3-player game with roles, events, Virulent Strain and the Bio-Terrorist (2 pawns and him). Games
ended in losses: 8 outbreaks after a cure (2p), the Bio-Terrorist winning (3p); earlier runs lost on an empty cube
supply and with him winning on 8 outbreaks.

- Rules checked from the views and log: 4 actions a turn (no turn started otherwise); 2 cards drawn; epidemics
  increase (rate 2, 2, 2, 3), infect 3 from the bottom, intensify (discard 12 back on the deck, 36 to 48 cards);
  infections at the rate; outbreaks and chains (3 in one infection; the 8th ends the game); the hand limit (a
  discard prompt at 8 cards); a cure (Scientist, 4 cards at a station); Quarantine Specialist blocking; events out of
  turn in the windows (Forecast, One Quiet Night, Resilient Population); the Bio-Terrorist's city on no other seat's
  table while unseen (744 checks), shown on his own; win and loss lines.
- Fixed: the table showed no hand, role or Bio-Terrorist line and was 525 to 560 px wide in a 330 px box (now within
  34 columns with roles, cities, visible hands, decks and the infection discard; add-on lines wrapped; `base.test.ts`
  "the table on a phone"); seat ids were disease colours, so the web's names swap read "Sydney is infected (1 Ana)"
  (seats are now green, orange, white, pink, brown); the turn line said "(other)" and "(infect)"; an add-on's state
  line never reached the table (public compose fix).
- Left: prompts name seats by id ("Offer Madrid to orange"; public Q107); the epidemic's intensify step has no log
  line; the turn pop-up covers the board for 2 s; "(draft)" log lines for a provisional step.
