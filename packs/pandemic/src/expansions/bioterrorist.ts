// On the Brink's Bio-Terrorist challenge (the option `bioterrorist`; 3 to 5 seats, not with Mutation: setup
// refuses both). One against all: the pack declares hidden information, the `outcome` hook may name a lone
// winner, and `pawnSeats` says which seats get a pawn. One seat (the last, as a volunteer, or a random one: the
// option `bioterroristSeat`) gets no pawn and plays against the others: a secret location in this module's slice,
// infection cards as his hand (the base's `held` zone, seen by him only), airport sightings, spotting and
// capture, the purple disease with flare-outs (an outbreak of purple first takes 2 purple back), and his own
// win. His turn comes after each player's: up to 6 one-action phases before the base's `next`, with 2 actions
// and a free drive. Mechanics only.
import type { Action, Json, Option, Prompt, Rng, SeatId } from "@boardcore/pack-sdk";
import { ADJ, CITIES, CITY_NAMES } from "../data";
import { opt, pick } from "../engine";
import type { ModPhase, Module } from "../kernel";
import type { PDOp, PDState } from "../types";
import { wrap } from "./wrap";

const PURPLE = "purple";
const HAND_LIMIT = 7;
/** Drawing, driving and each kind of flight: at most twice a turn. Infecting and sabotage: once. */
const TWICE = ["draw", "drive", "direct", "charter"];
const ONCE = ["local", "remote", "sabotage"];
/** One action each: 2 actions and the free drive, then a pass, with steps to spare (an 8th card is discarded at once). */
const STEPS = [1, 2, 3, 4, 5, 6];

type S = PDState;
interface Slice {
  [k: string]: Json;
  seat: SeatId;
  city: string | null;
  captured: boolean;
  left: number;
  free: number;
  used: { [k: string]: number };
  done: boolean;
  /** The last airport sighting (public). */
  sighting: string | null;
  /** His location sheet: every action, by turn, for his eyes only. */
  sheet: string[];
  turn: number;
}
const btSeat = (s: S): SeatId => s.seats.find((x) => !s.players.includes(x))!;
const fresh = (seat: SeatId): Slice => ({ seat, city: null, captured: false, left: 0, free: 0, used: {}, done: true, sighting: null, sheet: [], turn: 0 });
const sliceOf = (j: Json, s?: S | null): Slice => (j as Slice | null) ?? fresh(s ? btSeat(s) : "");
const onBoard = (cubes: { [city: string]: { [c: string]: number } }, c: string) => Object.values(cubes).reduce((t, m) => t + (m[c] ?? 0), 0);
const isOut = (eradicated: string[]) => eradicated.includes(PURPLE);
/** He is on the board for everyone: captured, or in a city with a pawn. */
const spotted = (sl: Slice, pawnCities: string[]) => sl.city !== null && (sl.captured || pawnCities.includes(sl.city));
const note = (sl: Slice, line: string): Slice => ({ ...sl, sheet: [...sl.sheet, `Turn ${sl.turn}: ${line}`] });
const pawnCitiesOf = (pl: { [seat: string]: { city: string } }, players: string[]) => players.map((x) => pl[x]!.city);

/** His options this step, from his slice, his hand and what the table shows. */
function btPrompt(sl: Slice, hand: string[], deck: number, stations: string[], pawnCities: string[], partial: Action): Prompt | null {
  const n = (k: string) => sl.used[k] ?? 0;
  if (partial.length === 0) {
    const noAct = sl.left <= 0 ? "no actions left" : null;
    const twice = (k: string) => (n(k) >= 2 ? "twice already this turn" : null);
    const once = (k: string) => (n(k) ? "once a turn" : null);
    const out: Option[] = [opt("draw", "Draw an infection card", noAct ?? twice("draw") ?? (deck ? null : "the infection deck is empty"))];
    if (sl.captured) out.push(opt("escape", "Escape: discard a card and fly to its city", noAct ?? (hand.some((c) => CITIES[c]) ? null : "no city cards")));
    else {
      const city = sl.city!;
      out.push(opt("drive", sl.free > 0 ? "Drive / ferry (the free move)" : "Drive / ferry", sl.free > 0 ? null : noAct ?? twice("drive")));
      out.push(opt("direct", "Direct flight (an airport sighting where you land)", noAct ?? twice("direct") ?? (hand.some((c) => c !== city && CITIES[c]) ? null : "no card")));
      out.push(opt("charter", "Charter flight (an airport sighting where you leave)", noAct ?? twice("charter") ?? (hand.includes(city) ? null : "no card for this city")));
      const seen = spotted(sl, pawnCities) ? "you are spotted" : null;
      out.push(opt("local", "Infect locally (1 purple here)", noAct ?? seen ?? once("local")));
      out.push(opt("remote", "Infect remotely (discard a card: 1 purple there)", noAct ?? seen ?? once("remote") ?? (hand.some((c) => CITIES[c]) ? null : "no city cards")));
      out.push(opt("sabotage", "Sabotage the research station here (discard a card of this city's colour)", noAct ?? seen ?? once("sabotage")
        ?? (!stations.includes(city) ? "no station here" : hand.some((c) => CITIES[c] === CITIES[city]) ? null : "no card of this colour")));
    }
    out.push(opt("pass", "End your turn"));
    return pick(`Bio-Terrorist in ${sl.city}${sl.captured ? " (captured)" : ""}: ${sl.left} action${sl.left === 1 ? "" : "s"} left`, out);
  }
  if (partial.length > 1) return null;
  const id = String(partial[0]);
  const cards = (f: (c: string) => boolean) => [...new Set(hand.filter((c) => CITIES[c] && f(c)))].map((c) => opt(`c:${c}`, c));
  if (id === "drive") return pick("Move to", (ADJ[sl.city!] ?? []).map((c) => opt(`c:${c}`, c)));
  if (id === "direct") return pick("Fly to", cards((c) => c !== sl.city));
  if (id === "charter") return pick("Fly to", CITY_NAMES.filter((c) => c !== sl.city).map((c) => opt(`c:${c}`, c)));
  if (id === "remote" || id === "escape") return pick("Discard which card", cards(() => true));
  if (id === "sabotage") return pick("Discard which card", cards((c) => CITIES[c] === CITIES[sl.city!]));
  return null;
}

/** His turn ends once nothing is left to do (the free drive can't be used while captured). */
const settle = (sl: Slice, over: boolean): Slice => (!over && sl.left <= 0 && (sl.free <= 0 || sl.captured) ? { ...sl, done: true } : sl);

const step = (k: number): ModPhase => ({
  name: `bt${k}`, kind: "turns", before: "next",
  seats: ({ state, slice }) => {
    const s = state!, sl = sliceOf(slice, s);
    if (s.outcome || isOut(s.eradicated) || sl.city === null) return [];
    return k === 1 || !sl.done ? [sl.seat] : [];
  },
  // The first step opens his turn: 2 actions and the free drive.
  begin: ({ state, slice }) => {
    const s = state!, sl = sliceOf(slice, s);
    if (k !== 1 || s.outcome || isOut(s.eradicated) || sl.city === null) return {};
    return { slice: { ...sl, left: 2, free: 1, used: {}, done: false, turn: sl.turn + 1 } };
  },
  // His own held cards and what the table shows.
  choices: ({ state, slice, seat, partial }) => {
    const sl = sliceOf(slice);
    if (sl.done || seat !== sl.seat) return null;
    return btPrompt(sl, state.held[seat]?.items ?? [], state.infDeck.items.length, state.stations, pawnCitiesOf(state.pl, state.players), partial);
  },
  apply: ({ state, slice, action, zones }) => {
    const s = state!;
    let sl = sliceOf(slice, s);
    const hand = zones.items(s.held[sl.seat]!);
    const id = String(action[0]);
    const arg = action[1] === undefined ? "" : String(action[1]).slice(2);
    const ops: PDOp[] = [];
    const log = (text: string) => ops.push({ op: "log", text });
    const pawnCities = pawnCitiesOf(s.pl, s.players);
    if (id === "pass") {
      log("The Bio-Terrorist ends his turn.");
      return { slice: { ...note(sl, "end of turn"), done: true, left: 0, free: 0 }, ops };
    }
    const use = (k: string, free = false) => { sl = { ...sl, used: { ...sl.used, [k]: (sl.used[k] ?? 0) + 1 }, ...(free ? { free: sl.free - 1 } : { left: sl.left - 1 }) }; };
    const discard = (card: string) => ops.push({ op: "unhold", seat: sl.seat, cards: [card] });
    let reveal = false;
    const from = sl.city!;
    switch (id) {
      case "draw":
        // He sees the card: the step depends on the deck's order.
        use("draw");
        sl = note(sl, "draw an infection card");
        ops.push({ op: "hold", seat: sl.seat, n: 1 });
        log("The Bio-Terrorist draws an infection card.");
        if (hand.length + 1 > HAND_LIMIT) {
          // Over his hand limit the card he just drew (the 8th) goes to the infection discards, without effect
          // and with no choice (OTB p6).
          const card = zones.items(s.infDeck)[0]!;
          sl = note(sl, `discard ${card} (hand limit)`);
          ops.push({ op: "unhold", seat: sl.seat, cards: [card] });
          log(`The Bio-Terrorist discards ${card} (over his hand limit).`);
        }
        return { slice: settle(sl, false), ops, reveal: true };
      case "drive":
        use("drive", sl.free > 0);
        sl = note({ ...sl, city: arg }, `drive to ${arg}`);
        log("The Bio-Terrorist moves.");
        break;
      case "direct":
        use("direct"); discard(arg);
        sl = note({ ...sl, city: arg, sighting: arg }, `direct flight to ${arg}`);
        log(`The Bio-Terrorist discards ${arg} and is sighted at the airport in ${arg}.`);
        break;
      case "charter":
        use("charter"); discard(from);
        reveal = true; // names the city he was in
        sl = note({ ...sl, city: arg, sighting: from }, `charter flight from ${from} to ${arg}`);
        log(`The Bio-Terrorist discards ${from} and is sighted at the airport in ${from}.`);
        break;
      case "escape":
        use("escape"); discard(arg);
        sl = note({ ...sl, city: arg, sighting: arg, captured: false }, `escape to ${arg}`);
        log(`The Bio-Terrorist escapes and is sighted at the airport in ${arg}!`);
        break;
      case "local":
        use("local");
        reveal = true; // names the city he was in
        sl = note(sl, `infect locally in ${from}`);
        log(`A purple cube appears in ${from}.`);
        ops.push({ op: "place", city: from, color: PURPLE, n: 1 });
        break;
      case "remote":
        use("remote"); discard(arg);
        sl = note(sl, `infect remotely in ${arg}`);
        log(`The Bio-Terrorist discards ${arg}: a purple cube appears there.`);
        ops.push({ op: "place", city: arg, color: PURPLE, n: 1 });
        break;
      case "sabotage":
        use("sabotage"); discard(arg);
        reveal = true; // names the city he was in
        sl = note(sl, `sabotage in ${from}`);
        log(`The Bio-Terrorist discards ${arg}: the research station in ${from} is sabotaged!`);
        ops.push({ op: "unstation", city: from });
        break;
      default: throw new Error(`no Bio-Terrorist action ${id}`);
    }
    if (["drive", "direct", "charter", "escape"].includes(id) && !sl.captured && pawnCities.includes(sl.city!)) {
      log(`The Bio-Terrorist is spotted in ${sl.city}!`);
      reveal = true;
    }
    const left = hand.length - (ops.filter((o) => o.op === "unhold").length);
    return { slice: settle(sl, left > HAND_LIMIT), ops, ...(reveal ? { reveal: true as const } : {}) };
  },
});

const start: ModPhase = {
  // Before the first turn he deals himself 2 infection cards and picks his secret starting city.
  name: "start", kind: "turns", before: "actions", rounds: [1],
  seats: ({ state, slice }) => (sliceOf(slice, state).city === null ? [btSeat(state!)] : []),
  begin: ({ state }) => ({ slice: fresh(btSeat(state!)), ops: [{ op: "hold", seat: btSeat(state!), n: 2 }, { op: "log", text: "The Bio-Terrorist draws 2 infection cards." }] }),
  choices: ({ partial }) => (partial.length ? null : pick("Choose your secret starting city", CITY_NAMES.map((c) => opt(`c:${c}`, c)))),
  apply: ({ slice, state, action }) => {
    const city = String(action[0]).slice(2);
    const sl = note({ ...sliceOf(slice, state), city }, `start in ${city}`);
    const ops: PDOp[] = [{ op: "log", text: "The Bio-Terrorist takes up a position." }];
    // Starting where a pawn stands, he is spotted at once: the commit names his city, so it is a reveal,
    // logged as any other spotting (PR #118 second review).
    if (pawnCitiesOf(state!.pl, state!.players).includes(city)) return { slice: sl, ops: [...ops, { op: "log", text: `The Bio-Terrorist is spotted in ${city}!` }], reveal: true };
    return { slice: sl, ops };
  },
};

const bioterrorist: Module = {
  id: "bioterrorist",
  phases: [start, ...STEPS.map(step)],
  contributes: {
    diseases: [{ id: PURPLE, cubes: 12, cure: "any", follows: true, flare: 2 }],
    // The seat without a pawn: the last (a volunteer) or a random one.
    pawnSeats: ({ value, options, rng }) => {
      const bt = options.bioterroristSeat === "random" ? value[rng!.int(value.length)]! : value[value.length - 1]!;
      return value.filter((x) => x !== bt);
    },
    // Capture: a player in his city (so he is spotted) takes him; his hand goes to the infection discards.
    actions: ({ state, slice, args }) => {
      const s = state!, sl = sliceOf(slice, s);
      return !isOut(s.eradicated) && !sl.captured && sl.city !== null && s.pl[args.seat]!.city === sl.city ? [{ id: "capture", label: "Capture the Bio-Terrorist", cost: 1 }] : [];
    },
    steps: ({ args }) => (args.id === "capture" ? { prompt: null } : null),
    act: ({ state, slice, args }) => {
      if (args.id !== "capture") return {};
      const sl = sliceOf(slice, state);
      return {
        slice: note({ ...sl, captured: true }, `captured by ${args.seat} in ${sl.city}`),
        ops: [{ op: "reveal" }, { op: "unhold", seat: sl.seat, cards: null }, { op: "log", text: `${args.seat} captures the Bio-Terrorist in ${sl.city}! His hand is discarded.` }],
      };
    },
    // A pawn entering a city tells everyone whether he is there: the step depends on his secret city.
    onEnter: ({ state, slice, args }) => {
      const sl = sliceOf(slice, state);
      if (sl.captured || sl.city === null || isOut(state!.eradicated)) return {};
      return { ops: [{ op: "reveal" }, ...(sl.city === args.city ? [{ op: "log", text: `${args.seat} spots the Bio-Terrorist in ${args.city}!` } as PDOp] : [])] };
    },
    cureGoal: ({ state, value }) => value && (state!.cured.includes(PURPLE) || onBoard(state!.cubes, PURPLE) === 0),
    // A loss for the players is his win while purple is on the board and he is in the game; else everyone loses.
    outcome: ({ state, slice, args }) => {
      const s = state!, sl = sliceOf(slice, s), r = args.result;
      if (r.winners.length) return { winners: r.winners.filter((x) => x !== sl.seat), text: r.text };
      const why = r.text.replace(/^the players lose /, "");
      if (!isOut(s.eradicated) && onBoard(s.cubes, PURPLE) > 0) return { winners: [sl.seat], text: `the Bio-Terrorist wins ${why}` };
      return { winners: [], text: `everyone loses ${why}` };
    },
  },
  setup: ({ state }) => fresh(btSeat(state)),
  view: ({ slice, view, viewer }) => {
    const sl = sliceOf(slice);
    const me = viewer === sl.seat;
    const seen = me || spotted(sl, pawnCitiesOf(view.pl, view.players));
    return {
      seat: sl.seat, city: seen ? sl.city : null, sighting: sl.sighting, captured: sl.captured, out: isOut(view.eradicated),
      left: sl.left, free: sl.free, sheet: me ? sl.sheet : [], turn: sl.turn,
    };
  },
  text: {
    legend: () => "Bio-Terrorist: one player, without a pawn, secretly moves and spreads the purple disease; airport sightings and spotting reveal him, and a player in his city may capture him. He wins when the others lose with purple on the board.",
    state: ({ view }) => {
      const v = view as { seat: string; city: string | null; sighting: string | null; captured: boolean; out: boolean; sheet: string[] } | null;
      if (!v) return "";
      const where = v.out ? "out of the game" : v.captured ? `captured in ${v.city}` : v.city ? `in ${v.city}` : "unseen";
      return [wrap(`Bio-Terrorist (${v.seat}): ${where}${v.sighting ? `; last sighted at ${v.sighting}` : ""}.`), ...(v.sheet.length ? ["Your sheet:", ...v.sheet.slice(-6).map((x) => wrap(`${x}.`))] : [])].join("\n");
    },
  },
  // For anyone but him: his city redrawn among the cities without a pawn while he is unseen, his sheet hidden.
  resampleHidden: ({ state, slice, seat, rng }) => {
    const sl = sliceOf(slice, state);
    if (seat === sl.seat || sl.city === null) return sl;
    const pawnCities = pawnCitiesOf(state.pl, state.players);
    const city = spotted(sl, pawnCities) ? sl.city : redraw(pawnCities, rng);
    return { ...sl, city, sheet: sl.sheet.map(() => "(hidden)") };
  },
};
export default bioterrorist;

function redraw(pawnCities: string[], rng: Rng): string {
  const free = CITY_NAMES.filter((c) => !pawnCities.includes(c));
  return free[rng.int(free.length)]!;
}
