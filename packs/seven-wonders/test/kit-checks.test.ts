// The published kit's leak check (part 7b: two worlds, D52; the D82 resampled view; public clocks; choices that
// read a hidden zone) in both adapters, and interleaved rooms against rooms played alone (§5).
import { describe, expect, it } from "vitest";
import { interleave, kitLeakCheck } from "@boardcore-packs/kit";
import { label, room, seats, type Room } from "./rooms";

const CHECKS: [number, Room][] = [
  [3, { addons: [] }],
  [5, { addons: [], options: { randomSides: true } }],
  [4, { addons: ["leaders"], promos: true }],
  [6, { addons: ["cities"], options: { teamPlay: true } }],
  [4, { addons: ["wonder-pack", "leaders"] }],
  [7, { addons: ["leaders", "cities", "wonder-pack"], promos: true }],
  [8, { addons: ["leaders", "cities", "wonder-pack"], options: { teamPlay: true } }],
];

describe("seven-wonders: hidden information", () => {
  for (const [n, r] of CHECKS) {
    it(`keeps hidden information out of prompts, quiet actions and resampled views: ${label(r, n)}`, async () => {
      const h = await room(r);
      const rep = kitLeakCheck(h.trusted, { seats: seats(n), options: h.options, seed: n, every: n >= 7 ? 6 : 3 });
      console.log(`leak check ${label(r, n)}: ${rep.states} states, ${rep.worlds} worlds, ${rep.quietActions} quiet actions`);
      expect(rep.ended).toBe(true);
      expect(rep.findings).toEqual([]);
      expect(rep.failed).toBe(0);
    }, 240_000);
  }

  it("runs the leak check the same way in the sandbox", async () => {
    const h = await room({ addons: ["leaders", "cities", "wonder-pack"], promos: true });
    const o = { seats: seats(4), options: h.options, seed: 21, every: 12, perActor: 1 };
    const s = kitLeakCheck(h.sandboxed, o);
    console.log(`leak check, sandboxed, 4 seats, all add-ons: ${s.states} states, ${s.worlds} worlds, ${s.quietActions} quiet actions`);
    expect(s.findings).toEqual([]);
    expect(s).toEqual(kitLeakCheck(h.trusted, o));
  }, 600_000);
});

describe("seven-wonders: interleaved rooms", () => {
  it("gives interleaved rooms the same games as rooms played alone", async () => {
    const all = await room({ addons: ["leaders", "cities", "wonder-pack"], promos: true });
    expect(await interleave(all, "trusted", 3, { seats: seats(5), maxPlies: 3000 })).toBe(null);
    expect(await interleave(await room({ addons: [] }), "trusted", 3, { seats: seats(7), maxPlies: 3000 })).toBe(null);
    expect(await interleave(all, "sandboxed", 2, { seats: seats(3), maxPlies: 3000 })).toBe(null);
  }, 600_000);
});
