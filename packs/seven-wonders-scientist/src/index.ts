// Scientist (S11 part 8b): a persona for the draft game. Its prior likes building a science card; its evaluation
// estimates every city's points from the public view (military, wonder stages, civic and science cards, coins) and
// scores a seat by how many other cities it leads. Mechanics only: card names and their science symbols.
import { definePersona, type Json } from "@boardcore/pack-sdk";

type Player = { stages: number[]; cards: string[]; colors: { [c: string]: number }; coins: number; victories: number[]; defeats: number };
interface View { [k: string]: Json; seats: string[]; players: { [seat: string]: Player }; hand: string[]; scores: { [seat: string]: { vp: number }[] } | null }

/** Science cards by name: c, g or t. */
const SCIENCE: { [name: string]: string } = {
  Apothecary: "c", Workshop: "g", Scriptorium: "t", Dispensary: "c", Laboratory: "g", Library: "t", School: "t",
  Lodge: "c", Observatory: "g", University: "t", Academy: "c", Study: "g",
};

function science(p: Player): number {
  let c = 0, g = 0, t = 0;
  for (const k of p.cards) { const s = SCIENCE[k]; if (s === "c") c++; else if (s === "g") g++; else if (s === "t") t++; }
  return c * c + g * g + t * t + 7 * Math.min(c, g, t);
}

function points(p: Player): number {
  let v = -p.defeats;
  for (const x of p.victories) v += x;
  return v + 3 * p.stages.length + 3 * (p.colors.blue ?? 0) + science(p) + (p.colors.yellow ?? 0) + 2 * (p.colors.purple ?? 0) + p.coins / 3;
}

const total = (lines: { vp: number }[]): number => { let s = 0; for (const l of lines) s += l.vp; return s; };

export default definePersona<View>({
  evaluate(v, seat) {
    const pts: { [seat: string]: number } = {};
    for (const x of v.seats) pts[x] = v.scores ? total(v.scores[x]!) : points(v.players[x]!);
    const mine = pts[seat]!;
    let beat = 0;
    for (const x of v.seats) if (x !== seat) beat += pts[x]! < mine ? 1 : pts[x]! === mine ? 0.5 : 0;
    return v.seats.length > 1 ? beat / (v.seats.length - 1) : 0.5;
  },
  prior(v, _seat, action) {
    const first = action[0];
    if (typeof first !== "string" || first.slice(0, 2) !== "c:") return 1;
    const card = v.hand[Number(first.slice(2))];
    const way = action[1];
    if (way === "sell") return 0.5;
    if (way === "build" || way === "olympia") return card !== undefined && SCIENCE[card] !== undefined ? 4 : 1;
    return 1;
  },
});
