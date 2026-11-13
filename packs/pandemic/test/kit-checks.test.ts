// The built pack through Boardcore's test kit: more random games, interleaved rooms against solo rooms (§5),
// and the two-worlds leak check (D52) with D82's resampled-view check, in both adapters.
import { describe, expect, it } from "vitest";
import type { Json } from "@boardcore/pack-sdk";
import { interleave, leakCheck, loadBoth, readDist, seatsOf, type Finding, type Handles } from "@boardcore-packs/kit";

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

/**
 * Known contract gaps (CONTRACT-GAPS.md), counted but not failed. G1: an event playable out of turn makes
 * its holder an actor, and actors are public; and since the table waits while anyone holds an event that
 * can still be played, whether an action ends an event window (and so draws the next hidden card) depends
 * on other closed hands. G2: sharing knowledge offers to take a card from another player's closed hand.
 */
const known = (f: Finding) =>
  f.kind.startsWith("actors") || f.kind === "commit point depends on hidden information" ||
  (/^(prompt depends on hidden information|own action illegal in own resampled world)$/.test(f.kind) && /share|take:/.test(f.detail + JSON.stringify(f.action)));

describe("pandemic in the test kit", () => {
  it("plays more random games in the trusted adapter", async () => {
    const { trusted } = await handles();
    const { playRandom } = await import("@boardcore/testkit");
    for (const [n, options] of CONFIGS) for (let seed = 50; seed < 55; seed++) {
      const g = playRandom(trusted, { seats: seatsOf(NAMES, n), options, pickSeed: seed, maxPlies: 3000 });
      expect(g.match.data.suspended).toBe(null);
      expect(g.match.data.outcome).not.toBe(null);
    }
  }, 120_000);

  it("gives interleaved rooms the same games as rooms played alone", async () => {
    const hs = await handles();
    expect(await interleave(hs, "trusted", 3, { seats: seatsOf(NAMES, 4), options: { epidemics: 5, onTheBrink: true, virulentStrain: true }, maxPlies: 3000 })).toBe(null);
    expect(await interleave(hs, "trusted", 3, { seats: seatsOf(NAMES, 4), options: { epidemics: 5, bioterrorist: true }, maxPlies: 3000 })).toBe(null);
    expect(await interleave(hs, "sandboxed", 2, { seats: seatsOf(NAMES, 3), options: { epidemics: 5, mutation: true }, maxPlies: 3000 })).toBe(null);
  }, 180_000);

  CONFIGS.forEach(([n, options], i) => {
    it(`keeps hidden information out of quiet actions and resampled views: ${name(n, options)}`, async () => {
      for (const seed of [i + 1, i + 11, i + 21]) {
        const r = leakCheck((await handles()).trusted, { seats: seatsOf(NAMES, n), options, seed, every: 2, actorsKey: "actors" });
        console.log(`leak check ${name(n, options)} #${seed}: ${r.states} states, ${r.worlds} worlds, ${r.quietActions} quiet actions, ${JSON.stringify(r.kinds)}`);
        expect(r.ended).toBe(true);
        // With open hands nothing is excused: every finding fails.
        const open = options.openHands === true || (options.epidemics ?? 4) === 4;
        expect(open ? r.kinds : r.findings.filter((f) => !known(f))).toEqual(open ? {} : []);
      }
    }, 120_000);
  });

  it("runs the leak check the same way in the sandbox", async () => {
    const hs = await handles();
    const o = { seats: seatsOf(NAMES, 4), options: { epidemics: 5, bioterrorist: true }, seed: 7, every: 3, actorsKey: "actors" };
    const s = leakCheck(hs.sandboxed, o);
    expect(s.findings.filter((f) => !known(f))).toEqual([]);
    expect(s).toEqual(leakCheck(hs.trusted, o));
  }, 180_000);
});
