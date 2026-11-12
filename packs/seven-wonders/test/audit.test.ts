// Behaviour corrected or added by the rules audit (../RULES-AUDIT.md): heading, guild count, Cities
// cards, leader costs, the 8-player variant, team play, and the Leaders goodies.
import { describe, expect, it } from "@effect/vitest";
import type { Json, Rng, SeatInfo, Step } from "@boardcore/pack-sdk";
import pack from "../src/index";
import { cities } from "../src/addons/cities";
import { CARDS, LEADERS } from "../src/data";
import { makeHooks } from "../src/hooks";
import { keyName, military, perCount, POINTS, type Ctx, type State } from "../src/engine";

const rngOf = (seed: number): Rng => {
  let x = (seed * 2654435761) >>> 0 || 1;
  return { int: (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; } };
};
const SEATS = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
const seats = (n: number): SeatInfo[] => SEATS.slice(0, n).map((seat) => ({ seat, team: null }));
const start = (n: number, options: { [k: string]: Json } = {}, seed = 1) => pack.setup({ options, seats: seats(n), rng: rngOf(seed) });

/** The first enabled option at each step after a prefix, preferring to discard. */
function path(s: State, seat: string, prefix: Step[] = []): Step[] {
  const p: Step[] = [...prefix];
  for (;;) {
    const pr = pack.choices(s, seat, p);
    if (!pr) return p;
    const o = pr.options.find((x) => x.id === "sell" && !x.disabled) ?? pr.options.find((x) => !x.disabled && x.id !== "freeze")!;
    p.push(o.id);
  }
}
const playAll = (s: State, r: Rng, first?: { seat: string; prefix: Step[] }) => {
  if (first) s = pack.apply(s, first.seat, path(s, first.seat, first.prefix), r).state;
  for (const x of pack.status(s).actors) s = pack.apply(s, x, path(s, x), r).state;
  return s;
};
const header = (s: State) => pack.text.layout!(pack.view(s, "spectator")).split("\n")[0];

describe("audit: heading", () => {
  it("names the leader draft, recruitment and the turn", () => {
    const r = rngOf(3);
    let s = start(3, { leaders: true });
    expect(header(s)).toBe("Leader draft, pick 1 of 4");
    s = playAll(s, r);
    expect(header(s)).toBe("Leader draft, pick 2 of 4");
    while (s.phase === "draft") s = playAll(s, r);
    expect(header(s)).toBe("Age I: leader recruitment");
    s = playAll(s, r);
    expect(header(s)).toBe("Age I, turn 1");
    expect(pack.text.state(pack.view(s, "red"))).toMatch(/^Age I, turn 1\./);
  });
});

describe("audit: setup", () => {
  it("uses players + 2 guilds, and 9 at 8 players (set up like 7)", () => {
    expect(start(5, { cities: true }).decks[2]!.filter((k) => CARDS.find((c) => c.name === keyName(k))!.color === "purple")).toHaveLength(7);
    const s8 = start(8, { cities: true });
    expect(s8.decks[2]!.filter((k) => CARDS.find((c) => c.name === keyName(k))!.color === "purple")).toHaveLength(9);
    expect(s8.decks[2]!.length % 8).toBe(0);
    for (const x of s8.seats) expect(s8.players[x]!.hand).toHaveLength(7);
  });
  it("the Leaders goodies need Leaders", () => {
    expect(() => start(3, { leaderPromos: true })).toThrow(/leaders/);
    const pool = (s: State) => [...s.leaderBox, ...s.seats.flatMap((x) => s.draft[x] ?? [])];
    expect(pool(start(3, { leaders: true, leaderPromos: true }))).toEqual(expect.arrayContaining(["Louis", "Stevie", "Esteban"]));
    expect(pool(start(3, { leaders: true }))).not.toContain("Esteban");
  });
});

describe("audit: Cities Age III per-victory and per-black cards (aid p1)", () => {
  it("count victory tokens and black cards in the city", () => {
    const s0 = start(3, { cities: true });
    const s: State = { ...s0, players: { ...s0.players, red: { ...s0.players.red!, victories: [1, 3, 5], cards: ["Militia@1", "Spy Ring@2", "Lumber Yard@1"] } } };
    const sm = CARDS.find((c) => c.name === "Slave Market")!;
    const ss = CARDS.find((c) => c.name === "Secret Society")!;
    for (const e of sm.eff) if (e.k === "perCoins" || e.k === "perVP") expect(perCount(s, "red", e)).toBe(3);
    for (const e of ss.eff) if (e.k === "perCoins" || e.k === "perVP") expect(perCount(s, "red", e)).toBe(2);
  });
});

describe("audit: Leaders goodies (aid p2)", () => {
  const withLeaders = (s: State, seat: string, leaders: string[], leaderHand: string[] = []) =>
    ({ ...s, players: { ...s.players, [seat]: { ...s.players[seat]!, leaders, leaderHand, coins: 20 } } });
  it("Louis scores 7 minus your victory tokens", () => {
    const s0 = start(3, { leaders: true, leaderPromos: true });
    let s = withLeaders(s0, "red", ["Louis"]);
    s = { ...s, phase: "over", players: { ...s.players, red: { ...s.players.red!, victories: [1, 3] } } };
    const lines = pack.view(s, "spectator").scores!.red!;
    expect(lines.filter((l) => l.cat === "leaders").reduce((t, l) => t + l.vp, 0)).toBe(5);
  });
  it("Stevie builds a wonder stage for 1 coin per resource", () => {
    const r = rngOf(4);
    let s = start(3, { leaders: true, leaderPromos: true });
    while (s.phase === "draft") s = playAll(s, r);
    expect(s.phase).toBe("recruit");
    s = withLeaders(s, "red", [], ["Stevie", ...s.players.red!.leaderHand.slice(1)]);
    const ways = pack.choices(s, "red", ["l:0"])!.options;
    const stevie = ways.find((o) => o.id.startsWith("stevie:"))!;
    expect(stevie.label).toMatch(/with Stevie \(\d+ coins\)/);
    const coins = s.players.red!.coins;
    const cost = Number(/\((\d+) coins\)/.exec(stevie.label)![1]);
    s = playAll(s, r, { seat: "red", prefix: ["l:0", stevie.id] });
    expect(s.players.red!.built).toHaveLength(1);
    expect(s.players.red!.coins).toBe(coins - cost);
  });
  it("Esteban freezes the passing of hands once", () => {
    const r = rngOf(5);
    let s = start(3, { leaders: true, leaderPromos: true });
    while (s.phase !== "turn") s = playAll(s, r);
    s = withLeaders(s, "red", ["Esteban"]);
    expect(pack.choices(s, "red", [])!.options.map((o) => o.id)).toContain("freeze");
    expect(pack.choices(s, "blue", [])!.options.map((o) => o.id)).not.toContain("freeze");
    const hand = s.players.red!.hand;
    s = playAll(s, r, { seat: "red", prefix: ["freeze"] });
    // Red keeps the rest of his own hand: one card fewer, nothing passed in.
    expect(s.players.red!.hand).toHaveLength(hand.length - 1);
    expect(s.players.red!.hand.every((k) => hand.includes(k))).toBe(true);
    expect(pack.choices(s, "red", [])!.options.map((o) => o.id)).not.toContain("freeze");
    const hand2 = s.players.red!.hand;
    s = playAll(s, r);
    expect(s.players.red!.hand.some((k) => !hand2.includes(k))).toBe(true);
  });
});

describe("audit: Cities card list (parts list + 7w-5)", () => {
  const names = (age: number) => CARDS.filter((c) => c.set === "cities" && c.color === "black" && c.age === age).map((c) => c.name).sort();
  it("has the nine cards of each age, including the three that were missing or in the wrong age", () => {
    expect(names(1)).toEqual(["Clandestine Dock East", "Clandestine Dock West", "Gambling Den", "Gates of the City", "Hideout", "Militia", "Pigeon Loft", "Residence", "Secret Warehouse"].sort());
    expect(names(2)).toEqual(["Architect Cabinet", "Black Market", "Consulate", "Gambling House", "Lair", "Mercenaries", "Sepulcher", "Spy Ring", "Tabularium"].sort());
    expect(names(3)).toEqual(["Brotherhood", "Builders Union", "Capitol", "Cenotaph", "Contingent", "Embassy", "Secret Society", "Slave Market", "Torture Chamber"].sort());
  });
  it("matches the 7w-5 costs that were wrong in the first draft", () => {
    const c = (name: string, age: number) => CARDS.find((x) => x.name === name && x.age === age)!;
    expect(c("Militia", 1).cost).toBe("$3");
    expect(c("Hideout", 1).cost).toBe("");
    expect(c("Pigeon Loft", 1).cost).toBe("$1O");
    expect(c("Gates of the City", 1).cost).toBe("$1W");
    expect(c("Architect Cabinet", 2).cost).toBe("$1P");
    expect(c("Black Market", 2).cost).toBe("OL");
    expect(c("Consulate", 2).cost).toBe("CP");
    expect(c("Lair", 2).cost).toBe("WG");
    expect(c("Mercenaries", 2).cost).toBe("$4P");
    expect(c("Sepulcher", 2).cost).toBe("SGL");
    expect(c("Spy Ring", 2).cost).toBe("$2SC");
    expect(c("Tabularium", 2).cost).toBe("$2OWL");
    expect(c("Brotherhood", 3).cost).toBe("WWWOL");
    expect(c("Builders Union", 3).cost).toBe("CWPG");
    expect(c("Capitol", 3).cost).toBe("$2CCSSGP");
    expect(c("Cenotaph", 3).cost).toBe("CCSLG");
    expect(c("Contingent", 3).cost).toBe("$5L");
    expect(c("Embassy", 3).cost).toBe("SLP");
    expect(c("Slave Market", 3).cost).toBe("OOWW");
    expect(c("Secret Society", 3).cost).toBe("SP");
    expect(c("Torture Chamber", 3).cost).toBe("$3OOG");
    expect(CARDS.find((x) => x.name === "Spies Guild")!.cost).toBe("SSSG");
    expect(CARDS.find((x) => x.name === "Counterfeiters Guild")!.cost).toBe("OOOLG");
    expect(CARDS.find((x) => x.name === "Guild of Shadows")!.cost).toBe("SSWP");
    expect(CARDS.find((x) => x.name === "Courtesans Guild")!.cost).toBe("SCGL");
  });
});

describe("audit: leader costs (7w-2, 7w-3, 7w-5)", () => {
  const cost = (name: string) => LEADERS.find((l) => l.name === name)!.cost;
  it("corrects the costs that disagreed with the lists", () => {
    expect(cost("Bilkis")).toBe(4);
    expect(cost("Tomyris")).toBe(4);
    expect(cost("Nero")).toBe(1); // 7w-5 says 3; the dedicated lists say 1
    expect(cost("Berenice")).toBe(2);
    expect(cost("Aspasia")).toBe(3);
    expect(cost("Caligula")).toBe(3);
    expect(cost("Semiramis")).toBe(2);
    expect(cost("Diocletian")).toBe(2);
    expect(cost("Esteban")).toBe(5);
    expect(cost("Archimedes")).toBe(4);
    expect(cost("Hammurabi")).toBe(2);
    expect(cost("Nefertiti")).toBe(3);
  });
});

describe("audit: team play (cheatsheet)", () => {
  const ctxOf = (s: State): Ctx => {
    const table = { cities, teamPlay: { id: "teamPlay", handlers: {} } };
    return { hooks: makeHooks(table, s.addons, POINTS), addons: table };
  };
  it("needs Cities and an even seat count of 4, 6 or 8", () => {
    expect(() => start(4, { teamPlay: true })).toThrow(/cities/);
    expect(() => start(3, { cities: true, teamPlay: true })).toThrow(/Team play/);
    expect(() => start(5, { cities: true, teamPlay: true })).toThrow(/Team play/);
    expect(start(4, { cities: true, teamPlay: true }).log.join(" ")).toMatch(/red & blue/);
  });
  it("skips the teammate fight and doubles tokens on the other neighbour", () => {
    let s = start(4, { cities: true, teamPlay: true });
    const blank = (seat: string, cards: string[]) => ({ ...s.players[seat]!, cards, victories: [] as number[], defeats: 0 });
    s = { ...s, age: 1, players: { ...s.players, red: blank("red", ["Stockade@1"]), blue: blank("blue", []), green: blank("green", []), yellow: blank("yellow", []) } };
    s = military(s, ctxOf(s));
    // Pairs: red-blue and green-yellow are teammates. Fights: blue-green (tie), yellow-red (red wins twice).
    expect(s.players.red!.victories).toEqual([1, 1]);
    expect(s.players.yellow!.defeats).toBe(2);
    expect(s.players.blue!.victories).toEqual([]);
    expect(s.players.blue!.defeats).toBe(0);
    expect(s.players.green!.victories).toEqual([]);
    expect(s.players.green!.defeats).toBe(0);
  });
});
