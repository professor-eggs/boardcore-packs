// Pandemic: On the Brink — the Virulent Strain challenge. Its 8 epidemic cards replace the normal ones; the
// first one drawn names the strain; immediate effects happen before Intensify; continuing effects apply once
// the epidemic is done and last all game (Complex Molecular Structure only while the strain is uncured; Rate
// Effect only while it isn't eradicated, as the cards say).
import { shuffle, type Rng, type SeatId } from "@boardcore/pack-sdk";
import { CITIES, CITY_NAMES, COLORS, VS_EPIDEMICS, type Color } from "../data";
import { cubesIn, cur, onBoard, place, say, touch, type Ctx, type State } from "../engine";
import type { PandemicAddOn } from "../addon";

interface Ext { color: Color | null; active: string[]; seen: string[] }
const ext = (s: State): Ext => ({ color: null, active: [], seen: [], ...(s.ext.virulentStrain as unknown as Ext | undefined) });
const withExt = (s: State, e: Partial<Ext>): State => ({ ...s, ext: { ...s.ext, virulentStrain: { ...ext(s), ...e } as unknown as State["ext"][string] } });
export const CONTINUING = ["Chronic Effect", "Complex Molecular Structure", "Government Interference", "Rate Effect", "Slippery Slope"];
const on = (s: State, name: string) => { const e = ext(s); return e.color !== null && e.active.includes(name); };
const nameOf = (card: string) => card.slice(3);

/** The standard colour with the most cubes on the board (ties at random; purple never). */
function pickStrain(s: State, rng: Rng): Color {
  const most = Math.max(...COLORS.map((c) => onBoard(s, c)));
  const tied = COLORS.filter((c) => onBoard(s, c) === most);
  return tied[tied.length > 1 ? rng.int(tied.length) : 0]!;
}

/** After the Infect step: name the strain if needed, then the card's immediate effect (before Intensify). */
function afterInfect(s: State, card: string, ctx: Ctx, rng: Rng): State {
  const name = nameOf(card);
  s = say(touch(s), `Virulent Strain epidemic: ${name}.`);
  if (!ext(s).color) { const c = pickStrain(s, rng); s = say(withExt(s, { color: c }), `The virulent strain is ${c}.`); }
  s = withExt(s, { seen: [...ext(s).seen, name] });
  const c = ext(s).color!;
  if (name === "Hidden Pocket" && s.eradicated.includes(c)) {
    const back = s.infDiscard.filter((x) => CITIES[x] === c);
    if (back.length) {
      s = say({ ...s, eradicated: s.eradicated.filter((x) => x !== c) }, `Hidden pocket: ${c} is no longer eradicated.`);
      for (const city of back) if (!s.outcome) s = place(s, city, c, 1, ctx);
    }
  }
  if (name === "Unacceptable Loss") s = say({ ...s, supply: { ...s.supply, [c]: Math.max(0, s.supply[c]! - 4) } }, `Unacceptable loss: up to 4 ${c} cubes leave the supply.`);
  if (name === "Uncounted Populations") {
    const ones = CITY_NAMES.filter((city) => cubesIn(s, city, c) === 1);
    for (const city of ones) if (!s.outcome) s = place(s, city, c, 1, ctx);
  }
  return s;
}

export const virulentStrain: PandemicAddOn = {
  id: "virulentStrain",
  handlers: (ctx: Ctx) => ({
    // Shuffle the 8, take as many as the difficulty asks; the rest stay unseen.
    epidemics: (epis: string[], _s: State, rng: Rng) => shuffle(rng, [...VS_EPIDEMICS]).slice(0, epis.length).map((n) => `vs:${n}`),
    isEpidemic: (_s: State, card: string) => (card.startsWith("vs:") ? true : null),
    epidemic(s: State, step: string, rng: Rng, card: string): State {
      if (!card.startsWith("vs:")) return s;
      if (step === "infected") return afterInfect(s, card, ctx, rng);
      return CONTINUING.includes(nameOf(card)) ? withExt(s, { active: [...ext(s).active, nameOf(card)] }) : s;
    },
    // Chronic Effect: only during the infection step, a strain city with none of its cubes gets 2.
    infectCubes: (n: number, s: State, city: string, c: string, why: string) =>
      (why === "infect" && on(s, "Chronic Effect") && c === ext(s).color && cubesIn(s, city, c) === 0 ? 2 : n),
    cureCost: (n: number, s: State, _seat: SeatId, c: string) => (on(s, "Complex Molecular Structure") && c === ext(s).color && !s.cured.includes(c) ? n + 1 : n),
    // Government Interference: a pawn leaves a city with strain cubes only once the current player has
    // treated a strain cube in that city this turn (Mobile Hospital's removal counts as treating).
    blockLeave: (s: State, _seat: SeatId, from: string) =>
      (on(s, "Government Interference") && cubesIn(s, from, ext(s).color!) > 0 && !s.pl[cur(s)]!.used.includes(`treated:${from}:${ext(s).color}`)
        ? `Government Interference: the current player must first treat a ${ext(s).color} cube in ${from}` : null),
    // Rate Effect: one more card if a strain city was among the infection cards drawn (cards drawn for a
    // Mutation card don't count) and the strain isn't eradicated.
    infectBonus: (n: number, s: State, drawn: string[]) =>
      (on(s, "Rate Effect") && !s.eradicated.includes(ext(s).color!) && drawn.some((x) => CITIES[x] === ext(s).color) ? n + 1 : n),
    outbreakSteps: (n: number, s: State, c: string) => (on(s, "Slippery Slope") && c === ext(s).color ? 2 : n),
    view: (s: State) => ({ virulentStrain: { color: ext(s).color, active: ext(s).active, seen: ext(s).seen } }) as never,
  }),
};
