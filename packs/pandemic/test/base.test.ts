// The base alone, through the runtime (trusted adapter): setup, seat counts, the response windows (G1), questions
// to a seat about its own closed hand (G2), Forecast, the end, and resampleHidden.
import { describe, expect, it } from "vitest";
import type { Action, Json, Rng, Step } from "@boardcore/pack-sdk";
import { Pcg32 } from "@boardcore/pack-sdk/kernel";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { PHASES } from "../src/index";
import { room, seats } from "./rooms";
import type { PDState, PDView } from "../src/types";

type S = PDState;
const rng = (n: number): Rng => Pcg32.seeded(BigInt(n), 3n);
const base = async () => (await room({ mods: [] })).trusted;
const start = (p: PackHandle, n: number, options: { [k: string]: Json } = {}, seed = 1) =>
  p.setup({ options: { epidemics: 5, openHands: false, ...options }, seats: seats(n), rng: rng(seed) }) as S;
const act = (p: PackHandle, s: S, seat: string, action: Action, seed = 7) => p.apply(s, seat, action, rng(seed)).state as S;
const cur = (s: S) => s.players[s.current]!;
const ids = (p: PackHandle, s: S, seat: string, partial: Step[] = []) => p.choices(s, seat, partial)?.options.map((o) => o.id) ?? [];
/** The state with a seat's hand (and city) set: a test fixture, as a deal could have made it. */
function withHand(s: S, seat: string, cards: string[], city?: string): S {
  const p = s.pl[seat]!;
  return { ...s, pl: { ...s.pl, [seat]: { ...p, city: city ?? p.city, hand: { ...p.hand, items: cards } } } };
}
const withRole = (s: S, seat: string, role: string): S => ({ ...s, pl: { ...s.pl, [seat]: { ...s.pl[seat]!, role } } });

describe("pandemic base: setup", () => {
  it("deals hands by seat count, 9 infected cities, the deck in piles with one epidemic each, closed hands", async () => {
    const p = await base();
    for (const [n, hand] of [[2, 4], [3, 3], [4, 2]] as const) {
      const s = start(p, n);
      expect(s.players).toEqual(seats(n).map((x) => x.seat));
      expect(s.run.order).toEqual(PHASES);
      for (const x of s.players) {
        expect(s.pl[x]!.hand.items).toHaveLength(hand);
        expect(s.pl[x]!.hand.seenBy).toEqual([x]);
        expect(s.pl[x]!.city).toBe("Atlanta");
      }
      expect(Object.values(s.cubes).reduce((t, m) => t + Object.values(m).reduce((a, b) => a + b, 0), 0)).toBe(18);
      expect(s.infDeck.items).toHaveLength(39);
      expect(s.infDeck.seenBy).toEqual([]);
      expect(s.playerDeck.seenBy).toEqual([]);
      expect(s.playerDeck.items).toHaveLength(48 + 5 - n * hand + 5);
      expect(s.piles).toHaveLength(5);
      let at = 0;
      for (const size of s.piles) { expect(s.playerDeck.items.slice(at, at + size).filter((k) => k === "epidemic")).toHaveLength(1); at += size; }
      expect(p.status(s).actors).toEqual([cur(s)]);
    }
  });

  it("opens the hands in the introductory game (4 epidemics) and on request", async () => {
    const p = await base();
    expect(start(p, 3, { epidemics: 4 }).pl.green!.hand.seenBy).toBe("all");
    expect(start(p, 3, { openHands: true }).pl.orange!.hand.seenBy).toBe("all");
  });

  it("refuses 5 players and the legendary game without the On the Brink roles", async () => {
    const p = await base();
    expect(() => start(p, 5)).toThrow(/On the Brink roles/);
    expect(() => start(p, 3, { epidemics: 7 })).toThrow(/On the Brink roles/);
  });
});

describe("pandemic base: response windows (G1)", () => {
  it("offers a window to every player with cards while an event is unaccounted for, closed hands; Pass closes it", async () => {
    const p = await base();
    let s = start(p, 3);
    const me = cur(s);
    s = act(p, s, me, ["end"]);
    expect(s.run.order[s.run.at]).toBe("beforeDraw");
    expect([...p.status(s).actors].sort()).toEqual([...s.players].sort());
    // Every actor's prompt ends with Pass (the runner's), whatever its hand holds.
    for (const x of s.players) expect(ids(p, s, x)).toContain("pass");
    for (const x of s.players) s = act(p, s, x, ["pass"]);
    expect(s.run.order[s.run.at]).not.toBe("beforeDraw");
  });

  it("offers it only to the holders of a playable event when hands are open", async () => {
    const p = await base();
    let s = start(p, 3, { openHands: true });
    const me = cur(s), other = s.players.find((x) => x !== me)!;
    s = withHand(s, other, [...s.pl[other]!.hand.items.filter((k) => !k.startsWith("event:")), "event:Government Grant"]);
    for (const x of s.players) if (x !== other) s = withHand(s, x, s.pl[x]!.hand.items.filter((k) => !k.startsWith("event:")));
    s = act(p, s, me, ["end"]);
    expect(s.run.order[s.run.at]).toBe("beforeDraw");
    expect(p.status(s).actors).toEqual([other]);
    expect(ids(p, s, other)).toEqual(["ev:Government Grant", "pass"]);
  });

  it("lets the current player wait for the others' events: a question to each, in seat order", async () => {
    const p = await base();
    let s = start(p, 3);
    const me = cur(s);
    expect(ids(p, s, me)).toContain("call");
    s = act(p, s, me, ["call"]);
    expect(s.run.questions.map((q) => q.kind)).toEqual(["respond", "respond"]);
    const asked = s.run.questions[0]!.seat;
    expect(p.status(s).actors).toEqual([asked]);
    expect(ids(p, s, asked).at(-1)).toBe("pass");
  });
});

describe("pandemic base: questions about a closed hand (G2)", () => {
  it("never lists the other seat's cards to the asker; the asked seat chooses from its own hand or refuses", async () => {
    const p = await base();
    let s = start(p, 2);
    const me = cur(s), other = s.players.find((x) => x !== me)!;
    s = withRole(withRole(s, me, "Medic"), other, "Scientist");
    s = withHand(s, other, ["city:Atlanta", "city:Paris", "city:Atlanta"]);
    s = withHand(s, me, ["city:Lima"]);
    const share = ids(p, s, me, ["share"]);
    expect(share).toEqual([`take:${other}`]);
    expect(share.join()).not.toMatch(/Paris|Atlanta/);
    // The same prompt whatever the other hand holds.
    expect(p.choices(withHand(s, other, ["city:Tokyo"]), me, ["share"])).toEqual(p.choices(s, me, ["share"]));
    s = act(p, s, me, ["share", `take:${other}`]);
    expect(s.actionsLeft).toBe(4);
    expect(p.status(s).actors).toEqual([other]);
    expect(ids(p, s, other)).toEqual(["g:city:Atlanta", "refuse"]);
    const given = act(p, s, other, ["g:city:Atlanta"]);
    expect(given.pl[me]!.hand.items).toContain("city:Atlanta");
    expect(given.pl[other]!.hand.items).toEqual(["city:Paris", "city:Atlanta"]);
    expect(given.actionsLeft).toBe(3);
    const refused = act(p, s, other, ["refuse"]);
    expect(refused.actionsLeft).toBe(4);
    expect(refused.pl[me]!.hand.items).toEqual(["city:Lima"]);
  });

  it("asks the receiver to accept an offered card (a consent), paid only when agreed", async () => {
    const p = await base();
    let s = start(p, 2);
    const me = cur(s), other = s.players.find((x) => x !== me)!;
    s = withRole(withRole(s, me, "Medic"), other, "Scientist");
    s = withHand(s, me, ["city:Atlanta"]);
    s = act(p, s, me, ["share", `give:${other}:city:Atlanta`]);
    expect(ids(p, s, other)).toEqual(["yes", "no"]);
    expect(act(p, s, other, ["no"]).actionsLeft).toBe(4);
    const yes = act(p, s, other, ["yes"]);
    expect(yes.actionsLeft).toBe(3);
    expect(yes.pl[other]!.hand.items).toContain("city:Atlanta");
  });
});

describe("pandemic base: events, the end", () => {
  it("plays Forecast as a series of picks seen by its player only, then puts the cards back in that order", async () => {
    const p = await base();
    let s = start(p, 2);
    const me = cur(s);
    s = withHand(s, me, ["event:Forecast"]);
    const top = s.infDeck.items.slice(0, 6);
    s = act(p, s, me, ["ev:Forecast"]);
    expect(s.forecast!.seenBy).toEqual([me]);
    expect(s.infKnown[me]).toBe(6);
    expect(ids(p, s, me)).toHaveLength(6);
    s = act(p, s, me, ["f:5", "f:4", "f:3", "f:2", "f:1"]);
    expect(s.forecast).toBe(null);
    expect(s.infDeck.items.slice(0, 6)).toEqual([...top].reverse());
    expect((p.view(s, me) as PDView).known).toEqual([...top].reverse());
    expect((p.view(s, s.players.find((x) => x !== me)!) as PDView).known).toEqual([]);
  });

  it("wins at once when the last disease is cured, for every player", async () => {
    const p = await base();
    let s = start(p, 2);
    const me = cur(s);
    s = withHand(withRole({ ...s, cured: ["blue", "yellow", "black"] }, me, "Medic"), me, ["city:Tokyo", "city:Osaka", "city:Seoul", "city:Beijing", "city:Shanghai"]);
    s = act(p, s, me, ["cure", "red"]);
    expect(s.outcome).toEqual({ winners: s.players, text: "the players cure the diseases and win" });
    expect(p.status(s)).toMatchObject({ actors: [], outcome: { winners: s.players } });
  });

  it("loses when too few player cards are left to draw", async () => {
    const p = await base();
    let s = start(p, 2);
    const me = cur(s);
    s = act(p, { ...s, playerDeck: { ...s.playerDeck, items: s.playerDeck.items.slice(0, 1) } }, me, ["end"]);
    while (!s.outcome) { const x = p.status(s).actors[0]!; s = act(p, s, x, ["pass"]); }
    expect(s.outcome).toEqual({ winners: [], text: "the players lose (the player deck ran out)" });
  });
});

describe("pandemic base: resampleHidden", () => {
  it("keeps what the seat sees and every count, and redraws the rest", async () => {
    const p = await base();
    const s = start(p, 3);
    const me = s.players[0]!;
    const r = p.resampleHidden!(s, me, rng(5)) as S;
    expect(r.pl[me]!.hand).toEqual(s.pl[me]!.hand);
    for (const x of s.players) expect(r.pl[x]!.hand.items).toHaveLength(s.pl[x]!.hand.items.length);
    expect(r.playerDeck.items).toHaveLength(s.playerDeck.items.length);
    let at = 0;
    for (const size of r.piles) { expect(r.playerDeck.items.slice(at, at + size).filter((k) => k === "epidemic")).toHaveLength(1); at += size; }
    expect([...r.infDeck.items].sort()).toEqual([...s.infDeck.items].sort());
    expect(r.infDeck.items).not.toEqual(s.infDeck.items);
    expect(p.view(r, me)).toEqual(p.view(s, me));
  });

  // PR #109 second review: the persona bench's co-op game, game 3, lowest setting: red's search faulted in a world
  // ("blue has no city:Cairo"): blue had offered red a card, and red's world redrew blue's hand without it.
  const committed = (p: PackHandle, me: string, other: string, s0: S) => {
    const cases: [string, S, string, string][] = [];
    // A Share Knowledge offer: the consent gives the offered card.
    cases.push(["an offered card", act(p, withHand(s0, me, ["city:Atlanta", "city:Lima", "city:Paris"]), me, ["share", `give:${other}:city:Atlanta`]), "city:Atlanta", other]);
    // Airlift on another's pawn: the consent spends the event.
    cases.push(["Airlift", act(p, withHand(s0, me, ["city:Lima", "event:Airlift", "city:Paris"]), me, ["ev:Airlift", other, "Paris"]), "event:Airlift", other]);
    // A Dispatcher's direct flight of another's pawn: the consent pays with the card.
    cases.push(["a dispatched direct flight", act(p, withRole(withHand(s0, me, ["city:Lima", "city:Tokyo", "city:Paris"]), me, "Dispatcher"), me, ["dispatch", other, "direct", "Tokyo"]), "city:Tokyo", other]);
    return cases;
  };

  it("keeps in every world a card a pending question commits from a hand the seat can't see", async () => {
    const p = await base();
    const s0 = start(p, 3);
    const me = cur(s0), [other, third] = s0.players.filter((x) => x !== me) as [string, string];
    for (const [what, s, card, asked] of committed(p, me, other, s0)) {
      expect(p.status(s).actors, what).toEqual([asked]);
      const places = new Set<number>();
      for (const x of [other, third]) {
        for (let i = 0; i < 40; i++) {
          const w = p.resampleHidden!(s, x, rng(100 + i)) as S;
          expect(w.pl[me]!.hand.items, what).toContain(card);
          expect(w.pl[me]!.hand.items).toHaveLength(s.pl[me]!.hand.items.length);
          expect(p.view(w, x), what).toEqual(p.view(s, x));
          places.add(w.pl[me]!.hand.items.indexOf(card));
          // The asked seat's search plays "yes" in its world: the answer applies.
          const yes = p.apply(w, asked, ["yes"], rng(9)).state as S;
          const n = (h: S) => h.pl[me]!.hand.items.filter((k) => k === card).length;
          expect(n(yes), what).toBe(n(w) - 1);
        }
      }
      // Kept at a fresh place in the hand, not where it was.
      expect(places.size, what).toBeGreaterThan(1);
    }
  });

  it("keeps the committed card the same way in the sandbox", async () => {
    const h = await room({ mods: [] });
    const s0 = h.sandboxed.setup({ options: { epidemics: 5, openHands: false }, seats: seats(3), rng: rng(1) }) as S;
    const me = cur(s0), other = s0.players.find((x) => x !== me)!;
    for (const [what, s, card, asked] of committed(h.sandboxed, me, other, s0)) {
      for (let i = 0; i < 8; i++) {
        const w = h.sandboxed.resampleHidden!(s, asked, rng(200 + i));
        expect(w, what).toEqual(h.trusted.resampleHidden!(s, asked, rng(200 + i)));
        expect((w as S).pl[me]!.hand.items, what).toContain(card);
        expect(() => h.sandboxed.apply(w, asked, ["yes"], rng(9)), what).not.toThrow();
      }
    }
  });
});

describe("pandemic base: the table on a phone (phone play, 2026-11-18)", () => {
  // The web table shows the layout in about 36 columns: every line stays within 34. It names each player's role
  // and city and shows the hands the viewer may see, and seat names are never disease colours (the web client
  // writes a seat's player name for its id, so "Sydney is infected (1 red)" must not read as a player).
  const WIDTH = 34;
  const first = (p: PackHandle, s: S, seat: string): Action => {
    const out: Step[] = [];
    for (let i = 0; i < 12; i++) {
      const pr = p.choices(s, seat, out);
      if (!pr) return out;
      if (pr.kind === "order") { out.push(pr.options.map((o) => o.id)); continue; }
      const en = pr.options.filter((o) => !o.disabled);
      const o = en.find((x) => /^(drive|treat|end|pass|yes|d:0)$/.test(x.id) && !(out.length === 0 && x.id === "end" && en.some((y) => y.id === "drive"))) ?? en[0]!;
      out.push(o.id);
    }
    return out;
  };

  it("keeps seat names apart from the disease colours", async () => {
    const p = await base();
    const colours = new Set(["blue", "yellow", "black", "red", "purple"]);
    for (const x of seats(5).map((y) => y.seat)) expect(colours.has(x), x).toBe(false);
    expect(start(p, 4).players.some((x) => colours.has(x))).toBe(false);
  });

  it("keeps every layout line within 34 characters and shows roles, cities and the hands the viewer sees", async () => {
    for (const n of [2, 4]) {
      const p = await base();
      let s = start(p, n, { openHands: n === 2 }, 20 + n);
      const r = rng(n + 40);
      const wide = new Set<string>();
      for (let i = 0; i < 300 && !p.status(s).outcome; i++) {
        for (const viewer of ["spectator", ...s.players]) {
          const l = p.layout(p.view(s, viewer)) ?? "";
          for (const line of l.split("\n")) if (line.length > WIDTH) wide.add(line);
          expect(l.split("\n")[0], "the turn line in words").not.toMatch(/\((other|draw|infect|epidemic)\)/);
          if (i === 0) {
            for (const x of s.players) expect(l.replace(/\n +/g, " ")).toContain(`${x}: ${s.pl[x]!.role} in ${s.pl[x]!.city}`);
            const mine = viewer === "spectator" ? null : s.pl[viewer]!.hand.items[0]!;
            if (mine) expect(l.replace(/\n +/g, " ")).toContain(mine.slice(5));
            if (viewer === "spectator" && n === 4) expect(l).toMatch(/2 cards \(hidden\)/);
          }
        }
        const a = p.status(s).actors;
        const x = a[r.int(a.length)]!;
        s = act(p, s, x, first(p, s, x), 50 + i);
      }
      expect([...wide]).toEqual([]);
    }
  });
});
