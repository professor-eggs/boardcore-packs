// The built pack through Boardcore's test kit (11 §5, D79): random games in both adapters with equal hashes
// every ply, each BGN replayed in both. Timings per game and per ply are printed for CONTRACT-GAPS.md.
import { describe, expect, it } from "vitest";
import type { Json } from "@boardcore/pack-sdk";
import { loadBoth, playBoth, readDist, runLine, seatsOf, type Handles } from "@boardcore-packs/kit";

const NAMES = ["red", "blue", "green", "yellow", "purple", "black"];
const CONFIGS: [number, { [k: string]: Json }][] = [
  [2, {}],
  [3, { epidemics: 5 }],
  [4, { epidemics: 6, openHands: true }],
  [5, { epidemics: 7, onTheBrink: true, virulentStrain: true }],
  [4, { epidemics: 5, onTheBrink: true, mutation: true }],
  [4, { epidemics: 5, bioterrorist: true, bioterroristSeat: "random" }],
  [5, { epidemics: 6, onTheBrink: true, bioterrorist: true }],
];
const name = (n: number, o: object) => `${n} seats ${JSON.stringify(o)}`;
let h: Handles;
const handles = async () => (h ??= await loadBoth(readDist(new URL("../dist/", import.meta.url))));

describe("pandemic in the test kit", () => {
  CONFIGS.forEach(([n, options], i) => {
    it(`plays to the end in both adapters and replays: ${name(n, options)}`, async () => {
      for (const pickSeed of [i + 1, i + 31]) {
        const r = playBoth(await handles(), { seats: seatsOf(NAMES, n), options, pickSeed, maxPlies: 3000 });
        console.log(runLine(`${name(n, options)} #${pickSeed}`, r));
        expect(r.suspended).toEqual({ trusted: null, sandboxed: null });
        expect(r.firstDifference).toBe(null);
        expect(r.replay).toEqual({ trusted: null, sandboxed: null });
        const out = r.outcome as { winners: string[]; places: { [s: string]: number } };
        // Co-op: every player wins or none does; only the Bio-Terrorist can win alone.
        const firsts = Object.keys(out.places).filter((x) => out.places[x] === 1).length;
        expect(out.winners.length === 0 ? firsts : out.winners.length).toBe(firsts);
        if (!options.bioterrorist) expect([0, n]).toContain(out.winners.length);
      }
    }, 120_000);
  });

});
