// The 2nd edition (Z-Man, 2013) and On the Brink's 2013 edition: one test per rule or card the 2nd edition
// changed from the 1st (2008), and per rule the audit found coded wrong (2.0.0). Through the composed packs
// (trusted adapter). Sources and the items still to confirm: ../RULES-AUDIT.md.
import { describe, expect, it } from "vitest";
import type { Action, Json, Rng, Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { BASE_EVENTS, BASE_ROLES, CITIES, CITY_NAMES, POPULATION } from "../src/data";
import { room, seats, type Room } from "./rooms";

type S = PDState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
const start = async (r: Room, n: number, options: { [k: string]: Json } = {}, seed = 1) => {
  const h = await room(r);
  return { p: h.trusted, s: h.trusted.setup({ options: { ...h.options, epidemics: 5, openHands: false, ...options }, seats: seats(n), rng: rng(seed) }) as S };
};
const base = (n = 2, options: { [k: string]: Json } = {}, seed = 1) => start({ addons: [] }, n, options, seed);
const act = (p: PackHandle, s: S, seat: string, action: Action, seed = 7) => p.apply(s, seat, action, rng(seed)).state as S;
const ids = (p: PackHandle, s: S, seat: string, partial: Step[] = []) => p.choices(s, seat, partial)?.options.map((o) => o.id) ?? [];
const cur = (s: S) => s.players[s.current]!;
const other = (s: S) => s.players.find((x) => x !== cur(s))!;
const set = (s: S, seat: string, over: Partial<PDPl>): S => ({ ...s, pl: { ...s.pl, [seat]: { ...s.pl[seat]!, ...over } as PDPl } });
const hand = (s: S, seat: string, items: string[]): S => set(s, seat, { hand: { ...s.pl[seat]!.hand, items } });
const cubes = (s: S, city: string, c: string) => s.cubes[city]?.[c] ?? 0;
/** The infection deck with these cards on top (the same cards, so the segments still add up). */
const infTop = (s: S, top: string[]): S => ({ ...s, infDeck: { ...s.infDeck, items: [...top, ...s.infDeck.items.filter((c) => !top.includes(c))] } });
/** The player deck with these cards on top (and nothing else, so no epidemic comes unasked). */
const deck = (s: S, items: string[]): S => ({ ...s, playerDeck: { ...s.playerDeck, items } });
/** Ends the current player's actions and passes every window and question until the next player's actions. */
function endTurn(p: PackHandle, s: S): S {
  const who = cur(s);
  s = act(p, s, who, ["end"]);
  for (let i = 0; i < 60 && !s.outcome && !(s.step === "actions" && cur(s) !== who); i++) {
    const x = p.status(s).actors[0];
    if (!x) break;
    const o = ids(p, s, x);
    s = act(p, s, x, [o.includes("pass") ? "pass" : o.includes("refuse") ? "refuse" : o[0]!]);
  }
  return s;
}

describe("2nd edition: components", () => {
  it("has 48 city cards (12 a colour) and 5 events: 59 player cards with 6 epidemics", async () => {
    expect(CITY_NAMES).toHaveLength(48);
    for (const c of ["blue", "yellow", "black", "red"]) expect(CITY_NAMES.filter((x) => CITIES[x] === c)).toHaveLength(12);
    expect([...BASE_EVENTS]).toEqual(["Airlift", "Forecast", "Government Grant", "One Quiet Night", "Resilient Population"]);
    const { s } = await base(2, { epidemics: 6 });
    const all = [...s.playerDeck.items, ...s.players.flatMap((x) => s.pl[x]!.hand.items)];
    expect(all).toHaveLength(59);
    expect(all.filter((k) => k === "epidemic")).toHaveLength(6);
    expect(all.filter((k) => k.startsWith("event:"))).toHaveLength(5);
  });

  it("has 7 roles, the Contingency Planner and the Quarantine Specialist among them", async () => {
    expect([...BASE_ROLES].sort()).toEqual(["Contingency Planner", "Dispatcher", "Medic", "Operations Expert", "Quarantine Specialist", "Researcher", "Scientist"]);
    const { s } = await base(4);
    expect([...s.unusedRoles, ...s.players.map((x) => s.pl[x]!.role)].sort()).toEqual([...BASE_ROLES].sort());
  });
});

describe("2nd edition: setup", () => {
  it("lets the player with the highest city population in hand go first (not the one most recently sick)", async () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { s } = await base(4, {}, seed);
      const best = (x: string) => Math.max(0, ...s.pl[x]!.hand.items.filter((k) => k.startsWith("city:")).map((k) => POPULATION[k.slice(5)]!));
      const top = Math.max(...s.players.map(best));
      expect(best(cur(s))).toBe(top);
      expect(s.players.slice(0, s.current).every((x) => best(x) < top)).toBe(true);
    }
  });

  it("plays the introductory game with open hands, the standard and heroic games with private hands", async () => {
    expect((await base(3, { epidemics: 4 })).s.pl.red!.hand.seenBy).toBe("all");
    for (const epidemics of [5, 6]) expect((await base(3, { epidemics })).s.pl.red!.hand.seenBy).toEqual(["red"]);
  });
});

describe("2nd edition: roles", () => {
  it("Operations Expert: builds with no card, and once a turn flies from a station anywhere by discarding any city card", async () => {
    const { p, s: s0 } = await base();
    const me = cur(s0);
    let s = hand(set(s0, me, { role: "Operations Expert" }), me, ["city:Lima", "city:Paris"]);
    expect(ids(p, s, me)).toContain("opsMove");
    s = act(p, s, me, ["opsMove", "city:Lima", "Tokyo"]);
    expect(s.pl[me]!.city).toBe("Tokyo");
    expect(s.playerDiscard).toContain("city:Lima");
    expect(s.actionsLeft).toBe(3);
    s = act(p, s, me, ["build"]);
    expect(s.stations).toContain("Tokyo");
    expect(s.pl[me]!.hand.items).toEqual(["city:Paris"]);
    // At a station again, with a card: the move is spent for this turn.
    expect(ids(p, s, me)).not.toContain("opsMove");
  });

  it("Contingency Planner: as an action stores a discarded event outside the hand; played, it leaves the game", async () => {
    const { p, s: s0 } = await base();
    const me = cur(s0);
    let s = hand({ ...set(s0, me, { role: "Contingency Planner" }), playerDiscard: ["event:Airlift"] }, me, []);
    s = act(p, s, me, ["cpTake", "event:Airlift"]);
    expect(s.pl[me]!.stored).toBe("event:Airlift");
    expect(s.pl[me]!.hand.items).toEqual([]);
    expect(s.actionsLeft).toBe(3);
    expect(ids(p, s, me)).not.toContain("cpTake");
    s = act(p, s, me, ["ev:Airlift", me, "Paris"]);
    expect(s.pl[me]!).toMatchObject({ stored: null, city: "Paris" });
    expect(s.removed).toContain("event:Airlift");
    expect(s.playerDiscard).not.toContain("event:Airlift");
  });

  it("Quarantine Specialist: no cubes in her city or the cities next to it", async () => {
    const { p, s: s0 } = await base();
    const me = cur(s0);
    let s = deck(set(s0, me, { role: "Quarantine Specialist", city: "London" }), ["city:Lima", "city:Tokyo", "city:Osaka", "city:Seoul"]);
    s = infTop(s, ["Paris", "Essen"]);
    const before = [cubes(s, "Paris", "blue"), cubes(s, "Essen", "blue")];
    s = endTurn(p, s);
    expect([cubes(s, "Paris", "blue"), cubes(s, "Essen", "blue")]).toEqual(before);
    expect(s.infDiscard.slice(-2)).toEqual(["Paris", "Essen"]);
  });

  it("Medic: no cubes of a cured disease are placed in his city", async () => {
    const { p, s: s0 } = await base();
    const me = cur(s0);
    let s = deck({ ...set(s0, me, { role: "Medic", city: "Lima" }), cured: ["yellow"] }, ["city:Paris", "city:Tokyo", "city:Osaka", "city:Seoul"]);
    s = { ...s, cubes: { ...s.cubes, Lima: {}, Santiago: {} } };
    s = infTop(s, ["Lima", "Santiago"]);
    s = endTurn(p, s);
    expect(cubes(s, "Lima", "yellow")).toBe(0);
    expect(cubes(s, "Santiago", "yellow")).toBe(1);
  });

  it("Dispatcher: another player's pawn only with its owner's consent, never with the Operations Expert's move", async () => {
    const { p, s: s0 } = await base();
    const me = cur(s0), them = other(s0);
    let s = hand(set(set(s0, me, { role: "Dispatcher" }), them, { role: "Operations Expert" }), me, ["city:Lima"]);
    expect(ids(p, s, me, ["dispatch", them])).toEqual(["drive", "direct", "charter", "shuttle", "join"]);
    expect(ids(p, s, me, ["dispatch", me])).toEqual(["join"]);
    s = act(p, s, me, ["dispatch", them, "drive", "Chicago"]);
    expect(s.actionsLeft).toBe(4);
    expect(p.status(s).actors).toEqual([them]);
    expect(ids(p, s, them)).toEqual(["yes", "no"]);
    const yes = act(p, s, them, ["yes"]);
    expect(yes.pl[them]!.city).toBe("Chicago");
    expect(yes.actionsLeft).toBe(3);
    expect(act(p, s, them, ["no"]).pl[them]!.city).toBe("Atlanta");
  });

  it("Researcher: gives any city card (never an event); another player may ask her for any city card", async () => {
    const { p, s: s0 } = await base();
    const me = cur(s0), them = other(s0);
    const cards = ["city:Lima", "city:Tokyo", "event:Airlift"];
    // Her turn: she offers any city card.
    let s = hand(hand(set(set(s0, me, { role: "Researcher" }), them, { role: "Medic" }), me, cards), them, []);
    expect(ids(p, s, me, ["share"]).filter((x) => x.startsWith("give:")).sort()).toEqual([`give:${them}:city:Lima`, `give:${them}:city:Tokyo`]);
    // Another player's turn: he asks, and she may give him any of her city cards.
    s = hand(hand(set(set(s0, me, { role: "Medic" }), them, { role: "Researcher" }), them, cards), me, []);
    s = act(p, s, me, ["share", `take:${them}`]);
    expect(ids(p, s, them).sort()).toEqual(["g:city:Lima", "g:city:Tokyo", "refuse"]);
  });
});

describe("2nd edition: epidemics", () => {
  it("takes a resolved epidemic card out of the game, not to the player discard pile", async () => {
    const { p, s: s0 } = await base();
    let s = deck(s0, ["epidemic", "city:Lima", "city:Tokyo", "city:Osaka"]);
    s = endTurn(p, s);
    expect(s.rateIdx).toBe(1);
    expect(s.removed).toContain("epidemic");
    expect(s.playerDiscard).not.toContain("epidemic");
  });
});

describe("audit fixes (2.0.0)", () => {
  it("the Epidemiologist's free take is offered with no actions left (once during her turn, not an action)", async () => {
    const { p, s: s0 } = await start({ addons: ["roles"] }, 2);
    const me = cur(s0), them = other(s0);
    let s = hand(hand({ ...set(s0, me, { role: "Epidemiologist" }), actionsLeft: 0 }, them, ["city:Lima", "city:Tokyo"]), me, []);
    expect(ids(p, s, me)).toContain("epidemiologist");
    s = act(p, s, me, ["epidemiologist", them]);
    expect(p.status(s).actors).toEqual([them]);
    s = act(p, s, them, ["g:city:Tokyo"]);
    expect(s.pl[me]!.hand.items).toEqual(["city:Tokyo"]);
    expect(s.actionsLeft).toBe(0);
    expect(ids(p, s, me)).not.toContain("epidemiologist");
  });

  it("the Field Operative may return samples with no actions left (at any time on her turn)", async () => {
    const { p, s: s0 } = await start({ addons: ["roles"] }, 2);
    const me = cur(s0);
    const s = { ...set(s0, me, { role: "Field Operative", samples: { red: 2 } }), actionsLeft: 0 };
    expect(ids(p, s, me)).toContain("returnSamples");
    expect(ids(p, s, me)).not.toContain("sample");
  });

  it("New Assignment: a player swapped off the Archivist with 8 cards discards down to 7", async () => {
    const { p, s: s0 } = await start({ addons: ["roles", "events"] }, 2);
    const me = cur(s0);
    const eight = ["city:Paris", "city:Lima", "city:Tokyo", "city:Osaka", "city:Seoul", "city:Cairo", "city:Delhi", "city:Milan"];
    let s = hand({ ...set(s0, me, { role: "Archivist" }), unusedRoles: s0.unusedRoles.filter((r) => r !== "Archivist") }, me, [...eight, "event:New Assignment"]);
    const role = s.unusedRoles.find((r) => r !== "Generalist")!;
    s = act(p, s, me, ["ev:New Assignment", me, role]);
    expect(s.pl[me]!.role).toBe(role);
    expect(s.pl[me]!.hand.items).toHaveLength(8);
    expect(s.run.questions.map((q) => q.kind)).toEqual(["discard"]);
    s = act(p, s, me, ["d:0"]);
    expect(s.pl[me]!.hand.items).toHaveLength(7);
    expect(s.actionsLeft).toBe(4);
  });
});
