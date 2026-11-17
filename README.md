# boardcore-packs (private)

Xavier's own Boardcore packs of published games, for personal use only. Never distributed, never copied into the public `boardcore` repository (D80).

## Layout

- `boardcore/`: the Boardcore repository as a git submodule, pinned to the commit whose pack SDK, build tool and test kit these packs are written against.
- `packs/<name>/`: one pack each (`manifest.src.json`, `src/`, `test/`, `README.md`, `RULES-AUDIT.md`, `CONTRACT-GAPS.md`: where contract v1 was awkward, with the test-kit numbers).
- `packs/seven-wonders-scientist/`, `packs/pandemic-medic/`: the personas Scientist and Medic (S11 part 8b), each a persona file of its own (`format: "persona/1"`, built by the same tool, hashed as 13 §6 says), with their tests; `test/demo.test.ts` plays the demo game through Rooms with `BOARDCORE_DEMO=1`.
- `bench/`: the runs part 8b measured with Boardcore's `tools/persona-bench` (`node ../boardcore/tools/persona-bench/run.mjs <runs>.json [--phone|--inside] --out results/<name>.json`) and their results. The bench writes the runs with their bundles inlined, the phone page and the raw result lines to `bench/.persona-bench/<runs>/` (ignored), never into the public working copy. `first-visit.json` (PR #109 second review) reran the draft and co-op grids sandboxed to measure one visit on its own (`longestVisitMs`: 0.38 to 0.70 s at the draft game's first pick, 0.76 to 1.41 s in the co-op game's first plies, rerun after the resampler fix below; 0.99 to 1.58 s before it); it also showed a failed search the first grid hid: at the co-op game's lowest setting, game 3, red's search hit a pack fault in `apply` in one of its worlds ("blue has no city:Cairo": the co-op pack's `resampleHidden` drew a world inconsistent with a move it offers), so the seat played its fallback. The bench now flags any run with a failed search or fallback and exits 3. The resampler now keeps in every world a card a pending question commits from a hand (`packs/pandemic/README.md` "Hidden zones"); the co-op run of `first-visit.json`, rerun, has no failed search and no fallback (red's search there completes, 9.7 s), and its result replaces the flagged one.
- `tools/kit/`: runs a built pack (`dist/`) through Boardcore's test kit in both adapters: random games with equal hashes every ply, BGN replays, interleaved rooms, the two-worlds leak check (D52) and D82's resampled-view check. Each pack's `test/kit-*.test.ts` uses it.
- `tools/local-packs.mjs`: writes each built pack as a pack file (`{ manifest, bundle }`) for a server's `PACKS_DIR`.

## Use

```sh
pnpm run setup    # submodule, Boardcore's install and build, then this repo's install
pnpm check        # typecheck, build every pack, run every pack's tests
pnpm packs out/   # pack files for a local server
```

To move to a newer Boardcore: `git -C boardcore fetch origin <ref> && git -C boardcore checkout <commit>`, stage the new pointer (`git add boardcore`, since `pnpm run setup` runs `git submodule update`), run `pnpm run setup` and `pnpm check`, and commit it. (`pnpm setup` alone is pnpm's own command, which edits the shell profile.)
