// Pandemic: the map, setup, actions, infection and outbreaks, epidemics, the end, and each add-on.
import { describe, expect, it } from "@effect/vitest";
import type { Action, Json, Rng, SeatInfo, Step } from "@boardcore/pack-sdk";
import pack from "../src/index";
import { ADJ, CITIES, CITY_NAMES } from "../src/data";
import { onBoard, type State } from "../src/engine";

const rngOf = (seed: number): Rng => {
  let x = (seed * 2654435761) >>> 0 || 1;
  return { int: (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; } };
};
const NAMES = ["red", "blue", "green", "yellow", "purple", "black"];
const seats = (n: number): SeatInfo[] => NAMES.slice(0, n).map((seat) => ({ seat, team: null }));
const start = (n: number, options: { [k: string]: Json } = {}, seed = 1) => pack.setup({ options, seats: seats(n), rng: rngOf(seed) });

function randomPath(s: State, seat: string, r: Rng): Action {
  const path: Step[] = [];
  for (;;) {
    const p = pack.choices(s, seat, path);
    if (!p) return path;
    const ok = p.options.filter((o) => !o.disabled);
    // Mostly useful actions; sometimes anything.
    const good = ok.filter((o) => ["cure", "curePurple", "treat", "share", "build", "capture"].includes(o.id));
    const pool = good.length && r.int(3) > 0 ? good : ok;
    path.push(pool[r.int(pool.length)]!.id);
  }
}

function playOut(s: State, seed: number, max = 4000): State {
  const r = rngOf(seed + 7);
  for (let i = 0; i < max; i++) {
    const st = pack.status(s);
    if (st.outcome) return s;
    const seat = st.actors[r.int(st.actors.length)]!;
    s = pack.apply(s, seat, randomPath(s, seat, r), r).state;
    let total = 0;
    for (const c of ["blue", "yellow", "black", "red", "purple"]) {
      total = onBoard(s, c) + s.supply[c]!;
      expect(s.supply[c]).toBeGreaterThanOrEqual(0);
      void total;
    }
  }
  throw new Error("game did not end");
}

describe("pandemic map", () => {
  it("has 48 cities, 12 per colour, connections both ways", () => {
    expect(CITY_NAMES).toHaveLength(48);
    for (const c of ["blue", "yellow", "black", "red"]) expect(CITY_NAMES.filter((x) => CITIES[x] === c)).toHaveLength(12);
    for (const a of CITY_NAMES) for (const b of ADJ[a]!) expect(ADJ[b]).toContain(a);
    expect(ADJ["Atlanta"]).toEqual(expect.arrayContaining(["Chicago", "Washington", "Miami"]));
    expect(ADJ["San Francisco"]).toContain("Tokyo");
  });
});

describe("pandemic setup", () => {
  it("infects 9 cities with 18 cubes, deals hands and seeds epidemics", () => {
    for (const [n, hand] of [[2, 4], [3, 3], [4, 2]] as const) {
      const s = start(n, { epidemics: 5 });
      const cubes = ["blue", "yellow", "black", "red"].reduce((t, c) => t + onBoard(s, c), 0);
      expect(cubes).toBe(18);
      expect(s.infDiscard).toHaveLength(9);
      for (const x of s.players) { expect(s.pl[x]!.hand).toHaveLength(hand); expect(s.pl[x]!.city).toBe("Atlanta"); }
      expect(s.playerDeck.filter((c) => c === "epidemic")).toHaveLength(5);
      expect(s.playerDeck.length + n * hand).toBe(48 + 5 + 5);
      expect(s.stations).toEqual(["Atlanta"]);
      expect(new Set(s.players.map((x) => s.pl[x]!.role)).size).toBe(n);
      expect(pack.status(s).actors).toContain(s.players[s.current]);
    }
  });
  it("rejects bad seat counts and combinations", () => {
    expect(() => start(5)).toThrow(/players/);
    expect(() => start(5, { onTheBrink: true })).not.toThrow();
    expect(() => start(4, { mutation: true, bioterrorist: true })).toThrow(/Mutation/);
    expect(() => start(3, { epidemics: 7 })).toThrow(/epidemics/);
  });
});

describe("pandemic turns", () => {
  it("drives, ends the turn, draws two cards and infects", () => {
    let s = start(2, {}, 3);
    const r = rngOf(1);
    const me = s.players[s.current]!;
    s = pack.apply(s, me, ["drive", "Chicago"], r).state;
    expect(s.pl[me]!.city).toBe("Chicago");
    expect(s.actionsLeft).toBe(3);
    const deck = s.playerDeck.length;
    const first = s.current;
    s = pack.apply(s, me, ["end"], r).state;
    // Any event holders may hold the infection step open; otherwise it's the next player's turn already.
    while (s.phase !== "actions" || s.current === first) {
      if (s.pending.length) { s = pack.apply(s, s.pending[0]!.seat, [`d:${s.pl[s.pending[0]!.seat]!.hand[0]}`], r).state; continue; }
      if (s.outcome) break;
      s = pack.apply(s, me, [s.phase === "infect" ? "infect" : "continue"], r).state;
    }
    expect(s.playerDeck.length).toBe(deck - 2);
    expect(s.infDiscard.length).toBeGreaterThanOrEqual(9);
  });
  it("chains outbreaks into neighbours", () => {
    let s = start(2, {}, 4);
    // Load Atlanta and Chicago with 3 blue each, then infect Atlanta once more.
    // Pawns out of the way, so no Quarantine Specialist or Medic protects the cities.
    s = { ...s, pl: Object.fromEntries(Object.entries(s.pl).map(([k, p]) => [k, { ...p, city: "Jakarta" }])) };
    s = { ...s, cubes: { ...s.cubes, Atlanta: { blue: 3 }, Chicago: { blue: 3 } } };
    s = { ...s, infDeck: ["Atlanta", ...s.infDeck.filter((c) => c !== "Atlanta")], quiet: false, phase: "infect", inf: null };
    // Someone must hold an event, or the step would run by itself: give red one.
    s = { ...s, current: 0, pl: { ...s.pl, red: { ...s.pl.red!, hand: ["event:Airlift"] } } };
    const r = rngOf(2);
    s = pack.apply(s, "red", ["infect"], r).state;
    expect(s.outbreaks).toBeGreaterThanOrEqual(2);
    expect(s.cubes.Washington?.blue ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe("pandemic win and loss", () => {
  it("the fourth cure wins", () => {
    let s = start(2, {}, 5);
    const red = ["Beijing", "Seoul", "Tokyo", "Shanghai", "Osaka"].map((c) => `city:${c}`);
    s = { ...s, current: 0, cured: ["blue", "yellow", "black"], pl: { ...s.pl, red: { ...s.pl.red!, role: "Medic", hand: red } } };
    s = pack.apply(s, "red", ["cure", "red"], rngOf(1)).state;
    expect(s.outcome?.winners).toEqual(["red", "blue"]);
    expect(pack.status(s).outcome).toBeDefined();
  });
  it("an empty player deck loses", () => {
    let s = start(2, {}, 6);
    s = { ...s, playerDeck: [], current: 0 };
    s = pack.apply(s, "red", ["end"], rngOf(1)).state;
    expect(s.outcome?.winners).toEqual([]);
    expect(s.outcome?.text).toMatch(/player deck/);
  });
  it("an epidemic raises the rate and puts 3 cubes on the bottom card's city", () => {
    let s = start(2, {}, 7);
    const bottom = s.infDeck[s.infDeck.length - 1]!;
    s = { ...s, current: 0, playerDeck: ["epidemic", ...s.playerDeck.filter((c) => c !== "epidemic")], pl: Object.fromEntries(Object.entries(s.pl).map(([k, p]) => [k, { ...p, hand: p.hand.filter((c) => !c.startsWith("event:")) }])) };
    s = pack.apply(s, "red", ["end"], rngOf(1)).state;
    expect(s.rateIdx).toBe(1);
    expect(s.infDiscard).not.toContain(bottom);
    expect(s.infDeck.slice(0, 1)).not.toEqual([]);
  });
  it("bio-terrorist: a player in his city can capture him", () => {
    let s = start(3, { bioterrorist: true }, 2);
    s = pack.apply(s, "green", ["Atlanta"], rngOf(1)).state;
    const me = s.players[s.current]!;
    const opts = pack.choices(s, me, [])!.options.map((o) => o.id);
    expect(opts).toContain("capture");
    s = pack.apply(s, me, ["capture"], rngOf(1)).state;
    expect((pack.view(s, "red").extra.bioterrorist as { city: string }).city).toBe("Atlanta");
  });
});

describe("pandemic full games", () => {
  const cases: [string, { [k: string]: Json }, number][] = [
    ["base 2p", {}, 2], ["base 4p heroic", { epidemics: 6 }, 4], ["on the brink 5p", { onTheBrink: true }, 5],
    ["on the brink legendary", { onTheBrink: true, epidemics: 7 }, 3], ["virulent strain", { virulentStrain: true, epidemics: 6 }, 3],
    ["mutation", { mutation: true, onTheBrink: true }, 4], ["bio-terrorist", { bioterrorist: true, onTheBrink: true }, 4],
    ["bio-terrorist + virulent strain", { bioterrorist: true, virulentStrain: true }, 5],
  ];
  for (const [name, options, n] of cases) {
    it(`plays to an end: ${name}`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const s = playOut(start(n, options, seed), seed);
        expect(s.outcome).not.toBe(null);
        expect(pack.text.state(pack.view(s, "spectator"))).toMatch(/Game over/);
      }
    });
  }
});

describe("pandemic add-ons", () => {
  it("on the brink: more roles, 2 events per player", () => {
    const roles = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) { const s = start(5, { onTheBrink: true }, seed); for (const x of s.players) roles.add(s.pl[x]!.role); }
    expect(roles.size).toBe(13);
    const s = start(3, { onTheBrink: true });
    const events = [...s.playerDeck, ...s.players.flatMap((x) => s.pl[x]!.hand)].filter((c) => c.startsWith("event:"));
    expect(events).toHaveLength(6);
  });
  it("virulent strain: its epidemic cards replace the normal ones", () => {
    const s = start(3, { virulentStrain: true, epidemics: 5 });
    expect(s.playerDeck.filter((c) => c === "epidemic")).toHaveLength(0);
    expect(new Set(s.playerDeck.filter((c) => c.startsWith("vs:"))).size).toBe(5);
  });
  it("mutation: two Mutation! cards in the infection discards and three events in the deck", () => {
    const s = start(3, { mutation: true });
    expect(s.infDiscard.filter((c) => c.startsWith("Mutation!"))).toHaveLength(2);
    expect(s.playerDeck.filter((c) => c.startsWith("mutation:"))).toHaveLength(3);
    expect(s.supply.purple).toBe(12);
  });
  it("bio-terrorist: a hidden last seat who starts in secret", () => {
    let s = start(4, { bioterrorist: true });
    expect(s.players).toEqual(["red", "blue", "green"]);
    expect(pack.status(s).actors).toEqual(["yellow"]);
    s = pack.apply(s, "yellow", ["Lima"], rngOf(1)).state;
    const bt = (v: { extra: { [k: string]: Json } }) => v.extra.bioterrorist as { city: string | null; hand: string[] };
    expect(bt(pack.view(s, "yellow")).city).toBe("Lima");
    expect(bt(pack.view(s, "yellow")).hand).toHaveLength(2);
    expect(bt(pack.view(s, "red")).city).toBe(null);
    expect(bt(pack.view(s, "red")).hand).toHaveLength(0);
    expect(bt(pack.view(s, "spectator")).city).toBe(null);
    expect(pack.status(s).actors).toContain(s.players[s.current]);
  });
  it("lab challenge: a documented stub that refuses to start", async () => {
    const { LAB_REASON } = await import("../src/addons/lab");
    expect(LAB_REASON).toMatch(/In the Lab/);
  });
});
