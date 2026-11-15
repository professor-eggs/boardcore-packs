# Generic contract gaps from porting a private card-drafting game and its three expansions (S11 part 7c)

Written to be carried into the public docs (`docs/s11-attack.md` findings or `docs/10-questions.md`). No game
text: "the game" is a simultaneous card-drafting game for 3 to 8 seats; "the expansions" are three add-ons (one
adds a hidden draft of character cards and a recruitment each round, one adds cards, a debt choice and an
eighth seat, one adds four boards). Pinned engine: `e0c5d98`.

1. **Every point call copies the whole state.** Each handler gets a deep, frozen copy of the base's state. A
   point the base would call on every build, or on every price it computes for a prompt, copies every seat's
   city each time, so the base keeps those rules itself and add-ons can only put effect values on their cards
   for the base to read. Options: a lazily copied or structurally shared input; a published cost per call so a
   base can choose; or saying in the authoring guide that points are for rare events.
2. **An event handler can't ask a question.** An event effect returns operations and a slice. An add-on whose
   effect needs one seat's choice records it and asks from an auto phase of its own, anchored before every base
   phase where the event can fire (here up to 9 phases an add-on). Options: let an event effect carry `ask`,
   queued when the base's phase call returns; or one "after this phase" hook per add-on.
3. **Add-ons can't read each other's slices.** Content one add-on brings that another add-on interprets (here,
   character cards from one expansion whose effects belong to another) works only because the base publishes
   the cards in play as public state on each seat. Options: document the pattern (a base exposes cross-add-on
   facts as public state); or a read-only view of other members' slices.
4. **Registries aren't in a handler's input.** A handler sees card ids in the state, not the composed card
   registry, so the base passes card summaries (with their effects) in a point's arguments. Option: the
   composed registries, frozen and loaded once, in every handler's input.
5. **A question between a pick and the base's next auto phase moves that phase into the answer.** A base that
   reads a hidden zone directly in an auto phase that follows a pick (whose resolve is a reveal anyway) leaks
   once an add-on asks a question in between: the answer runs the base's phase, so a quiet action changes what
   seats see. The published leak check found it (`quietView`). Option: the authoring guide says every hidden
   zone in a `begin` is read through `ctx.zones`, since any phase may come to run inside another member's answer.
6. **An empty pick phase resolves as a reveal.** A pick phase whose `seats` is empty resolves at once and marks
   the action a reveal: a phase that rarely has seats (a once-a-game choice before each turn) costs a call per
   turn and hides actions from the leak check's quiet-action checks. Option: skip a pick phase with no seats,
   without a reveal.
7. **The first phase of round 1 begins before the add-on's slice exists.** An add-on phase first in round 1
   begins inside the base's setup, so its `seats` handler is called with `slice: null`. Option: document it with
   the `slice` handed to the add-on's `setup`, or run add-on setups before the runner starts.
8. **A question's default is written twice.** The default is built from the state when the question is asked,
   the prompt from the base's view; the two must agree or the composer faults. Option: a missing default means
   "the first enabled option".
9. **An add-on's prompt sees only the base's view.** An add-on rule that reuses a base action ("build a stage with
   this card instead") needs the base to publish that action's options and prices in its view ahead of time.
   Option: none in the contract; a note in the authoring guide for base authors.
10. **Still open from part 4:** `resampleHidden` has no history (O3): a seat's knowledge of what it passed on
    (cards, and now drafted characters) is lost, so worlds are a superset of the player's. Teams as an option
    (Q68 (d)) and a tie-break that doesn't show in `scores` are unchanged.
11. **Tooling:** `pnpm setup` is pnpm's own command (it edits the shell profile), so a consuming repository's
    setup script must be run as `pnpm run setup`; and that script's `git submodule update` resets a moved
    submodule pointer unless it is staged first.
