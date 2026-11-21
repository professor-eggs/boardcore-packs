// Rules of the three expansions as options: through the built pack (trusted adapter) where a game shows them, and
// their modules' functions called directly where a situation is rare in random play. Then the option rules: every
// mix of the expansions, what each switches on, and the combinations and seat counts `setup` refuses.
import { describe, expect, it } from "vitest";
import { zoneReader, type Json, type PhaseCtx, type QuestionInput, type Rng, type Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { BASE_CARDS } from "../src/data";
import { askPending } from "../src/engine";
import { cities } from "../src/expansions/cities";
import { CITIES_CARDS } from "../src/expansions/cities-data";
import { leaders, leaderText, recruitPhase } from "../src/expansions/leaders";
import { LEADERS } from "../src/expansions/leaders-data";
import { wonderPack } from "../src/expansions/wonder-pack";
import { PHASES } from "../src/index";
import { makeLib, type Build } from "../src/kernel";
import { EXPANSIONS, MIXES, label, room, seats, type Room } from "./rooms";

type S = SWState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
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
const phase = (s: S) => s.run.order[s.run.at];
const player = (over: Partial<SWPlayer> = {}): SWPlayer => ({
  wonder: "Giza", side: "A", built: [], stageCosts: [], cards: [], colors: {}, coins: 0, victories: [], defeats: 0,
  hand: { zone: "hidden", items: [], seenBy: [] }, markers: { zone: "hidden", items: [], seenBy: [] }, extras: [], freeUsed: {}, ...over,
} as SWPlayer);
/** A state for a module's function called directly: the named players, nothing pending, an empty question queue. */
const stateOf = (players: { [seat: string]: SWPlayer }, over: Partial<SWState> = {}) => ({
  seats: Object.keys(players), sets: ["base"], players, age: 1, turn: 0, decks: [], discard: { zone: "hidden", items: [], seenBy: [] },
  pending: [], losses: {}, gained: {}, bought: [], partner: {}, log: [], run: { questions: [] }, ...over,
}) as unknown as SWState;
const leader = (name: string, k: `${string}:${string}`, cost = 1): SWExtra => ({ from: "leaders", name, cost, eff: [{ k }], off: null });
/** A phase handler's context that records the questions asked. */
function asking(): { ctx: PhaseCtx; asked: QuestionInput[] } {
  const asked: QuestionInput[] = [];
  return { asked, ctx: { rng: rng(1), zones: zoneReader(""), round: 1, ask: (q) => { asked.push(q); }, stay: () => {} } };
}
const build = (seat: string, effs: SWEff[], over: Partial<Build> = {}): Build =>
  ({ seat, effs, city: [], item: { type: "stage", name: "stage", age: 1, color: "wonder", free: null }, ...over });

describe("Leaders", () => {
  it("starts every city with 6 coins, drafts four leaders a seat in hidden picks, then recruits before the deal", async () => {
    const h = await room({ leaders: true });
    const p = h.trusted;
    let s = start(p, h.options, 4);
    expect(s.seats.map((x) => s.players[x]!.coins)).toEqual([6, 6, 6, 6]);
    expect(s.run.order.slice(0, 5)).toEqual(["draft1", "draft2", "draft3", "recruit", "deal"]);
    const v = (x: string) => (p.view(s, x) as SWView).leaders!;
    expect(v("red").draft).toHaveLength(4);
    expect(v("red").draftSizes).toEqual({ blue: 4, green: 4, red: 4, yellow: 4 });
    expect(v("blue").draft).not.toEqual(v("red").draft);
    expect(JSON.stringify(p.view(s, "blue"))).not.toContain(JSON.stringify(v("red").draft));
    for (let k = 0; k < 3; k++) s = playAll(p, s);
    expect(v("red").hand).toHaveLength(4);
    expect(v("red").draft).toEqual([]);
    expect(phase(s)).toBe("recruit");
    // Recruitment comes before the age's cards are dealt: nobody sees its age hand yet (PR #118 review).
    expect(s.players.red!.hand.items).toHaveLength(0);
    expect(p.choices(s, "red", [])!.label).toBe("Recruitment for Age I: choose a leader");
    // Everyone recruits its first leader it can afford.
    const coins = s.players.red!.coins;
    s = playAll(p, s, /^recruit$/);
    expect(s.players.red!.extras).toHaveLength(1);
    expect(s.players.red!.coins).toBeLessThanOrEqual(coins);
    expect(v("red").hand).toHaveLength(3);
    expect(s.players.red!.hand.items).toHaveLength(7);
    expect(phase(s)).toBe("turn1");
  });

  it("recruits each later age before its deal too, and puts the leftover leader out before Age III", async () => {
    const h = await room({ leaders: true });
    const p = h.trusted;
    let s = start(p, h.options, 3);
    for (let i = 0; i < 400 && !(s.run.round === 3 && phase(s) === "recruit"); i++) s = playAll(p, s);
    expect(s.run.round).toBe(3);
    expect(s.run.order.indexOf("recruit")).toBeLessThan(s.run.order.indexOf("deal"));
    expect(s.seats.every((x) => s.players[x]!.hand.items.length === 0)).toBe(true);
    expect(p.choices(s, "red", [])!.label).toBe("Recruitment for Age III: choose a leader");
    expect(p.textState(p.view(s, "red"))).toMatch(/^Before Age III\./);
    s = playAll(p, s);
    expect(s.seats.every((x) => s.leaders!.hands[x]!.length === 0)).toBe(true);
    expect(s.age).toBe(3);
    expect(s.seats.every((x) => s.players[x]!.hand.items.length === 7)).toBe(true);
  });

  it("the draft is over after Age I: nobody is asked to draft in Ages II and III", async () => {
    const h = await room({ leaders: true });
    const p = h.trusted;
    let s = start(p, h.options, 3);
    const seen = new Set<string>();
    for (let i = 0; i < 400 && !p.status(s).outcome; i++) { if (s.run.round > 1) seen.add(phase(s)!); s = playAll(p, s); }
    expect(p.status(s).outcome).toBeTruthy();
    expect([...seen].filter((x) => x.startsWith("draft"))).toEqual([]);
    expect(seen.has("recruit")).toBe(true);
  });

  it("pays Hatshepsut for a neighbour bought from while building a stage with a leader in a recruitment", () => {
    const lib = makeLib([leaders]);
    const hat = { from: "leaders", name: "Hatshepsut", cost: 2, eff: [{ k: "leaders:hatshepsut" }], off: null };
    const players = { red: player({ coins: 5, stageCosts: ["SS"], extras: [hat] as never }), blue: player({ coins: 0 }), green: player({ coins: 0 }) };
    const own: SWLeaders = { draft: {}, hands: { red: ["Caesar"], blue: [], green: [] }, box: [], out: { red: [], blue: [], green: [] }, used: [], frozen: null };
    const out = recruitPhase(lib).resolve!(stateOf(players, { age: 0, sets: lib.sets, leaders: own }), { red: ["l:Caesar", "wonder", "pay:1,1,0"] }, asking().ctx);
    // 5 coins, 1 to each neighbour, then Hatshepsut's coin for each of the two neighbours bought from.
    expect([out.players.red!.coins, out.players.blue!.coins, out.players.green!.coins]).toEqual([5, 1, 1]);
    expect(out.players.red!.built).toEqual([0]);
    expect(out.players.red!.markers.items).toEqual(["leader"]);
    expect(out.leaders!.out.red).toEqual(["Caesar"]);
  });

  it("describes a draft pick to its picker by the leader's name, others see only that a seat chose", async () => {
    const h = await room({ leaders: true });
    const p = h.trusted;
    const s = start(p, h.options, 3);
    const pr = p.choices(s, "red", [])!;
    const first = pr.options.find((o) => !o.disabled)!.id;
    expect(first.startsWith("l:")).toBe(true);
    expect(p.describe(s, "red", [first], "red")).toBe(`You choose ${first.slice(2)}.`);
    expect(p.describe(s, "red", [first], "blue")).toBe("red has chosen.");
  });

  it("gives Tomyris's defeat to the winner and Nero 2 coins a victory token", () => {
    const s = stateOf({ a: player({ extras: [leader("Nero", "leaders:nero")] }), b: player({ extras: [leader("Tomyris", "leaders:tomyris")] }) });
    const c: SWConflict = { a: "a", b: "b", winner: "a", value: 3, tokens: 2, defeatTo: "b", bonus: {} };
    const [r] = leaders.conflicts!(s, [c]);
    expect(r).toMatchObject({ defeatTo: "a", bonus: { a: 4 } });
  });

  it("scores Plato, Justinian, Alexander and the Diplomats' Guild", () => {
    const ext = (name: string, what: string): SWExtra => ({ from: "leaders", name, cost: 1, eff: [{ k: "leaders:vp", what }], off: null });
    const colors = { brown: 2, grey: 1, blue: 2, yellow: 1, green: 3, red: 2, purple: 1 };
    const s = stateOf({ a: player({ colors, victories: [1, 3], extras: [ext("Plato", "plato"), ext("Justinian", "justinian"), ext("Alexander", "victories")] }), b: player({ extras: [ext("X", "coins3"), ext("Y", "coins3")] }), c: player() });
    const city = { a: [{ key: "Diplomats Guild@3", color: "purple", eff: [{ k: "leaders:perNbrLeader", n: 1 }] as SWEff[] }], b: [], c: [] };
    const out = leaders.score!(s, { effects: {}, city, markers: {} });
    expect(out.a).toEqual([{ cat: "leaders", vp: 7 }, { cat: "leaders", vp: 6 }, { cat: "leaders", vp: 2 }, { cat: "guilds", vp: 2 }]);
  });

  it("freezes the passing of hands for Esteban's turn only", () => {
    const passes = (frozen: SWLeaders["frozen"], turn: number) => leaders.passes!(stateOf({}, { age: 2, leaders: { draft: {}, hands: {}, box: [], out: {}, used: [], frozen } }), turn);
    expect(passes({ age: 2, turn: 3 }, 3)).toBe(false);
    expect(passes({ age: 2, turn: 3 }, 4)).toBe(true);
    expect(passes({ age: 1, turn: 3 }, 3)).toBe(true);
    expect(passes(null, 3)).toBe(true);
  });

  it("deals the promo leaders only with the promo option, and the Cities leaders only with Cities", async () => {
    const pool = async (r: Room, n: number) => {
      const h = await room(r);
      const sl = start(h.trusted, h.options, n).leaders!;
      return [...Object.values(sl.draft).flat(), ...sl.box];
    };
    const of = (set: string) => LEADERS.filter((l) => l.set === set).map((l) => l.name);
    const alone = await pool({ leaders: true }, 3);
    expect(alone.sort()).toEqual(of("leaders").sort());
    expect((await pool({ leaders: true, leaderPromos: true }, 3)).sort()).toEqual([...of("leaders"), ...of("promo")].sort());
    expect((await pool({ leaders: true, cities: true }, 8)).sort()).toEqual([...of("leaders"), ...of("cities")].sort());
  });
});

describe("Leaders: the words on a leader's card", () => {
  // Phone play (2026-11-17) showed "Nero (1 coins): nero": an effect's code name and a wrong plural.
  it("says every leader's effect in words, never an effect kind's name, and counts coins right", () => {
    for (const l of LEADERS) {
      const t = leaderText(l.name);
      expect(t, t).not.toMatch(/: [a-z]+(;|$)|; [a-z]+(;|$)/);
      expect(t, t).not.toMatch(/\b1 coins\b/);
      expect(t, t).not.toMatch(/[a-z]+:[a-z]/);
    }
  });
});

describe("Cities", () => {
  it("seats eight, with a black card a seat and age (seven at eight seats), and 9 guilds", async () => {
    const h = await room({ cities: true });
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
    const h = await room({ cities: true });
    const p = h.trusted;
    let s = start(p, h.options, 4);
    expect(phase(s)).toBe("turn1");
    s = { ...s, losses: { blue: 4 } };
    s = playAll(p, s);
    // The question is asked before the end of the turn: the hands haven't passed yet.
    expect(phase(s)).toBe("debt1");
    expect(p.status(s).actors).toEqual(["blue"]);
    expect((p.view(s, "red") as SWView).run.asked).toEqual({ seat: "blue", kind: "debt" });
    expect(s.players.blue!.coins).toBe(6);
    const pr = p.choices(s, "blue", [])!;
    expect(pr.options.map((o) => o.id)).toEqual([4, 3, 2, 1, 0].map((k) => `pay:${k}`));
    expect(pr.default).toEqual(["pay:0"]);
    s = p.apply(s, "blue", ["pay:1"], rng(1)).state as S;
    expect(p.describe(s, "blue", ["pay:1"], "red")).toBe("blue pays 1 and takes 3 debt.");
    expect(s.players.blue!.coins).toBe(5);
    expect((p.view(s, "red") as SWView).cities!.debt).toEqual({ blue: 3 });
    expect(p.textState(p.view(s, "red"))).toMatch(/\nDebt: blue 3\. Diplomacy tokens: none\.$/);
    expect(phase(s)).toBe("turn2");
  });

  it("gives a seat with no coins its whole loss as debt, without a question", () => {
    const s = stateOf({ a: player({ coins: 0 }), b: player({ coins: 2 }), c: player({ coins: 9 }) }, { losses: { a: 3, b: 3 }, cities: { debt: { a: 1 }, diplomacy: {}, absent: [], spent: [] } });
    const { ctx, asked } = asking();
    const out = cities.losses!(s, ctx);
    expect(out.cities!.debt).toEqual({ a: 4 });
    expect(out.losses).toEqual({});
    expect(out.log).toEqual(["a takes 3 debt."]);
    expect(asked).toEqual([{ kind: "debt", seat: "b", args: { n: 3 }, default: ["pay:0"] }]);
    expect(cities.score!(out, { effects: {}, city: {}, markers: {} }).a).toEqual([{ cat: "debt", vp: -4 }]);
  });

  it("raises the losses of a card for every other seat, a diplomacy token, and Diocletian's coins for a black card", () => {
    const lib = makeLib([cities]);
    const dio: SWExtra = leader("Diocletian", "cities:diocletian");
    const s = stateOf({ a: player({ extras: [dio] }), b: player({ victories: [1, 3] }), c: player({ built: [0] }) }, { cities: { debt: {}, diplomacy: {}, absent: [], spent: [] } });
    const item: SWItem = { type: "card", name: "Sepulcher", age: 2, color: "black", free: null };
    const out = cities.onBuild!(lib, s, build("a", [{ k: "cities:loss", n: 2 }, { k: "cities:lossPer", n: 1, what: "victories" }, { k: "cities:diplomacy" }], { item }));
    expect(out.losses).toEqual({ b: 4, c: 2 });
    expect(out.cities!.diplomacy).toEqual({ a: 1 });
    expect(out.players.a!.coins).toBe(2);
  });

  it("keeps a diplomacy seat out of an age's conflicts; in team play it fights for one fewer token", () => {
    const own: SWCities = { debt: {}, diplomacy: { a: 2 }, absent: [], spent: [] };
    const solo = cities.ageEnd!(stateOf({ a: player(), b: player(), c: player() }, { cities: own }));
    expect(solo.cities).toMatchObject({ diplomacy: { a: 1 }, absent: ["a"], spent: ["a"] });
    expect(cities.conflictSeats!(solo, ["a", "b", "c"])).toEqual(["b", "c"]);
    const team = cities.ageEnd!(stateOf({ a: player(), b: player(), c: player(), d: player() }, { cities: own, partner: { a: "b", b: "a", c: "d", d: "c" } }));
    expect(team.cities).toMatchObject({ absent: [], spent: ["a"] });
    const fight = (a: string, b: string, tokens: number): SWConflict => ({ a, b, winner: a, value: 1, tokens, defeatTo: b, bonus: {} });
    expect(cities.conflicts!(team, [fight("a", "b", 0), fight("d", "a", 2), fight("b", "c", 2)]).map((c) => c.tokens)).toEqual([0, 1, 2]);
  });

  it("pays Berenice for the coins a seat took this turn, read before any other end-of-turn coin", () => {
    const ber = leader("Berenice", "cities:berenice"), hat = leader("Hatshepsut", "leaders:hatshepsut");
    // a took coins this turn; b only bought from a neighbour (Hatshepsut's coin comes at the end of the turn too).
    const s = stateOf({ a: player({ extras: [ber] }), b: player({ extras: [ber, hat] }) }, { gained: { a: 3 }, bought: ["b>L"] });
    expect(cities.endTurn!(s, 1)).toEqual([{ seat: "a", n: 1 }]);
    expect(leaders.endTurn!(s, 1)).toEqual([{ seat: "b", n: 1 }]);
  });
});

describe("Wonder Pack", () => {
  it("deals Abu Simbel only with Leaders on too", async () => {
    const wonders = async (r: Room) => {
      const h = await room(r);
      const seen = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) { const s = start(h.trusted, h.options, 7, seed); for (const x of s.seats) seen.add(s.players[x]!.wonder); }
      return seen;
    };
    const alone = await wonders({ wonderPack: true });
    expect(alone.has("Abu Simbel")).toBe(false);
    expect(alone.has("Great Wall") && alone.has("Stonehenge") && alone.has("Manneken Pis")).toBe(true);
    expect((await wonders({ leaders: true, wonderPack: true })).has("Abu Simbel")).toBe(true);
  });

  it("keeps the Great Wall B out of its age's conflicts and costs the others 2 coins", () => {
    const lib = makeLib([wonderPack]);
    const s = stateOf({ a: player(), b: player(), c: player() }, { age: 2, wonderPack: { skip: {}, absent: [] } });
    const built = wonderPack.onBuild!(lib, s, build("a", [{ k: "wp:wallSkip" }]));
    expect(built.losses).toEqual({ b: 2, c: 2 });
    const end = wonderPack.ageEnd!(built);
    expect(wonderPack.conflictSeats!(end, ["a", "b", "c"])).toEqual(["b", "c"]);
    expect(wonderPack.ageEnd!({ ...built, age: 3 }).wonderPack).toMatchObject({ absent: [] });
  });

  it("scores Stonehenge's stones and turned-up card, and entombed leaders at twice their cost", () => {
    const stone = { key: "Stone Pit@1", color: "brown", eff: [{ k: "prod", any: "S", trade: true }] as SWEff[] };
    const mixed = { key: "Excavation@1", color: "brown", eff: [{ k: "prod", any: "SC", trade: true }] as SWEff[] };
    const s = stateOf({
      a: player({ wonder: "Stonehenge", side: "B", built: [0, 1], extras: [{ from: "leaders", name: "Nero", cost: 3, eff: [], off: "entomb" }] }),
      b: player({ colors: { blue: 2 } }), c: player({ colors: { blue: 1, red: 4 } }),
    });
    const out = wonderPack.score!(s, { effects: { a: [{ k: "wp:stoneVP", n: 1 }], b: [], c: [] }, city: { a: [stone, mixed], b: [], c: [] }, markers: { a: ["red", "blue"], b: [], c: [] } });
    expect(out.a).toEqual([{ cat: "wonder", vp: 2 }, { cat: "wonder", vp: 3 }, { cat: "wonder", vp: 6 }]);
  });

  it("asks an entombing seat which of its leaders in play, and scores the one it entombs", () => {
    const lib = makeLib([leaders, wonderPack]);
    const nero = leader("Nero", "leaders:nero", 1), caesar = leader("Caesar", "leaders:x", 5);
    const copy: SWExtra = { ...leader("Midas (copy)", "leaders:vp"), from: "leaders:copy" };
    let s = stateOf({ a: player({ extras: [copy, nero, caesar] }), b: player(), c: player() }, { sets: lib.sets, wonderPack: { skip: {}, absent: [] } });
    s = wonderPack.onBuild!(lib, s, build("a", [{ k: "wp:entomb" }]));
    s = wonderPack.onBuild!(lib, s, build("b", [{ k: "wp:entomb" }]));
    expect(s.pending).toEqual([{ seat: "a", kind: "entomb" }, { seat: "b", kind: "entomb" }]);
    const { ctx, asked } = asking();
    s = askPending(lib, s, ctx);
    // b has no leader in play: nothing to entomb, no question. A copied leader isn't one of a's leaders.
    expect(asked).toEqual([{ kind: "entomb", seat: "a", default: ["e:Nero"] }]);
    expect(s.pending).toEqual([]);
    const q = wonderPack.questions!(lib).entomb!;
    const question = { kind: "entomb", seat: "a", args: null, default: ["e:Nero"] };
    expect(q.choices(s, question, [])!.options.map((o) => o.id)).toEqual(["e:Nero", "e:Caesar"]);
    s = q.answer(s, question, ["e:Caesar"], ctx);
    expect(s.players.a!.extras.map((x) => x.off)).toEqual([null, null, "entomb"]);
    expect(wonderPack.score!(s, { effects: {}, city: {}, markers: {} }).a).toEqual([{ cat: "wonder", vp: 10 }]);
  });
});

describe("Questions a build raises (the expansions' and the base's, one queue)", () => {
  const all = makeLib([leaders, cities, wonderPack]);
  const base = (over: Partial<SWState> = {}) => stateOf(
    { a: player({ extras: [leader("Nero", "leaders:nero")] }), b: player({ extras: [leader("Caesar", "leaders:x")] }), c: player() },
    { sets: all.sets, leaders: { draft: {}, hands: { a: [], b: ["Sappho"], c: [] }, box: [], out: {}, used: [], frozen: null }, ...over },
  );

  it("asks the discard-pile builds first, then copies, extra leaders and entombings, whatever the order they were raised in", () => {
    const pending = [{ seat: "a", kind: "entomb" }, { seat: "b", kind: "extra" }, { seat: "c", kind: "copy" }, { seat: "a", kind: "discardBuild" }, { seat: "a", kind: "copy" }];
    const { ctx, asked } = asking();
    const out = askPending(all, base({ pending }), ctx);
    expect(asked.map((q) => `${q.kind} ${q.seat}`)).toEqual(["discardBuild a", "copy c", "copy a", "extra b", "entomb a"]);
    // The copy's default is the first leader next door, the left neighbour's first.
    expect(asked[1]).toEqual({ kind: "copy", seat: "c", default: ["c:b:Caesar"] });
    expect(asked[2]).toEqual({ kind: "copy", seat: "a", default: ["c:b:Caesar"] });
    expect(out.pending).toEqual([]);
    // The seat asked about the discard pile looks through it while asked.
    expect(out.discard.seenBy).toEqual(["a"]);
  });

  it("asks nothing for a copy with no leader next door, or an extra leader with an empty hand", () => {
    const { ctx, asked } = asking();
    const out = askPending(all, base({ pending: [{ seat: "b", kind: "copy" }, { seat: "a", kind: "extra" }] }), ctx);
    // b's neighbours are a (Nero) and c: a copy. a holds no leader: no extra.
    expect(asked.map((q) => `${q.kind} ${q.seat}`)).toEqual(["copy b"]);
    expect(out.pending).toEqual([]);
  });

  it("inside an answer, keeps a copy pending while an entombing is queued (its default could be entombed), and asks it at the next phase", () => {
    const queued = { run: { questions: [{ kind: "entomb", seat: "b", args: null, default: ["e:Caesar"] }] } } as unknown as Partial<SWState>;
    const pending = [{ seat: "a", kind: "copy" }, { seat: "a", kind: "discardBuild" }];
    const first = asking();
    const waiting = askPending(all, base({ pending, ...queued }), first.ctx, true);
    expect(first.asked.map((q) => q.kind)).toEqual(["discardBuild"]);
    expect(waiting.pending).toEqual([{ seat: "a", kind: "copy" }]);
    // With no entombing queued the answer asks it at once.
    const second = asking();
    expect(askPending(all, base({ pending }), second.ctx, true).pending).toEqual([]);
    expect(second.asked.map((q) => q.kind)).toEqual(["discardBuild", "copy"]);
    // And a phase's own ask (the queue is empty then) takes what waited.
    const third = asking();
    expect(askPending(all, { ...waiting, run: { questions: [] } } as unknown as SWState, third.ctx).pending).toEqual([]);
    expect(third.asked.map((q) => q.kind)).toEqual(["copy"]);
  });

  it("asks what a recruitment raises before the deal: Solomon's discard-pile build", async () => {
    const h = await room({ leaders: true });
    const p = h.trusted;
    let s = start(p, h.options, 3);
    for (let k = 0; k < 3; k++) s = playAll(p, s);
    expect(phase(s)).toBe("recruit");
    s = { ...s, leaders: { ...s.leaders!, hands: { ...s.leaders!.hands, red: ["Solomon", ...s.leaders!.hands.red!.slice(1)] } } };
    s = p.apply(s, "red", ["l:Solomon", "recruit"], rng(9)).state as S;
    s = playAll(p, s);
    expect(s.players.red!.extras.map((x) => x.name)).toEqual(["Solomon"]);
    expect((p.view(s, "blue") as SWView).run.asked).toEqual({ seat: "red", kind: "discardBuild" });
    expect(p.status(s).actors).toEqual(["red"]);
    // Nothing is dealt until red has answered.
    expect(phase(s)).toBe("recruit");
    expect(s.seats.every((x) => s.players[x]!.hand.items.length === 0)).toBe(true);
    s = p.apply(s, "red", ["skip"], rng(9)).state as S;
    expect(phase(s)).toBe("turn1");
    expect(s.seats.every((x) => s.players[x]!.hand.items.length === 7)).toBe(true);
  });

  it("asks Roma's extra leader when the turn resolves, and what that leader raises at once, before the hands pass", async () => {
    const h = await room({ leaders: true });
    const p = h.trusted;
    let s = start(p, h.options, 3);
    while (phase(s) !== "turn1") s = playAll(p, s);
    const hand = s.players.blue!.hand.items.slice();
    s = { ...s, pending: [{ seat: "red", kind: "extra" }], leaders: { ...s.leaders!, hands: { ...s.leaders!.hands, red: ["Solomon"] } }, players: { ...s.players, red: { ...s.players.red!, coins: 9 } } };
    s = playAll(p, s);
    expect((p.view(s, "blue") as SWView).run.asked).toEqual({ seat: "red", kind: "extra" });
    expect(p.choices(s, "red", [])!.default).toEqual(["skip"]);
    const coins = s.players.red!.coins;
    s = p.apply(s, "red", ["l:Solomon"], rng(9)).state as S;
    expect(p.describe(s, "red", ["l:Solomon"], "blue")).toBe("red recruits Solomon (Roma).");
    expect(s.players.red!.coins).toBe(coins - 3);
    expect(s.leaders!.hands.red).toEqual([]);
    expect((p.view(s, "blue") as SWView).run.asked).toEqual({ seat: "red", kind: "discardBuild" });
    // Still the same turn: the hands pass only once the queue is empty.
    expect(phase(s)).toBe("turn1");
    expect(s.players.blue!.hand.items).toEqual(hand.slice(1));
    // red looks through the discard pile (three cards sold this turn) and builds one.
    const pr = p.choices(s, "red", [])!;
    expect(pr.options.filter((o) => o.id !== "skip").length).toBeGreaterThan(0);
    s = p.apply(s, "red", [pr.options[0]!.id], rng(9)).state as S;
    expect(s.players.red!.cards).toHaveLength(1);
    expect(phase(s)).toBe("turn2");
  });

  it("asks a loss a recruitment raised before the first turn, with Cities", async () => {
    const h = await room({ leaders: true, cities: true });
    const p = h.trusted;
    let s = start(p, h.options, 3);
    for (let k = 0; k < 3; k++) s = playAll(p, s);
    expect(phase(s)).toBe("recruit");
    s = playAll(p, { ...s, losses: { blue: 2 } });
    expect(phase(s)).toBe("ready");
    expect((p.view(s, "red") as SWView).run.asked).toEqual({ seat: "blue", kind: "debt" });
    s = playAll(p, s);
    expect(phase(s)).toBe("turn1");
    expect(s.losses).toEqual({});
  });
});

describe("Option rules", () => {
  const names = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink", "white"];
  const tryStart = (p: PackHandle, options: { [k: string]: Json }, n: number) => () => p.setup({ options, seats: names.slice(0, n).map((seat) => ({ seat, team: null })), rng: rng(1) });

  it("plays every mix of the three expansions: its sets, its phases, its own state and its starting coins", async () => {
    for (const r of MIXES) {
      const h = await room(r);
      const s = start(h.trusted, h.options, 4);
      const on = EXPANSIONS.filter((x) => r[x] === true);
      expect(s.sets, label(r, 4)).toEqual(["base", ...on]);
      expect(EXPANSIONS.filter((x) => s[x] !== undefined), label(r, 4)).toEqual(on);
      const order = PHASES.flatMap((id) => {
        const n = /^(turn|end)(\d)$/.exec(id);
        if (id === "deal" && r.leaders) return ["draft1", "draft2", "draft3", "recruit", id];
        if (n?.[1] === "turn" && r.leaders) return [`freeze${n[2]}`, id];
        if (n?.[1] === "end" && r.cities) return [`debt${n[2]}`, id];
        if (id === "war" && r.cities) return ["debtWar", id];
        return [id];
      });
      expect(s.run.order, label(r, 4)).toEqual(order);
      const coins = r.leaders ? 6 : 3;
      for (const x of s.seats) expect(s.players[x]!.coins - (s.players[x]!.wonder === "Manneken Pis" ? 4 : 0), label(r, 4)).toBe(coins);
      const v = h.trusted.view(s, "red") as SWView;
      expect([v.leaders !== undefined, v.cities !== undefined], label(r, 4)).toEqual([r.leaders === true, r.cities === true]);
      expect(h.trusted.legend(v).split("\n"), label(r, 4)).toHaveLength(r.leaders ? 2 : 1);
    }
  });

  it("deals only the boards of the expansions switched on", async () => {
    const boards: { [x: string]: string[] } = { leaders: ["Roma"], cities: ["Petra", "Byzantium"], wonderPack: ["Great Wall", "Stonehenge", "Manneken Pis", "Abu Simbel"] };
    for (const r of MIXES) {
      const h = await room(r);
      const seen = new Set<string>();
      for (let seed = 1; seed <= 6; seed++) { const s = start(h.trusted, h.options, 7, seed); for (const x of s.seats) seen.add(s.players[x]!.wonder); }
      for (const x of EXPANSIONS) if (!r[x]) expect(boards[x]!.filter((b) => seen.has(b)), label(r, 7)).toEqual([]);
    }
  });

  it("refuses the promo leaders without Leaders", async () => {
    const h = await room();
    for (const more of [{}, { cities: true }, { wonderPack: true }, { cities: true, wonderPack: true }])
      expect(tryStart(h.trusted, { ...h.options, ...more, leaderPromos: true }, 4)).toThrow(/promo leaders need the Leaders expansion/);
    expect(tryStart(h.trusted, { ...h.options, leaders: true, leaderPromos: true }, 4)).not.toThrow();
  });

  it("refuses 8 players without Cities, whatever else is on, and takes 8 with it", async () => {
    const h = await room();
    for (const more of [{}, { leaders: true }, { wonderPack: true }, { leaders: true, wonderPack: true, leaderPromos: true }, { teamPlay: true }])
      expect(tryStart(h.trusted, { ...h.options, ...more }, 8)).toThrow(/8 players need the Cities expansion/);
    for (const more of [{}, { leaders: true }, { wonderPack: true }, { leaders: true, wonderPack: true }, { teamPlay: true }])
      expect(tryStart(h.trusted, { ...h.options, cities: true, ...more }, 8)).not.toThrow();
  });

  it("refuses fewer than 3 players and more than 8", async () => {
    const h = await room();
    for (const o of [h.options, { ...h.options, leaders: true, cities: true, wonderPack: true }]) {
      expect(tryStart(h.trusted, o, 2)).toThrow(/needs 3 to 7 players, or 8 with the Cities expansion/);
      expect(tryStart(h.trusted, o, 9)).toThrow(/needs 3 to 7 players, or 8 with the Cities expansion/);
    }
  });

  it("refuses team play at 3, 5 or 7 players, and takes it at 4, 6 and (with Cities) 8", async () => {
    const h = await room();
    for (const n of [3, 5, 7]) for (const more of [{}, { cities: true }, { leaders: true, cities: true, wonderPack: true }])
      expect(tryStart(h.trusted, { ...h.options, ...more, teamPlay: true }, n)).toThrow(/Team play needs 4, 6 or 8 players/);
    for (const n of [4, 6]) expect(tryStart(h.trusted, { ...h.options, teamPlay: true }, n)).not.toThrow();
    expect(tryStart(h.trusted, { ...h.options, cities: true, teamPlay: true }, 8)).not.toThrow();
  });

  it("refuses in the sandbox too, with the same words", async () => {
    const h = await room();
    expect(tryStart(h.sandboxed, { ...h.options, leaderPromos: true }, 4)).toThrow(/promo leaders need the Leaders expansion/);
    expect(tryStart(h.sandboxed, h.options, 8)).toThrow(/8 players need the Cities expansion/);
    expect(tryStart(h.sandboxed, { ...h.options, teamPlay: true }, 5)).toThrow(/Team play needs 4, 6 or 8 players/);
  });
});
