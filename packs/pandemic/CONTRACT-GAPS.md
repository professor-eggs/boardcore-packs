# Pandemic: contract gaps (S11 part 4, first pass)

Where pack contract v1 (`boardcore/docs/11-engine-contract.md`) and the SDK as pinned (S11 part 1, `c1d7e54`) were awkward for this pack or couldn't express the game. Each finding says what the pack does instead, how bad it is, and a suggested change. Mechanics are described generically, with no rulebook text. Severity: **high** (a leak, a fault, or a rule that can't be played), **medium** (works, but the pack carries machinery the engine or SDK should own), **low** (cosmetic, or one line of pack code).

## Findings

**G1. Cards any seat may play at any moment, from a hidden hand (high).** Any player holding a certain kind of card may play it out of turn, between almost any two steps, and the table must give them the chance. In v1 the only way to let a seat act is to make it an actor, and actors are public (every view's `waitingFor`). So with closed hands everyone learns who holds a playable card of that kind, and since the table pauses while such a holder exists and moves on by itself when none does, whether an action ends a window (and so draws the next hidden card) also depends on other seats' hidden hands. The two-worlds check reports both on every closed-hand game (the kit tests count them and excuse them as this gap: about 1,250 actor differences and 4 commit-point differences in 21 games). With open hands there is no finding. *Suggest:* a "may respond" role distinct from actors: a seat offered an optional prompt that isn't published in `waitingFor`, with the window closed by the engine (every eligible seat passes, or a short timer) and every seat of the game offered the window, holder or not, so being offered reveals nothing. A window kind in the S11.7 phase runner would carry it.

**G2. An action that needs another seat's answer (high).** Some actions give or take a card between two players, or move another player's pawn, and need the other player's agreement; the card taken comes from a hand the taker can't see. v1 can't ask a second seat in the middle of an action, so the acting seat decides alone, and its prompt lists the other player's matching cards, which leaks that closed hand (the leak check reports it as "prompt depends on hidden information"; excused in the tests as this gap). *Suggest:* the interrupt queue for questions to other seats (D81, SP1 C3) usable from a base pack: "ask a seat" turns into a prompt for that seat ("give one of these, or refuse"), and the asker's prompt names only what it can see.

**G3. `resampleHidden` has no history to work from (medium).** Players know which cards a reshuffle put back on top of the infection deck (they were face up a moment before) and the order a forecast set; the state keeps neither, so `resampleHidden` redraws the whole infection deck. It also needs each remaining epidemic to stay within its own pile of the player deck, which no rule needs once the deck is built: the pack now keeps the pile sizes in the state (`piles`) only for the resampler, which changes every state hash. *Suggest:* as 7 Wonders G2: let `resampleHidden` take what the seat has seen, or a per-seat knowledge value kept outside the hashed state.

**G4. A hidden-loyalty or one-against-all seat (medium).** With the Bio-Terrorist on, one seat (the last, or a random one drawn at setup) plays against the others. The room's teams are fixed in the header when the room is made, before setup draws the seat, so the header can't say who is on which side, and D79's teammates-share-a-place check can't apply. The outcome uses `winners` alone: the lone seat (place 1, the rest 2), or all the others (place 1, the lone seat last). *Suggest:* let `setup` (or the first `status`) declare teams, recorded in the BGN like an engine entry, when the manifest says teams are drawn in play.

**G5. Everyone loses together (low).** When the lone opponent is out of the game and the players then lose, nobody wins. The only outcome for that is `winners: []`, which D79 treats as every seat at place 1 (a draw), and a surface that shows placings would call it a shared 1st. The same holds for a plain cooperative loss, where the heading and the text carry it. *Suggest:* an outcome flag (or a rule that `winners: []` with a non-draw text shows "everyone lost") so a surface can say "no one won" rather than "everyone 1st".

**G6. Reveal bookkeeping by hand (medium).** v1 asks the pack to flag `reveal` whenever an action's result depends on hidden information. The pack counts reads of hidden cards in a `touched` field and flags a reveal when it changes; the two-worlds check found three places it forgot (see Bugs fixed). Nothing but the leak check catches a missed flag. *Suggest:* an SDK hidden-zone helper (a deck or hand whose reads go through accessors that mark the call as a reveal), so a pack can't read hidden data without flagging it.

**G7. Many tiny plies for a window that is almost always passed (low).** While anyone holds a card from G1, each infection card is its own action (the current player presses "draw the next card"), so a turn with such a card in play costs up to six plies, each with a `decide`'s full set of pack calls. G1's engine-run window would remove these.

**G8. One seat, several roles (low).** The official solo rules have one person play three roles with one shared hand. Seats map one-to-one to players in the pack's turn loop; nothing in v1 stops a pack from giving a seat several pawns, but the shared parser, prompts and views have no notion of "which of your pawns", so it isn't built.

**G9. Display fields can't be filled yet (low).** As 7 Wonders G9: the pinned Boardcore has no `complexity`, `tags` or `playtime` in the manifest.

## Test-kit numbers

Run 2026-11-13 on the pinned Boardcore, Node 22, through `tools/kit` (see the 7 Wonders file for what it adds to `@boardcore/testkit`). Random play loses fast (outbreaks or the cube supply), so the games are short.

| Configuration | Plies (2 games) | Trusted s (ms/ply) | Sandboxed s (ms/ply) | Costliest call |
| --- | --- | --- | --- | --- |
| 2 seats, introductory (open hands) | 40, 49 | 0.26, 0.19 (4.0–6.5) | 2.58, 2.98 (61–64) | 4 |
| 3 seats, 5 epidemics | 31, 29 | 0.28, 0.26 (9.0) | 3.82, 3.74 (123–129) | 4 |
| 4 seats, 6 epidemics, open hands | 35, 47 | 0.13, 0.17 (3.5) | 1.75, 2.07 (44–50) | 4 |
| 5 seats, 7 epidemics, On the Brink + Virulent Strain | 29, 27 | 0.36, 0.38 (12–14) | 3.87, 5.96 (133–221) | 4 |
| 4 seats, On the Brink + Mutation | 58, 52 | 0.31, 0.32 (5.4–6.2) | 4.53, 4.06 (78) | 5 |
| 4 seats, Bio-Terrorist (random seat) | 30, 19 | 0.10, 0.06 (3.0–3.2) | 1.28, 0.76 (40–43) | 4 |
| 5 seats, On the Brink + Bio-Terrorist | 48, 48 | 0.26, 0.29 (5.5–6.1) | 3.18, 4.63 (66–97) | 5 |

- **Games:** 14 games in both adapters with equal state hashes every ply, each BGN verified in both; 35 more random games in the trusted adapter (5 per configuration); interleaving: two trusted runs of 3 rooms and one sandboxed run of 2 rooms, all equal to the same games played alone. Every outcome followed 11 §2 (cooperative: every player at place 1, winning or losing together; the Bio-Terrorist alone at place 1 when he wins); none suspended.
- **Leak and D82 checks:** 21 trusted games (3 per configuration), 466 sampled states, 1,868 resampled worlds, 808 quiet actions. D82 (`view(world, seat) = view(state, seat)`) held in every world once the public actors list is set aside (G1). Open-hand configurations: no findings at all. Closed-hand configurations: only G1 and G2 findings, counted and excused; three real missing reveals were found and fixed. One game also ran in the sandbox, with the same report as trusted.
- **Faults:** none. No budget or memory fault in QuickJS; the costliest call used 5 interrupt checks of 2,000. Sandboxed play costs about 40 to 220 ms a ply including the kit's own work (every legal action walked through `choices`, including 47-city destination lists and multi-step card choices), about 10 to 15 times the trusted adapter.

## Bugs fixed in this pass

- **Infection cards drawn one by one in a window weren't reveals.** Only the first card of an infection step marked the action as a reveal; when someone could play a card between infection cards, each later "draw the next card" read the hidden deck with no reveal (a missed commit point, so the step could have been drafted and undone). Every card drawn now marks it.
- **An epidemic's bottom card wasn't a reveal when a response window followed.** If someone held a card playable mid-epidemic, the epidemic paused before its shuffle, so the action that turned up the bottom infection card drew no randomness and wasn't flagged. It is now.
- **Moving a pawn didn't count as a reveal with the Bio-Terrorist hidden.** Entering a city tells everyone whether he is there, but only a successful sighting was announced and nothing was flagged, so a move that found him (and one that didn't) were quiet actions. While he is unseen, every pawn entering a city is now a reveal.
