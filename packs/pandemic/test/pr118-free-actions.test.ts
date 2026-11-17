// PR #118 second review: the base charged an action only when it asked no question, meant for actions another
// seat must agree to. Any other question raised along the way (a colour choice on entering, a hand-limit
// discard) made the action free, and the answer charged nothing. Fixed: only a give or consent question's
// answer pays; every other action is paid at once.
import { describe, expect, it } from "vitest";
import type { Action, Json, Rng, Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { ADJ } from "../src/data";
import { room, seats, type Room } from "./rooms";

type S = PDState & { addons: { [id: string]: Json } };
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

describe("PR #118: an action that raises a question is free", () => {
  it("Mobile Hospital: driving into a city with two colours of cubes still costs an action", async () => {
    const { p, s: s0 } = await start({ addons: ["events"] }, 2);
    const me = cur(s0);
    const to = ADJ[s0.pl[me]!.city]![0]!;
    let s = hand(set(s0, me, { role: "Scientist" }), me, ["event:Mobile Hospital"]);
    s = act(p, s, me, ["ev:Mobile Hospital"]);
    expect(s.actionsLeft).toBe(4); // an event is no action
    s = { ...s, cubes: { ...s.cubes, [to]: { blue: 1, red: 1 } } };
    expect(ids(p, s, me, ["drive"])).toContain(to);
    s = act(p, s, me, ["drive", to]);
    expect(p.status(s).actors).toEqual([me]);
    s = act(p, s, me, [ids(p, s, me)[0]!]);  // the colour to remove
    expect(s.pl[me]!.city).toBe(to);
    expect(s.actionsLeft).toBe(3);
  });

  it("Archivist: taking a card back that puts him over his hand limit still costs an action", async () => {
    const { p, s: s0 } = await start({ addons: ["roles"] }, 2);
    const me = cur(s0);
    const here = s0.pl[me]!.city;
    const eight = ["city:Paris", "city:Lima", "city:Tokyo", "city:Osaka", "city:Seoul", "city:Cairo", "city:Delhi", "city:Milan"];
    let s = hand(set(s0, me, { role: "Archivist" }), me, eight);
    s = { ...s, playerDiscard: [...s.playerDiscard, `city:${here}`] };
    expect(ids(p, s, me)).toContain("archive");
    s = act(p, s, me, ["archive"]);
    expect(s.pl[me]!.hand.items).toHaveLength(9);
    s = act(p, s, me, ["d:0"]);              // the hand-limit discard
    expect(s.actionsLeft).toBe(3);
  });
});
