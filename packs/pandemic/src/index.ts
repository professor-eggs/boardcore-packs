// Pandemic (base game) with On the Brink: new roles and events, Virulent Strain, Mutation and the
// Bio-Terrorist, each a switchable add-on. Mechanics only. Rules summary and gaps: ../README.md.
import { definePack, type Action, type Json, type Prompt, type SeatId, type Step, type Viewer } from "@boardcore/pack-sdk";
import { CITIES, CITY_NAMES, RATES } from "./data";
import { act, actors, prompt, settle } from "./actions";
import { cardLabel, cur, POINTS, setupState, type ActionDef, type Ctx, type EventDef, type Opts, type State } from "./engine";
import { makeHooks, type AddOn } from "./hooks";
import type { PandemicAddOn } from "./addon";
import { base } from "./addons/base";
import { onTheBrink } from "./addons/on-the-brink";
import { virulentStrain } from "./addons/virulent-strain";
import { mutation } from "./addons/mutation";
import { bioterrorist } from "./addons/bioterrorist";
import { lab } from "./addons/lab";
import { resample } from "./resample";

const ADDONS: { [id: string]: PandemicAddOn } = { base, onTheBrink, virulentStrain, mutation, bioterrorist, lab };
const ORDER = ["onTheBrink", "virulentStrain", "mutation", "bioterrorist"] as const;

/** The game's context: hooks bound to the add-ons switched on, and the merged registries. */
function ctxOf(active: readonly string[]): Ctx {
  const ctx: Ctx = { hooks: null as unknown as Ctx["hooks"], actions: [], events: {}, phases: {}, interrupts: {} };
  const table: { [id: string]: AddOn } = {};
  for (const id of active) {
    const a = ADDONS[id];
    if (!a) throw new Error(`unknown add-on ${id}`);
    table[id] = { id, handlers: typeof a.handlers === "function" ? a.handlers(ctx) : a.handlers };
    ctx.actions.push(...(a.actions ?? []).filter((x: ActionDef) => !ctx.actions.some((y) => y.id === x.id)));
    for (const e of a.events ?? []) ctx.events[(e as EventDef).name] = e;
    Object.assign(ctx.phases, a.phases ?? {});
    Object.assign(ctx.interrupts, a.interrupts ?? {});
  }
  ctx.hooks = makeHooks(table, active, POINTS);
  return ctx;
}
const ctxFor = (s: State) => ctxOf(["base", ...s.addons]);

/** A hand is shown to its owner, or to all with open hands; otherwise only its size. */
interface PlayerView { [k: string]: Json; role: string; city: string; hand: string[]; handSize: number; stored: string | null }
interface View {
  [k: string]: Json;
  viewer: Viewer;
  addons: string[];
  openHands: boolean;
  phase: string;
  current: SeatId;
  actionsLeft: number;
  players: SeatId[];
  pl: { [seat: string]: PlayerView };
  cubes: { [city: string]: { [c: string]: number } };
  supply: { [c: string]: number };
  stations: string[];
  cured: string[];
  eradicated: string[];
  outbreaks: number;
  infectionRate: number;
  playerDeck: number;
  playerDiscard: string[];
  infectionDeck: number;
  infectionDiscard: string[];
  actors: SeatId[];
  log: string[];
  outcome: Json;
  extra: { [k: string]: Json };
}

function viewOf(s: State, viewer: Viewer): View {
  const ctx = ctxFor(s);
  const extra: { [k: string]: Json } = {};
  for (const x of ctx.hooks.collect<{ [k: string]: Json }>("view", s, viewer)) Object.assign(extra, x);
  const cubes: View["cubes"] = {};
  for (const [c, m] of Object.entries(s.cubes)) { const k = Object.entries(m).filter(([, n]) => n > 0); if (k.length) cubes[c] = Object.fromEntries(k); }
  return {
    viewer, addons: s.addons, openHands: s.openHands, phase: s.phase, current: cur(s), actionsLeft: s.actionsLeft, players: s.players,
    pl: Object.fromEntries(s.players.map((x) => [x, {
      role: s.pl[x]!.role, city: s.pl[x]!.city, hand: s.openHands || viewer === x ? s.pl[x]!.hand : [], handSize: s.pl[x]!.hand.length, stored: s.pl[x]!.stored,
    }])),
    cubes, supply: s.supply, stations: s.stations, cured: s.cured, eradicated: s.eradicated, outbreaks: s.outbreaks, infectionRate: RATES[s.rateIdx]!,
    playerDeck: s.playerDeck.length, playerDiscard: s.playerDiscard, infectionDeck: s.infDeck.length, infectionDiscard: s.infDiscard,
    actors: actors(s, ctx), log: s.log, outcome: s.outcome, extra,
  };
}

function firstPath(s: State, seat: SeatId, ctx: Ctx): Action | null {
  const path: Step[] = [];
  for (let i = 0; i < 8; i++) {
    const p: Prompt | null = prompt(s, seat, path, ctx);
    if (!p) return path.length ? path : null;
    const pref = p.options.find((o) => ["end", "infect", "continue", "pass"].includes(o.id) && !o.disabled);
    const o = pref ?? p.options.find((x) => !x.disabled && !x.id.startsWith("ev:"));
    if (!o) return null;
    path.push(o.id);
  }
  return null;
}

export default definePack<State, View>({
  setup({ options, seats, rng }) {
    const opts: Opts = {
      epidemics: typeof options.epidemics === "number" ? options.epidemics : 4,
      onTheBrink: options.onTheBrink === true, virulentStrain: options.virulentStrain === true,
      mutation: options.mutation === true, bioterrorist: options.bioterrorist === true,
      openHands: options.openHands === true, bioterroristSeat: options.bioterroristSeat === "random" ? "random" : "last",
    };
    const addons = ORDER.filter((id) => opts[id]);
    const ctx = ctxOf(["base", ...addons]);
    const s = setupState(seats.map((x) => x.seat), opts, [...addons], ctx, rng);
    return settle(s, ctx, rng);
  },

  choices: (s, seat, partial) => prompt(s, seat, partial, ctxFor(s)),

  apply(s, seat, action, rng) {
    const next = act(s, seat, action, ctxFor(s), rng);
    return next.touched !== s.touched || next.outcome ? { state: next, reveal: true } : { state: next };
  },

  view: viewOf,

  status(s) {
    if (s.outcome) return { actors: [], outcome: { winners: s.outcome.winners, text: s.outcome.text } };
    return { actors: actors(s, ctxFor(s)) };
  },

  describe(s, seat, action, viewer) {
    void action; void viewer; void seat;
    return s.log.length ? s.log.join(" ") : null;
  },

  onTimeout: (s, seat) => firstPath(s, seat, ctxFor(s)),

  resampleHidden: (s, seat, rng) => resample(s, seat, rng),

  extensionPoints: Object.entries(POINTS).map(([name, combine]) => ({ name, combine })),

  text: {
    legend: (v) =>
      `Pandemic${v.addons.length ? ` with ${v.addons.join(", ")}` : ""}. A cooperative game: the players travel the world treating disease cubes and ` +
      "trading city cards to discover cures (5 cards of one colour at a research station). Each turn: 4 actions, draw 2 player cards (epidemics " +
      "raise the infection rate and reshuffle), then infect cities one card at a time. 8 outbreaks, an empty cube supply or too few player cards " +
      "to draw loses; four cures win at once.",
    state(v) {
      const parts = [v.outcome ? `Game over: ${(v.outcome as { text: string }).text}.` : `${v.current}'s turn (${v.phase}${v.phase === "actions" ? `, ${v.actionsLeft} left` : ""}).`];
      parts.push(`Outbreaks ${v.outbreaks}/8, infection rate ${v.infectionRate}, cured: ${v.cured.join(", ") || "none"}${v.eradicated.length ? `, eradicated: ${v.eradicated.join(", ")}` : ""}.`);
      parts.push(`Research stations: ${v.stations.join(", ")}.`);
      for (const x of v.players) {
        const p = v.pl[x]!;
        const hand = p.hand.length || p.handSize === 0 ? p.hand.map(cardLabel).join(", ") || "no cards" : `${p.handSize} cards (hidden)`;
        parts.push(`${x} (${p.role}) in ${p.city}: ${hand}${p.stored ? `; stored ${cardLabel(p.stored)}` : ""}.`);
      }
      const cubes = Object.entries(v.cubes).map(([c, m]) => `${c} ${Object.entries(m).map(([k, n]) => `${n} ${k}`).join(" ")}`);
      parts.push(`Cubes: ${cubes.join("; ") || "none"}.`);
      parts.push(`Supply: ${Object.entries(v.supply).map(([k, n]) => `${k} ${n}`).join(", ")}. Player deck ${v.playerDeck}, infection deck ${v.infectionDeck}.`);
      const bt = v.extra.bioterrorist as { seat: string; city: string | null; sighting: string | null; hand: string[]; handSize: number } | undefined;
      if (bt) parts.push(`Bio-Terrorist (${bt.seat}): ${bt.city ? `in ${bt.city}` : "hidden"}${bt.sighting ? `, last sighted in ${bt.sighting}` : ""}, ${bt.handSize} cards${bt.hand.length ? ` (your hand: ${bt.hand.join(", ")})` : ""}.`);
      const vs = v.extra.virulentStrain as { color: string | null; active: string[] } | undefined;
      if (vs?.color) parts.push(`Virulent strain: ${vs.color}${vs.active.length ? ` (${vs.active.join(", ")})` : ""}.`);
      if (v.log.length) parts.push(`Last: ${v.log.join(" ")}`);
      return parts.join(" ");
    },
    layout(v) {
      const rows = CITY_NAMES.filter((c) => v.cubes[c] || v.stations.includes(c) || v.players.some((x) => v.pl[x]!.city === c)).map((c) =>
        `${(v.stations.includes(c) ? "[R] " : "    ") + c.padEnd(18)} ${String(CITIES[c]).padEnd(7)} ${Object.entries(v.cubes[c] ?? {}).map(([k, n]) => `${k}:${n}`).join(" ").padEnd(22)} ${v.players.filter((x) => v.pl[x]!.city === c).join(" ")}`);
      return [`Outbreaks ${v.outbreaks}/8  rate ${v.infectionRate}  cured ${v.cured.join(",") || "-"}`, ...rows].join("\n");
    },
  },
});
