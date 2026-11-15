// The built packs through Boardcore's test kit (11 §5, D79): random games of every seat count, the base alone,
// with each add-on and with all of them. A set of rooms plays in both adapters with equal hashes every ply and
// each BGN replayed in both (timings printed for CONTRACT-GAPS.md); every room plays in the trusted adapter.
import { describe, expect, it } from "vitest";
import { playRandom } from "@boardcore/testkit";
import { playBoth, runLine } from "@boardcore-packs/kit";
import { label, room, seats, type Room } from "./rooms";

const BASE: Room = { addons: [] };
const LEADERS: Room = { addons: ["leaders"], promos: true };
const CITIES: Room = { addons: ["cities"] };
const WP: Room = { addons: ["wonder-pack"] };
const ALL: Room = { addons: ["leaders", "cities", "wonder-pack"], promos: true };

const BOTH: [number, Room][] = [
  [3, BASE],
  [4, { addons: [], options: { sideB: true } }],
  [7, { addons: [], options: { randomSides: true } }],
  [4, LEADERS],
  [6, { addons: ["cities"], options: { teamPlay: true } }],
  [5, WP],
  [3, ALL],
  [8, { ...ALL, options: { teamPlay: true, sideB: true } }],
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

describe("seven-wonders in the test kit, every seat count and room (trusted)", () => {
  for (const r of [BASE, LEADERS, CITIES, WP, ALL]) {
    it(`plays 3 to ${r.addons.includes("cities") ? 8 : 7} seats to an outcome: ${label(r, 0).replace(/^0 seats, /, "")}`, async () => {
      const h = await room(r);
      const max = r.addons.includes("cities") ? 8 : 7;
      for (let n = 3; n <= max; n++) for (const pickSeed of [1, 2]) {
        const g = playRandom(h.trusted, { seats: seats(n), options: h.options, pickSeed, maxPlies: 3000 });
        expect(g.match.data.suspended, label(r, n)).toBe(null);
        expect(g.match.data.outcome, label(r, n)).not.toBe(null);
      }
    }, 240_000);
  }

  it("refuses 8 seats without Cities, also with the other add-ons", async () => {
    const h = await room({ addons: ["leaders", "wonder-pack"] });
    expect(() => h.trusted.setup({ options: h.options, seats: seats(8), rng: { int: () => 0 } })).toThrow(/Cities/);
  });
});
