// The 2nd edition (2.0.0): every card and wonder the edition changed, as data (cost, effect, chain, copies) and
// through the built pack (trusted adapter): chains, the new Olympia free builds, the Decorators Guild, the Ludus,
// Babylon B's two stages. Sources and the values still to confirm: ../RULES-AUDIT.md "2nd edition (2.0.0)".
import { describe, expect, it } from "@effect/vitest";
import type { Action, Json, Rng } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { loadBoth, readDist, seatsOf } from "@boardcore-packs/kit";
import { BASE_CARDS, BASE_WONDERS } from "../src/data";

const NAMES = ["red", "blue", "green", "yellow", "purple", "orange", "teal"];
type S = SWState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
let base: PackHandle;
const h = async () => (base ??= (await loadBoth(readDist(new URL("../dist/", import.meta.url)))).trusted);
const start = (p: PackHandle, n = 3, options: { [k: string]: Json } = {}) =>
  p.setup({ options: { leaders: false, leaderPromos: false, cities: false, wonderPack: false, sideB: false, randomSides: false, teamPlay: false, ...options }, seats: seatsOf(NAMES, n), rng: rng(1) }) as S;

const cardDef = (name: string, age?: number) => {
  const c = BASE_CARDS.find((x) => x.name === name && (age === undefined || x.age === age));
  if (!c) throw new Error(`no card ${name}`);
  return c;
};
const wonder = (id: string) => BASE_WONDERS.find((w) => w.id === id)!;
const stages = (id: string, side: "A" | "B") => wonder(id)[side].map((x) => [x.cost, x.eff]);

/** A seat's city: its cards (keys), with the colour counts the base keeps beside them. */
function city(keys: string[]): Pick<SWPlayer, "cards" | "colors"> {
  const colors: { [c: string]: number } = {};
  for (const k of keys) { const d = BASE_CARDS.find((c) => c.id === k)!; colors[d.color] = (colors[d.color] ?? 0) + 1; }
  return { cards: keys, colors };
}
const withRed = (s: S, over: Partial<SWPlayer>): S => ({ ...s, players: { ...s.players, red: { ...s.players.red!, ...over } as SWPlayer } });
const hand = (s: S, items: string[]) => ({ ...s.players.red!.hand, items });
/** red's "build" option for the first card of its hand: its label, and whether it is disabled. */
const buildOf = (p: PackHandle, s: S) => p.choices(s, "red", ["c:0"])!.options.find((o) => o.id === "build")!;
/** Everyone but red discards its first card; red plays `action`. */
function turn(p: PackHandle, s: S, action: Action): S {
  for (const x of p.status(s).actors) s = p.apply(s, x, x === "red" ? action : ["c:0", "sell"], rng(5)).state as S;
  return s;
}

describe("2nd edition cards (data)", () => {
  it("Age I: the Well replaces the Pawnshop; Altar and Theater score 3 and chain into Age III", () => {
    expect(BASE_CARDS.some((c) => c.name === "Pawnshop")).toBe(false);
    expect(cardDef("Well")).toMatchObject({ id: "Well@1", age: 1, color: "blue", cost: "", counts: [4, 7], from: [], eff: [{ k: "vp", n: 3 }] });
    expect(cardDef("Altar")).toMatchObject({ cost: "", counts: [3, 5], eff: [{ k: "vp", n: 3 }] });
    expect(cardDef("Theater")).toMatchObject({ cost: "", counts: [3, 6], eff: [{ k: "vp", n: 3 }] });
  });
  it("Age II: the Temple scores 4 with no chain; the Statue comes from the Well", () => {
    expect(cardDef("Temple")).toMatchObject({ cost: "WCG", from: [], eff: [{ k: "vp", n: 4 }] });
    expect(cardDef("Statue")).toMatchObject({ cost: "OOW", from: ["Well"], eff: [{ k: "vp", n: 4 }] });
    // Nothing chains from the Temple or the Statue any more.
    expect(BASE_CARDS.filter((c) => c.from.includes("Temple") || c.from.includes("Statue"))).toEqual([]);
  });
  it("Age III civic: the Pantheon comes from the Altar, the Gardens from the Theater; the Town Hall loses its 5+ copy", () => {
    expect(cardDef("Pantheon")).toMatchObject({ from: ["Altar"], eff: [{ k: "vp", n: 7 }] });
    expect(cardDef("Gardens")).toMatchObject({ from: ["Theater"], eff: [{ k: "vp", n: 5 }] });
    expect(cardDef("Town Hall").counts).toEqual([3, 6]);
  });
  it("Age III commerce: the Ludus (5+, 7+) takes the 5+ Town Hall's and the 7+ Arena's places, 3 coins per red card", () => {
    expect(cardDef("Arena").counts).toEqual([3, 5]);
    expect(cardDef("Ludus")).toMatchObject({ age: 3, color: "yellow", counts: [5, 7], from: [] });
  });
  it("the Ludus costs a stone and an ore, pays 3 coins and scores 1 VP per red card in the city (2.2.0, card list and photo)", () => {
    expect(cardDef("Ludus")).toMatchObject({
      cost: "SO",
      eff: [{ k: "perCoins", n: 3, who: "self", colors: ["red"] }, { k: "perVP", n: 1, who: "self", colors: ["red"] }],
    });
  });
  it("the Castrum costs a wood, two clay and a papyrus (2.2.0, card photo and card databases)", () => {
    expect(cardDef("Castrum")).toMatchObject({ cost: "WCCP", counts: [4, 7], from: [], eff: [{ k: "shields", n: 3 }] });
  });
  it("Age III military: two copies each of five cards, the Castrum new, the Fortifications costing clay", () => {
    const red = BASE_CARDS.filter((c) => c.age === 3 && c.color === "red");
    expect(Object.fromEntries(red.map((c) => [c.name, c.counts]))).toEqual({
      Fortifications: [3, 7], Circus: [4, 6], Arsenal: [3, 5], "Siege Workshop": [3, 5], Castrum: [4, 7],
    });
    expect(cardDef("Fortifications")).toMatchObject({ cost: "OOOC", from: ["Walls"], eff: [{ k: "shields", n: 3 }] });
    expect(cardDef("Castrum")).toMatchObject({ eff: [{ k: "shields", n: 3 }] });
  });
  it("Guilds: the Decorators Guild replaces the Strategists; Builders +1 stone; Spies one clay fewer", () => {
    expect(BASE_CARDS.some((c) => c.name === "Strategists Guild")).toBe(false);
    expect(cardDef("Decorators Guild")).toMatchObject({ color: "purple", eff: [{ k: "wonderDoneVP", n: 7 }] });
    expect(cardDef("Builders Guild").cost).toBe("SSSCCG");
    expect(cardDef("Spies Guild").cost).toBe("CCG");
    expect(BASE_CARDS.filter((c) => c.color === "purple")).toHaveLength(10);
  });
  it("deals 7 cards a seat in every age at 3 to 7 seats (the replaced copies balance)", () => {
    for (let n = 3; n <= 7; n++) for (const age of [1, 2, 3]) {
      const cards = BASE_CARDS.filter((c) => c.age === age && c.color !== "purple").reduce((t, c) => t + c.counts.filter((k) => k <= n).length, 0);
      expect(cards + (age === 3 ? n + 2 : 0), `age ${age}, ${n} seats`).toBe(7 * n);
    }
  });
});

describe("2nd edition wonders (data)", () => {
  const vp = (n: number) => ({ k: "vp", n });
  it("Alexandria", () => {
    expect(wonder("Alexandria").base).toBe("G");
    expect(stages("Alexandria", "A").map(([c]) => c)).toEqual(["SS", "OO", "PL"]);
    expect(stages("Alexandria", "B").map(([c]) => c)).toEqual(["CC", "OOO", "WWWW"]);
  });
  it("Babylon makes wood; side B has two stages", () => {
    expect(wonder("Babylon").base).toBe("W");
    expect(stages("Babylon", "A")).toEqual([["CC", [vp(3)]], ["OOL", [{ k: "sci", s: "*" }]], ["WWWW", [vp(7)]]]);
    expect(stages("Babylon", "B")).toEqual([["SS", [{ k: "lastCard" }]], ["CCCG", [{ k: "sci", s: "*" }]]]);
  });
  it("Ephesus", () => {
    expect(stages("Ephesus", "A").map(([c]) => c)).toEqual(["CC", "WW", "OOG"]);
    expect(stages("Ephesus", "B").map(([c]) => c)).toEqual(["SS", "WW", "OOL"]);
  });
  it("Giza (side B unchanged)", () => {
    expect(stages("Giza", "A").map(([c]) => c)).toEqual(["WW", "CCL", "SSSS"]);
    expect(stages("Giza", "B").map(([c]) => c)).toEqual(["WW", "SSS", "CCC", "SSSSP"]);
  });
  it("Halicarnassus", () => {
    expect(stages("Halicarnassus", "A").map(([c]) => c)).toEqual(["OO", "GP", "SSS"]);
    expect(stages("Halicarnassus", "B").map(([c]) => c)).toEqual(["CC", "GP", "WWW"]);
  });
  it("Olympia makes clay; both sides overhauled", () => {
    expect(wonder("Olympia").base).toBe("C");
    expect(stages("Olympia", "A")).toEqual([["SS", [vp(3)]], ["WW", [{ k: "freeFirstColor" }]], ["CCC", [vp(7)]]]);
    expect(stages("Olympia", "B")).toEqual([["OO", [{ k: "freeFirstCard" }, vp(2)]], ["CCC", [{ k: "freeLastCard" }, vp(3)]], ["GPL", [vp(5)]]]);
  });
  it("Rhodes: unchanged (the article names no change)", () => {
    expect(stages("Rhodes", "A").map(([c]) => c)).toEqual(["WW", "CCC", "OOOO"]);
    expect(stages("Rhodes", "B").map(([c]) => c)).toEqual(["SSS", "OOOO"]);
  });
});

describe("2nd edition in play", () => {
  it("chains: Well to Statue, Altar to Pantheon, Theater to Gardens; Altar no longer to Temple, Statue no longer to Gardens", async () => {
    const p = await h();
    const s0 = withRed(start(p), { coins: 0 });
    const label = (cards: string[], card: string) => buildOf(p, withRed(s0, { ...city(cards), hand: hand(s0, [card, "Lumber Yard@1"]) }));
    expect(label(["Well@1"], "Statue@2")).toEqual({ id: "build", label: "Build Statue free (chain)" });
    expect(label(["Altar@1"], "Pantheon@3")).toEqual({ id: "build", label: "Build Pantheon free (chain)" });
    expect(label(["Theater@1"], "Gardens@3")).toEqual({ id: "build", label: "Build Gardens free (chain)" });
    expect(label(["Altar@1"], "Temple@2")).toMatchObject({ label: "Build Temple", disabled: "you can't pay for it" });
    expect(label(["Statue@2"], "Gardens@3")).toMatchObject({ label: "Build Gardens", disabled: "you can't pay for it" });
    expect(label(["Temple@2"], "Pantheon@3")).toMatchObject({ label: "Build Pantheon", disabled: "you can't pay for it" });
  });

  it("Olympia makes clay for its owner and to sell", async () => {
    const p = await h();
    const s = withRed(start(p), { wonder: "Olympia", side: "A", coins: 0, hand: hand(start(p), ["Guard Tower@1", "Lumber Yard@1"]) });
    expect((p.view(s, "red") as SWView).players.red!.base).toBe("C");
    expect(buildOf(p, s)).toEqual({ id: "build", label: "Build Guard Tower" });
    expect(p.choices(s, "red", ["c:0", "build"])).toBe(null);
  });

  it("Olympia A stage 2: the first card of each colour in the city is free, for the whole game", async () => {
    const p = await h();
    const s0 = start(p);
    const s = withRed(s0, { wonder: "Olympia", side: "A", built: [0, 1], coins: 0, ...city(["Stockade@1"]), hand: hand(s0, ["Temple@2", "Barracks@1", "Lumber Yard@1"]) });
    expect(buildOf(p, s)).toEqual({ id: "build", label: "Build Temple (free as the first blue card)" });
    // A red card is already in the city: the Barracks costs its ore.
    const barracks = buildOf(p, withRed(s, { hand: hand(s, ["Barracks@1", "Temple@2"]) }));
    expect(barracks).toMatchObject({ label: "Build Barracks", disabled: "you can't pay for it" });
    // Played: the Temple goes down for nothing and the next blue card pays.
    const after = turn(p, s, ["c:0", "build"]);
    expect(after.players.red!.cards).toContain("Temple@2");
    expect(after.players.red!.coins).toBe(0);
    expect(after.log.join(" ")).toMatch(/red builds Temple \(free: free as the first blue card\)/);
    const next = withRed(after, { hand: hand(after, ["Courthouse@2", "Lumber Yard@1"]) });
    expect(buildOf(p, next)).toMatchObject({ label: "Build Courthouse", disabled: "you can't pay for it" });
    // Without stage 2, no free build.
    expect(buildOf(p, withRed(s, { built: [0] }))).toMatchObject({ label: "Build Temple", disabled: "you can't pay for it" });
  });

  it("Olympia B stage 1: the card played on an age's first turn is free; stage 2: the card played from a hand of two", async () => {
    const p = await h();
    const s0 = start(p);
    const b1 = withRed(s0, { wonder: "Olympia", side: "B", built: [0], coins: 0, hand: hand(s0, ["Pantheon@3", "Lumber Yard@1", "Loom@1"]) });
    expect(buildOf(p, b1)).toEqual({ id: "build", label: "Build Pantheon (free as the first card of the age)" });
    const played = turn(p, b1, ["c:0", "build"]);
    expect(played.players.red!.cards).toEqual(["Pantheon@3"]);
    // Turn 2: no longer the first card.
    const t2 = withRed(played, { hand: hand(played, ["Palace@3", "Lumber Yard@1", "Loom@1"]) });
    expect(played.run.order[played.run.at]).toBe("turn2");
    expect(buildOf(p, t2)).toMatchObject({ label: "Build Palace", disabled: "you can't pay for it" });
    // A hand of two (the age's last turn): free with stage 2 only.
    const last = withRed(t2, { hand: hand(t2, ["Palace@3", "Lumber Yard@1"]) });
    expect(buildOf(p, last)).toMatchObject({ label: "Build Palace", disabled: "you can't pay for it" });
    const b2 = withRed(last, { built: [0, 1] });
    expect(buildOf(p, b2)).toEqual({ id: "build", label: "Build Palace (free as the last card of the age)" });
    expect(buildOf(p, withRed(b2, { hand: hand(b2, ["Palace@3", "Lumber Yard@1", "Loom@1"]) }))).toMatchObject({ disabled: "you can't pay for it" });
  });

  it("Olympia B scores 2 + 3 + 5 from its stages", async () => {
    const p = await h();
    const s = withRed(start(p), { wonder: "Olympia", side: "B", built: [0, 1, 2], coins: 0 });
    const lines = (p.view({ ...s, run: { ...s.run, over: true } }, "spectator") as SWView).scores!.red!;
    expect(lines.filter((l) => l.cat === "wonder").map((l) => l.vp)).toEqual([2, 3, 5]);
  });

  it("the Decorators Guild: 7 VP with every stage built, none before", async () => {
    const p = await h();
    const s = withRed(start(p), { wonder: "Giza", side: "A", coins: 0, ...city(["Decorators Guild@3"]) });
    const guilds = (x: S) => (p.view({ ...x, run: { ...x.run, over: true } }, "spectator") as SWView).scores!.red!.filter((l) => l.cat === "guilds");
    expect(guilds(withRed(s, { built: [0, 1] }))).toEqual([]);
    expect(guilds(withRed(s, { built: [0, 1, 2] }))).toEqual([{ cat: "guilds", vp: 7 }]);
    // Babylon B (two stages) is finished at two.
    expect(guilds(withRed(s, { wonder: "Babylon", side: "B", built: [0, 1] }))).toEqual([{ cat: "guilds", vp: 7 }]);
  });

  it("the Ludus pays 3 coins per red card in the city when built", async () => {
    const p = await h();
    const s0 = start(p);
    const s = withRed(s0, { wonder: "Giza", side: "A", coins: 0, ...city(["Stone Pit@1", "Ore Vein@1", "Stockade@1", "Barracks@1"]), hand: hand(s0, ["Ludus@3", "Lumber Yard@1", "Loom@1"]) });
    expect(buildOf(p, s)).toEqual({ id: "build", label: "Build Ludus" });
    const after = turn(p, s, ["c:0", "build"]);
    expect(after.players.red!.coins).toBe(6);
  });

  it("the Ludus scores 1 VP per red card in the city at the end (stone + ore is enough to build it)", async () => {
    const p = await h();
    const s0 = start(p);
    // Rhodes makes ore: one stone pit pays for the Ludus.
    const s = withRed(s0, { wonder: "Rhodes", side: "A", coins: 0, ...city(["Stone Pit@1", "Stockade@1", "Barracks@1"]), hand: hand(s0, ["Ludus@3", "Lumber Yard@1", "Loom@1"]) });
    expect(buildOf(p, s)).toEqual({ id: "build", label: "Build Ludus" });
    const ended = withRed(s, city(["Stone Pit@1", "Stockade@1", "Barracks@1", "Walls@2", "Ludus@3"]));
    const lines = (p.view({ ...ended, run: { ...ended.run, over: true } }, "spectator") as SWView).scores!.red!;
    expect(lines.filter((l) => l.cat === "commerce")).toEqual([{ cat: "commerce", vp: 3 }]);
  });

  it("the Castrum takes a wood, two clay and a papyrus, not the Arsenal's cost", async () => {
    const p = await h();
    const s0 = start(p);
    const can = (cards: string[]) =>
      buildOf(p, withRed(s0, { wonder: "Babylon", side: "A", coins: 0, ...city(cards), hand: hand(s0, ["Castrum@3", "Lumber Yard@1"]) })).disabled === undefined;
    // Babylon makes wood.
    expect(can(["Brickyard@2", "Press@1"])).toBe(true);
    expect(can(["Clay Pool@1", "Press@1"])).toBe(false);
    expect(can(["Sawmill@2", "Ore Vein@1", "Loom@1"])).toBe(false);
  });

  it("costs: the Fortifications take clay, the Builders Guild three stones, the Spies Guild two clay", async () => {
    const p = await h();
    const s0 = start(p);
    const can = (cards: string[], card: string, wonderId = "Rhodes") =>
      buildOf(p, withRed(s0, { wonder: wonderId, side: "A", coins: 0, ...city(cards), hand: hand(s0, [card, "Lumber Yard@1"]) })).disabled === undefined;
    // Rhodes makes ore: three more ore and a clay.
    expect(can(["Foundry@2", "Ore Vein@1", "Clay Pool@1"], "Fortifications@3")).toBe(true);
    expect(can(["Foundry@2", "Ore Vein@1", "Stone Pit@1"], "Fortifications@3")).toBe(false);
    expect(can(["Clay Pool@1", "Clay Pit@1", "Glassworks@1"], "Spies Guild@3")).toBe(true);
    expect(can(["Quarry@2", "Brickyard@2", "Glassworks@1"], "Builders Guild@3")).toBe(false);
    expect(can(["Quarry@2", "Stone Pit@1", "Brickyard@2", "Glassworks@1"], "Builders Guild@3")).toBe(true);
  });

  it("Babylon B: the first stage (two stone) plays the age's last card", async () => {
    const p = await h();
    const s0 = start(p);
    const s = withRed(s0, { wonder: "Babylon", side: "B", coins: 0, ...city(["Stone Pit@1"]) });
    // Babylon makes wood: with a stone pit the stage needs one stone bought, which red can't pay for; with two it builds.
    expect(p.choices(s, "red", ["c:0"])!.options.find((o) => o.id === "wonder")).toMatchObject({ disabled: "you can't pay for it" });
    const two = withRed(s, city(["Stone Pit@1", "Quarry@2"]));
    expect(p.choices(two, "red", ["c:0"])!.options.find((o) => o.id === "wonder")).toEqual({ id: "wonder", label: "Build Babylon stage 1" });
    const after = turn(p, two, ["c:0", "wonder"]);
    expect(after.players.red!.built).toEqual([0]);
  });
});
