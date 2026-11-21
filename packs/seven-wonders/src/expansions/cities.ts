// Cities (the `cities` option; 1st edition). Black cards go into the decks (one per seat and age, seven at eight
// seats) with three guilds; Petra and Byzantium join the boards; an eighth seat is allowed. Coin losses become a
// question to each losing seat (pay, or take debt tokens: -1 point each), asked where the base settles losses;
// diplomacy tokens keep a seat out of an age's conflicts (in team play the seat still fights, both sides taking
// one fewer token). The Cities leaders' effects (when Leaders is on too) are read from each seat's public extras.
import { sample, type InterruptKind, type SeatId } from "@boardcore/pack-sdk";
import { gain, lose, say, spend, type State } from "../engine";
import type { Expansion, Part } from "../kernel";
import { blackOf, CITIES_CARDS, CITIES_WONDERS, GUILDS } from "./cities-data";

const own = (s: State): SWCities => s.cities!;
const put = (s: State, part: Part<SWCities>): State => ({ ...s, cities: { ...own(s), ...part } });
const add = (m: { [seat: string]: number }, seat: SeatId, n: number) => ({ ...m, [seat]: (m[seat] ?? 0) + n });
/** The seat's effects of a kind among its extras in play (leaders). */
const extra = (s: State, seat: SeatId, k: string) => s.players[seat]!.extras.filter((x) => x.off === null).flatMap((x) => x.eff).filter((e) => e.k === k).length;

const questions = (): { [kind: string]: InterruptKind<State> } => ({
  debt: {
    choices: (s, q, partial) => {
      if (partial.length) return null;
      const n = Number((q.args as { n: number }).n), coins = s.players[q.seat]?.coins ?? 0;
      const options = [];
      for (let k = Math.min(coins, n); k >= 0; k--) options.push({ id: `pay:${k}`, label: k === n ? `Pay all ${n} coins` : `Pay ${k}, take ${n - k} debt` });
      return { kind: "pick", label: `You lose ${n} coin${n === 1 ? "" : "s"}: pay, or take debt tokens`, options };
    },
    answer: (s, q, action) => {
      const n = Number((q.args as { n: number }).n), k = Number(String(action[0]).slice(4));
      return say(spend(put(s, { debt: add(own(s).debt, q.seat, n - k) }), q.seat, k), `${q.seat} pays ${k} and takes ${n - k} debt.`);
    },
  },
});

export const cities: Expansion = {
  id: "cities",
  cards: CITIES_CARDS,
  wonders: CITIES_WONDERS,
  maxSeats: 8,
  decks: (ids, seats, rng) => {
    const per = seats === 8 ? 7 : seats;
    return ids.map((d, i) => [...d, ...sample(rng, blackOf(i + 1), per), ...(i === 2 ? GUILDS : [])]);
  },
  setup: () => ({ cities: { debt: {}, diplomacy: {}, absent: [], spent: [] } }),
  onBuild: (_lib, s, b) => {
    for (const e of b.effs) {
      if (e.k === "cities:loss") for (const x of s.seats) if (x !== b.seat) s = lose(s, x, Number(e.n));
      if (e.k === "cities:lossPer") for (const x of s.seats) {
        if (x === b.seat) continue;
        const p = s.players[x]!;
        const n = Number(e.n) * (e.what === "victories" ? p.victories.length : p.built.length);
        if (n > 0) s = lose(s, x, n);
      }
      if (e.k === "cities:diplomacy") s = put(s, { diplomacy: add(own(s).diplomacy, b.seat, 1) });
    }
    // Diocletian: 2 coins for each black card built.
    const dio = extra(s, b.seat, "cities:diocletian");
    if (b.item.type === "card" && b.item.color === "black" && dio) s = gain(s, b.seat, 2 * dio);
    return s;
  },
  // Berenice: a coin at the end of a turn in which the seat took coins from the bank.
  endTurn: (s) => s.seats.filter((x) => (s.gained[x] ?? 0) > 0 && extra(s, x, "cities:berenice")).map((x) => ({ seat: x, n: 1 })),
  // Each seat that must lose coins is asked how (pay or take debt); a seat with no coins takes it all as debt.
  losses: (s, ctx) => {
    for (const x of s.seats) {
      const n = s.losses[x] ?? 0;
      if (n <= 0) continue;
      if (s.players[x]!.coins === 0) s = say(put(s, { debt: add(own(s).debt, x, n) }), `${x} takes ${n} debt.`);
      else ctx.ask({ kind: "debt", seat: x, args: { n }, default: ["pay:0"] });
    }
    return { ...s, losses: {} };
  },
  // Each seat holding a diplomacy token spends one: it sits this age's conflicts out (team play: it fights).
  ageEnd: (s) => {
    const sl = own(s);
    const holding = s.seats.filter((x) => (sl.diplomacy[x] ?? 0) > 0);
    const diplomacy = { ...sl.diplomacy };
    for (const x of holding) diplomacy[x] = diplomacy[x]! - 1;
    const team = Object.keys(s.partner).length > 0;
    s = put(s, { diplomacy, absent: team ? [] : holding, spent: holding });
    if (!holding.length) return s;
    return say(s, team ? `Diplomacy: ${holding.join(", ")} still fight, one fewer token each side.` : `Diplomacy: ${holding.join(", ")} sit${holding.length === 1 ? "s" : ""} out the conflicts.`);
  },
  conflictSeats: (s, seats) => seats.filter((x) => !own(s).absent.includes(x)),
  // Semiramis: each defeat token counts as a shield.
  shields: (s, shields) => Object.fromEntries(Object.entries(shields).map(([x, n]) => [x, n + (extra(s, x, "cities:semiramis") ? s.players[x]!.defeats : 0)])),
  conflicts: (s, fights) => {
    if (!Object.keys(s.partner).length) return fights;
    const spent = own(s).spent;
    return fights.map((c) => (c.tokens > 0 && (spent.includes(c.a) || spent.includes(c.b)) ? { ...c, tokens: c.tokens - 1 } : c));
  },
  score: (s) => Object.fromEntries(s.seats.map((x) => [x, [{ cat: "debt", vp: -(own(s).debt[x] ?? 0) }]])),
  questions,
  view: (s) => ({ cities: { debt: own(s).debt, diplomacy: own(s).diplomacy } }),
  text: (view) => {
    const v = view.cities;
    const list = (m: { [seat: string]: number }) => Object.keys(m).filter((x) => m[x]).map((x) => `${x} ${m[x]}`).join(", ") || "none";
    return v ? `Debt: ${list(v.debt)}. Diplomacy tokens: ${list(v.diplomacy)}.` : "";
  },
};
