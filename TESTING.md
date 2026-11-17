# Testing a game pack

Every game pack in this repo goes through the same steps before it counts as done. 7 Wonders set the pattern (2026-11-17). Record each step's result in the pack's `RULES-AUDIT.md` under a "Testing record" heading, with the date and commit.

## 1. Rules audit against an outside source

- Pick the edition the owner plays, and write it in the README and manifest. Ask if unsure.
- Go through every card, tile, wonder and special rule against an outside source for that edition. Use the official rules summary, or an errata or changes article the owner supplies. Heavy research goes to the owner's research bot as a spec. Write down mechanics only: names and numbers, never rulebook text.
- Each row of the `RULES-AUDIT.md` table says what was coded and where that comes from. Anything the source leaves ambiguous goes on an owner card check: a short list of items for the owner to compare against their physical copy, on the owner questions page.
- Add a test file for the edition's differences, one test per changed card or rule (like `test/second-edition.test.ts`).

## 2. Rule tests

- `base.test.ts`: setup, turn order, scoring, end of game, and one full scripted game with its final score checked by hand.
- `addons.test.ts`: each add-on alone and together with the others, plus the combinations the add-on contract refuses.
- `fixtures.test.ts`: recorded games replay to the same hash in both adapters.

## 3. Test kit in both adapters (trusted and sandboxed)

- `kit-games.test.ts`: random legal play to the end, many seeds, every seat count.
- `kit-checks.test.ts`:
  - The two-worlds check (D52): no view leaks hidden information.
  - The D82 resample check: `resampleHidden` keeps everything a seat has seen, including cards a pending question commits.
- Fix every reveal the two-worlds check finds. Write contract gaps up in `CONTRACT-GAPS.md`, and carry them to the public `docs/s11-attack.md` or `docs/10-questions.md` in words.

## 4. Bots

- The pack's persona (like Scientist or Medic) plays full games in both adapters.
- Bench it against the 8 s persona bar. Record the numbers and the host they ran on.

## 5. Played through the server and the web client

Run these locally with the private packs loaded, never on the demo server.

- **Random-play fuzzing** (`pnpm fuzz` in boardcore, pointed at the pack): run with `FUZZ_STRICT=1` until it's clean. The invariants are no console errors, no dead screens, no negative clocks, no hidden-information leaks, and every refusal explained.
- **Phone pass:** play one scripted game on an iPhone-sized screen and take a screenshot of each screen. Check for:
  - off-screen buttons;
  - tap targets under 44 px;
  - code names or ids in player-facing text;
  - boards wider than the screen.

## 6. Adversarial review

- A fresh review agent per pack PR. It checks the rules audit against the code, tries to break hidden information, and runs every test above.
- Fix its findings, then run steps 3 and 5 again.

## 7. Owner check

- The owner card-check items go on the owner questions page.
- The owner plays one game on his phone (UAT) when it's convenient.
