// PR #118 second review: part 7c's X7 fix (the runner's `ended`) was made for this pack, but the base passed
// no `ended` to phaseRunner, so a game lost early still walked every remaining round (about deck/2 + 3 rounds
// of ~30 phases, each add-on's seats/begin called) inside the losing action. Fixed: `ended` is the outcome.
import { describe, expect, it } from "vitest";
import type { Action, Json, Rng } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { room, seats, type Room } from "./rooms";

type S = PDState & { addons: { [id: string]: Json } };
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
const start = async (r: Room, n: number, seed = 1) => {
  const h = await room(r);
  return { p: h.trusted, s: h.trusted.setup({ options: h.options, seats: seats(n), rng: rng(seed) }) as S };
};
const act = (p: PackHandle, s: S, seat: string, action: Action, seed = 7) => p.apply(s, seat, action, rng(seed)).state as S;
const cur = (s: S) => s.players[s.current]!;

describe("PR #118: the pandemic base stops its runner at the end (X7)", () => {
  for (const r of [{ addons: [] }, { addons: ["bioterrorist"] }] as Room[]) {
    it(`a loss in round 1 leaves the runner in round 1 (${r.addons.join() || "base"})`, async () => {
      const { p, s: s0 } = await start(r, 3);
      let s = s0;
      // Let the Bio-Terrorist (if any) take up his position first.
      for (let i = 0; i < 3 && !p.status(s).actors.includes(cur(s)); i++) { const x = p.status(s).actors[0]!; s = act(p, s, x, [String(p.choices(s, x, [])!.options[0]!.id)]); }
      const me = cur(s);
      // One card left in the player deck: the draw loses. No events anywhere, so no window opens.
      s = { ...s, playerDeck: { ...s.playerDeck, items: s.playerDeck.items.slice(0, 1) }, pl: Object.fromEntries(Object.entries(s.pl).map(([k, v]) => [k, { ...v, hand: { ...v.hand, items: [] } }])) as S["pl"], nEvents: 0 };
      const round = s.run.round;
      s = act(p, s, me, ["end"]);
      expect(p.status(s).outcome?.text).toMatch(/player deck ran out/);
      expect(s.run.rounds).toBeGreaterThan(20);
      expect(s.run.round).toBe(round);
    });
  }
});
