// 7 Wonders: Cities, an add-on of boardcore/seven-wonders 1.x. Black cards go into the decks (one per seat
// and age, seven at eight seats) with three guilds; Petra and Byzantium join the boards; an eighth seat is
// allowed. Coin losses become a question to each losing seat (pay, or take debt tokens: -1 point each), asked
// in this add-on's own phases before the end of each turn and before the war; diplomacy tokens keep a seat out
// of an age's conflicts (in team play the seat still fights, both sides taking one fewer token). The Cities
// leaders' effects (when the Leaders add-on is on too) are read from each seat's public extras.
import { defineAddon, sample, type Json, type SeatId } from "@boardcore/pack-sdk";
import { blackOf, CITIES_CARDS, CITIES_WONDERS, GUILDS } from "./data";

interface Slice { [k: string]: Json; debt: { [seat: string]: number }; diplomacy: { [seat: string]: number }; absent: SeatId[]; spent: SeatId[] }
const sliceOf = (j: Json): Slice => (j as Slice | null) ?? { debt: {}, diplomacy: {}, absent: [], spent: [] };
const add = (m: { [seat: string]: number }, seat: SeatId, n: number) => ({ ...m, [seat]: (m[seat] ?? 0) + n });
/** The seat's effects of a kind among its extras in play (leaders). */
const extra = (s: SWState, seat: SeatId, k: string) => s.players[seat]!.extras.filter((x) => x.off === null).flatMap((x) => x.eff).filter((e) => e.k === k).length;
const TURNS = [1, 2, 3, 4, 5, 6, 7];

type Phase = NonNullable<NonNullable<Parameters<typeof defineAddon<"boardcore/seven-wonders">>[0]["contributes"]>["phases"]>[number];
/** Before the end of a turn (or the war), each seat that must lose coins is asked how (pay or take debt). */
const debtPhase = (name: string, before: string): Phase => ({
  name, kind: "auto", before,
  begin: ({ state, slice }) => {
    const s = state!;
    let sl = sliceOf(slice);
    const ops: SWOp[] = [];
    const ask: { kind: string; seat: SeatId; args: Json; default: string[] }[] = [];
    for (const x of s.seats) {
      const n = s.losses[x] ?? 0;
      if (n <= 0) continue;
      ops.push({ op: "clearLoss", seat: x });
      if (s.players[x]!.coins === 0) { sl = { ...sl, debt: add(sl.debt, x, n) }; ops.push({ op: "log", text: `${x} takes ${n} debt.` }); }
      else ask.push({ kind: "debt", seat: x, args: { n }, default: ["pay:0"] });
    }
    return { slice: sl, ops, ask };
  },
  choices: () => null,
});

export default defineAddon<"boardcore/seven-wonders">({
  contributes: {
    cards: CITIES_CARDS,
    wonders: CITIES_WONDERS,
    sets: [{ id: "cities" }],
    decks: ({ value, args, rng }) => {
      const per = args.seats === 8 ? 7 : args.seats;
      return value.map((d, i) => [...d, ...sample(rng!, blackOf(i + 1), per), ...(i === 2 ? GUILDS : [])]);
    },
    maxSeats: ({ value }) => Math.max(value, 8),
    lossRule: () => "keep",
    onBuild: ({ state, slice, args }) => {
      const s = state!;
      let sl = sliceOf(slice);
      const ops: SWOp[] = [];
      for (const e of args.effs) {
        if (e.k === "cities:loss") for (const x of s.seats) if (x !== args.seat) ops.push({ op: "loss", seat: x, n: Number(e.n) });
        if (e.k === "cities:lossPer") for (const x of s.seats) {
          if (x === args.seat) continue;
          const p = s.players[x]!;
          const n = Number(e.n) * (e.what === "victories" ? p.victories.length : p.built.length);
          if (n > 0) ops.push({ op: "loss", seat: x, n });
        }
        if (e.k === "cities:diplomacy") sl = { ...sl, diplomacy: add(sl.diplomacy, args.seat, 1) };
      }
      // Diocletian: 2 coins for each black card built.
      const dio = extra(s, args.seat, "cities:diocletian");
      if (args.item.type === "card" && args.item.color === "black" && dio) ops.push({ op: "coins", seat: args.seat, n: 2 * dio });
      return { slice: sl, ops };
    },
    // Berenice: a coin at the end of a turn in which the seat took coins from the bank.
    endTurn: ({ state }) => ({ ops: state!.seats.filter((x) => (state!.gained[x] ?? 0) > 0 && extra(state!, x, "cities:berenice")).map((x) => ({ op: "coins" as const, seat: x, n: 1 })) }),
    // Each seat holding a diplomacy token spends one: it sits this age's conflicts out (team play: it fights).
    ageEnd: ({ state, slice, baseOptions }) => {
      const sl = sliceOf(slice);
      const holding = state!.seats.filter((x) => (sl.diplomacy[x] ?? 0) > 0);
      const diplomacy = { ...sl.diplomacy };
      for (const x of holding) diplomacy[x] = diplomacy[x]! - 1;
      const team = baseOptions.teamPlay === true;
      const ops: SWOp[] = holding.length
        ? [{ op: "log", text: team ? `Diplomacy: ${holding.join(", ")} still fight, one fewer token each side.` : `Diplomacy: ${holding.join(", ")} sit${holding.length === 1 ? "s" : ""} out the conflicts.` }]
        : [];
      return { slice: { ...sl, diplomacy, absent: team ? [] : holding, spent: holding }, ops };
    },
    conflictSeats: ({ value, slice }) => value.filter((x) => !sliceOf(slice).absent.includes(x)),
    // Semiramis: each defeat token counts as a shield.
    shields: ({ value, state }) => Object.fromEntries(Object.entries(value).map(([x, n]) => [x, n + (extra(state!, x, "cities:semiramis") ? state!.players[x]!.defeats : 0)])),
    conflicts: ({ value, slice, baseOptions }) => {
      if (baseOptions.teamPlay !== true) return value;
      const spent = sliceOf(slice).spent;
      return value.map((c) => (c.tokens > 0 && (spent.includes(c.a) || spent.includes(c.b)) ? { ...c, tokens: c.tokens - 1 } : c));
    },
    score: ({ slice, state }) => Object.fromEntries(state!.seats.map((x) => [x, [{ cat: "debt", vp: -(sliceOf(slice).debt[x] ?? 0) }]])),
    phases: [...TURNS.map((n) => debtPhase(`debt${n}`, `end${n}`)), debtPhase("debtWar", "war")],
  },
  interrupts: {
    debt: {
      choices: ({ view, seat, question, partial }) => {
        if (partial.length) return null;
        const n = Number((question.args as { n: number }).n), coins = view.players[seat]?.coins ?? 0;
        const options = [];
        for (let k = Math.min(coins, n); k >= 0; k--) options.push({ id: `pay:${k}`, label: k === n ? `Pay all ${n} coins` : `Pay ${k}, take ${n - k} debt` });
        return { kind: "pick", label: `You lose ${n} coin${n === 1 ? "" : "s"}: pay, or take debt tokens`, options };
      },
      answer: ({ slice, seat, question, action }) => {
        const n = Number((question.args as { n: number }).n), k = Number(String(action[0]).slice(4));
        const sl = sliceOf(slice);
        return { slice: { ...sl, debt: add(sl.debt, seat, n - k) }, ops: [{ op: "coins", seat, n: -k }, { op: "log", text: `${seat} pays ${k} and takes ${n - k} debt.` }] };
      },
    },
  },
  setup: () => ({ debt: {}, diplomacy: {}, absent: [], spent: [] }),
  view: ({ slice }) => { const s = sliceOf(slice); return { debt: s.debt, diplomacy: s.diplomacy }; },
  text: {
    state: ({ view }) => {
      const v = view as { debt: { [seat: string]: number }; diplomacy: { [seat: string]: number } } | null;
      const list = (m: { [seat: string]: number }) => Object.keys(m).filter((x) => m[x]).map((x) => `${x} ${m[x]}`).join(", ") || "none";
      return v ? `Debt: ${list(v.debt)}. Diplomacy tokens: ${list(v.diplomacy)}.` : "";
    },
  },
  describe: ({ view, seat }) => (view.log.length ? view.log.join(" ") : `${seat} settles a coin loss.`),
});
