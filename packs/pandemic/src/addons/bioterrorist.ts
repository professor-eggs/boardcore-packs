// Pandemic: On the Brink — the Bio-Terrorist challenge. One seat (the last, as a volunteer, or a random one)
// plays against the others: a hidden location kept on a location sheet only his view shows, infection cards
// as his hand, airport sightings, spotting and capture, the purple disease with flare-out outbreaks, and his
// own win. Not with Mutation.
import type { SeatId, Step } from "@boardcore/pack-sdk";
import { ADJ, CITIES, CITY_NAMES } from "../data";
import { nextQueued, onBoard, opt, place, removeCubes, say, touch, type ActionDef, type Ctx, type State } from "../engine";
import { curePurple, purpleFollows, purpleGoal } from "../purple";
import type { PandemicAddOn } from "../addon";

interface Ext {
  seat: SeatId;
  city: string | null;
  hand: string[];
  captured: boolean;
  out: boolean;
  left: number;
  freeDrive: number;
  used: { [k: string]: number };
  /** Over the hand limit after a draw: one card must go before anything else. */
  over: boolean;
  /** The last public sighting. */
  sighting: string | null;
  /** His location sheet: every action, by turn, for his eyes only. */
  sheet: string[];
  turn: number;
}
export const BT_HAND_LIMIT = 7;
const BASIC_MAX = 2;
const ext = (s: State): Ext => s.ext.bioterrorist as unknown as Ext;
const withExt = (s: State, e: Partial<Ext>): State => ({ ...s, ext: { ...s.ext, bioterrorist: { ...ext(s), ...e } as unknown as State["ext"][string] } });
/** On the board: in a city with a player (or captured, on a role card). */
const spotted = (s: State) => { const e = ext(s); return e.city !== null && (e.captured || s.players.some((x) => s.pl[x]!.city === e.city)); };
const note = (s: State, line: string) => withExt(s, { sheet: [...ext(s).sheet, `Turn ${ext(s).turn}: ${line}`] });
const pick = (label: string, options: { id: string; label: string; disabled?: string }[]) => (options.length ? { kind: "pick" as const, label, options } : null);

function btOptions(s: State) {
  const e = ext(s);
  const n = (k: string) => e.used[k] ?? 0;
  const out = [];
  const noAct = e.left <= 0 ? "no actions left" : null;
  const twice = (k: string) => (n(k) >= BASIC_MAX ? "twice already this turn" : null);
  out.push(opt("draw", "Draw an infection card", noAct ?? twice("draw") ?? (!s.infDeck.length ? "the infection deck is empty" : null)));
  if (e.captured) {
    out.push(opt("escape", "Escape: discard a card and fly to its city", noAct ?? (e.hand.length ? null : "no cards")));
  } else {
    out.push(opt("drive", e.freeDrive > 0 ? "Drive / ferry (the extra move)" : "Drive / ferry", e.freeDrive > 0 ? null : noAct ?? twice("drive")));
    out.push(opt("direct", "Direct flight (an airport sighting where you land)", noAct ?? twice("direct") ?? (e.hand.some((c) => c !== e.city && CITIES[c]) ? null : "no card")));
    out.push(opt("charter", "Charter flight (an airport sighting where you leave)", noAct ?? twice("charter") ?? (e.hand.includes(e.city!) ? null : "no card for this city")));
    const hidden = spotted(s) ? "you are spotted" : null;
    const once = (k: string) => (n(k) ? "once a turn" : null);
    out.push(opt("local", "Infect locally (1 purple here)", noAct ?? hidden ?? once("local")));
    out.push(opt("remote", "Infect remotely (discard a card: 1 purple there)", noAct ?? hidden ?? once("remote") ?? (e.hand.length ? null : "no cards")));
    out.push(opt("sabotage", "Sabotage the research station here (discard a card of this city's colour)", noAct ?? hidden ?? once("sabotage")
      ?? (!s.stations.includes(e.city!) ? "no station here" : e.hand.some((c) => CITIES[c] === CITIES[e.city!]) ? null : "no card of this colour")));
  }
  out.push(opt("pass", "End your turn"));
  return out;
}

function btSteps(s: State, partial: Step[]) {
  const e = ext(s);
  if (e.over) return partial.length ? null : pick(`Hand limit ${BT_HAND_LIMIT}: discard a card (no effect)`, [...new Set(e.hand)].map((c) => opt(c, c)));
  if (partial.length === 0) return pick(`Bio-Terrorist in ${e.city}${e.captured ? " (captured)" : ""}: ${e.left} action${e.left === 1 ? "" : "s"}${e.freeDrive && !e.captured ? " and the extra move" : ""}`, btOptions(s));
  const id = partial[0];
  if (partial.length > 1) return null;
  if (id === "drive") return pick("Move to", (ADJ[e.city!] ?? []).map((c) => opt(c, c)));
  if (id === "direct") return pick("Fly to", [...new Set(e.hand.filter((c) => c !== e.city && CITIES[c]))].map((c) => opt(c, c)));
  if (id === "charter") return pick("Fly to", CITY_NAMES.filter((c) => c !== e.city).map((c) => opt(c, c)));
  if (id === "remote" || id === "escape") return pick("Discard which card", [...new Set(e.hand.filter((c) => CITIES[c]))].map((c) => opt(c, c)));
  if (id === "sabotage") return pick("Discard which card", [...new Set(e.hand.filter((c) => CITIES[c] === CITIES[e.city!]))].map((c) => opt(c, c)));
  return null;
}

function discard(s: State, card: string): State {
  const e = ext(s);
  const i = e.hand.indexOf(card);
  return withExt({ ...s, infDiscard: [...s.infDiscard, card] }, { hand: e.hand.filter((_, j) => j !== i) });
}

function btApply(s: State, action: Step[], ctx: Ctx): State {
  const id = String(action[0]);
  const arg = action[1] === undefined ? "" : String(action[1]);
  s = touch(s);
  let e = ext(s);
  if (e.over) {
    s = say(note(withExt(discard(s, id), { over: false }), `discard ${id} (hand limit)`), `The Bio-Terrorist discards ${id} (over his hand limit).`);
    return maybeEnd(s, ctx);
  }
  const use = (k: string, free = false) => withExt(s, { used: { ...e.used, [k]: (e.used[k] ?? 0) + 1 }, ...(free ? { freeDrive: e.freeDrive - 1 } : { left: e.left - 1 }) });
  if (id === "pass") return endBt(say(note(s, "end of turn"), "The Bio-Terrorist ends his turn."), ctx);
  // What the others see: cards drawn and discarded, purple cubes, stations, and airport sightings (never
  // which kind of flight, nor a drive).
  if (id === "draw") {
    const card = s.infDeck[0]!;
    s = use("draw");
    s = note(withExt({ ...s, infDeck: s.infDeck.slice(1) }, { hand: [...ext(s).hand, card] }), `draw ${card}`);
    s = say(s, "The Bio-Terrorist draws an infection card.");
    if (ext(s).hand.length > BT_HAND_LIMIT) return withExt(s, { over: true });
  } else if (id === "drive") {
    s = note(withExt(use("drive", e.freeDrive > 0), { city: arg }), `drive to ${arg}`);
  } else if (id === "direct") {
    s = discard(use("direct"), arg);
    s = say(note(withExt(s, { city: arg, sighting: arg }), `direct flight to ${arg}`), `The Bio-Terrorist is sighted at the airport in ${arg}.`);
  } else if (id === "charter") {
    const from = e.city!;
    s = discard(use("charter"), from);
    s = say(note(withExt(s, { city: arg, sighting: from }), `charter flight from ${from} to ${arg}`), `The Bio-Terrorist is sighted at the airport in ${from}.`);
  } else if (id === "escape") {
    s = discard(use("escape"), arg);
    s = say(note(withExt(s, { city: arg, sighting: arg, captured: false }), `escape to ${arg}`), `The Bio-Terrorist escapes and is sighted at the airport in ${arg}!`);
  } else if (id === "local") {
    s = use("local");
    s = place(say(note(s, `infect locally in ${e.city}`), `A purple cube appears in ${e.city}.`), e.city!, "purple", 1, ctx);
  } else if (id === "remote") {
    s = discard(use("remote"), arg);
    s = place(say(note(s, `infect remotely in ${arg}`), `The Bio-Terrorist discards ${arg}: a purple cube appears there.`), arg, "purple", 1, ctx);
  } else if (id === "sabotage") {
    s = discard(use("sabotage"), arg);
    s = say(note({ ...s, stations: s.stations.filter((c) => c !== e.city) }, `sabotage in ${e.city}`), `The research station in ${e.city} is sabotaged!`);
  }
  e = ext(s);
  if (spotted(s) && !e.captured && ["drive", "direct", "charter", "escape"].includes(id)) s = say(s, `The Bio-Terrorist is spotted in ${e.city}!`);
  return maybeEnd(s, ctx);
}

/** His turn ends once nothing is left to do (the extra move can't be used while captured). */
function maybeEnd(s: State, ctx: Ctx): State {
  const e = ext(s);
  if (!s.outcome && !e.over && e.left <= 0 && (e.freeDrive <= 0 || e.captured)) return endBt(s, ctx);
  return s;
}

const endBt = (s: State, ctx: Ctx) => nextQueued(withExt(s, { left: 0, freeDrive: 0 }), ctx);

const capture: ActionDef = {
  id: "capture", cost: 1,
  check: (s, seat) => { const e = ext(s); return !e.out && !e.captured && e.city === s.pl[seat]!.city ? null : "hide"; },
  label: () => "Capture the Bio-Terrorist",
  steps: () => null,
  apply(s, seat) {
    const e = ext(s);
    s = withExt({ ...s, infDiscard: [...s.infDiscard, ...e.hand] }, { hand: [], captured: true });
    return say(touch(note(s, `captured by ${seat} in ${e.city}`)), `${seat} captures the Bio-Terrorist in ${e.city}! His hand is discarded.`);
  },
};

export const bioterrorist: PandemicAddOn = {
  id: "bioterrorist",
  actions: [curePurple, capture],
  phases: {
    btStart: {
      actors: (s) => [ext(s).seat],
      prompt: (s, _seat, partial) => (partial.length ? null : pick("Choose your secret starting city", CITY_NAMES.map((c) => opt(c, c)))),
      apply: (s, _seat, action) => ({ ...say(note(withExt(s, { city: String(action[0]) }), `start in ${String(action[0])}`), "The Bio-Terrorist takes up a position."), phase: "actions", queue: [] }),
    },
    bt: {
      actors: (s) => [ext(s).seat],
      prompt: (s, _seat, partial) => btSteps(s, partial),
      apply: (s, _seat, action, ctx) => btApply(s, action, ctx),
    },
  },
  handlers: {
    seatCheck: (_n: number, players: number, opts: { mutation: boolean }) => [
      ...(opts.mutation ? ["The Bio-Terrorist can't be played with Mutation"] : []),
      ...(players < 2 ? ["The Bio-Terrorist needs at least 2 other players"] : []),
    ],
    setup(s: State): State {
      const seat = String((s.ext as { btSeat?: string }).btSeat ?? s.seats[s.seats.length - 1]);
      // 2 infection cards, dealt after the 9 starting infections.
      const hand = s.infDeck.slice(0, 2);
      s = { ...s, infDeck: s.infDeck.slice(2), supply: { ...s.supply, purple: 12 } };
      const e: Ext = { seat, city: null, hand, captured: false, out: false, left: 0, freeDrive: 0, used: {}, over: false, sighting: null, sheet: [], turn: 0 };
      return { ...s, ext: { ...s.ext, bioterrorist: e as unknown as State["ext"][string] }, phase: "btStart" };
    },
    betweenTurns: (q: string[], s: State) => (ext(s).out ? q : [...q, "bt"]),
    // His budget for the turn he takes after this player's.
    turnStart: (s: State): State => (s.ext.bioterrorist ? withExt(s, { left: 2, freeDrive: 1, used: {}, turn: ext(s).turn + 1 }) : s),
    infectAlso: purpleFollows,
    onEnter: (s: State, seat: SeatId, city: string) => (ext(s).city === city && !ext(s).captured && !ext(s).out ? say(s, `${seat} spots the Bio-Terrorist in ${city}!`) : s),
    // Flare-out: the outbreaking city gives back 2 purple before its neighbours get 1 each.
    outbreakSource: (s: State, city: string, c: string): State | null => (c === "purple" ? removeCubes(s, city, "purple", 2) : null),
    cureGoal: purpleGoal,
    outcome(s: State): State | null {
      const e = ext(s);
      if (s.outcome && s.outcome.winners.length === 0 && s.outcome.text.startsWith("lost") && !s.outcome.text.includes("Bio-Terrorist")) {
        if (onBoard(s, "purple") > 0 && !e.out) return { ...s, outcome: { winners: [e.seat], text: `the Bio-Terrorist wins (${s.outcome.text.slice(6)})` } };
        return { ...s, outcome: { winners: [], text: `everyone loses (${s.outcome.text.slice(6)})` } };
      }
      if (!e.out && s.eradicated.includes("purple")) return say(withExt(s, { out: true }), "Purple is eradicated: the Bio-Terrorist is out of the game.");
      return null;
    },
    view(s: State, viewer: string) {
      const e = ext(s);
      const me = viewer === e.seat;
      return { bioterrorist: { seat: e.seat, city: me || spotted(s) ? e.city : null, sighting: e.sighting, captured: e.captured, out: e.out, handSize: e.hand.length, hand: me ? e.hand : [], sheet: me ? e.sheet : [] } } as never;
    },
  },
};

