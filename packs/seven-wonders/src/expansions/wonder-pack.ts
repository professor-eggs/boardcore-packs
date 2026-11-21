// The Wonder Pack (the `wonderPack` option; 1st edition). Four more boards (Abu Simbel only when Leaders is on
// too: its `needs`). The base rules already read what the boards share with other content (stages in any order,
// a neighbour's stage copied, masks, the black market, coins to the neighbours); this module reads its own
// kinds: the Great Wall B keeps its seat out of an age's conflicts and costs every other seat 2 coins,
// Stonehenge scores (and pays) per stone on brown cards and turns up the card under one stage, and Abu Simbel
// entombs one of the seat's leaders (a question raised by the build and asked with the base's own).
import type { InterruptKind, SeatId } from "@boardcore/pack-sdk";
import { gain, lose, say, turnOff, type State } from "../engine";
import type { Expansion, Part } from "../kernel";
import { WP_WONDERS } from "./wonder-pack-data";

const own = (s: State): SWWonderPack => s.wonderPack!;
const put = (s: State, part: Part<SWWonderPack>): State => ({ ...s, wonderPack: { ...own(s), ...part } });
const WONDERS = new Map(WP_WONDERS.map((w) => [w.id, w]));

const nbrsOf = (s: State, seat: SeatId): SeatId[] => {
  const i = s.seats.indexOf(seat), n = s.seats.length;
  return [...new Set([s.seats[(i + n - 1) % n]!, s.seats[(i + 1) % n]!])].filter((x) => x !== seat);
};
/** Stone symbols on brown cards (a stone-or-clay card shows one). */
const stones = (city: SWCityCard[]) =>
  city.filter((c) => c.color === "brown").reduce((t, c) => t + c.eff.filter((e) => e.k === "prod" && String(e.any).includes("S")).length, 0);
/** Whether stage `i` of a seat's board has an effect of kind `k`, through a copy of a neighbour's stage too. */
function stageHas(s: State, seat: SeatId, i: number, k: string): boolean {
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
/** The leaders a seat has in play (the ones it may entomb). */
const inPlay = (s: State, seat: SeatId) => s.players[seat]!.extras.filter((x) => x.off === null && x.from === "leaders");

const questions = (): { [kind: string]: InterruptKind<State> } => ({
  entomb: {
    choices: (s, q, partial) => {
      if (partial.length) return null;
      return { kind: "pick", label: "Abu Simbel: entomb one of your leaders", options: inPlay(s, q.seat).map((l) => ({ id: `e:${l.name}`, label: `${l.name} (worth ${2 * l.cost} VP, loses its effect)` })) };
    },
    answer: (s, q, action) => {
      const name = String(action[0]).slice(2);
      return say(turnOff(s, q.seat, name, "entomb"), `${q.seat} entombs ${name}.`);
    },
  },
});

export const wonderPack: Expansion = {
  id: "wonderPack",
  wonders: WP_WONDERS,
  setup: () => ({ wonderPack: { skip: {}, absent: [] } }),
  onBuild: (_lib, s, b) => {
    for (const e of b.effs) {
      if (e.k === "wp:wallSkip") {
        s = put(s, { skip: { ...own(s).skip, [b.seat]: s.age } });
        for (const x of s.seats) if (x !== b.seat) s = lose(s, x, 2);
      }
      if (e.k === "wp:stoneCoins") s = gain(s, b.seat, Number(e.n) * stones(b.city));
      if (e.k === "wp:entomb") s = { ...s, pending: [...s.pending, { seat: b.seat, kind: "entomb" }] };
    }
    return s;
  },
  // The Great Wall B: a seat that built its skipping stage this age sits out this age's conflicts.
  ageEnd: (s) => {
    const absent = s.seats.filter((x) => own(s).skip[x] === s.age);
    s = put(s, { absent });
    return absent.length ? say(s, `The Great Wall: ${absent.join(", ")} sit${absent.length === 1 ? "s" : ""} out the conflicts.`) : s;
  },
  conflictSeats: (s, seats) => seats.filter((x) => !own(s).absent.includes(x)),
  score: (s, args) => {
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
  asks: {
    // Abu Simbel: a seat that built an entombing stage is asked which leader to entomb, if it has one in play.
    entomb: (s, seat) => {
      const first = inPlay(s, seat)[0];
      return first ? { kind: "entomb", seat, default: [`e:${first.name}`] } : null;
    },
  },
  questions,
};
