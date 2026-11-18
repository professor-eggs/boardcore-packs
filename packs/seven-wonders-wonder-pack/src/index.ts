// 7 Wonders: Wonder Pack, an add-on of boardcore/seven-wonders 1.x. Four boards join the `wonders` registry
// (Abu Simbel only when the Leaders add-on is in the room: its `needs`). The base already reads what the boards
// share with other content (stages in any order, a neighbour's stage copied, masks, the black market, coins to
// the neighbours); this add-on reads its own kinds: the Great Wall B keeps its seat out of an age's conflicts
// and costs every other seat 2 coins, Stonehenge scores (and pays) per stone on brown cards and turns up the card
// under one stage, and Abu Simbel entombs one of the seat's leaders (a question, asked in this add-on's own
// phases before the end of each turn, before Age I's first turn and before the war).
import { defineAddon, type Json, type SeatId } from "@boardcore/pack-sdk";
import { WP_WONDERS } from "./data";

interface Slice { [k: string]: Json; skip: { [seat: string]: number }; absent: SeatId[]; pending: SeatId[] }
const sliceOf = (j: Json): Slice => (j as Slice | null) ?? { skip: {}, absent: [], pending: [] };
const WONDERS = new Map(WP_WONDERS.map((w) => [w.id, w]));
const TURNS = [1, 2, 3, 4, 5, 6, 7];

const nbrsOf = (s: SWState, seat: SeatId): SeatId[] => {
  const i = s.seats.indexOf(seat), n = s.seats.length;
  return [...new Set([s.seats[(i + n - 1) % n]!, s.seats[(i + 1) % n]!])].filter((x) => x !== seat);
};
/** Stone symbols on brown cards (a stone-or-clay card shows one). */
const stones = (city: SWCityCard[]) =>
  city.filter((c) => c.color === "brown").reduce((t, c) => t + c.eff.filter((e) => e.k === "prod" && String(e.any).includes("S")).length, 0);
/** Whether stage `i` of a seat's board has an effect of kind `k`, through a copy of a neighbour's stage too. */
function stageHas(s: SWState, seat: SeatId, i: number, k: string): boolean {
  const p = s.players[seat]!;
  const def = WONDERS.get(p.wonder)?.[p.side][i];
  if (!def) return false;
  return def.eff.some((e) => {
    if (e.k === k) return true;
    if (e.k !== "copyStage") return false;
    const n = s.seats.length, at = s.seats.indexOf(seat);
    const o = s.players[s.seats[(at + (e.side === "L" ? n - 1 : 1)) % n]!]!;
    const defs = WONDERS.get(o.wonder)?.[o.side] ?? [], copied = Number(e.stage);
    return (defs[copied < 0 ? defs.length + copied : copied]?.eff ?? []).some((x) => x.k === k);
  });
}
const active = (s: SWState, seat: SeatId) => s.players[seat]!.extras.filter((x) => x.off === null);

type Phase = NonNullable<NonNullable<Parameters<typeof defineAddon<"boardcore/seven-wonders">>[0]["contributes"]>["phases"]>[number];
/** Abu Simbel: each seat that built an entombing stage since the last ask is asked which leader to entomb. */
const entombPhase = (name: string, anchor: { before: string; rounds?: number[] }): Phase => ({
  name, kind: "auto", ...anchor,
  begin: ({ state, slice }) => {
    const s = state!, sl = sliceOf(slice);
    if (!sl.pending.length) return {};
    const ask = sl.pending.flatMap((seat) => {
      const ls = active(s, seat).filter((x) => x.from === "leaders");
      return ls.length ? [{ kind: "entomb", seat, args: null, default: [`e:${ls[0]!.name}`] }] : [];
    });
    return { slice: { ...sl, pending: [] }, ask };
  },
  choices: () => null,
});

export default defineAddon<"boardcore/seven-wonders">({
  contributes: {
    wonders: WP_WONDERS,
    sets: [{ id: "wonderPack" }],
    onBuild: ({ state, slice, args }) => {
      const s = state!;
      let sl = sliceOf(slice);
      const ops: SWOp[] = [];
      for (const e of args.effs) {
        if (e.k === "wp:wallSkip") {
          sl = { ...sl, skip: { ...sl.skip, [args.seat]: s.age } };
          for (const x of s.seats) if (x !== args.seat) ops.push({ op: "loss", seat: x, n: 2 });
        }
        if (e.k === "wp:stoneCoins") { const n = Number(e.n) * stones(args.city); if (n > 0) ops.push({ op: "coins", seat: args.seat, n }); }
        if (e.k === "wp:entomb" && !sl.pending.includes(args.seat)) sl = { ...sl, pending: [...sl.pending, args.seat] };
      }
      return { slice: sl, ops };
    },
    // The Great Wall B: a seat that built its skipping stage this age sits out this age's conflicts.
    ageEnd: ({ state, slice }) => {
      const s = state!, sl = sliceOf(slice);
      const absent = s.seats.filter((x) => sl.skip[x] === s.age);
      const ops: SWOp[] = absent.length ? [{ op: "log", text: `The Great Wall: ${absent.join(", ")} sit${absent.length === 1 ? "s" : ""} out the conflicts.` }] : [];
      return { slice: { ...sl, absent }, ops };
    },
    conflictSeats: ({ value, slice }) => value.filter((x) => !sliceOf(slice).absent.includes(x)),
    score: ({ state, args }) => {
      const s = state!;
      const out: { [seat: string]: SWLine[] } = {};
      for (const x of s.seats) {
        const lines: SWLine[] = [];
        const p = s.players[x]!;
        for (const e of args.effects[x] ?? []) if (e.k === "wp:stoneVP") lines.push({ cat: "wonder", vp: Number(e.n) * stones(args.city[x] ?? []) });
        // Stonehenge B: the card under that stage is turned up; 1 VP per card of its colour next door.
        p.built.forEach((st, order) => {
          if (!stageHas(s, x, st, "wp:revealColor")) return;
          const color = args.markers[x]?.[order];
          if (!color || color === "leader") return;
          lines.push({ cat: "wonder", vp: nbrsOf(s, x).reduce((t, y) => t + (s.players[y]!.colors[color] ?? 0), 0) });
        });
        for (const l of p.extras) if (l.off === "entomb") lines.push({ cat: "wonder", vp: 2 * l.cost });
        out[x] = lines;
      }
      return out;
    },
    phases: [
      entombPhase("entombStart", { before: "turn1" }),
      ...TURNS.map((n) => entombPhase(`entomb${n}`, { before: `end${n}` })),
      entombPhase("entombWar", { before: "war" }),
    ],
  },
  interrupts: {
    entomb: {
      choices: ({ view, seat, partial }) => {
        if (partial.length) return null;
        const ls = (view.players[seat]?.extras ?? []).filter((x) => x.off === null && x.from === "leaders");
        return { kind: "pick", label: "Abu Simbel: entomb one of your leaders", options: ls.map((l) => ({ id: `e:${l.name}`, label: `${l.name} (worth ${2 * l.cost} VP, loses its effect)` })) };
      },
      answer: ({ seat, action }) => {
        const name = String(action[0]).slice(2);
        return { ops: [{ op: "off", seat, name, why: "entomb" }, { op: "log", text: `${seat} entombs ${name}.` }] };
      },
    },
  },
  setup: () => ({ skip: {}, absent: [], pending: [] }),
  describe: ({ view, seat }) => (view.log.length ? view.log.join(" ") : `${seat} entombs a leader.`),
});
