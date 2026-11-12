// Pandemic rules audit: one test per rule the audit fixed or added (see ../RULES-AUDIT.md).
import { describe, expect, it } from "@effect/vitest";
import type { Json, Rng, SeatInfo } from "@boardcore/pack-sdk";
import pack from "../src/index";
import { CITIES, POPULATION } from "../src/data";
import { cityOf, isCity, onBoard, type Pl, type State } from "../src/engine";

const rngOf = (seed: number): Rng => {
  let x = (seed * 2654435761) >>> 0 || 1;
  return { int: (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; } };
};
const NAMES = ["red", "blue", "green", "yellow", "purple", "black"];
const seats = (n: number): SeatInfo[] => NAMES.slice(0, n).map((seat) => ({ seat, team: null }));
const start = (n: number, options: { [k: string]: Json } = {}, seed = 1) => pack.setup({ options, seats: seats(n), rng: rngOf(seed) });
const r = rngOf(9);
const go = (s: State, seat: string, ...action: string[]) => pack.apply(s, seat, action, r).state;
const ids = (s: State, seat: string, partial: string[] = []) => (pack.choices(s, seat, partial)?.options ?? []).filter((o) => !o.disabled).map((o) => o.id);
const allIds = (s: State, seat: string, partial: string[] = []) => (pack.choices(s, seat, partial)?.options ?? []).map((o) => o.id);
const pl = (s: State, seat: string, p: Partial<Pl>): State => ({ ...s, pl: { ...s.pl, [seat]: { ...s.pl[seat]!, ...p } as Pl } });
/** A calm board: no cubes, red to play, everyone in Atlanta with no cards. */
function calm(s: State): State {
  s = { ...s, cubes: {}, current: 0, actionsLeft: 4, phase: "actions", log: [] };
  for (const x of s.players) s = pl(s, x, { hand: [], city: "Atlanta", role: "Scientist", used: [] });
  return s;
}
const cubeTotal = (s: State) => ["blue", "yellow", "black", "red", "purple"].reduce((t, c) => t + onBoard(s, c), 0);

describe("base setup", () => {
  it("the player with the highest city population goes first", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = start(3, { epidemics: 5 }, seed);
      const best = (x: string) => Math.max(0, ...s.pl[x]!.hand.filter(isCity).map((k) => POPULATION[cityOf(k)]!));
      const top = Math.max(...s.players.map(best));
      expect(best(s.players[s.current]!)).toBe(top);
    }
  });
  it("starting infections ignore the Quarantine Specialist and Medic (always 18 cubes)", () => {
    for (let seed = 1; seed <= 30; seed++) expect(cubeTotal(start(4, {}, seed))).toBe(18);
  });
  it("epidemics go one per pile, piles as equal as possible, bigger piles on top", () => {
    const s = start(2, { epidemics: 6 }, 3);
    const n = s.playerDeck.length; // 44 cities and events + 6 epidemics
    const per = Math.floor((n - 6) / 6), extra = (n - 6) % 6;
    let at = 0;
    for (let i = 0; i < 6; i++) {
      const size = per + (i < extra ? 1 : 0) + 1;
      expect(s.playerDeck.slice(at, at + size).filter((c) => c === "epidemic")).toHaveLength(1);
      at += size;
    }
  });
  it("hands are private from 5 epidemics up unless open hands is on; open in the introductory game", () => {
    const priv = start(2, { epidemics: 5 });
    expect(pack.view(priv, "blue").pl.red!.hand).toEqual([]);
    expect(pack.view(priv, "blue").pl.red!.handSize).toBe(4);
    expect(pack.view(priv, "red").pl.red!.hand).toHaveLength(4);
    expect(pack.view(start(2, { epidemics: 4 }), "blue").pl.red!.hand).toHaveLength(4);
    expect(pack.view(start(2, { epidemics: 6, openHands: true }), "blue").pl.red!.hand).toHaveLength(4);
  });
});

describe("base turn", () => {
  it("fewer than 2 player cards to draw loses", () => {
    let s = calm(start(2, {}, 2));
    s = { ...s, playerDeck: ["city:Lima"] };
    s = go(s, "red", "end");
    expect(s.outcome?.text).toMatch(/player deck/);
  });
  it("outbreaks chain breadth first and never hit a city twice", () => {
    let s = calm(start(2, {}, 4));
    for (const x of s.players) s = pl(s, x, { city: "Jakarta", role: "Scientist" });
    s = { ...s, cubes: { Atlanta: { blue: 3 }, Chicago: { blue: 3 }, Washington: { blue: 3 } }, supply: { ...s.supply, blue: 15 } };
    s = pl(s, "red", { hand: ["event:Airlift"] });
    s = { ...s, phase: "infect", inf: null, infDeck: ["Atlanta", ...s.infDeck.filter((c) => c !== "Atlanta")] };
    s = go(s, "red", "infect");
    expect(s.outbreaks).toBe(3);
    expect(s.cubes.Atlanta!.blue).toBe(3);
    expect(s.cubes.Montreal!.blue).toBe(2); // from Chicago and Washington
    expect(s.cubes.Miami!.blue).toBe(2); // from Atlanta and Washington
  });
  it("infection cards are drawn one at a time with an event window between them", () => {
    let s = calm(start(2, { epidemics: 5 }, 5));
    s = pl(s, "blue", { hand: ["event:Airlift"] });
    s = { ...s, playerDeck: ["city:Lima", "city:Paris", ...s.playerDeck.filter((c) => c !== "city:Lima" && c !== "city:Paris")] };
    s = go(s, "red", "end");
    expect(s.phase).toBe("infect");
    s = go(s, "red", "infect");
    expect(s.phase).toBe("infect");
    expect(s.inf!.left).toBe(1);
    expect(ids(s, "blue")).toContain("ev:Airlift");
    s = go(s, "blue", "ev:Airlift", "blue", "Paris");
    expect(s.pl.blue!.city).toBe("Paris");
    // No event left in anyone's hand: the step finishes by itself.
    expect(s.current).toBe(1);
    expect(s.phase).toBe("actions");
  });
  it("two epidemics drawn together: a window between them; only Resilient Population inside an epidemic", () => {
    let s = calm(start(2, { epidemics: 5 }, 6));
    s = pl(s, "blue", { hand: ["event:Airlift", "event:Resilient Population"] });
    s = { ...s, playerDeck: ["epidemic", "epidemic", ...s.playerDeck.filter((c) => c !== "epidemic")] };
    s = go(s, "red", "end");
    expect(s.phase).toBe("epidemic");
    expect(ids(s, "blue")).toEqual(["ev:Resilient Population"]);
    s = go(s, "red", "continue");
    expect(s.phase).toBe("drawWindow");
    expect(ids(s, "blue")).toContain("ev:Airlift");
    s = go(s, "red", "continue");
    expect(s.phase).toBe("epidemic");
    expect(s.rateIdx).toBe(2);
  });
  it("Resilient Population never removes a Mutation card", () => {
    let s = calm(start(2, { mutation: true }, 7));
    s = pl(s, "red", { hand: ["event:Resilient Population"] });
    const opts = allIds(s, "red", ["ev:Resilient Population"]);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.some((o) => o.startsWith("Mutation"))).toBe(false);
  });
  it("the Dispatcher can move his own pawn to a city with another pawn", () => {
    let s = calm(start(2, {}, 8));
    s = pl(pl(s, "red", { role: "Dispatcher" }), "blue", { city: "Lima" });
    expect(allIds(s, "red", ["dispatch", "red"])).toEqual(["join"]);
    s = go(s, "red", "dispatch", "red", "join", "Lima");
    expect(s.pl.red!.city).toBe("Lima");
  });
  it("cures pick their cards one at a time when there is a choice", () => {
    let s = calm(start(2, {}, 9));
    const blue = ["Chicago", "Essen", "London", "Madrid", "Milan", "Paris"].map((c) => `city:${c}`);
    s = pl(s, "red", { role: "Medic", hand: blue });
    expect(ids(s, "red", ["cure", "blue"])).toHaveLength(2); // the first card: 2 sets of 5 left open
    s = go(s, "red", "cure", "blue", "city:Essen", "city:London", "city:Madrid", "city:Milan", "city:Paris");
    expect(s.cured).toContain("blue");
    expect(s.pl.red!.hand).toEqual(["city:Chicago"]);
  });
});

describe("on the brink roles and events", () => {
  const otb = (seed = 1) => calm(start(3, { onTheBrink: true, epidemics: 5 }, seed));
  it("the Troubleshooter shows the card on a Direct Flight, as often as she likes", () => {
    let s = pl(otb(), "red", { role: "Troubleshooter", hand: ["city:Lima", "city:Paris"] });
    s = go(s, "red", "direct", "Lima");
    s = go(s, "red", "direct", "Paris");
    expect(s.pl.red!.city).toBe("Paris");
    expect(s.pl.red!.hand).toEqual(["city:Lima", "city:Paris"]);
  });
  it("Mobile Hospital played by another player works on the current player's drives, with a choice of colour", () => {
    let s = pl(otb(2), "blue", { hand: ["event:Mobile Hospital"] });
    s = { ...s, cubes: { Chicago: { blue: 1, red: 2 } }, supply: { ...s.supply, blue: 23, red: 22 } };
    s = go(s, "blue", "ev:Mobile Hospital");
    s = go(s, "red", "drive", "Chicago");
    expect(pack.status(s).actors).toEqual(["red"]);
    s = go(s, "red", "red");
    expect(s.cubes.Chicago).toEqual({ blue: 1, red: 1 });
  });
  it("Rapid Vaccine Deployment: right after a cure, even the last action; connected cities only", () => {
    let s = pl(otb(3), "red", { role: "Scientist", hand: ["Chicago", "Essen", "London", "Madrid"].map((c) => `city:${c}`) });
    s = pl(s, "blue", { hand: ["event:Rapid Vaccine Deployment"] });
    s = { ...s, actionsLeft: 1, cubes: { Paris: { blue: 2 }, London: { blue: 1 }, Tokyo: { red: 1 }, Atlanta: { blue: 1 } }, supply: { ...s.supply, blue: 20, red: 23 } };
    s = go(s, "red", "cure", "blue");
    expect(s.phase).toBe("actions");
    expect(s.actionsLeft).toBe(0);
    expect(ids(s, "blue")).toContain("ev:Rapid Vaccine Deployment");
    const bad = pack.choices(s, "blue", ["ev:Rapid Vaccine Deployment", "Atlanta", "Paris"])!.options.find((o) => o.id === "done")!;
    expect(bad.disabled).toBeTruthy();
    const deck = s.playerDeck.length;
    s = go(s, "blue", "ev:Rapid Vaccine Deployment", "London", "Paris", "Paris", "done");
    expect(s.log.join(" ")).toMatch(/3 blue cubes removed \(London, Paris\)/);
    expect(s.playerDeck.length).toBe(deck - 2); // then the turn moved on to the Draw step
  });
  it("Commercial Travel Ban sits in front of the current player, whoever plays it", () => {
    let s = pl(otb(4), "blue", { hand: ["event:Commercial Travel Ban"] });
    s = go(s, "blue", "ev:Commercial Travel Ban");
    expect((pack.view(s, "red").extra.travelBan)).toBe("red");
  });
  it("Special Orders gives the current player another pawn to move", () => {
    let s = pl(otb(5), "blue", { hand: ["event:Special Orders"] });
    s = go(s, "blue", "ev:Special Orders", "green");
    s = go(s, "red", "orders", "drive", "Chicago");
    expect(s.pl.green!.city).toBe("Chicago");
  });
  it("New Assignment to the Generalist mid-turn gives the fifth action", () => {
    let s = pl(otb(6), "blue", { hand: ["event:New Assignment"] });
    s = { ...s, unusedRoles: ["Generalist"], actionsLeft: 2 };
    s = go(s, "blue", "ev:New Assignment", "red", "Generalist");
    expect(s.pl.red!.role).toBe("Generalist");
    expect(s.actionsLeft).toBe(3);
  });
  it("Re-examined Research: the chosen player takes a card from the discards", () => {
    let s = pl(otb(7), "blue", { hand: ["event:Re-examined Research"] });
    s = { ...s, playerDiscard: ["city:Lima"] };
    s = go(s, "blue", "ev:Re-examined Research", "green", "city:Lima");
    expect(s.pl.green!.hand).toEqual(["city:Lima"]);
  });
  it("Borrowed Time only during your own actions; the Archivist holds 8", () => {
    let s = pl(otb(8), "blue", { hand: ["event:Borrowed Time"] });
    expect(pack.status(s).actors).toEqual(["red"]); // blue can't play it on red's turn
    s = pl(s, "red", { hand: ["event:Borrowed Time"] });
    s = go(s, "red", "ev:Borrowed Time");
    expect(s.actionsLeft).toBe(6);
    s = pl(s, "red", { role: "Archivist", hand: CITY_LIST.slice(0, 7) });
    s = { ...s, playerDeck: ["city:Lima", "city:Paris", ...s.playerDeck] };
    s = go(s, "red", "end");
    expect(s.pending.map((p) => p.seat)).toEqual(["red"]);
    expect(pack.choices(s, "red", [])!.label).toMatch(/limit 8/);
  });
  it("Field Operative: samples leave the board and stand in for 2 cards", () => {
    let s = pl(otb(9), "red", { role: "Field Operative", hand: ["Chicago", "Essen", "London"].map((c) => `city:${c}`) });
    s = { ...s, cubes: { Atlanta: { blue: 3 } }, supply: { ...s.supply, blue: 21 } };
    s = go(s, "red", "sample", "blue");
    expect(s.cubes.Atlanta!.blue).toBe(2);
    expect(s.supply.blue).toBe(21);
    expect(ids(s, "red")).not.toContain("sample"); // once a turn
    s = { ...s, ext: { ...s.ext, onTheBrink: { ...(s.ext.onTheBrink as object), samples: { red: { blue: 3 } } } as never } };
    s = go(s, "red", "foCure", "blue");
    expect(s.cured).toContain("blue");
    expect(s.pl.red!.hand).toEqual([]);
    expect(s.supply.blue).toBe(24);
  });
});
const CITY_LIST = Object.keys(CITIES).map((c) => `city:${c}`);

describe("virulent strain", () => {
  const vs = (seed = 1) => calm(start(2, { virulentStrain: true, epidemics: 5 }, seed));
  const withStrain = (s: State, active: string[]): State => ({ ...s, ext: { ...s.ext, virulentStrain: { color: "blue", active, seen: active } as never } });
  it("immediate effects happen before Intensify; the strain is never purple", () => {
    let s = vs(1);
    s = { ...s, playerDeck: ["vs:Unacceptable Loss", "city:Lima", ...s.playerDeck.filter((c) => !c.startsWith("vs:"))] };
    s = go(s, "red", "end");
    const strain = (pack.view(s, "red").extra.virulentStrain as { color: string }).color;
    expect(["blue", "yellow", "black", "red"]).toContain(strain);
    expect(s.supply[strain]! + onBoard(s, strain)).toBe(20);
  });
  it("Government Interference: leaving needs a strain cube treated there by the current player this turn", () => {
    let s = withStrain(vs(2), ["Government Interference"]);
    s = { ...s, cubes: { Atlanta: { blue: 2 } }, supply: { ...s.supply, blue: 22 } };
    s = pl(s, "red", { hand: ["event:Airlift"] });
    expect(pack.choices(s, "red", [])!.options.find((o) => o.id === "drive")!.disabled).toMatch(/Government Interference/);
    expect(pack.choices(s, "red", ["ev:Airlift"])!.options.find((o) => o.id === "blue")!.disabled).toMatch(/Government Interference/);
    s = go(s, "red", "treat", "blue");
    expect(ids(s, "red")).toContain("drive");
    expect(ids(s, "red", ["ev:Airlift"])).toContain("blue");
  });
  it("Rate Effect: one more infection card when a strain city came up", () => {
    let s = withStrain(vs(3), ["Rate Effect"]);
    s = pl(s, "blue", { hand: ["event:Airlift"] });
    s = { ...s, phase: "infect", inf: null, infDeck: ["Paris", "Lima", "Tokyo", ...s.infDeck.filter((c) => !["Paris", "Lima", "Tokyo"].includes(c))] };
    s = go(go(s, "red", "infect"), "red", "infect");
    expect(s.inf!.left).toBe(1);
    s = go(s, "red", "infect");
    expect(s.infDiscard.slice(-3)).toEqual(["Paris", "Lima", "Tokyo"]);
  });
  it("continuing effects outlast the cure, except Complex Molecular Structure", () => {
    let s = withStrain(vs(4), ["Chronic Effect", "Complex Molecular Structure"]);
    s = pl(s, "red", { role: "Medic", hand: ["Chicago", "Essen", "London", "Madrid", "Milan", "Paris"].map((c) => `city:${c}`) });
    expect(pack.choices(s, "red", ["cure"])!.options.find((o) => o.id === "blue")!.label).toMatch(/6 cards/);
    s = { ...s, cured: ["blue"] };
    s = pl(s, "blue", { hand: ["event:Airlift"] });
    s = { ...s, phase: "infect", inf: null, infDeck: ["Paris", ...s.infDeck.filter((c) => c !== "Paris")] };
    s = go(s, "red", "infect");
    expect(s.cubes.Paris!.blue).toBe(2);
  });
});

describe("mutation", () => {
  const mu = (seed = 1) => calm(start(2, { mutation: true, epidemics: 5 }, seed));
  it("a Mutation event drawn with an epidemic goes first; two of them: the player orders them", () => {
    let s = mu(1);
    s = { ...s, playerDeck: ["epidemic", "mutation:Mutation Threatens", ...s.playerDeck.filter((c) => c !== "epidemic" && !c.startsWith("mutation:"))] };
    const bottom = s.infDeck[s.infDeck.length - 1]!;
    s = go(s, "red", "end");
    expect(s.cubes[bottom]!.purple).toBe(3); // Threatens took the bottom card before the epidemic did
    let t = mu(2);
    t = { ...t, playerDeck: ["mutation:Mutation Spreads", "mutation:Mutation Intensifies", ...t.playerDeck.filter((c) => !c.startsWith("mutation:"))] };
    t = go(t, "red", "end");
    expect(t.pending[0]!.kind).toBe("drawOrder");
    t = go(t, "red", "mutation:Mutation Intensifies");
    expect(onBoard(t, "purple")).toBe(3);
  });
  it("infecting a city with purple on it puts both colours there", () => {
    let s = mu(3);
    s = { ...s, cubes: { Paris: { purple: 1 } }, supply: { ...s.supply, purple: 11 } };
    s = pl(s, "blue", { hand: ["event:Airlift"] });
    s = { ...s, phase: "infect", inf: null, infDeck: ["Paris", ...s.infDeck.filter((c) => c !== "Paris")] };
    s = go(s, "red", "infect");
    expect(s.cubes.Paris).toEqual({ purple: 2, blue: 1 });
  });
  it("Mutation events do nothing once purple is eradicated", () => {
    let s = mu(4);
    s = { ...s, cured: ["purple"], eradicated: ["purple"], playerDeck: ["mutation:Mutation Threatens", "city:Lima", ...s.playerDeck.filter((c) => !c.startsWith("mutation:") && c !== "city:Lima")] };
    const deck = s.infDeck.length;
    s = go(s, "red", "end");
    expect(onBoard(s, "purple")).toBe(0);
    expect(s.infDeck.length).toBeLessThanOrEqual(deck - 2); // only the infection step drew
  });
  it("a purple cure takes any 5 city cards with at least one purple city", () => {
    let s = mu(5);
    s = { ...s, cubes: { Lima: { purple: 1 } }, supply: { ...s.supply, purple: 11 } };
    s = pl(s, "red", { role: "Medic", hand: ["Chicago", "Essen", "Tokyo", "Cairo", "Paris", "Lima"].map((c) => `city:${c}`) });
    // Without Lima the fifth card must be Lima.
    expect(ids(s, "red", ["curePurple", "city:Chicago", "city:Essen", "city:Tokyo", "city:Cairo"])).toEqual(["city:Lima"]);
    s = go(s, "red", "curePurple", "city:Chicago", "city:Essen", "city:Tokyo", "city:Cairo", "city:Lima");
    expect(s.cured).toContain("purple");
  });
});

describe("bio-terrorist", () => {
  const btGame = (seed = 1, opts: { [k: string]: Json } = {}) => {
    let s = start(4, { bioterrorist: true, onTheBrink: true, epidemics: 5, ...opts }, seed);
    s = go(s, "yellow", "Lima");
    return s;
  };
  const bt = (s: State) => s.ext.bioterrorist as { hand: string[]; city: string; sheet: string[]; captured: boolean; over: boolean; left: number };
  const atBt = (s: State): State => ({ ...s, phase: "bt", queue: [], ext: { ...s.ext, bioterrorist: { ...bt(s), left: 2, freeDrive: 1, used: {} } as never } });
  it("seats: 3 to 5 in all, 2 events per seat counting him, a random seat if asked", () => {
    expect(() => start(6, { bioterrorist: true, onTheBrink: true })).toThrow(/besides the Bio-Terrorist/);
    const s = start(4, { bioterrorist: true, onTheBrink: true });
    expect([...s.playerDeck, ...s.players.flatMap((x) => s.pl[x]!.hand)].filter((c) => c.startsWith("event:"))).toHaveLength(8);
    const btSeats = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) btSeats.add((start(4, { bioterrorist: true, bioterroristSeat: "random" }, seed).ext.bioterrorist as { seat: string }).seat);
    expect(btSeats.size).toBeGreaterThan(1);
  });
  it("he may draw past 7 cards but must then discard one", () => {
    let s = atBt(btGame(1));
    s = { ...s, ext: { ...s.ext, bioterrorist: { ...bt(s), hand: ["Paris", "Lima", "Tokyo", "Cairo", "Essen", "Milan", "Seoul"] } as never } };
    s = go(s, "yellow", "draw");
    expect(bt(s).over).toBe(true);
    expect(pack.choices(s, "yellow", [])!.label).toMatch(/Hand limit 7/);
    s = go(s, "yellow", "Paris");
    expect(bt(s).hand).toHaveLength(7);
    expect(s.infDiscard[s.infDiscard.length - 1]).toBe("Paris");
  });
  it("a drive is silent; a flight shows only the airport", () => {
    let s = atBt(btGame(2));
    s = { ...s, ext: { ...s.ext, bioterrorist: { ...bt(s), city: "Lima", hand: ["Lima", "Tokyo"] } as never } };
    s = go(s, "yellow", "drive", "Santiago");
    expect(s.log).toEqual([]);
    s = go(s, "yellow", "direct", "Tokyo");
    expect(s.log.join(" ")).toMatch(/airport in Tokyo/);
    expect(s.log.join(" ")).not.toMatch(/direct|charter/i);
    expect(bt(s).sheet.join(" ")).toMatch(/drive to Santiago/);
    expect((pack.view(s, "red").extra.bioterrorist as { sheet: string[] }).sheet).toEqual([]);
  });
  it("purple flares out: 2 cubes go back, each neighbour gets 1", () => {
    let s = atBt(btGame(3));
    s = { ...s, cubes: { ...s.cubes, Lima: { ...s.cubes.Lima, purple: 3 } }, supply: { ...s.supply, purple: 9 } };
    for (const x of s.players) s = pl(s, x, { city: "Tokyo", role: "Scientist" });
    s = { ...s, ext: { ...s.ext, bioterrorist: { ...bt(s), city: "Lima" } as never } };
    const before = s.outbreaks;
    s = go(s, "yellow", "local");
    expect(s.outbreaks).toBe(before + 1);
    expect(s.cubes.Lima!.purple).toBe(1);
    for (const n of ["Bogota", "Mexico City", "Santiago"]) expect(s.cubes[n]!.purple).toBe(1);
  });
  it("after an escape he finishes his turn normally", () => {
    let s = atBt(btGame(4));
    s = { ...s, ext: { ...s.ext, bioterrorist: { ...bt(s), captured: true, hand: [] } as never } };
    expect(ids(s, "yellow")).toEqual(["draw", "pass"]);
    s = go(s, "yellow", "draw");
    const card = bt(s).hand[0]!;
    s = go(s, "yellow", "escape", card);
    expect(bt(s).captured).toBe(false);
    expect(bt(s).city).toBe(card);
    expect(ids(s, "yellow")).toContain("drive"); // the extra move is still there
  });
});
