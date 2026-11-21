// The published kit's leak check (part 7b: two worlds, D52; the D82 resampled view; public clocks; choices that
// read a hidden zone) with closed hands, no kind excused, in the trusted adapter for every room and once in the
// sandbox; and interleaved rooms against rooms played alone (§5).
import { describe, expect, it } from "vitest";
import { interleave, kitLeakCheck } from "@boardcore-packs/kit";
import { label, room, seats, type Room } from "./rooms";

const CHECKS: [number, Room][] = [
  [2, { mods: [], options: { epidemics: 5 } }],
  [3, { mods: [], options: { epidemics: 5 } }],
  [4, { mods: [], options: { epidemics: 6 } }],
  [5, { mods: ["roles"], options: { epidemics: 5 } }],
  [3, { mods: ["events"], options: { epidemics: 5 } }],
  [4, { mods: ["virulentStrain"] }],
  [3, { mods: ["mutation"] }],
  [3, { mods: ["bioterrorist"] }],
  [5, { mods: ["bioterrorist"] }],
  [5, { mods: ["roles", "events", "virulentStrain", "mutation"] }],
  [5, { mods: ["roles", "events", "virulentStrain", "bioterrorist"] }],
];

describe("pandemic: hidden information", () => {
  for (const [n, r] of CHECKS) {
    it(`keeps closed hands and decks out of prompts, quiet actions and resampled views: ${label(r, n)}`, async () => {
      const h = await room(r);
      expect(h.options.openHands).toBe(false);
      const rep = kitLeakCheck(h.trusted, { seats: seats(n), options: h.options, seed: n, every: 2 });
      console.log(`leak check ${label(r, n)}: ${rep.states} states, ${rep.worlds} worlds, ${rep.quietActions} quiet actions`);
      expect(rep.ended).toBe(true);
      expect(rep.findings).toEqual([]);
      expect(rep.failed).toBe(0);
      expect(rep.excused).toEqual({});
    }, 240_000);
  }

  it("runs the leak check the same way in the sandbox", async () => {
    const h = await room({ mods: ["roles", "events", "virulentStrain", "bioterrorist"] });
    const o = { seats: seats(4), options: h.options, seed: 21, every: 6, perActor: 1 };
    const s = kitLeakCheck(h.sandboxed, o);
    console.log(`leak check, sandboxed, 4 seats, roles + events + virulentStrain + bioterrorist: ${s.states} states, ${s.worlds} worlds, ${s.quietActions} quiet actions`);
    expect(s.findings).toEqual([]);
    expect(s).toEqual(kitLeakCheck(h.trusted, o));
  }, 600_000);
});

describe("pandemic: interleaved rooms", () => {
  it("gives interleaved rooms the same games as rooms played alone", async () => {
    const all = await room({ mods: ["roles", "events", "virulentStrain", "mutation"] });
    expect(await interleave(all, "trusted", 3, { seats: seats(4), maxPlies: 4000 })).toBe(null);
    expect(await interleave(await room({ mods: ["bioterrorist"] }), "trusted", 3, { seats: seats(4), maxPlies: 4000 })).toBe(null);
    expect(await interleave(await room({ mods: [] }), "sandboxed", 2, { seats: seats(2), maxPlies: 4000 })).toBe(null);
  }, 600_000);
});
