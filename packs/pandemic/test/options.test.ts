// Rules of the five On the Brink modules, each an option of the pack: through the pack with the option on
// (trusted adapter) where a room shows them, and the module's own handlers called directly where a situation is
// rare in random play. Then the option rules: every combination `setup` refuses.
import { describe, expect, it } from "vitest";
import type { Action, Rng, Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import roles from "../src/expansions/roles";
import events from "../src/expansions/events";
import vs from "../src/expansions/virulent-strain";
import mutation from "../src/expansions/mutation";
import bt from "../src/expansions/bioterrorist";
import { optionProblem } from "../src/index";
import type { PDOp, PDOutcome, PDPl, PDState } from "../src/types";
import { room, seats, type Room } from "./rooms";

type S = PDState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
const start = async (r: Room, n: number, seed = 1) => {
  const h = await room(r);
  return { p: h.trusted, s: h.trusted.setup({ options: h.options, seats: seats(n), rng: rng(seed) }) as S };
};
const act = (p: PackHandle, s: S, seat: string, action: Action, seed = 7) => p.apply(s, seat, action, rng(seed)).state as S;
const ids = (p: PackHandle, s: S, seat: string, partial: Step[] = []) => p.choices(s, seat, partial)?.options.map((o) => o.id) ?? [];
const cur = (s: S) => s.players[s.current]!;
const set = (s: S, seat: string, over: Partial<PDPl>): S => ({ ...s, pl: { ...s.pl, [seat]: { ...s.pl[seat]!, ...over } as PDPl } });
const hand = (s: S, seat: string, items: string[]): S => set(s, seat, { hand: { ...s.pl[seat]!.hand, items } });
// A module's handler called directly, with only the fields the case needs.
const call = <T>(f: unknown, input: object): T => (f as (x: object) => T)(input);
type BtSlice = { city: string; captured: boolean; free: number; left: number };
const btOf = (s: S) => s.slices.bioterrorist as unknown as BtSlice;
const btView = (p: PackHandle, s: S, viewer: string) => (p.view(s, viewer) as unknown as { modules: { bioterrorist: { city: string | null } } }).modules.bioterrorist;

describe("option roles", () => {
  it("allows 5 players and the legendary game, and adds its six roles", async () => {
    const { s } = await start({ mods: ["roles"], options: { epidemics: 7 } }, 5);
    expect(s.players).toHaveLength(5);
    expect(s.piles).toHaveLength(7);
    expect([...s.unusedRoles, ...s.players.map((x) => s.pl[x]!.role)]).toHaveLength(13);
  });

  it("gives the Generalist 5 actions and the Archivist a hand limit of 8", async () => {
    const { p, s } = await start({ mods: ["roles"] }, 2);
    const me = cur(s), other = s.players.find((x) => x !== me)!;
    const g = act(p, set(set(s, me, { role: "Medic" }), other, { role: "Generalist" }), me, ["end"]);
    let t = g;
    while (cur(t) !== other || t.step !== "actions") t = act(p, t, p.status(t).actors[0]!, ids(p, t, p.status(t).actors[0]!).includes("pass") ? ["pass"] : [ids(p, t, p.status(t).actors[0]!)[0]!]);
    expect(t.actionsLeft).toBe(5);
    expect(call<number>(roles.contributes!.handLimit, { state: set(s, me, { role: "Archivist" }), value: 7, args: { seat: me } })).toBe(8);
    expect(call<number>(roles.contributes!.handLimit, { state: s, value: 7, args: { seat: other } })).toBe(7);
  });

  it("lets the Epidemiologist ask for a card without seeing the hand (G2), free and once a turn", async () => {
    const { p, s: s0 } = await start({ mods: ["roles"] }, 2);
    const me = cur(s0), other = s0.players.find((x) => x !== me)!;
    let s = hand(hand(set(set(s0, me, { role: "Epidemiologist" }), other, { role: "Medic" }), other, ["city:Paris", "city:Lima"]), me, []);
    expect(ids(p, s, me)).toContain("epidemiologist");
    expect(ids(p, s, me, ["epidemiologist"])).toEqual([other]);
    s = act(p, s, me, ["epidemiologist", other]);
    expect(ids(p, s, other)).toEqual(["g:city:Paris", "g:city:Lima", "refuse"]);
    s = act(p, s, other, ["g:city:Lima"]);
    expect(s.pl[me]!.hand.items).toEqual(["city:Lima"]);
    expect(s.actionsLeft).toBe(4);
    expect(ids(p, s, me)).not.toContain("epidemiologist");
  });

  it("lets the Field Operative cure with 3 samples for 2 of the cards", async () => {
    const { p, s: s0 } = await start({ mods: ["roles"] }, 2);
    const me = cur(s0);
    const s = hand(set(s0, me, { role: "Field Operative", samples: { red: 3 } }), me, ["city:Tokyo", "city:Osaka", "city:Seoul"]);
    expect(p.choices(s, me, ["cure"])!.options.filter((o) => !o.disabled).map((o) => o.id)).toEqual(["red+samples"]);
    const t = act(p, s, me, ["cure", "red+samples"]);
    expect(t.cured).toEqual(["red"]);
    expect(t.pl[me]!.samples.red).toBe(0);
    expect(t.supply.red).toBe(s.supply.red! + 3);
  });
});

describe("option events", () => {
  it("puts 2 events per player in the game, from 13", async () => {
    for (const n of [2, 3, 4]) {
      const { s } = await start({ mods: ["events"] }, n);
      expect(s.nEvents).toBe(2 * n);
      const all = [...s.playerDeck.items, ...s.players.flatMap((x) => s.pl[x]!.hand.items)];
      expect(all.filter((k) => k.startsWith("event:"))).toHaveLength(2 * n);
    }
  });

  it("holds the infection rate at 1 under a Commercial Travel Ban until its player's next turn", () => {
    const sl = { ctb: "green", mobile: null };
    expect(call<number>(events.contributes!.infectionRate, { value: 3, slice: sl })).toBe(1);
    expect(call<{ slice: { ctb: string | null } }>(events.contributes!.turnStart, { slice: sl, args: { seat: "green" } }).slice.ctb).toBe(null);
    expect(call<object>(events.contributes!.turnStart, { slice: sl, args: { seat: "orange" } })).toEqual({});
  });

  it("asks another player before Special Orders moves his pawn (G2)", async () => {
    const { p, s: s0 } = await start({ mods: ["events"] }, 2);
    const me = cur(s0), other = s0.players.find((x) => x !== me)!;
    let s = hand(s0, me, ["event:Special Orders"]);
    s = act(p, s, me, ["ev:Special Orders", other]);
    expect(s.pl[me]!.hand.items).toEqual(["event:Special Orders"]);
    expect(ids(p, s, other)).toEqual(["yes", "no"]);
    s = act(p, s, other, ["yes"]);
    expect(s.grant).toBe(other);
    expect(s.pl[me]!.hand.items).toEqual([]);
    expect(ids(p, s, me)).toContain("granted");
  });
});

describe("option virulentStrain", () => {
  it("replaces the epidemics with Virulent Strain ones (as many as the room's epidemics) and names the strain on the first", async () => {
    const { s } = await start({ mods: ["virulentStrain"] }, 3);
    expect(s.epiPool).toHaveLength(8);
    expect(s.playerDeck.items.filter((k) => k.startsWith("epidemic:"))).toHaveLength(5);
    const st = { ...s, cubes: { Tokyo: { red: 3 }, Paris: { blue: 1 } } };
    const out = call<{ slice: { color: string; seen: string[] }; ops: PDOp[] }>(vs.contributes!.epidemic, { state: st, slice: null, args: { step: "infected", card: "epidemic:Unacceptable Loss" }, rng: rng(1) });
    expect(out.slice.color).toBe("red");
    expect(out.ops).toContainEqual({ op: "supply", color: "red", n: -4 });
  });

  it("makes lasting effects work from Intensify: Slippery Slope, Complex Molecular Structure", () => {
    const sl = { color: "red", active: ["Slippery Slope", "Complex Molecular Structure"], seen: [] };
    expect(call<number>(vs.contributes!.outbreakSteps, { slice: sl, value: 1, args: { color: "red" } })).toBe(2);
    expect(call<number>(vs.contributes!.outbreakSteps, { slice: sl, value: 1, args: { color: "blue" } })).toBe(1);
    expect(call<number>(vs.contributes!.cureCost, { slice: sl, value: 5, args: { seat: "x", color: "red" } })).toBe(6);
  });
});

describe("option mutation", () => {
  it("adds purple: 12 cubes, two Mutation cards in the infection discards, three Mutation cards in the deck", async () => {
    const { s } = await start({ mods: ["mutation"] }, 3);
    expect(s.supply.purple).toBe(12);
    expect(s.infDiscard.slice(-2)).toEqual(["Mutation! 1", "Mutation! 2"]);
    expect(s.playerDeck.items.filter((k) => k.startsWith("mutation:"))).toHaveLength(3);
  });

  it("puts purple on the bottom infection card, and needs purple cured or gone to win", () => {
    const st = { eradicated: [], cubes: {}, cured: [] };
    expect(call<{ ops: PDOp[] }>(mutation.contributes!.infectCard, { state: st, args: { card: "Mutation! 1" } }).ops).toContainEqual({ op: "infectBottom", color: "purple", n: 1 });
    expect(call<{ ops: PDOp[] }>(mutation.contributes!.drawCard, { state: st, args: { card: "mutation:Mutation Threatens" } }).ops).toContainEqual({ op: "infectBottom", color: "purple", n: 3 });
    expect(call<boolean>(mutation.contributes!.cureGoal, { state: { ...st, cubes: { Lima: { purple: 1 } } }, value: true })).toBe(false);
    expect(call<boolean>(mutation.contributes!.cureGoal, { state: st, value: true })).toBe(true);
  });

  it("can't be played with the Bio-Terrorist: setup refuses, naming both", async () => {
    await expect(start({ mods: ["mutation", "bioterrorist"] }, 4)).rejects.toThrow(/Mutation and the Bio-Terrorist can't be played together/);
  });
});

describe("option bioterrorist", () => {
  it("takes the last seat (no pawn), deals him 2 infection cards and asks him first for his secret city", async () => {
    const { p, s } = await start({ mods: ["bioterrorist"] }, 4);
    expect(s.players).toEqual(["green", "orange", "white"]);
    expect(s.held.pink!.items).toHaveLength(2);
    expect(s.held.pink!.seenBy).toEqual(["pink"]);
    expect(p.status(s).actors).toEqual(["pink"]);
    const t = act(p, s, "pink", [`c:Lima`]);
    expect(btOf(t).city).toBe("Lima");
    expect(btView(p, t, "green").city).toBe(null);
    expect(btView(p, t, "pink").city).toBe("Lima");
    expect(p.status(t).actors).toEqual([cur(t)]);
  });

  it("is spotted at once when he starts where a pawn stands: a reveal, logged as a spotting (PR #118 review)", async () => {
    const { p, s } = await start({ mods: ["bioterrorist"] }, 3);
    const quiet = p.apply(s, "white", [`c:Lima`], rng(3));
    expect(quiet.reveal).toBeFalsy();
    const r = p.apply(s, "white", [`c:Atlanta`], rng(3));
    expect(r.reveal).toBe(true);
    const t = r.state as S;
    expect(t.log).toContain("The Bio-Terrorist is spotted in Atlanta!");
    expect(btView(p, t, "green").city).toBe("Atlanta");
  });

  it("picks a random seat when asked", async () => {
    const h = await room({ mods: ["bioterrorist"], options: { bioterroristSeat: "random" } });
    const pawns = new Set([1, 2, 3, 4, 5, 6].map((n) => (h.trusted.setup({ options: h.options, seats: seats(4), rng: rng(n) }) as S).players.join()));
    expect(pawns.size).toBeGreaterThan(1);
  });

  it("refuses 2 seats (one player besides him)", async () => {
    await expect(start({ mods: ["bioterrorist"] }, 2)).rejects.toThrow(/Bio-Terrorist/);
  });

  it("wins when the players lose with purple on the board; otherwise everyone loses; a players' win is theirs", () => {
    const sl = { seat: "pink", city: "Lima" };
    const lose = { winners: [], text: "the players lose (8 outbreaks)" };
    expect(call<PDOutcome>(bt.contributes!.outcome, { state: { eradicated: [], cubes: { Lima: { purple: 1 } } }, slice: sl, args: { result: lose } })).toEqual({ winners: ["pink"], text: "the Bio-Terrorist wins (8 outbreaks)" });
    expect(call<PDOutcome>(bt.contributes!.outcome, { state: { eradicated: [], cubes: {} }, slice: sl, args: { result: lose } }).winners).toEqual([]);
    expect(call<PDOutcome>(bt.contributes!.outcome, { state: { eradicated: [], cubes: {} }, slice: sl, args: { result: { winners: ["green", "orange"], text: "won" } } }).winners).toEqual(["green", "orange"]);
  });

  it("is spotted by a pawn entering his city (a reveal either way) and captured there, his hand discarded", async () => {
    const { p, s: s0 } = await start({ mods: ["bioterrorist"] }, 3);
    let s = act(p, s0, "white", [`c:Washington`]);
    const me = cur(s);
    s = set(s, me, { role: "Medic" });
    const r = p.apply(s, me, ["drive", "Washington"], rng(3));
    expect(r.reveal).toBe(true);
    s = r.state as S;
    expect(s.log).toContain(`${me} spots the Bio-Terrorist in Washington!`);
    expect(btView(p, s, me).city).toBe("Washington");
    const held = s.held.white!.items;
    s = act(p, s, me, ["capture"]);
    expect(btOf(s).captured).toBe(true);
    expect(s.held.white!.items).toEqual([]);
    expect(s.infDiscard.slice(-held.length)).toEqual(held);
  });

  it("over his hand limit of 7 discards the card he just drew, without effect and with no choice (OTB p6)", async () => {
    const { p, s: s0 } = await start({ mods: ["bioterrorist"] }, 3);
    let s = act(p, s0, "white", [`c:Lima`]);
    const me = cur(s);
    s = act(p, s, me, ["end"]);
    for (let i = 0; i < 40 && !p.status(s).actors.includes("white"); i++) { const x = p.status(s).actors[0]!; s = act(p, s, x, ids(p, s, x).includes("pass") ? ["pass"] : [ids(p, s, x)[0]!]); }
    expect(p.status(s).actors).toEqual(["white"]);
    // Seven in his hand, taken from the infection deck's bottom so the top stays as dealt.
    const deck = s.infDeck.items;
    const seven = deck.slice(-7);
    s = { ...s, held: { ...s.held, white: { ...s.held.white!, items: seven } }, infDeck: { ...s.infDeck, items: deck.slice(0, -7) }, infSegs: [deck.length - 7] };
    const top = s.infDeck.items[0]!;
    const cubes = JSON.stringify(s.cubes);
    const r = p.apply(s, "white", ["draw"], rng(1));
    const t = r.state as S;
    expect(t.held.white!.items).toEqual(seven);
    expect(t.infDiscard[t.infDiscard.length - 1]).toBe(top);
    expect(JSON.stringify(t.cubes)).toBe(cubes);
    expect(t.log.join(" ")).toMatch(/over his hand limit/);
    // No question: his next prompt is his actions, not a discard.
    expect(p.choices(t, "white", [])?.label ?? "").not.toMatch(/Hand limit/);
  });

  it("takes his turn after a player's: 2 actions and a free drive, a quiet drive naming no city", async () => {
    const { p, s: s0 } = await start({ mods: ["bioterrorist"] }, 3);
    let s = act(p, s0, "white", [`c:Lima`]);
    const me = cur(s);
    s = act(p, s, me, ["end"]);
    for (let i = 0; i < 40 && !p.status(s).actors.includes("white"); i++) { const x = p.status(s).actors[0]!; s = act(p, s, x, ids(p, s, x).includes("pass") ? ["pass"] : [ids(p, s, x)[0]!]); }
    expect(p.status(s).actors).toEqual(["white"]);
    const opts = ids(p, s, "white");
    expect(opts).toContain("drive");
    expect(p.choices(s, "white", [])!.label).toMatch(/2 actions left/);
    const r = p.apply(s, "white", ["drive", "c:Santiago"], rng(1));
    expect(r.reveal).toBeUndefined();
    s = r.state as S;
    expect(p.describe!(s, "white", ["drive", "c:Santiago"], "green")).not.toMatch(/Santiago|Lima/);
    expect(btOf(s)).toMatchObject({ city: "Santiago", free: 0, left: 2 });
  });
});

describe("pandemic modules: their lines under the table on a phone (phone play, 2026-11-18)", () => {
  it("wraps the Bio-Terrorist's, the travel ban's and the virulent strain's lines within 34 columns", () => {
    const sheet = ["Turn 3: moves from Ho Chi Minh City to Kolkata by train", "Turn 4: infects Kolkata"];
    const lines = [
      call<string>(bt.text!.state, { view: { seat: "pink", city: "Ho Chi Minh City", sighting: "St. Petersburg", captured: false, out: false, sheet } }),
      call<string>(events.text!.state, { view: { travelBan: "orange" } }),
      call<string>(vs.text!.state, { view: { color: "yellow", active: ["Slippery Slope", "Complex Molecular Structure"] } }),
    ];
    for (const t of lines) for (const l of t.split("\n")) expect(l.length, l).toBeLessThanOrEqual(34);
    expect(lines[0]!.replace(/\n +/g, " ")).toContain("Bio-Terrorist (pink): in Ho Chi Minh City; last sighted at St. Petersburg.");
    expect(lines[0]).toContain("Your sheet:");
  });
});

describe("option rules: what setup refuses (README, \"Option rules\")", () => {
  const on = (...mods: string[]) => Object.fromEntries(mods.map((m) => [m, true]));
  it("says why for each combination that can't be played, and nothing for those that can", () => {
    expect(optionProblem(on("mutation", "bioterrorist"), 4)).toMatch(/Mutation and the Bio-Terrorist/);
    expect(optionProblem(on("bioterrorist"), 2)).toMatch(/Bio-Terrorist needs 3 to 5 seats/);
    expect(optionProblem({}, 5)).toMatch(/5 players need the On the Brink roles/);
    expect(optionProblem({ epidemics: 7 }, 3)).toMatch(/7 epidemics \(legendary\) need the On the Brink roles/);
    expect(optionProblem({ ...on("events", "virulentStrain"), epidemics: 7 }, 3)).toMatch(/need the On the Brink roles/);
    // 5 seats with the Bio-Terrorist are 4 players: no roles needed. With the roles, 5 players and 7 epidemics.
    expect(optionProblem(on("bioterrorist"), 5)).toBe(null);
    expect(optionProblem(on("bioterrorist"), 3)).toBe(null);
    expect(optionProblem({ ...on("roles"), epidemics: 7 }, 5)).toBe(null);
    expect(optionProblem({ ...on("roles", "events", "virulentStrain", "mutation"), epidemics: 7 }, 5)).toBe(null);
    expect(optionProblem({ ...on("roles", "events", "virulentStrain", "bioterrorist"), epidemics: 7 }, 5)).toBe(null);
    for (const n of [2, 3, 4]) for (const e of [4, 5, 6]) expect(optionProblem({ epidemics: e }, n)).toBe(null);
  });

  it("refuses each of them at setup with that reason, in the pack as built", async () => {
    await expect(start({ mods: ["mutation", "bioterrorist"] }, 4)).rejects.toThrow(/switch one of them off/);
    await expect(start({ mods: ["bioterrorist"] }, 2)).rejects.toThrow(/needs 3 to 5 seats/);
    await expect(start({ mods: ["events"] }, 5)).rejects.toThrow(/5 players need the On the Brink roles/);
    await expect(start({ mods: ["virulentStrain"], options: { epidemics: 7 } }, 4)).rejects.toThrow(/7 epidemics/);
  });

  it("leaves the choice of the Bio-Terrorist's seat without effect when he isn't in the game", async () => {
    const { s } = await start({ mods: [], options: { bioterroristSeat: "random" } }, 3);
    expect(s.players).toEqual(["green", "orange", "white"]);
    expect(s.mods).toEqual([]);
  });

  it("has no presets: a challenge keeps the room's number of epidemics, 4 (introductory, open hands) by default", async () => {
    for (const m of ["virulentStrain", "mutation", "bioterrorist"] as const) {
      const h = await room({ mods: [m], options: { epidemics: 4 } });
      const s = h.trusted.setup({ options: h.options, seats: seats(3), rng: rng(1) }) as S;
      expect(s.piles).toHaveLength(4);
      expect(s.openHands).toBe(true);
    }
  });

  it("keeps the modules in the kernel's order whatever order the options come in, and none when all are off", async () => {
    const all = await start({ mods: ["mutation", "virulentStrain", "events", "roles"] }, 4);
    expect(all.s.mods).toEqual(["roles", "events", "virulentStrain", "mutation"]);
    const none = await start({ mods: [] }, 4);
    expect(none.s.mods).toEqual([]);
    expect(none.s.slices).toEqual({});
  });
});
