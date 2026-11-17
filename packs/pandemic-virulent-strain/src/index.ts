// Pandemic: On the Brink's Virulent Strain challenge, an add-on of boardcore/pandemic 2.x. Its 8 epidemic cards
// replace the normal ones (`epidemics`: as many as the difficulty asks, drawn from the 8; the rest stay unseen).
// The first one drawn names the strain: the standard disease with the most cubes on the board (ties at random).
// Immediate effects happen after the epidemic's Infect step (`epidemic`, step "infected"); continuing effects
// apply from its Intensify on and last all game, through the base's modifiers (`infectCubes`, `cureCost`,
// `blockLeave`, `infectBonus`, `outbreakSteps`). Mechanics only.
import { defineAddon, type Json, type Rng } from "@boardcore/pack-sdk";
import { CITIES } from "./map";

const NAMES = ["Chronic Effect", "Complex Molecular Structure", "Government Interference", "Hidden Pocket", "Rate Effect", "Slippery Slope", "Unacceptable Loss", "Uncounted Populations"];
const CONTINUING = ["Chronic Effect", "Complex Molecular Structure", "Government Interference", "Rate Effect", "Slippery Slope"];
type S = PDState;
interface Slice { [k: string]: Json; color: string | null; active: string[]; seen: string[] }
const EMPTY: Slice = { color: null, active: [], seen: [] };
const sliceOf = (j: Json): Slice => (j as Slice | null) ?? EMPTY;
const nameOf = (card: string) => (card.startsWith("epidemic:") ? card.slice(9) : null);
const on = (sl: Slice, name: string) => sl.color !== null && sl.active.includes(name);
const cubesIn = (s: S, city: string, c: string) => s.cubes[city]?.[c] ?? 0;
const onBoard = (s: S, c: string) => Object.values(s.cubes).reduce((t, m) => t + (m[c] ?? 0), 0);
const cur = (s: S) => s.players[s.current]!;

/** The standard disease with the most cubes on the board (ties at random). */
function strainOf(s: S, rng: Rng): string {
  const std = s.diseases.filter((d) => d.standard).map((d) => d.id);
  const most = Math.max(...std.map((c) => onBoard(s, c)));
  const tied = std.filter((c) => onBoard(s, c) === most);
  return tied[tied.length > 1 ? rng.int(tied.length) : 0]!;
}

export default defineAddon<"boardcore/pandemic">({
  contributes: {
    epidemics: ({ value }) => ({ pool: NAMES.map((n) => `epidemic:${n}`), n: value.n }),
    epidemic: ({ state, slice, args, rng }) => {
      const s = state!, name = nameOf(args.card);
      let sl = sliceOf(slice);
      if (!name) return {};
      if (args.step === "intensified") return CONTINUING.includes(name) ? { slice: { ...sl, active: [...sl.active, name] }, ops: [{ op: "log", text: `${name} lasts for the rest of the game.` }] } : {};
      const ops: PDOp[] = [{ op: "log", text: `Virulent Strain epidemic: ${name}.` }];
      if (!sl.color) {
        sl = { ...sl, color: strainOf(s, rng!) };
        ops.push({ op: "log", text: `The virulent strain is ${sl.color}.` });
      }
      sl = { ...sl, seen: [...sl.seen, name] };
      const c = sl.color!;
      if (name === "Hidden Pocket" && s.eradicated.includes(c)) {
        const back = s.infDiscard.filter((x) => CITIES[x] === c);
        if (back.length) ops.push({ op: "uneradicate", color: c }, { op: "log", text: `Hidden pocket: ${c} is no longer eradicated.` }, ...back.map((city): PDOp => ({ op: "place", city, color: c, n: 1 })));
      }
      if (name === "Unacceptable Loss") ops.push({ op: "supply", color: c, n: -4 }, { op: "log", text: `Unacceptable loss: up to 4 ${c} cubes leave the supply.` });
      if (name === "Uncounted Populations") for (const city of Object.keys(s.cubes)) if (cubesIn(s, city, c) === 1) ops.push({ op: "place", city, color: c, n: 1 });
      return { slice: sl, ops };
    },
    // Chronic Effect: in the infection step, a strain city with none of its cubes gets 2.
    infectCubes: ({ state, slice, value, args }) => {
      const sl = sliceOf(slice);
      return on(sl, "Chronic Effect") && args.color === sl.color && cubesIn(state!, args.city, args.color) === 0 ? 2 : value;
    },
    // Complex Molecular Structure: one more card to cure the strain.
    cureCost: ({ slice, value, args }) => (on(sliceOf(slice), "Complex Molecular Structure") && args.color === sliceOf(slice).color ? value + 1 : value),
    // Government Interference: a pawn leaves a city with strain cubes only once the current player has treated a
    // strain cube there this turn.
    blockLeave: ({ state, slice, value, args }) => {
      const s = state!, sl = sliceOf(slice);
      if (value || !on(sl, "Government Interference") || cubesIn(s, args.from, sl.color!) === 0) return value;
      return s.pl[cur(s)]!.used.includes(`treated:${args.from}:${sl.color}`) ? value : `Government Interference: the current player must first treat a ${sl.color} cube in ${args.from}`;
    },
    // Rate Effect: one more infection card when a strain city was among those drawn, while it isn't eradicated.
    infectBonus: ({ state, slice, value, args }) => {
      const sl = sliceOf(slice);
      return on(sl, "Rate Effect") && !state!.eradicated.includes(sl.color!) && args.drawn.some((x) => CITIES[x] === sl.color) ? value + 1 : value;
    },
    // Slippery Slope: an outbreak of the strain moves the marker 2 spaces.
    outbreakSteps: ({ slice, value, args }) => (on(sliceOf(slice), "Slippery Slope") && args.color === sliceOf(slice).color ? 2 : value),
  },
  setup: () => EMPTY,
  view: ({ slice }) => sliceOf(slice),
  text: {
    legend: () => "Virulent Strain: the epidemic cards are Virulent Strain epidemics; the first names the strain, each has an immediate or a lasting effect.",
    state: ({ view }) => {
      const v = view as Slice | null;
      return v?.color ? `The virulent strain is ${v.color}${v.active.length ? ` (lasting: ${v.active.join(", ")})` : ""}.` : "";
    },
  },
});
