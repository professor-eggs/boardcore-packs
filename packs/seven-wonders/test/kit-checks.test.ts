// The built pack through Boardcore's test kit: more random games, interleaved rooms against solo rooms (§5),
// and the two-worlds leak check (D52) with D82's resampled-view check, in both adapters.
import { describe, expect, it } from "vitest";
import { interleave, leakCheck, loadBoth, readDist, seatsOf, type Handles } from "@boardcore-packs/kit";

const NAMES = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
const CONFIGS: [number, { [k: string]: boolean }][] = [
  [3, {}],
  [4, { sideB: true }],
  [5, { leaders: true, cities: true, wonderPack: true }],
  [6, { cities: true, teamPlay: true, randomSides: true }],
  [7, { leaders: true, leaderPromos: true, wonderPack: true }],
  [8, { cities: true, teamPlay: true, leaders: true }],
];
const name = (n: number, o: object) => `${n} seats ${JSON.stringify(o)}`;
let h: Handles;
const handles = async () => (h ??= await loadBoth(readDist(new URL("../dist/", import.meta.url))));

describe("seven-wonders in the test kit", () => {
  it("plays more random games in the trusted adapter", async () => {
    const { trusted } = await handles();
    const { playRandom } = await import("@boardcore/testkit");
    for (const [n, options] of CONFIGS) for (let seed = 10; seed < 13; seed++) {
      const g = playRandom(trusted, { seats: seatsOf(NAMES, n), options, pickSeed: seed, maxPlies: 3000 });
      expect(g.match.data.suspended).toBe(null);
      expect(g.match.data.outcome).not.toBe(null);
    }
  }, 120_000);

  it("gives interleaved rooms the same games as rooms played alone", async () => {
    const hs = await handles();
    expect(await interleave(hs, "trusted", 3, { seats: seatsOf(NAMES, 4), options: { leaders: true, cities: true }, maxPlies: 3000 })).toBe(null);
    expect(await interleave(hs, "trusted", 3, { seats: seatsOf(NAMES, 7), options: { wonderPack: true }, maxPlies: 3000 })).toBe(null);
    expect(await interleave(hs, "sandboxed", 2, { seats: seatsOf(NAMES, 3), options: {}, maxPlies: 3000 })).toBe(null);
  }, 180_000);

  for (const [n, options] of CONFIGS) {
    it(`keeps hidden information out of quiet actions and resampled views: ${name(n, options)}`, async () => {
      const r = leakCheck((await handles()).trusted, { seats: seatsOf(NAMES, n), options, seed: n, every: n >= 7 ? 6 : 3 });
      console.log(`leak check ${name(n, options)}: ${r.states} states, ${r.worlds} worlds, ${r.quietActions} quiet actions, ${JSON.stringify(r.kinds)}`);
      expect(r.ended).toBe(true);
      expect(r.findings).toEqual([]);
    }, 120_000);
  }

  it("runs the leak check the same way in the sandbox", async () => {
    const hs = await handles();
    const o = { seats: seatsOf(NAMES, 4), options: { leaders: true }, seed: 21, every: 8, perActor: 2 };
    const s = leakCheck(hs.sandboxed, o);
    expect(s.findings).toEqual([]);
    expect(s).toEqual(leakCheck(hs.trusted, o));
  }, 180_000);
});
