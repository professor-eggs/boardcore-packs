# boardcore-packs (private)

Xavier's own Boardcore packs of published games, for personal use only. Never distributed, never copied into the public `boardcore` repository (D80).

## Layout

- `boardcore/`: the Boardcore repository as a git submodule, pinned to the commit whose pack SDK, build tool and test kit these packs are written against.
- `packs/<name>/`: one pack each (`manifest.src.json`, `src/`, `test/`, `README.md`, `RULES-AUDIT.md`).
- `tools/local-packs.mjs`: writes each built pack as a pack file (`{ manifest, bundle }`) for a server's `PACKS_DIR`.

## Use

```sh
pnpm setup        # submodule, Boardcore's install and build, then this repo's install
pnpm lint         # Boardcore's pack rules (determinism, no module state, SDK-only imports, no chained casts) and its general rules (type-only imports, no accumulating spread, kept error causes, no useless assignment)
pnpm lint:types   # the same with type information (oxlint-tsgolint): Boardcore's production rules on packs/*/src, its promise rules and the needless-cast rule on packs/*/test
pnpm check        # lint, lint:types, typecheck, build every pack, run every pack's tests
pnpm packs out/   # pack files for a local server
```

To move to a newer Boardcore: `git -C boardcore fetch origin <ref> && git -C boardcore checkout <commit>`, run `pnpm setup` and `pnpm check`, compare the rules in `boardcore/.oxlintrc.json` with ours in `.oxlintrc.json` (copy any new pack rule or type-aware rule, and keep `oxlint` and `oxlint-tsgolint` at Boardcore's versions), and commit the new submodule pointer.

The type-aware rules are Boardcore's (`boardcore/docs/09-quality.md`, "Type-aware lint"). `pnpm lint` doesn't run them, so a disable directive for one fails it as unused: fix the code instead. `tsconfig.json` extends Boardcore's root config for its compiler options only (that file's project references are not inherited); `pnpm typecheck` and the type-aware lint both read the packs' `src` and `test` through it.
