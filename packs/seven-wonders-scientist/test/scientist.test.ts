// Scientist on the draft game (S11 part 8b, private mode; s11-attack N27, N46, N56, N66): install's checks, a
// seeded self-play game the same in both adapters, worlds with no history (Q67), and eight bots at one pick
// through the host's gate. The performance numbers come from boardcore/tools/persona-bench (bench/ here).
import { describe, expect, it } from "vitest";
import type { Json, Prompt, SeatId, Step } from "@boardcore/pack-sdk";
import { decide, start, type Match } from "@boardcore/core/match";
import { drawWorlds, fairGate, personaBot, searchSeed, type Situation } from "@boardcore/bots";
import { inRange, personaSettings } from "@boardcore/core/rules-runtime";
import { legalActions, selfplayGame, type SelfplayMove } from "@boardcore/testkit";
import { bare, composed, kit, readDist, verifyPersonaDist } from "@boardcore-packs/kit";
import { Effect } from "effect";

const dist = (name: string) => readDist(new URL(`../../${name}/dist/`, import.meta.url));
const NAMES = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
const seats = (n: number) => NAMES.slice(0, n).map((seat) => ({ seat, team: null }));
const scientist = () => verifyPersonaDist(new URL("../dist/", import.meta.url));
const allAddons = () => composed(dist("seven-wonders"), ["leaders", "cities", "wonder-pack"].map((a) => dist(`seven-wonders-${a}`)), { teamPlay: true }, { "boardcore/seven-wonders-leaders": { promos: true } });
// The lowest settings: a test plays, the bench measures.
const LOW = { playouts: 50 };

type Hand = { items: string[] };
interface SwState { [k: string]: Json; turn: number; age: number; players: { [seat: string]: { hand: Hand } } }

describe("Scientist (8b, private)", () => {
  it("passes install's checks with its own settings, in range for the base", async () => {
    const p = await scientist();
    expect(p.manifest.persona).toEqual({ pack: "boardcore/seven-wonders", range: "^2.0.0" });
    // In range for the base as built: the base's own id and version, as a room's add-bot checks (12 §18 "Adding one").
    const base = dist("seven-wonders").manifest as { id: string; version: string };
    expect(p.manifest.persona.pack).toBe(base.id);
    expect(inRange(p.manifest.persona.range, base.version)).toBe(true);
    expect(personaSettings(p.manifest)).toMatchObject({ playouts: expect.any(Number), worlds: expect.any(Number), cutoff: expect.any(Number) });
  });

  it("N66: a seeded game at 8 seats with every add-on is the same in both adapters, its searches measured", async () => {
    const p = await scientist();
    const room = await allAddons();
    const moves: SelfplayMove[] = [];
    const play = (trust: "trusted" | "sandboxed") => selfplayGame({
      runtime: kit.runtime, ...room, seats: seats(8), trust, baseSeed: "8b-private", game: 1, maxPlies: 2,
      lineup: [{ persona: p, ...LOW }, ...Array.from({ length: 7 }, () => ({ persona: p, ...LOW }))],
      onMove: (m) => { if (trust === "trusted") moves.push(m); },
    });
    const t = await play("trusted");
    const s = await play("sandboxed");
    expect(bare(s)).toEqual(bare(t));
    expect(t.seats.every((x) => x.persona?.id === "boardcore/scientist")).toBe(true);
    // No search failed and no seat fell back (PR #109 second review, R3).
    for (const x of t.seats) expect([x.failedSearches, x.fallbacks]).toEqual([0, 0]);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) {
      expect(m.playouts).toBe(50);
      expect(m.worlds).toBe(personaSettings(p.manifest).worlds);
      expect(m.personaCalls.prior).toBeGreaterThan(0);
      expect(m.personaCalls.evaluate).toBeGreaterThan(0);
    }
  }, 600_000);

  it("N27: worlds have no history, so the cards a seat passed on are redrawn (Q67): weaker, never a leak", async () => {
    const room = await composed(dist("seven-wonders"));
    const h = await kit.load(room.pack, "trusted", room.with);
    let m: Match = start(h, { options: room.with.options, seats: seats(5), hostSecret: "n27", materials: NAMES.slice(0, 5) }, 0).match;
    const st = () => m.data.state as SwState;
    // Play seeded legal actions until every seat has picked once in Age I.
    let red0: string[] | null = null;
    let k = 0;
    while (!red0 || st().players.red!.hand.items.length !== red0.length - 1 || !h.status(m.data.state).actors.includes("red")) {
      const actors = h.status(m.data.state).actors;
      if (!red0 && st().age === 1 && actors.includes("red") && st().players.red!.hand.items.length === 7) red0 = [...st().players.red!.hand.items];
      const seat = NAMES.find((s) => actors.includes(s));
      if (!seat) throw new Error(`no actor at age ${st().age} turn ${st().turn}: ${JSON.stringify(h.status(m.data.state))} ${JSON.stringify(m.data.suspended)}`);
      const acts = legalActions(h, m.data.state, seat, 64);
      const d = decide(m, { seat, kind: "action", action: acts[k++ % acts.length]!, promptId: m.data.prompts[seat]?.promptId ?? null, idempotencyKey: `n27-${k}` }, 0);
      if (!d.ok) throw new Error(JSON.stringify(d.rejection));
      m = d.match;
      if (k > 400) throw new Error("no second turn");
    }
    // The seat that now holds the rest of red's first hand: red knows its hand exactly.
    const passed = red0!;
    const holder = NAMES.slice(0, 5).find((x) => x !== "red" && st().players[x]!.hand.items.every((c) => passed.includes(c)))!;
    expect(holder).toBeDefined();
    const truth = [...st().players[holder]!.hand.items].sort();
    const fresh = await kit.load(room.pack, "trusted", room.with);
    const worlds = drawWorlds(fresh, m.data.state, "red", searchSeed("persona", "n27", "p"), 50) as SwState[];
    fresh.dispose();
    const exact = worlds.filter((w) => JSON.stringify([...w.players[holder]!.hand.items].sort()) === JSON.stringify(truth)).length;
    const none = worlds.filter((w) => w.players[holder]!.hand.items.every((c) => !truth.includes(c))).length;
    console.log(`N27: of 50 worlds for red at Age I turn 2 (5 seats), ${exact} give ${holder} exactly the cards red passed; ${none} give it none of them`);
    // A person remembers the hand they passed; the worlds mostly don't.
    expect(exact).toBeLessThan(5);
    // Never a leak: red's own hand is red's in every world.
    for (const w of worlds) expect([...w.players.red!.hand.items].sort()).toEqual([...st().players.red!.hand.items].sort());
    h.dispose();
  }, 120_000);

  it("N46: seven persona seats at one pick share the host's gate of 2; seats the cap reaches at the gate play their fallback inside the deadline", async () => {
    const p = await scientist();
    const room = await allAddons();
    const h = await kit.load(room.pack, "sandboxed", room.with);
    const m = start(h, { options: room.with.options, seats: seats(8), hostSecret: "n46", materials: NAMES }, 0).match;
    const state = m.data.state;
    const actors = h.status(state).actors;
    expect(actors).toHaveLength(8);
    const gate = fairGate(2);
    const lines: string[] = [];
    const settings = personaSettings(p.manifest);
    const t0 = Date.now();
    const choicesAt = (seat: SeatId, partial: Step[]): Prompt | null | undefined => { try { return h.choices(state, seat, partial); } catch { return undefined; } };
    // Ann (red) is a person; the other seven are Scientist, as N46 sets it up.
    const bots = NAMES.slice(1).map((seat, i) => {
      const bot = personaBot({
        kind: "persona", seed: `n46-${seat}`, persona: { id: p.manifest.id, version: p.manifest.version, hash: p.manifest.hash }, settings, hidden: true, thinkMs: 0,
        gate, gateKey: { room: "n46", seat: i + 1, botOnly: () => false }, log: (l) => lines.push(l),
        port: {
          worlds: async (_pid, seed, count) => {
            const fresh = await kit.load(room.pack, "sandboxed", room.with);
            try { return { worlds: drawWorlds(fresh, state, seat, seed, count), seats: NAMES }; } finally { fresh.dispose(); }
          },
          load: () => Effect.runPromise(kit.runtime.loadSearch(room.pack, "sandboxed", room.with, p)),
        },
      });
      const sit: Situation = { packId: "boardcore/seven-wonders", seat, view: h.view(state, seat), prompt: choicesAt(seat, [])!, partial: [], promptId: m.data.prompts[seat]!.promptId, deadlineAt: t0 + 30_000, next: async (q) => choicesAt(seat, q) };
      return Promise.resolve(bot.choose(sit)).then(() => ({ seat, ms: Date.now() - t0 }));
    });
    const done = await Promise.all(bots);
    console.log(`N46: ${done.map((d) => `${d.seat} ${d.ms} ms`).join(", ")}`);
    for (const l of lines) console.log(`N46 host line: ${l}`);
    // Every seat answers before its 30 s deadline: the cap (8 s) counts the wait at the gate.
    for (const d of done) expect(d.ms).toBeLessThan(30_000);
    const atGate = lines.filter((l) => /waiting at the gate/.test(l)).length;
    const capped = lines.filter((l) => /reached its time cap/.test(l)).length;
    expect(atGate + capped).toBeGreaterThan(0);
    h.dispose();
  }, 120_000);
});
