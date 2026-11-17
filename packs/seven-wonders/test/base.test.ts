// The base alone, through the runtime (trusted adapter): setup, the hidden pick, the end of a turn, payments,
// science, the outcome (D79), and seat counts. The rules helpers are pure, so a few are tested directly.
import { describe, expect, it } from "@effect/vitest";
import type { Action, Json, Rng, Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { loadBoth, readDist, seatsOf } from "@boardcore-packs/kit";
import { plans, sciScore } from "../src/engine";
import { outcomeOf, PHASES } from "../src/index";

const NAMES = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
type S = SWState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
let base: PackHandle;
const h = async () => (base ??= (await loadBoth(readDist(new URL("../dist/", import.meta.url)))).trusted);
const start = (p: PackHandle, n: number, options: { [k: string]: Json } = {}, seed = 1) =>
  p.setup({ options: { sideB: false, randomSides: false, teamPlay: false, startCoins: 3, ...options }, seats: seatsOf(NAMES, n), rng: rng(seed) }) as S;
const pick = (p: PackHandle, s: S, seat: string, path: Step[] = []): Action => {
  const out = [...path];
  for (;;) {
    const pr = p.choices(s, seat, out);
    if (!pr) return out;
    const o = pr.options.find((x) => x.id === "sell" && !x.disabled) ?? pr.options.find((x) => !x.disabled)!;
    out.push(o.id);
  }
};

describe("seven-wonders base: setup", () => {
  it("deals 7 cards and a wonder to each of 3 to 7 seats, with players + 2 guilds in Age III", async () => {
    const p = await h();
    for (let n = 3; n <= 7; n++) {
      const s = start(p, n);
      expect(s.age).toBe(1);
      expect(s.run.order).toEqual(PHASES);
      for (const x of s.seats) {
        expect(s.players[x]!.hand.items).toHaveLength(7);
        expect(s.players[x]!.hand.seenBy).toEqual([x]);
        expect(s.players[x]!.coins).toBe(3);
      }
      expect(new Set(s.seats.map((x) => s.players[x]!.wonder)).size).toBe(n);
      expect(s.decks[2]!.items.filter((k) => k.includes("Guild"))).toHaveLength(n + 2);
      expect(s.decks[1]!.items).toHaveLength(7 * n);
      expect(s.decks[2]!.items).toHaveLength(7 * n);
    }
  });
  it("refuses 8 seats without the Cities add-on, 2 seats, and team play on an odd count", async () => {
    const p = await h();
    expect(() => start(p, 8)).toThrow(/Cities/);
    expect(() => start(p, 2)).toThrow();
    expect(() => start(p, 5, { teamPlay: true })).toThrow(/Team play/);
    expect(start(p, 4, { teamPlay: true }).partner).toEqual({ red: "blue", blue: "red", green: "yellow", yellow: "green" });
  });
});

describe("seven-wonders base: a turn", () => {
  it("plays no turn 7 when nobody holds two cards (PR #118 review)", async () => {
    const p = await h();
    let s = start(p, 3);
    // Babylon B (2nd edition: two stages) with its first stage built: the "last" pick stops the runner between turn 7 and the war.
    s = { ...s, players: { ...s.players, red: { ...s.players.red!, wonder: "Babylon", side: "B", built: [0] } } };
    for (let t = 0; t < 6; t++) for (const x of p.status(s).actors) s = p.apply(s, x, pick(p, s, x), rng(5)).state as S;
    expect(s.run.order[s.run.at]).toBe("last");
    expect(p.status(s).actors).toEqual(["red"]);
    expect(s.turn).toBe(6);
  });
  it("keeps picks hidden until the last, then resolves together and passes the hands left", async () => {
    const p = await h();
    let s = start(p, 3);
    const blue = s.players.blue!.hand.items.slice();
    s = p.apply(s, "red", ["c:0", "sell"], rng(5)).state as S;
    const v = (x: string) => p.view(s, x) as SWView;
    expect(v("blue").pick).toBe(null);
    expect(v("red").pick).toEqual(["c:0", "sell"]);
    expect(v("blue").run).toMatchObject({ phase: "turn1", picked: ["red"] });
    expect(p.describe(s, "red", ["c:0", "sell"], "blue")).toBe("red has chosen.");
    expect(p.status(s).actors).toEqual(["blue", "green"]);
    s = p.apply(s, "blue", ["c:0", "sell"], rng(5)).state as S;
    const last = p.apply(s, "green", ["c:0", "sell"], rng(5));
    expect(last.reveal).toBe(true);
    s = last.state as S;
    expect(s.turn).toBe(1);
    expect(s.run.order[s.run.at]).toBe("turn2");
    for (const x of s.seats) expect(s.players[x]!.coins).toBe(6);
    // red's left is the previous seat; in Age I hands move left, so red gets blue's (its right) hand.
    expect(s.players.red!.hand.items).toEqual(blue.slice(1));
    expect(s.discard.items).toHaveLength(3);
    expect(p.describe(s, "green", ["c:0", "sell"], "red")).toMatch(/discards a card for 3 coins/);
  });
  it("offers trading plans", () => {
    const pc = { own: [], left: ["W", "WC"], right: ["W"], price: { L: { W: 2, C: 2 }, R: { W: 1 } }, discount: 0, bank: 0, rebate: { L: 0, R: 0 }, waive: false };
    const ps = plans("WW", pc as never, 10);
    expect(ps).toContainEqual({ L: 2, R: 1, B: 0 });
    expect(plans("WWW", pc as never, 10)).toEqual([{ L: 4, R: 1, B: 0 }]);
    expect(plans("O", pc as never, 10)).toEqual([]);
    expect(plans("WW", { ...pc, discount: 2 } as never, 10)).toEqual([{ L: 0, R: 0, B: 0 }]);
    expect(plans("WW", { ...pc, rebate: { L: 1, R: 0 } } as never, 10)).toContainEqual({ L: 1, R: 1, B: 0 });
  });
  it("scores science with sets, wilds and masks", () => {
    const k = (c: number, g: number, t: number, wild = 0, masks = 0, pool = { c: 0, g: 0, t: 0 }) => sciScore({ c, g, t, wild, masks, pool }, 7);
    expect(k(1, 1, 1)).toBe(10);
    expect(k(2, 2, 2)).toBe(26);
    expect(k(1, 1, 0, 1)).toBe(10);
    expect(k(1, 1, 0, 0, 1, { c: 0, g: 0, t: 1 })).toBe(10);
  });
});

describe("seven-wonders base: whole games", () => {
  it("plays every seat count to an outcome with places and scores", async () => {
    const p = await h();
    for (const [n, o] of [[3, {}], [5, { sideB: true }], [7, { randomSides: true }], [6, { teamPlay: true }]] as [number, { [k: string]: Json }][]) {
      let s = start(p, n, o, n);
      const r = rng(n + 50);
      for (let i = 0; i < 400 && !p.status(s).outcome; i++) {
        const a = p.status(s).actors;
        const x = a[r.int(a.length)]!;
        s = p.apply(s, x, pick(p, s, x), r).state as S;
      }
      const out = p.status(s).outcome!;
      expect(out.winners.length).toBeGreaterThan(0);
      expect(Object.keys(out.places!).sort()).toEqual(NAMES.slice(0, n).sort());
      expect(p.textState(p.view(s, "spectator"))).toMatch(/^Game over\./);
    }
  });
  it("places by points, then coins, sharing a place still tied (1, 1, 3)", () => {
    const at = (coins: { [seat: string]: number }) => ({ seats: Object.keys(coins), players: Object.fromEntries(Object.entries(coins).map(([x, c]) => [x, { coins: c }])) });
    const o = outcomeOf(at({ red: 4, blue: 4, green: 9, yellow: 1 }), { red: 50, blue: 50, green: 40, yellow: 50 });
    expect(o.places).toEqual({ red: 1, blue: 1, yellow: 3, green: 4 });
    expect(o.winners).toEqual(["red", "blue"]);
    expect(outcomeOf(at({ red: 2, blue: 5, green: 0 }), { red: 30, blue: 30, green: 31 }).places).toEqual({ green: 1, blue: 2, red: 3 });
  });
});

describe("seven-wonders base: the board text fits a phone", () => {
  // A phone shows about 36 columns of the board text (phone play, 2026-11-17): every line stays within 34, and
  // the board at the end says each seat's score.
  const WIDTH = 34;
  const first = (p: PackHandle, s: S, seat: string): Action => {
    const out: Step[] = [];
    for (;;) {
      const pr = p.choices(s, seat, out);
      if (!pr) return out;
      const o = pr.options.find((x) => !x.disabled && x.id !== "sell") ?? pr.options.find((x) => !x.disabled)!;
      out.push(o.id);
    }
  };
  it("keeps every line within 34 characters at 3 and 7 seats, and ends with the scores", async () => {
    const p = await h();
    for (const n of [3, 7]) {
      let s = start(p, n, {}, 9 + n);
      const r = rng(n + 90);
      const wide = new Set<string>();
      for (let i = 0; i < 400 && !p.status(s).outcome; i++) {
        for (const viewer of ["spectator", s.seats[0]!]) for (const l of (p.layout(p.view(s, viewer)) ?? "").split("\n")) if (l.length > WIDTH) wide.add(l);
        const a = p.status(s).actors;
        const x = a[r.int(a.length)]!;
        s = p.apply(s, x, first(p, s, x), r).state as S;
      }
      expect(p.status(s).outcome).toBeTruthy();
      const end = p.layout(p.view(s, "spectator"))!;
      for (const l of end.split("\n")) if (l.length > WIDTH) wide.add(l);
      expect([...wide]).toEqual([]);
      for (const x of s.seats) expect(end).toMatch(new RegExp(`^${x} \\d+ points?:`, "m"));
    }
  });
});
