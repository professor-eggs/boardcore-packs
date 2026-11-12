# boardcore-packs

Private packs for Boardcore. Read `boardcore/AGENTS.md` and its docs first: these packs follow the same pack contract (`boardcore/docs/11-engine-contract.md`) and rules (packs are pure, plain TypeScript, no imports beyond `@boardcore/pack-sdk`).

- Nothing here is copied into the public `boardcore` repository. Gaps a pack finds in the contract are written up there (as findings in `docs/s11-attack.md` or questions in `docs/10-questions.md`) in words, without rulebook text.
- Mechanics only: card names and numbers, no rulebook text or art.
- Every pack passes `pnpm check`, including the test kit in both adapters.
