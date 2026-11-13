# boardcore-packs (private)

Xavier's own Boardcore packs of published games, for personal use only. Never distributed, never copied into the public `boardcore` repository (D80).

## Layout

- `boardcore/`: the Boardcore repository as a git submodule, pinned to the commit whose pack SDK, build tool and test kit these packs are written against.
- `packs/<name>/`: one pack each (`manifest.src.json`, `src/`, `test/`, `README.md`, `RULES-AUDIT.md`, `CONTRACT-GAPS.md`: where contract v1 was awkward, with the test-kit numbers).
- `tools/kit/`: runs a built pack (`dist/`) through Boardcore's test kit in both adapters: random games with equal hashes every ply, BGN replays, interleaved rooms, the two-worlds leak check (D52) and D82's resampled-view check. Each pack's `test/kit-*.test.ts` uses it.
- `tools/local-packs.mjs`: writes each built pack as a pack file (`{ manifest, bundle }`) for a server's `PACKS_DIR`.

## Use

```sh
pnpm setup        # submodule, Boardcore's install and build, then this repo's install
pnpm check        # typecheck, build every pack, run every pack's tests
pnpm packs out/   # pack files for a local server
```

To move to a newer Boardcore: `git -C boardcore fetch origin <ref> && git -C boardcore checkout <commit>`, run `pnpm setup` and `pnpm check`, and commit the new submodule pointer.
