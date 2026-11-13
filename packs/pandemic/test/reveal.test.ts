// Commit points (D52, L5) found by the test kit's two-worlds check, and resampleHidden (D82).
import { describe, expect, it } from "@effect/vitest";
import type { Json, Rng, SeatInfo } from "@boardcore/pack-sdk";
import pack from "../src/index";
import type { Pl, State } from "../src/engine";

const rngOf = (seed: number): Rng => {
  let x = (seed * 2654435761) >>> 0 || 1;
  return { int: (n: number) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; } };
};
const NAMES = ["red", "blue", "green", "yellow"];
const seats = (n: number): SeatInfo[] => NAMES.slice(0, n).map((seat) => ({ seat, team: null }));
const start = (n: number, options: { [k: string]: Json } = {}, seed = 1) => pack.setup({ options, seats: seats(n), rng: rngOf(seed) });
const pl = (s: State, seat: string, p: Partial<Pl>): State => ({ ...s, pl: { ...s.pl, [seat]: { ...s.pl[seat]!, ...p } as Pl } });

describe("reveals", () => {
  it("every infection card drawn in an event window is a reveal, not only the first", () => {
    let s = start(3, { epidemics: 5 });
    s = pl(s, "blue", { hand: ["event:Airlift"] });
    s = { ...s, current: 0, phase: "infect", inf: { left: 2, drawn: [], bonus: false }, pending: [], outcome: null };
    const r = pack.apply(s, "red", ["infect"], rngOf(3));
    expect(r.state.infDeck.length).toBe(s.infDeck.length - 1);
    expect(r.reveal).toBe(true);
  });
  it("entering a city while the Bio-Terrorist is unseen is a reveal, whether he is there or not", () => {
    let s = start(4, { epidemics: 5, bioterrorist: true });
    s = pack.apply(s, "yellow", ["Lima"], rngOf(2)).state;
    const red = s.players[s.current]!;
    expect(s.pl[red]!.city).toBe("Atlanta");
    s = { ...s, phase: "actions", actionsLeft: 4, pending: [] };
    expect(pack.apply(s, red, ["drive", "Chicago"], rngOf(3)).reveal).toBe(true);
  });
});

describe("resampleHidden", () => {
  it("keeps the seat's view and redraws the rest of the player deck within its piles", () => {
    const s = start(4, { epidemics: 6 }, 4);
    const w = pack.resampleHidden!(s, "red", rngOf(8));
    expect(pack.view(w, "red")).toEqual(pack.view(s, "red"));
    expect(w.pl.red!.hand).toEqual(s.pl.red!.hand);
    expect(w.playerDeck).not.toEqual(s.playerDeck);
    const unseen = (t: State) => [...t.playerDeck, ...["blue", "green", "yellow"].flatMap((x) => t.pl[x]!.hand)].sort();
    expect(unseen(w)).toEqual(unseen(s));
    let at = 0;
    for (const size of s.piles) {
      expect(w.playerDeck.slice(at, at + size).filter((k) => k === "epidemic")).toHaveLength(1);
      at += size;
    }
  });
});
