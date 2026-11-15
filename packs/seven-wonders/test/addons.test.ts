// Rules of the three add-ons: through the composed packs (trusted adapter) where a room shows them, and their
// own handlers called directly where a situation is rare in random play.
import { describe, expect, it } from "vitest";
import type { Json, Rng, Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import leaders from "../../seven-wonders-leaders/src/index";
import { CITIES_CARDS } from "../../seven-wonders-cities/src/data";
import wonderPack from "../../seven-wonders-wonder-pack/src/index";
import { BASE_CARDS } from "../src/data";
import { room, seats } from "./rooms";

type S = SWState & { addons: { [id: string]: Json } };
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
const L = "boardcore/seven-wonders-leaders", C = "boardcore/seven-wonders-cities";
const start = (p: PackHandle, options: { [k: string]: Json }, n: number, seed = 1) => p.setup({ options, seats: seats(n), rng: rng(seed) }) as S;
/** Every actor plays the first enabled option at each step, preferring a discard. */
function playAll(p: PackHandle, s: S, prefer = /(^|:)sell$/): S {
  for (const x of p.status(s).actors) {
    const path: Step[] = [];
    for (let pr = p.choices(s, x, path); pr; pr = p.choices(s, x, path)) path.push((pr.options.find((o) => !o.disabled && prefer.test(o.id)) ?? pr.options.find((o) => !o.disabled)!).id);
    s = p.apply(s, x, path, rng(9)).state as S;
  }
  return s;
}
// The handlers take frozen copies in a room; called directly here with plain objects.
const call = <T>(f: unknown, input: object): T => (f as (x: object) => T)(input);
const player = (over: Partial<SWPlayer> = {}): SWPlayer => ({
  wonder: "Giza", side: "A", built: [], stageCosts: [], cards: [], colors: {}, coins: 0, victories: [], defeats: 0,
  hand: { items: [], seenBy: [] }, markers: { items: [], seenBy: [] }, extras: [], freeUsed: {}, ...over,
} as SWPlayer);
const stateOf = (players: { [seat: string]: SWPlayer }, over: Partial<SWState> = {}) => ({ seats: Object.keys(players), players, age: 1, ...over }) as SWState;

describe("Leaders", () => {
  it("presets 6 starting coins, drafts four leaders a seat in hidden picks, then recruits after the deal", async () => {
    const h = await room({ addons: ["leaders"] });
    const p = h.trusted;
    expect(h.options.startCoins).toBe(6);
    let s = start(p, h.options, 4);
    expect(s.run.order.slice(0, 5)).toEqual([`${L}:draft1`, `${L}:draft2`, `${L}:draft3`, "deal", `${L}:recruit`]);
    const v = (x: string) => (p.view(s, x) as SWView & { addons: { [id: string]: { draft: string[]; hand: string[]; draftSizes: { [x: string]: number } } } }).addons[L]!;
    expect(v("red").draft).toHaveLength(4);
    expect(v("red").draftSizes).toEqual({ blue: 4, green: 4, red: 4, yellow: 4 });
    expect(v("blue").draft).not.toEqual(v("red").draft);
    expect(JSON.stringify(p.view(s, "blue"))).not.toContain(JSON.stringify(v("red").draft));
    for (let k = 0; k < 3; k++) s = playAll(p, s);
    expect(v("red").hand).toHaveLength(4);
    expect(v("red").draft).toEqual([]);
    expect(s.run.order[s.run.at]).toBe(`${L}:recruit`);
    expect(s.players.red!.hand.items).toHaveLength(7);
    // Everyone recruits its first leader it can afford.
    const coins = s.players.red!.coins;
    s = playAll(p, s, /^recruit$/);
    expect(s.players.red!.extras).toHaveLength(1);
    expect(s.players.red!.coins).toBeLessThanOrEqual(coins);
    expect(v("red").hand).toHaveLength(3);
    expect(s.run.order[s.run.at]).toBe("turn1");
  });

  it("gives Tomyris's defeat to the winner and Nero 2 coins a victory token", () => {
    const ext = (name: string, k: `${string}:${string}`): SWExtra => ({ from: "leaders", name, cost: 1, eff: [{ k }], off: null });
    const s = stateOf({ a: player({ extras: [ext("Nero", "leaders:nero")] }), b: player({ extras: [ext("Tomyris", "leaders:tomyris")] }) });
    const c: SWConflict = { a: "a", b: "b", winner: "a", value: 3, tokens: 2, defeatTo: "b", bonus: {} };
    const [r] = call<SWConflict[]>(leaders.contributes!.conflicts, { value: [c], state: s, slice: null });
    expect(r).toMatchObject({ defeatTo: "a", bonus: { a: 4 } });
  });

  it("scores Plato, Justinian, Alexander and the Diplomats' Guild", () => {
    const ext = (name: string, what: string): SWExtra => ({ from: "leaders", name, cost: 1, eff: [{ k: "leaders:vp", what }], off: null });
    const colors = { brown: 2, grey: 1, blue: 2, yellow: 1, green: 3, red: 2, purple: 1 };
    const s = stateOf({ a: player({ colors, victories: [1, 3], extras: [ext("Plato", "plato"), ext("Justinian", "justinian"), ext("Alexander", "victories")] }), b: player({ extras: [ext("X", "coins3"), ext("Y", "coins3")] }), c: player() });
    const city = { a: [{ key: "Diplomats Guild@3", color: "purple", eff: [{ k: "leaders:perNbrLeader", n: 1 }] }], b: [], c: [] };
    const out = call<{ [x: string]: SWLine[] }>(leaders.contributes!.score, { state: s, slice: null, args: { effects: {}, city, markers: {} } });
    expect(out.a).toEqual([{ cat: "leaders", vp: 7 }, { cat: "leaders", vp: 6 }, { cat: "leaders", vp: 2 }, { cat: "guilds", vp: 2 }]);
  });

  it("freezes the passing of hands for Esteban's turn only", () => {
    const passes = (frozen: Json, turn: number) => call<boolean>(leaders.contributes!.passes, { value: true, state: { age: 2 }, args: { turn }, slice: { frozen } });
    expect(passes({ age: 2, turn: 3 }, 3)).toBe(false);
    expect(passes({ age: 2, turn: 3 }, 4)).toBe(true);
    expect(passes({ age: 1, turn: 3 }, 3)).toBe(true);
  });
});

describe("Cities", () => {
  it("seats eight, with a black card a seat and age (seven at eight seats), and 9 guilds", async () => {
    const h = await room({ addons: ["cities"] });
    const s = start(h.trusted, h.options, 8);
    expect(s.seats.reduce((t, x) => t + s.players[x]!.hand.items.length, 0)).toBe(56);
    expect(s.decks.map((d) => d.items.length)).toEqual([0, 56, 56]);
    const black = new Set(CITIES_CARDS.filter((c) => c.color === "black").map((c) => c.id));
    const dealt = s.seats.flatMap((x) => s.players[x]!.hand.items);
    expect([dealt, s.decks[1]!.items, s.decks[2]!.items].map((d) => d.filter((k) => black.has(k)).length)).toEqual([7, 7, 7]);
    const purple = new Set([...BASE_CARDS, ...CITIES_CARDS].filter((c) => c.color === "purple").map((c) => c.id));
    expect(s.decks[2]!.items.filter((k) => purple.has(k))).toHaveLength(9);
  });

  it("asks a seat that must lose coins how many it pays, and turns the rest into debt points", async () => {
    const h = await room({ addons: ["cities"] });
    const p = h.trusted;
    let s = start(p, h.options, 4);
    while (s.run.order[s.run.at] !== "turn1") s = playAll(p, s);
    s = { ...s, losses: { blue: 4 } };
    s = playAll(p, s);
    expect(p.status(s).actors).toEqual(["blue"]);
    expect(s.players.blue!.coins).toBe(6);
    const pr = p.choices(s, "blue", [])!;
    expect(pr.options.map((o) => o.id)).toEqual([4, 3, 2, 1, 0].map((k) => `${C}:pay:${k}`));
    s = p.apply(s, "blue", [`${C}:pay:1`], rng(1)).state as S;
    expect(s.players.blue!.coins).toBe(5);
    expect((p.view(s, "red") as SWView & { addons: { [id: string]: { debt: { [x: string]: number } } } }).addons[C]!.debt).toEqual({ blue: 3 });
    expect(s.run.order[s.run.at]).toBe("turn2");
  });
});

describe("Wonder Pack", () => {
  it("deals Abu Simbel only with the Leaders add-on in the room", async () => {
    const wonders = async (addons: ("leaders" | "wonder-pack")[]) => {
      const h = await room({ addons });
      const seen = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) { const s = start(h.trusted, h.options, 7, seed); for (const x of s.seats) seen.add(s.players[x]!.wonder); }
      return seen;
    };
    const alone = await wonders(["wonder-pack"]);
    expect(alone.has("Abu Simbel")).toBe(false);
    expect(alone.has("Great Wall") && alone.has("Stonehenge") && alone.has("Manneken Pis")).toBe(true);
    expect((await wonders(["leaders", "wonder-pack"])).has("Abu Simbel")).toBe(true);
  });

  it("keeps the Great Wall B out of its age's conflicts and costs the others 2 coins", () => {
    const s = stateOf({ a: player(), b: player(), c: player() }, { age: 2 });
    const built = call<{ slice: Json; ops: SWOp[] }>(wonderPack.contributes!.onBuild, { state: s, slice: null, args: { seat: "a", effs: [{ k: "wp:wallSkip" }], city: [], item: { type: "stage" } } });
    expect(built.ops).toEqual([{ op: "loss", seat: "b", n: 2 }, { op: "loss", seat: "c", n: 2 }]);
    const end = call<{ slice: Json }>(wonderPack.contributes!.ageEnd, { state: s, slice: built.slice });
    expect(call<string[]>(wonderPack.contributes!.conflictSeats, { value: ["a", "b", "c"], slice: end.slice })).toEqual(["b", "c"]);
    expect(call<{ slice: Json }>(wonderPack.contributes!.ageEnd, { state: { ...s, age: 3 }, slice: built.slice }).slice).toMatchObject({ absent: [] });
  });

  it("scores Stonehenge's stones and turned-up card, and entombed leaders at twice their cost", () => {
    const stone = { key: "Stone Pit@1", color: "brown", eff: [{ k: "prod", any: "S", trade: true }] };
    const mixed = { key: "Excavation@1", color: "brown", eff: [{ k: "prod", any: "SC", trade: true }] };
    const s = stateOf({
      a: player({ wonder: "Stonehenge", side: "B", built: [0, 1], extras: [{ from: "leaders", name: "Nero", cost: 3, eff: [], off: "entomb" }] }),
      b: player({ colors: { blue: 2 } }), c: player({ colors: { blue: 1, red: 4 } }),
    });
    const out = call<{ [x: string]: SWLine[] }>(wonderPack.contributes!.score, {
      state: s, slice: null, args: { effects: { a: [{ k: "wp:stoneVP", n: 1 }], b: [], c: [] }, city: { a: [stone, mixed], b: [], c: [] }, markers: { a: ["red", "blue"], b: [], c: [] } },
    });
    expect(out.a).toEqual([{ cat: "wonder", vp: 2 }, { cat: "wonder", vp: 3 }, { cat: "wonder", vp: 6 }]);
  });
});
