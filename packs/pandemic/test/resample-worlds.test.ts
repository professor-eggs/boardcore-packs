// A searching bot's worlds (13 §6, D82): every legal action of every actor applies without a fault in the worlds
// `resampleHidden` draws for each seat, over many seeds and positions, so no world contradicts what is on the
// table (PR #109 second review: a pending Share Knowledge offer whose card a world had redrawn away). Where a
// pending question commits a card, the kit's resampler check finds no hand card kept at its place, but in a hand
// the question commits whole (a one-card hand offering its card), which has nothing left to redraw.
import { describe, expect, it } from "vitest";
import type { Json } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import { legalActions, resamplerKeeps } from "@boardcore/testkit";
import { pinnedCards } from "../src/resample";
import { label, room, seats, type Room } from "./rooms";

const ROOMS: [number, Room, number][] = [
  [4, { addons: ["roles", "events", "virulent-strain", "mutation"], options: { epidemics: 5 } }, 4],
  [3, { addons: ["roles", "events", "virulent-strain", "bioterrorist"] }, 3],
  [2, { addons: [], options: { epidemics: 5 } }, 3],
];

describe("pandemic: resampled worlds", () => {
  for (const [n, r, games] of ROOMS) {
    it(`never faults applying a legal action in any seat's world: ${label(r, n)}`, async () => {
      const hs = await room(r), h = hs.trusted;
      const names = seats(n).map((x) => x.seat);
      let worlds = 0, applied = 0, pending = 0;
      const faults: string[] = [];
      for (let g = 0; g < games; g++) {
        const play = Pcg32.seeded(BigInt(g), 11n), game = Pcg32.seeded(BigInt(g), 13n);
        let s: Json = h.setup({ options: hs.options, seats: seats(n), rng: game });
        for (let ply = 0; ply < 400; ply++) {
          const st = h.status(s);
          if (st.outcome || !st.actors.length) break;
          const pins = Object.keys(pinnedCards(s as PDState)).length > 0;
          if (pins) pending++;
          if (pins || ply % 2 === 0) {
            for (const x of names) {
              const w = h.resampleHidden!(s, x, Pcg32.seeded(BigInt(g * 1000 + ply), BigInt(names.indexOf(x) * 2 + 1)));
              worlds++;
              for (const a of h.status(w).actors) for (const act of legalActions(h, w, a)) {
                applied++;
                try { h.apply(w, a, act, Pcg32.seeded(BigInt(ply), 7n)); } catch (e) {
                  if (faults.length < 5) faults.push(`game ${g} ply ${ply}, ${x}'s world: ${a} ${JSON.stringify(act)}: ${String((e as { reason?: string }).reason ?? e)}`);
                }
              }
              if (pins) {
                // A hand kept at its place only when the pending question commits all of it (nothing to redraw).
                const st0 = s as PDState, pinned = pinnedCards(st0);
                const kept = resamplerKeeps(h, s, x, { n: 6, seed: g * 1000 + ply, seats: names }).filter((p) => p.includes(".hand."))
                  .filter((p) => { const y = p.split(".")[2]!; return (pinned[y]?.length ?? 0) < st0.pl[y]!.hand.items.length; });
                expect(kept, `game ${g} ply ${ply}`).toEqual([]);
              }
            }
          }
          const a = st.actors[play.int(st.actors.length)]!;
          const acts = legalActions(h, s, a);
          s = h.apply(s, a, acts[play.int(acts.length)]!, game).state;
        }
      }
      console.log(`resampled worlds ${label(r, n)}: ${worlds} worlds, ${applied} actions applied, ${pending} states with a committed card`);
      expect(faults).toEqual([]);
      expect(pending).toBeGreaterThan(0);
    }, 600_000);
  }
});
