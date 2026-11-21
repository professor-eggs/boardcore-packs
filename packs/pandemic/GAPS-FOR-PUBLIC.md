# Generic contract gaps from porting a private cooperative game and its five modules (S11 part 7c)

Written to be carried into the public docs (`docs/s11-attack.md` findings or `docs/10-questions.md`). No game
text: "the game" is a cooperative game for 2 to 5 seats with closed hands, out-of-turn cards and two face-down
decks; "the modules" are five add-ons (roles, events, a replacement for one deck's special cards, a fifth
disease, and a one-against-all mode where one seat without a piece plays against the others with a secret
location). Pinned engine: `e0c5d98`.

1. **The interim window costs a ply per seat per window.** Every seat that may hold an out-of-turn card by public
   information must pass every window; with closed hands that is every seat with cards, up to seven windows a
   turn. Most plies of a game are passes. Option: Q65's full shape (an engine-run offer closed by the engine when
   nobody plays, not an actor list).
2. **A base can't end the phase runner early.** Rounds are fixed at `start`. A cooperative game that can be won
   or lost at any moment keeps walking every remaining round after the end, calling every add-on's phase
   handlers, which do nothing: about a third of the sandbox's per-call budget in a one-against-all room when the
   game ends in round 1. Options: `ctx.end()`; or the runner stops when `status` reports an outcome.
3. **A window can't open inside a phase.** "Wait while the others may play a card" in the middle of a player's
   turn would be a window; since a window is a phase, the base asks each other seat in turn through the queue.
   Option: a window a phase handler can open, as it can queue a question.
4. **The kit's random player walks picks only.** `legalActions` returns nothing for an order, subset or amounts
   step, and `playRandom` then stops with neither an outcome nor a suspension. Repro: a pack whose only prompt is
   an order step of two options. Option: walk every step kind (`someSteps`), or suspend with a reason.
5. **A point can't return a prompt.** A point result must be `Json`; `Prompt` and `Option` aren't assignable to it,
   so a point that gives an add-on action's next prompt is declared as plain `Json` and cast on both sides.
   Option: make the prompt types `Json`-compatible.
6. **An event effect can't mark a reveal.** Phase effects may carry `reveal`; event and menu effects may not. An
   add-on whose event depends on its hidden slice (a piece entering a city learns whether the hidden seat is
   there) needs the base to declare a `reveal` operation. Option: `reveal` on every effect.
7. **One-against-all add-ons need the base designed for them.** 11 §10's test was met only because the base was
   written with the mode's points: which seats get a piece (a drawing modifier), a held zone per seat with its
   operations, an end point that may name a lone winner, a flare-out field in the disease registry, an
   on-enter event. Option: say in the authoring guide that a base author decides up front which such variants
   can be add-ons, with this list as the example.
8. **Still open:** every point call copies the whole state (as the card-drafting port's first finding); the
   first phase of round 1 begins inside setup (its seventh); `resampleHidden` has no history, so a pack keeps
   knowledge (deck segments known as sets, the top cards each seat has seen, pile sizes) in hashed state for the
   resampler only; teams can't be drawn at setup (Q68 (d)); an everyone-loses outcome shows as a shared first
   place.

## After the modules became options (2026-11-21)

Add-on packs were removed; the five modules are options of the one pack. Of the list above: 5, 6 and 7 are moot
(no points, no add-on effects, no one-against-all add-on), and so are 8's first two (point calls copying the
state, a phase beginning inside setup). 1 to 4 and the rest of 8 stand. New, as generic gaps:

9. **An option can't need, exclude or bound another.** One pack, five switchable modules: two exclude each other,
   one needs at least 3 seats, the top seat count needs one module and so does the top value of an integer option.
   The manifest can say none of it, so `setup` throws and the room learns at start, its options already fixed.
   This is Q106 with option-to-option rules beside seat counts. Option: `requires`, `conflicts` and seat bounds
   per option, checked at create.
10. **A default can't depend on another option.** Three modules used to preset one integer option to a higher
    value, still editable. An option has one default and `setup` can't tell a default from a choice. Option: an
    "auto" value the pack resolves.
11. **Measured gain.** With plain calls in place of points, a sandboxed move (prompt, view, apply) with every
    module on costs what the base alone costs: 18.3 ms became 10.6 ms in the largest room, 9.5 against 9.1 ms
    with no module.

