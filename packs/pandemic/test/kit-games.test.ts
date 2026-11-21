// The built packs through Boardcore's test kit (11 §5, D79): random games of every seat count, the base alone,
// with each On the Brink option and with all of them. A set of rooms plays in both adapters with equal hashes every ply and
// each BGN replayed in both (timings printed for CONTRACT-GAPS.md); every room plays in the trusted adapter.
import { describe, expect, it } from "vitest";
import { playRandom } from "@boardcore/testkit";
import { playBoth, runLine } from "@boardcore-packs/kit";
import { label, room, seats, type Room } from "./rooms";

const BASE: Room = { mods: [] };
const ROLES: Room = { mods: ["roles"] };
const EVENTS: Room = { mods: ["events"] };
const VS: Room = { mods: ["virulentStrain"] };
const MUTATION: Room = { mods: ["mutation"] };
const BT: Room = { mods: ["bioterrorist"] };
const ALL_MUTATION: Room = { mods: ["roles", "events", "virulentStrain", "mutation"] };
const ALL_BT: Room = { mods: ["roles", "events", "virulentStrain", "bioterrorist"] };

const BOTH: [number, Room][] = [
  [2, { mods: [], options: { epidemics: 4 } }],
  [4, { mods: [], options: { epidemics: 6 } }],
  [5, ROLES],
  [3, EVENTS],
  [4, VS],
  [3, MUTATION],
  [4, BT],
  [5, { ...ALL_MUTATION, options: { epidemics: 7 } }],
  [5, ALL_BT],
];

const outcomeOk = (out: { winners: string[]; text: string } | null, n: number, bt: boolean) => {
  expect(out).not.toBe(null);
  if (!out!.winners.length) return;
  // A cooperative win is every player's; the Bio-Terrorist wins alone.
  if (/Bio-Terrorist wins/.test(out!.text)) expect(out!.winners).toHaveLength(1);
  else expect(out!.winners).toHaveLength(bt ? n - 1 : n);
};

describe("pandemic in the test kit, both adapters", () => {
  for (const [n, r] of BOTH) {
    it(`plays to the end with equal hashes and replays: ${label(r, n)}`, async () => {
      const g = playBoth(await room(r), { seats: seats(n), pickSeed: n, maxPlies: 4000 });
      console.log(runLine(label(r, n), g));
      expect(g.suspended).toEqual({ trusted: null, sandboxed: null });
      expect(g.firstDifference).toBe(null);
      expect(g.replay).toEqual({ trusted: null, sandboxed: null });
      outcomeOk(g.outcome as { winners: string[]; text: string }, n, r.mods.includes("bioterrorist"));
    }, 240_000);
  }
});

describe("pandemic in the test kit, every seat count and room (trusted)", () => {
  const ROOMS: [Room, number, number][] = [[BASE, 2, 4], [ROLES, 2, 5], [EVENTS, 2, 4], [VS, 2, 4], [MUTATION, 2, 4], [BT, 3, 5], [ALL_MUTATION, 2, 5], [ALL_BT, 3, 5]];
  for (const [r, min, max] of ROOMS) {
    it(`plays ${min} to ${max} seats to an outcome: ${label(r, 0).replace(/^0 seats, /, "")}`, async () => {
      const h = await room(r);
      for (let n = min; n <= max; n++) for (const pickSeed of [1, 2]) {
        const g = playRandom(h.trusted, { seats: seats(n), options: h.options, pickSeed, maxPlies: 4000 });
        expect(g.match.data.suspended, label(r, n)).toBe(null);
        outcomeOk(g.match.data.outcome as { winners: string[]; text: string } | null, n, r.mods.includes("bioterrorist"));
      }
    }, 240_000);
  }
});
