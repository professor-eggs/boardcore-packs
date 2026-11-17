// Medic on the co-op game (S11 part 8b, private mode; s11-attack N48, N58, N66): install's checks, a seeded game
// the same in both adapters, each seat searched from its own view (no team back door), and the response windows:
// how many plies a persona plays without a search. Performance numbers come from boardcore/tools/persona-bench.
import { describe, expect, it } from "vitest";
import { inRange, personaSettings } from "@boardcore/core/rules-runtime";
import { selfplayGame, type SelfplayMove } from "@boardcore/testkit";
import { bare, composed, kit, readDist, verifyPersonaDist } from "@boardcore-packs/kit";

const dist = (name: string) => readDist(new URL(`../../${name}/dist/`, import.meta.url));
const NAMES = ["red", "blue", "green", "yellow", "purple"];
const seats = (n: number) => NAMES.slice(0, n).map((seat) => ({ seat, team: null }));
const medic = () => verifyPersonaDist(new URL("../dist/", import.meta.url));
const room = () => composed(dist("pandemic"), ["roles", "events", "virulent-strain", "mutation"].map((a) => dist(`pandemic-${a}`)), { epidemics: 5 });

describe("Medic (8b, private)", () => {
  it("passes install's checks, in range for the base", async () => {
    const p = await medic();
    expect(p.manifest.persona).toEqual({ pack: "boardcore/pandemic", range: "^2.0.0" });
    // In range for the base as built: the base's own id and version, as a room's add-bot checks (12 §18 "Adding one").
    const base = dist("pandemic").manifest as { id: string; version: string };
    expect(p.manifest.persona.pack).toBe(base.id);
    expect(inRange(p.manifest.persona.range, base.version)).toBe(true);
    expect(personaSettings(p.manifest).cutoff).not.toBe(null);
  });

  it("N58, N66: a seeded game at 4 seats with closed hands is the same in both adapters; each seat searches its own worlds", async () => {
    const p = await medic();
    const r = await room();
    const moves: SelfplayMove[] = [];
    const lineup = Array.from({ length: 4 }, () => ({ persona: p, playouts: 50 }));
    const play = (trust: "trusted" | "sandboxed") => selfplayGame({
      runtime: kit.runtime, ...r, seats: seats(4), lineup, trust, baseSeed: "8b-private", game: 2, maxPlies: 3,
      onMove: (m) => { if (trust === "trusted") moves.push(m); },
    });
    const t = await play("trusted");
    expect(bare(await play("sandboxed"))).toEqual(bare(t));
    // No search failed and no seat fell back (PR #109 second review, R3): every move measured is a searched one.
    for (const x of t.seats) expect([x.failedSearches, x.fallbacks]).toEqual([0, 0]);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      // A hidden-information game: every search ran over its own seat's worlds, never the true state.
      expect(m.worlds).toBe(personaSettings(p.manifest).worlds);
      expect(m.personaCalls.evaluate).toBeGreaterThan(0);
    }
  }, 600_000);

  it("N48: a window whose only option is Pass is played without a search, so most plies cost nothing", async () => {
    const p = await medic();
    const r = await room();
    const moves: SelfplayMove[] = [];
    // The lowest settings, trusted: this counts searches, it doesn't time them.
    const lineup = Array.from({ length: 4 }, () => ({ persona: p, playouts: 50 }));
    const rec = await selfplayGame({ runtime: kit.runtime, ...r, seats: seats(4), lineup, trust: "trusted", baseSeed: "8b-n48", game: 0, maxPlies: 60, onMove: (m) => moves.push(m) });
    const searched = new Set(moves.map((m) => m.ply)).size;
    console.log(`N48: ${rec.plies} plies, ${searched} searched (${Math.round((100 * searched) / rec.plies)}%), the rest a single legal action played without a search`);
    expect(searched).toBeLessThan(rec.plies);
  }, 600_000);
});
