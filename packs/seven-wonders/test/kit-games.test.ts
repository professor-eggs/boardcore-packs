// The built pack through Boardcore's test kit (11 §5, D79): random games of every seat count, the base game alone
// and with every mix of the expansions' options. A set of games plays in both adapters with equal hashes every ply
// and each BGN replayed in both (timings printed for CONTRACT-GAPS.md); every mix plays in the trusted adapter.
import { describe, expect, it } from "vitest";
import { playRandom } from "@boardcore/testkit";
import { playBoth, runLine } from "@boardcore-packs/kit";
import { label, MIXES, room, seats, type Room } from "./rooms";

const BASE: Room = {};
const LEADERS: Room = { leaders: true, leaderPromos: true };
const WP: Room = { wonderPack: true };
const ALL: Room = { leaders: true, leaderPromos: true, cities: true, wonderPack: true };

const BOTH: [number, Room][] = [
  [3, BASE],
  [4, { sideB: true }],
  [7, { randomSides: true }],
  [4, LEADERS],
  [6, { cities: true, teamPlay: true }],
  [5, WP],
  [5, { leaders: true, cities: true }],
  [6, { leaders: true, wonderPack: true, sideB: true }],
  [7, { cities: true, wonderPack: true, randomSides: true }],
  [3, ALL],
  [8, { ...ALL, teamPlay: true, sideB: true }],
];

describe("seven-wonders in the test kit, both adapters", () => {
  for (const [n, r] of BOTH) {
    it(`plays to the end with equal hashes and replays: ${label(r, n)}`, async () => {
      const g = playBoth(await room(r), { seats: seats(n), pickSeed: n, maxPlies: 3000 });
      console.log(runLine(label(r, n), g));
      expect(g.suspended).toEqual({ trusted: null, sandboxed: null });
      expect(g.firstDifference).toBe(null);
      expect(g.replay).toEqual({ trusted: null, sandboxed: null });
      const out = g.outcome as { winners: string[]; places: { [s: string]: number }; scores: { [s: string]: number } };
      expect(Object.keys(out.places)).toHaveLength(n);
      expect(out.winners.length).toBeGreaterThan(0);
    }, 240_000);
  }
});

describe("seven-wonders in the test kit, every seat count and option mix (trusted)", () => {
  // Every mix of the three expansions (the promo leaders with Leaders), at every seat count it takes.
  for (const mix of MIXES) {
    const r: Room = mix.leaders ? { ...mix, leaderPromos: true } : mix;
    const max = r.cities ? 8 : 7;
    it(`plays 3 to ${max} seats to an outcome: ${label(r, 0).replace(/^0 seats, /, "")}`, async () => {
      const h = await room(r);
      for (let n = 3; n <= max; n++) for (const pickSeed of [1, 2]) {
        const g = playRandom(h.trusted, { seats: seats(n), options: h.options, pickSeed, maxPlies: 3000 });
        expect(g.match.data.suspended, label(r, n)).toBe(null);
        expect(g.match.data.outcome, label(r, n)).not.toBe(null);
      }
    }, 240_000);
  }

  it("plays team play at 4, 6 and 8 seats with every expansion on", async () => {
    const h = await room({ ...ALL, teamPlay: true, randomSides: true });
    for (const n of [4, 6, 8]) {
      const g = playRandom(h.trusted, { seats: seats(n), options: h.options, pickSeed: n, maxPlies: 3000 });
      expect(g.match.data.suspended, `${n} seats`).toBe(null);
      expect(g.match.data.outcome, `${n} seats`).not.toBe(null);
    }
  }, 240_000);

  it("refuses 8 seats without Cities, also with the other expansions", async () => {
    const h = await room({ leaders: true, wonderPack: true });
    expect(() => h.trusted.setup({ options: h.options, seats: seats(8), rng: { int: () => 0 } })).toThrow(/Cities/);
  });
});
