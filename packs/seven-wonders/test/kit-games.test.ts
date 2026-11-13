// The built pack through Boardcore's test kit (11 §5, D79): random games in both adapters with equal hashes
// every ply, each BGN replayed in both. Timings per game and per ply are printed for CONTRACT-GAPS.md.
import { describe, expect, it } from "vitest";
import { loadBoth, playBoth, readDist, runLine, seatsOf, type Handles } from "@boardcore-packs/kit";

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
  for (const [n, options] of CONFIGS) {
    it(`plays to the end in both adapters and replays: ${name(n, options)}`, async () => {
      const r = playBoth(await handles(), { seats: seatsOf(NAMES, n), options, pickSeed: n, maxPlies: 3000 });
      console.log(runLine(name(n, options), r));
      expect(r.suspended).toEqual({ trusted: null, sandboxed: null });
      expect(r.firstDifference).toBe(null);
      expect(r.replay).toEqual({ trusted: null, sandboxed: null });
      const out = r.outcome as { winners: string[]; places: { [s: string]: number }; scores: { [s: string]: number } };
      expect(Object.keys(out.scores).sort()).toEqual(NAMES.slice(0, n).sort());
      expect(out.winners.length).toBeGreaterThan(0);
    }, 120_000);
  }

});
