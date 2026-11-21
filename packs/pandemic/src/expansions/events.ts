// On the Brink's eight events (the option `events`). They join the base's events and the game uses 2 events per
// seat (`eventCount`; the Bio-Terrorist's seat counts). Each is played through the kernel's `eventCheck`, `steps`
// and `act` hooks (../kernel.ts): the base spends the card and applies the operations, and an event that acts on
// another player's pawn or role asks that player first (a `consent`, G2; refused, the card stays in hand).
// Commercial Travel Ban and Mobile Hospital keep their state in this module's slice (`infectionRate`, `turnStart`, `onEnter`); Rapid
// Vaccine Deployment reads the base's `justCured`; Special Orders uses the base's `grant`. Mechanics only.
import type { Json, Prompt, SeatId, Step } from "@boardcore/pack-sdk";
import { ADJ, CITY_NAMES } from "../data";
import { opt, pick } from "../engine";
import type { Module } from "../kernel";
import type { PDOp, PDState } from "../types";
import { wrap } from "./wrap";

const EVENTS = ["Borrowed Time", "Commercial Travel Ban", "Mobile Hospital", "New Assignment", "Rapid Vaccine Deployment", "Re-examined Research", "Remote Treatment", "Special Orders"];
type S = PDState;
interface Slice { [k: string]: Json; ctb: SeatId | null; mobile: number | null }
const EMPTY: Slice = { ctb: null, mobile: null };
const sliceOf = (j: Json): Slice => (j as Slice | null) ?? EMPTY;

const P = (p: Prompt | null) => ({ prompt: p });
const cur = (s: S) => s.players[s.current]!;
const cubesIn = (s: S, city: string, c: string) => s.cubes[city]?.[c] ?? 0;
const cityOf = (k: string) => k.slice(5);

/** Cubes on the board as "city|colour", less those already chosen (a city's cube may be picked again while it has more). */
function cubeIds(s: S, chosen: Step[]): string[] {
  const out: string[] = [];
  for (const city of CITY_NAMES) for (const [c, n] of Object.entries(s.cubes[city] ?? {})) if (n - chosen.filter((x) => x === `${city}|${c}`).length > 0) out.push(`${city}|${c}`);
  return out;
}

/** Rapid Vaccine Deployment: every affected city is connected to another affected one, unless only one is. */
const rvdValid = (chosen: string[]) => { const cities = [...new Set(chosen)]; return cities.length <= 1 || cities.every((x) => cities.some((y) => y !== x && (ADJ[x] ?? []).includes(y))); };
function rvdSteps(s: S, rest: Step[]): Prompt | null {
  const c = s.justCured ?? "";
  const chosen = rest.filter((x) => x !== "done").map(String);
  if (rest.includes("done") || chosen.length >= 5) return null;
  // Cities in map order (a city may repeat), so each set of cubes is one path.
  const last = chosen.length ? CITY_NAMES.indexOf(chosen[chosen.length - 1]!) : 0;
  const options = CITY_NAMES.filter((x, i) => i >= last && cubesIn(s, x, c) > chosen.filter((y) => y === x).length).map((x) => opt(x, `${x} (${cubesIn(s, x, c)})`));
  if (chosen.length) options.unshift(opt("done", `Done (${chosen.length} cube${chosen.length === 1 ? "" : "s"})`, rvdValid(chosen) ? null : "each city must be connected to another chosen city"));
  return pick(`Remove ${c} cube ${chosen.length + 1} of up to 5`, options);
}

/** Why the seat may not play the event now: null, a reason, or "hide". */
function check(s: S, seat: SeatId, id: string, sl: Slice): string | null {
  if (s.outcome) return "hide";
  switch (id) {
    case "Borrowed Time": return seat === cur(s) && s.step === "actions" ? null : "hide";
    case "Commercial Travel Ban": return sl.ctb ? "hide" : null;
    case "Mobile Hospital": return sl.mobile === s.turn ? "hide" : null;
    case "New Assignment": return s.unusedRoles.length ? null : "hide";
    case "Rapid Vaccine Deployment": return s.justCured && cubeIds(s, []).some((x) => x.endsWith(`|${s.justCured}`)) ? null : "hide";
    case "Re-examined Research": return s.playerDiscard.some((k) => k.startsWith("city:")) ? null : "hide";
    case "Remote Treatment": return cubeIds(s, []).length ? null : "hide";
    case "Special Orders": return s.grant || s.step !== "actions" || s.players.length < 2 ? "hide" : null;
    default: return "hide";
  }
}

function steps(s: S, id: string, rest: Step[]): Prompt | null {
  switch (id) {
    case "New Assignment":
      if (rest.length === 0) return pick("Whose role", s.players.map((x) => opt(x, `${x} (${s.pl[x]!.role})`)));
      if (rest.length === 1) return pick("New role", s.unusedRoles.map((r) => opt(r, r)));
      return null;
    case "Rapid Vaccine Deployment": return rvdSteps(s, rest);
    case "Re-examined Research":
      if (rest.length === 0) return pick("Which player takes a card", s.players.map((x) => opt(x, x)));
      if (rest.length === 1) return pick("Take which card", [...new Set(s.playerDiscard.filter((k) => k.startsWith("city:")))].map((k) => opt(k, cityOf(k))));
      return null;
    case "Remote Treatment":
      if (rest.length >= 2 || (rest.length === 1 && !cubeIds(s, rest).length)) return null;
      return pick(`Remove cube ${rest.length + 1} of 2`, cubeIds(s, rest).map((x) => opt(x, x.replace("|", ": "))));
    case "Special Orders": return rest.length ? null : pick(`Which pawn may ${cur(s)} move this turn`, s.players.filter((x) => x !== cur(s)).map((x) => opt(x, x)));
    default: return null;
  }
}

function act(s: S, seat: SeatId, id: string, rest: Step[], sl: Slice): { slice?: Json; ops?: PDOp[] } {
  switch (id) {
    case "Borrowed Time": return { ops: [{ op: "actions", n: 2 }, { op: "log", text: `${seat} takes 2 extra actions this turn.` }] };
    // In front of the current player, whoever plays it.
    case "Commercial Travel Ban": return { slice: { ...sl, ctb: cur(s) }, ops: [{ op: "log", text: `The infection rate is 1 until ${cur(s)}'s next turn begins.` }] };
    case "Mobile Hospital": return { slice: { ...sl, mobile: s.turn }, ops: [{ op: "log", text: `This turn ${cur(s)} removes a cube from each city driven or ferried to.` }] };
    case "New Assignment": {
      const x = String(rest[0]), role = String(rest[1]);
      const op: PDOp = { op: "role", seat: x, role };
      return { ops: [x === seat ? op : { op: "consent", seat: x, from: seat, text: `${seat} wants to make you the ${role}`, ops: [op], cost: 0 }] };
    }
    case "Rapid Vaccine Deployment": {
      const c = s.justCured!;
      const chosen = rest.filter((x) => x !== "done").map(String);
      return { ops: [...chosen.map((x): PDOp => ({ op: "remove", city: x, color: c, n: 1 })), { op: "log", text: `Rapid vaccine deployment: ${chosen.length} ${c} cubes removed (${[...new Set(chosen)].join(", ")}).` }] };
    }
    case "Re-examined Research": {
      const x = String(rest[0]), k = String(rest[1]);
      return { ops: [{ op: "discardToHand", seat: x, card: k }, { op: "log", text: `${x} takes ${cityOf(k)} from the discard pile.` }, { op: "handLimit", seat: x }] };
    }
    case "Remote Treatment": {
      const ops: PDOp[] = rest.map((x) => { const [city, c] = String(x).split("|") as [string, string]; return { op: "remove", city, color: c, n: 1 }; });
      return { ops: [...ops, { op: "log", text: `Remote treatment: ${rest.map((x) => String(x).replace("|", " ")).join(", ")}.` }] };
    }
    case "Special Orders": {
      const pawn = String(rest[0]);
      const op: PDOp = { op: "grant", pawn };
      return { ops: [pawn === seat ? op : { op: "consent", seat: pawn, from: seat, text: `${seat} wants ${cur(s)} to move your pawn this turn`, ops: [op], cost: 0 }] };
    }
    default: return {};
  }
}

const events: Module = {
  id: "events",
  contributes: {
    events: EVENTS.map((id) => ({ id })),
    eventCount: ({ value, args }) => Math.min(value, 2 * args.seats),
    eventCheck: ({ state, slice, args }) => (EVENTS.includes(args.id) ? { why: check(state!, args.seat, args.id, sliceOf(slice)) } : null),
    steps: ({ state, args }) => (EVENTS.includes(args.id) ? P(steps(state!, args.id, args.rest)) : null),
    act: ({ state, slice, args }) => (EVENTS.includes(args.id) ? act(state!, args.seat, args.id, args.rest, sliceOf(slice)) : {}),
    infectionRate: ({ value, slice }) => (sliceOf(slice).ctb ? Math.min(value, 1) : value),
    turnStart: ({ slice, args }) => {
      const sl = sliceOf(slice);
      return sl.ctb === args.seat ? { slice: { ...sl, ctb: null }, ops: [{ op: "log", text: "The Commercial Travel Ban ends." }] } : {};
    },
    // Mobile Hospital: the current player driving or ferrying into a city removes one cube there (his choice of
    // colour when there are several); the removal counts as treating it.
    onEnter: ({ state, slice, args }) => {
      const s = state!;
      if (sliceOf(slice).mobile !== s.turn || args.seat !== cur(s) || args.how !== "drive") return {};
      const here = Object.entries(s.cubes[args.city] ?? {}).filter(([, n]) => n > 0).map(([c]) => c);
      const remove = (c: string): PDOp[] => [{ op: "remove", city: args.city, color: c, n: 1 }, { op: "use", seat: args.seat, flag: `treated:${args.city}:${c}` }, { op: "log", text: `Mobile Hospital removes a ${c} cube in ${args.city}.` }];
      if (here.length === 0) return {};
      if (here.length === 1) return { ops: remove(here[0]!) };
      return { ops: [{ op: "ask", seat: args.seat, label: `Mobile Hospital: remove a cube in ${args.city}`, choices: here.map((c) => ({ id: c, label: c, ops: remove(c) })) }] };
    },
  },
  setup: () => EMPTY,
  view: ({ slice }) => ({ travelBan: sliceOf(slice).ctb, mobileHospital: sliceOf(slice).mobile }),
  text: {
    legend: () => "On the Brink events: 8 more events; the game uses 2 events per seat.",
    state: ({ view }) => {
      const v = view as { travelBan: string | null } | null;
      return v?.travelBan ? wrap(`Commercial Travel Ban: the infection rate is 1 until ${v.travelBan}'s next turn.`) : "";
    },
  },
};
export default events;
