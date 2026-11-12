// 7 Wonders: Wonder Pack. The Great Wall (stages in any order, read from the board data), Stonehenge,
// Abu Simbel (needs Leaders: the board is only dealt when Leaders is on) and Manneken Pis.
import type { SeatId } from "@boardcore/pack-sdk";
import { leaderDef, type Eff } from "../data";
import { defOf, effectsOf, gain, leftOf, nbrs, opt, rightOf, setP, stageDefs, type Ctx, type Item, type Line, type State } from "../engine";
import type { SevenAddOn } from "../flow";

interface Ext { skip: { [seat: string]: number }; absent: SeatId[] }
const ext = (s: State): Ext => (s.ext.wonderPack as unknown as Ext | undefined) ?? { skip: {}, absent: [] };
const withExt = (s: State, e: Ext): State => ({ ...s, ext: { ...s.ext, wonderPack: e as unknown as State["ext"][string] } });

/** Stone symbols on a seat's brown cards (a stone-or-clay card shows one). */
const stones = (s: State, seat: SeatId) => s.players[seat]!.cards.filter((k) => defOf(k).color === "brown")
  .reduce((t, k) => t + defOf(k).eff.filter((e) => e.k === "prod" && e.any.includes("S")).length, 0);

export const wonderPack: SevenAddOn = {
  id: "wonderPack",
  interrupts: {
    entomb: {
      prompt(s, seat, partial) {
        if (partial.length) return null;
        const p = s.players[seat]!;
        const ls = p.leaders.filter((l) => !p.entombed.includes(l));
        return ls.length ? { kind: "pick", label: "Abu Simbel: entomb one of your leaders", options: ls.map((l) => opt(`e:${l}`, `${l} (worth ${2 * leaderDef(l).cost} VP, loses its effect)`)) } : null;
      },
      apply(s, seat, action) {
        const name = String(action[0]).slice(2);
        return { ...setP(s, seat, (p) => ({ ...p, entombed: [...p.entombed, name] })), log: [...s.log, `${seat} entombs ${name}.`] };
      },
      auto: (s) => s,
    },
  },
  handlers: {
    stageEffects(effs: Eff[], s: State, seat: SeatId): Eff[] {
      // Manneken Pis A: copy a neighbour's stage (never another copy).
      return effs.flatMap((e) => {
        if (e.k !== "copyStage") return [e];
        const o = s.players[e.side === "L" ? leftOf(s, seat) : rightOf(s, seat)]!;
        return (stageDefs(o)[e.stage]?.eff ?? []).filter((x) => x.k !== "copyStage");
      });
    },
    onBuild(s: State, seat: SeatId, item: Item, effs: Eff[]): State {
      void item;
      for (const e of effs) {
        if (e.k === "wallSkip") {
          s = withExt(s, { ...ext(s), skip: { ...ext(s).skip, [seat]: s.age } });
          const losses = { ...s.losses };
          for (const x of s.seats) if (x !== seat) losses[x] = (losses[x] ?? 0) + 2;
          s = { ...s, losses };
        }
        if (e.k === "stoneCoins") s = gain(s, seat, e.n * stones(s, seat));
        if (e.k === "entomb") s = { ...s, pending: [...s.pending, { seat, kind: "entomb", data: null }] };
      }
      return s;
    },
    ageEnd(s: State): State {
      const absent = s.seats.filter((x) => ext(s).skip[x] === s.age);
      if (absent.length) s = { ...s, log: [...s.log, `The Great Wall: ${absent.join(", ")} sit${absent.length === 1 ? "s" : ""} out the conflicts.`] };
      return withExt(s, { ...ext(s), absent });
    },
    conflictSeats: (seats: SeatId[], s: State) => seats.filter((x) => !ext(s).absent.includes(x)),
    shields: (n: number, s: State, seat: SeatId, ctx: Ctx) =>
      n + effectsOf(s, seat, ctx).reduce((t, e) => t + (e.eff.k === "wallShields" ? e.eff.n : 0), 0),
    score(s: State, seat: SeatId, ctx: Ctx): Line[] {
      const p = s.players[seat]!;
      const lines: Line[] = [];
      for (const { eff } of effectsOf(s, seat, ctx)) if (eff.k === "stoneVP") lines.push({ cat: "wonder", vp: eff.n * stones(s, seat) });
      // Stonehenge B: the card under the second stage is turned up; 1 VP per card of its colour next door.
      p.built.forEach((st, order) => {
        if (!(stageDefs(p)[st]?.eff ?? []).some((e) => e.k === "revealColor")) return;
        const marker = p.stageCards[order];
        if (!marker || marker.startsWith("leader:")) return;
        const color = defOf(marker).color;
        lines.push({ cat: "wonder", vp: nbrs(s, seat).reduce((t, x) => t + s.players[x]!.cards.filter((k) => defOf(k).color === color).length, 0) });
      });
      for (const l of p.entombed) lines.push({ cat: "wonder", vp: 2 * leaderDef(l).cost });
      return lines;
    },
  },
};
