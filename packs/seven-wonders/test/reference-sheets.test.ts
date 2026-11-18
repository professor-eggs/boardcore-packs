// The owner's reference sheets (2026-11-18): the values they settle for the 1st-edition expansions, as data and
// through the composed packs (trusted adapter). Mechanics only; sources per row in ../RULES-AUDIT.md
// "Checked against the owner's reference sheets (2026-11-18)".
import { describe, expect, it } from "vitest";
import type { Json, Rng } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import leaders from "../../seven-wonders-leaders/src/index";
import { LEADERS_GUILDS } from "../../seven-wonders-leaders/src/data";
import { WP_WONDERS } from "../../seven-wonders-wonder-pack/src/data";
import { room, seats } from "./rooms";

type S = SWState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
const start = (p: PackHandle, options: { [k: string]: Json }, n: number, seed: number) => p.setup({ options, seats: seats(n), rng: rng(seed) }) as S;
const board = (id: string) => WP_WONDERS.find((w) => w.id === id)!;
const costs = (id: string, side: "A" | "B") => board(id)[side].map((x) => x.cost);
const call = <T>(f: unknown, input: object): T => (f as (x: object) => T)(input);
const left = (s: S, x: string) => s.seats[(s.seats.indexOf(x) + s.seats.length - 1) % s.seats.length]!;
const right = (s: S, x: string) => s.seats[(s.seats.indexOf(x) + 1) % s.seats.length]!;

describe("Wonder Pack boards (photos of sides A and B; starting resources also 7w-5)", () => {
  it("starting resources: the Great Wall makes loom, Stonehenge wood, Abu Simbel papyrus", () => {
    expect(["Great Wall", "Stonehenge", "Abu Simbel"].map((id) => board(id).base)).toEqual(["L", "W", "P"]);
  });
  it("the Great Wall's stage costs", () => {
    expect(costs("Great Wall", "A")).toEqual(["WW", "CGP", "SSS", "OOO"]);
    expect(costs("Great Wall", "B")).toEqual(["WP", "CCO", "WWP", "SS"]);
  });
  it("Stonehenge's stage costs", () => {
    expect(costs("Stonehenge", "A")).toEqual(["CO", "CCP", "WWWL"]);
    expect(costs("Stonehenge", "B")).toEqual(["OOO", "CCCP"]);
  });
  it("Abu Simbel's stage costs", () => {
    expect(costs("Abu Simbel", "A")).toEqual(["SC", "WO", "SSGL"]);
    expect(costs("Abu Simbel", "B")).toEqual(["CCL", "WWG"]);
  });
  it("Manneken Pis: side B's one stage costs one of each resource; side A's stages cost what they copy", () => {
    expect(costs("Manneken Pis", "B")).toEqual(["WSCOGLP"]);
    expect(costs("Manneken Pis", "A")).toEqual(["?", "?", "?"]);
    expect(board("Manneken Pis").A.map((x) => x.eff)).toEqual([
      [{ k: "copyStage", side: "L", stage: 0 }], [{ k: "copyStage", side: "R", stage: 1 }], [{ k: "copyStage", side: "L", stage: -1 }],
    ]);
  });
});

describe("Manneken Pis A in play", () => {
  /** A 3-seat Wonder Pack room where red has Manneken Pis A. */
  async function manneken() {
    const h = await room({ addons: ["wonder-pack"] });
    for (let seed = 1; seed < 400; seed++) {
      const s = start(h.trusted, { ...h.options, sideB: false, randomSides: false }, 3, seed);
      if (s.players.red!.wonder === "Manneken Pis") return { p: h.trusted, s };
    }
    throw new Error("no seed deals Manneken Pis to red");
  }

  it("each stage costs the copied stage's cost: the left board's first, the right board's second, the left board's last", async () => {
    const { s } = await manneken();
    const L = s.players[left(s, "red")]!.stageCosts, R = s.players[right(s, "red")]!.stageCosts;
    expect(s.players.red!.stageCosts).toEqual([L[0], R[1], L[L.length - 1]]);
  });

  it("offers its first stage when the city makes the copied stage's resources, with no coins and nothing to buy", async () => {
    const { p, s } = await manneken();
    const one: { [r: string]: string } = { W: "Lumber Yard@1", S: "Stone Pit@1", C: "Clay Pool@1", O: "Ore Vein@1", G: "Glassworks@1", L: "Loom@1", P: "Press@1" };
    const cost = s.players[left(s, "red")]!.stageCosts[0]!;
    const cards = [...cost].map((r) => one[r]!);
    const t: S = { ...s, players: { ...s.players, red: { ...s.players.red!, coins: 0, cards, colors: {} } } };
    let u = t;
    while (u.run.order[u.run.at] !== "turn1") u = p.apply(u, p.status(u).actors[0]!, [], rng(1)).state as S;
    const wonder = p.choices(u, "red", ["c:0"])!.options.find((o) => o.id === "wonder")!;
    expect(wonder.disabled, `copied cost ${cost}`).toBeUndefined();
  });

  it("its third stage copies the left board's last stage, on a board with four stages too", async () => {
    const { p, s } = await manneken();
    const t: S = { ...s, players: {
      ...s.players,
      red: { ...s.players.red!, built: [0, 1, 2] },
      [left(s, "red")]: { ...s.players[left(s, "red")]!, wonder: "Giza", side: "B", built: [] },
      [right(s, "red")]: { ...s.players[right(s, "red")]!, wonder: "Rhodes", side: "A", built: [] },
    } };
    const lines = (p.view({ ...t, run: { ...t.run, over: true } }, "spectator") as SWView).scores!.red!;
    // Giza B's first stage (3 VP) and last stage (7 VP); Rhodes A's second stage gives shields, no points.
    expect(lines.filter((l) => l.cat === "wonder").map((l) => l.vp)).toEqual([3, 7]);
  });
});

describe("Leaders (7w-5 guild costs; 7w-1 and 7w-3 on Esteban)", () => {
  it("the Diplomats' Guild costs stone, wood, glass and papyrus; the Gamers' Guild stone, clay, wood and ore", () => {
    const cost = (name: string) => [...LEADERS_GUILDS.find((g) => g.name === name)!.cost].sort().join("");
    expect(cost("Diplomats Guild")).toBe([..."SWGP"].sort().join(""));
    expect(cost("Gamers Guild")).toBe([..."SCWO"].sort().join(""));
  });

  it("the Courtesans' Guild cannot copy Esteban", () => {
    const ext = (name: string, k: `${string}:${string}`): SWExtra => ({ from: "leaders", name, cost: 5, eff: [{ k }], off: null });
    const p = (extras: SWExtra[]) => ({ extras });
    const view = { seats: ["a", "b", "c"], players: { a: p([]), b: p([ext("Esteban", "leaders:esteban"), ext("Nero", "leaders:nero")]), c: p([]) } };
    const pr = call<{ options: { id: string }[] }>(leaders.interrupts!.copy!.choices, { view, seat: "a", partial: [], slice: null });
    expect(pr.options.map((o) => o.id)).toEqual(["c:b:Nero"]);
  });
});
