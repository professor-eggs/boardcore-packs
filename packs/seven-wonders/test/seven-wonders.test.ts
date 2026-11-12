// 7 Wonders: setup, turns, payments, military, scoring, the end, and each add-on switched on.
import { describe, expect, it } from "@effect/vitest";
import type { Action, Json, Rng, SeatInfo, Step } from "@boardcore/pack-sdk";
import pack from "../src/index";
import { CARDS } from "../src/data";
import { plans, sciScore, keyName, type State } from "../src/engine";

const rngOf = (seed: number): Rng => {
  let x = (seed * 2654435761) >>> 0 || 1;
  return { int: (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; } };
};
const SEATS = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
const seats = (n: number): SeatInfo[] => SEATS.slice(0, n).map((seat) => ({ seat, team: null }));
const start = (n: number, options: { [k: string]: Json } = {}, seed = 1) => pack.setup({ options, seats: seats(n), rng: rngOf(seed) });

function randomPath(s: State, seat: string, r: Rng): Action {
  const path: Step[] = [];
  for (;;) {
    const p = pack.choices(s, seat, path);
    if (!p) return path;
    const ok = p.options.filter((o) => !o.disabled);
    // Prefer building over discarding so cities fill up.
    const build = ok.filter((o) => o.id !== "sell" && o.id !== "skip");
    const pool = build.length && r.int(4) > 0 ? build : ok;
    path.push(pool[r.int(pool.length)]!.id);
  }
}

function playOut(s: State, seed: number, max = 3000): State {
  const r = rngOf(seed + 99);
  for (let i = 0; i < max; i++) {
    const st = pack.status(s);
    if (st.outcome) return s;
    const seat = st.actors[r.int(st.actors.length)]!;
    s = pack.apply(s, seat, randomPath(s, seat, r), r).state;
    for (const x of s.seats) expect(s.players[x]!.coins).toBeGreaterThanOrEqual(0);
  }
  throw new Error("game did not end");
}

describe("seven-wonders setup", () => {
  it("deals 7 cards to each of 3-7 players and a wonder each", () => {
    for (let n = 3; n <= 7; n++) {
      const s = start(n);
      expect(s.age).toBe(1);
      expect(s.phase).toBe("turn");
      for (const x of s.seats) {
        expect(s.players[x]!.hand).toHaveLength(7);
        expect(s.players[x]!.coins).toBe(3);
      }
      expect(new Set(s.seats.map((x) => s.players[x]!.wonder)).size).toBe(n);
      expect(s.decks[2]!.filter((k) => CARDS.find((c) => c.name === keyName(k))!.color === "purple")).toHaveLength(n + 2);
    }
  });
  it("rejects 8 players without Cities and 2 players", () => {
    expect(() => start(8)).toThrow(/Cities/);
    expect(() => start(2)).toThrow();
  });
  it("hides hands and picks from other seats", () => {
    let s = start(3);
    const v = pack.view(s, "red");
    expect(v.hand).toHaveLength(7);
    expect(pack.view(s, "spectator").hand).toHaveLength(0);
    s = pack.apply(s, "red", ["c:0", "sell"], rngOf(5)).state;
    expect(pack.view(s, "blue").pick).toBe(null);
    expect(pack.view(s, "red").pick).toEqual(["c:0", "sell"]);
    expect(pack.describe(s, "red", ["c:0", "sell"], "blue")).toBe("red has chosen.");
  });
});

describe("seven-wonders turns", () => {
  it("resolves a turn once everyone picks, then passes hands left", () => {
    let s = start(3);
    const handBlue = s.players.blue!.hand.slice();
    const r = rngOf(2);
    for (const x of s.seats) s = pack.apply(s, x, ["c:0", "sell"], r).state;
    expect(s.turn).toBe(2);
    for (const x of s.seats) expect(s.players[x]!.coins).toBe(6);
    // red's left is the previous seat; in Age I hands move left, so red gets blue's (its right) hand.
    expect(s.players.red!.hand).toEqual(handBlue.slice(1));
    expect(s.discard).toHaveLength(3);
  });
  it("offers trading plans and pays neighbours", () => {
    const pc = { own: [], left: ["W", "WC"], right: ["W"], price: { L: { W: 2, C: 2 }, R: { W: 1 } }, discount: 0, bank: 0, rebate: { L: 0, R: 0 }, waive: false };
    const ps = plans("WW", pc as never, 10);
    expect(ps).toContainEqual({ L: 2, R: 1, B: 0 });
    expect(ps.every((p) => p.L + p.R + p.B <= 4)).toBe(true);
    expect(plans("WWW", pc as never, 10)).toEqual([{ L: 4, R: 1, B: 0 }]);
    expect(plans("O", pc as never, 10)).toEqual([]);
    expect(plans("WW", { ...pc, discount: 1 } as never, 10)).toContainEqual({ L: 0, R: 1, B: 0 });
    expect(plans("WW", { ...pc, discount: 2 } as never, 10)).toEqual([{ L: 0, R: 0, B: 0 }]);
  });
  it("scores science with sets and wild symbols", () => {
    const k = (c: number, g: number, t: number, wild = 0) => sciScore({ c, g, t, wild, masks: 0, pool: { c: 0, g: 0, t: 0 } }, 7);
    expect(k(1, 1, 1)).toBe(10);
    expect(k(2, 2, 2)).toBe(26);
    expect(k(3, 0, 0)).toBe(9);
    expect(k(1, 1, 0, 1)).toBe(10);
  });
});

describe("seven-wonders full games", () => {
  for (const [name, options, n] of [
    ["base", {}, 3], ["base B sides", { sideB: true }, 5], ["base, 7 players", { randomSides: true }, 7],
    ["leaders", { leaders: true }, 4], ["cities", { cities: true }, 4], ["cities, 8 players", { cities: true }, 8], ["cities team play", { cities: true, teamPlay: true }, 4],
    ["wonder pack", { wonderPack: true, randomSides: true }, 6], ["everything", { leaders: true, cities: true, wonderPack: true, randomSides: true }, 7],
  ] as [string, { [k: string]: Json }, number][]) {
    it(`plays to the end: ${name}`, () => {
      for (let seed = 1; seed <= 3; seed++) {
        const s = playOut(start(n, options, seed), seed);
        const st = pack.status(s);
        expect(st.outcome).toBeDefined();
        expect(st.outcome!.winners.length).toBeGreaterThan(0);
        for (const x of s.seats) {
          const names = s.players[x]!.cards.map(keyName);
          expect(new Set(names).size).toBe(names.length);
          expect(s.players[x]!.victories.length + s.players[x]!.defeats).toBeGreaterThan(-1);
        }
        expect(pack.text.state(pack.view(s, "spectator"))).toMatch(/Game over/);
      }
    });
  }
});

describe("seven-wonders add-ons", () => {
  it("leaders: a 4-card draft, 6 coins, then recruiting before each age", () => {
    let s = start(3, { leaders: true });
    expect(s.phase).toBe("draft");
    expect(s.players.red!.coins).toBe(6);
    expect(s.draft.red).toHaveLength(4);
    const r = rngOf(3);
    for (let round = 0; round < 3; round++) for (const x of s.seats) s = pack.apply(s, x, ["l:0"], r).state;
    expect(s.phase).toBe("recruit");
    for (const x of s.seats) expect(s.players[x]!.leaderHand).toHaveLength(4);
    for (const x of s.seats) s = pack.apply(s, x, ["l:0", "sell"], r).state;
    expect(s.phase).toBe("turn");
    for (const x of s.seats) expect(s.players[x]!.coins).toBe(9);
  });
  it("cities: one black card per player per age and 8-card hands", () => {
    const s = start(4, { cities: true });
    for (const x of s.seats) expect(s.players[x]!.hand).toHaveLength(8);
    const black = (age: number) => s.decks[age]!.filter((k) => CARDS.find((c) => c.name === keyName(k))!.color === "black").length;
    expect([black(0), black(1), black(2)]).toEqual([4, 4, 4]);
    const s8 = start(8, { cities: true });
    for (const x of s8.seats) expect(s8.players[x]!.hand).toHaveLength(7);
  });
  it("wonder pack: its boards join the pool, Abu Simbel only with Leaders", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) for (const x of start(7, { wonderPack: true }, seed).seats) seen.add(start(7, { wonderPack: true }, seed).players[x]!.wonder);
    expect(seen.has("Great Wall") && seen.has("Stonehenge") && seen.has("Manneken Pis")).toBe(true);
    expect(seen.has("Abu Simbel")).toBe(false);
  });
});
