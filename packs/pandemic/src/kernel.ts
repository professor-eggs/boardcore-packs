// The in-pack kernel: how the base calls the On the Brink modules (./expansions), now that they are options of
// this pack and no longer add-on packs. A module is a table of handlers by hook name; `hooks(mods)` gives the
// base one plain function per hook that runs the handlers of the modules switched on, in the kernel's order.
// Nothing is copied or frozen on the way: a handler gets the state itself and must not change it.
//
// Four kinds of hook, as the base uses them:
//  - a list (`roles`, `events`, `diseases`): every module's entries after the base's own;
//  - a modifier: each module's handler in turn changes a value the base starts;
//  - an event: each module's handler returns operations (PDOp) the base applies in order, and may return its
//    new slice, which the kernel puts first among them (the `slice` operation);
//  - a first-answer hook (`steps`, `eventCheck`, `outcome`): the first module to answer decides.
// A module may also bring its own phases (the Bio-Terrorist's turn), placed before one of the base's.
import type { Action, Json, Options, Phase, PhaseKind, Prompt, Rng, SeatId, Step, Viewer, Zones } from "@boardcore/pack-sdk";
import type { PDActionOpt, PDDisease, PDOp, PDOutcome, PDState, PDView } from "./types";

/** The modules, in the order their handlers run (the challenges after the roles, the events and Virulent Strain). */
export const MOD_IDS = ["roles", "events", "virulentStrain", "mutation", "bioterrorist"] as const;
export type ModId = (typeof MOD_IDS)[number];

type J = { [k: string]: Json };
type List<E> = { kind: "list"; entry: E };
type Modifier<V, A = undefined> = { kind: "modifier"; value: V; args: A };
type Event<A> = { kind: "event"; args: A };
type First<R, A> = { kind: "first"; result: R; args: A };
type All<R, A> = { kind: "all"; result: R; args: A };
type Drawing<V> = { kind: "drawing"; value: V };

/** Every hook the base offers, with what it hands a handler and what it takes back. */
export interface HookTable {
  roles: List<{ id: string }>;
  events: List<{ id: string; inEpidemic?: boolean }>;
  diseases: List<PDDisease>;
  /** The current player's module actions. */
  actions: All<PDActionOpt[], { seat: string }>;
  /** The prompt after a module action's or event's id and `rest` (`{ prompt: null }`: complete), or null when not its own. */
  steps: First<{ prompt: Prompt | null }, { id: string; seat: string; rest: Step[] }>;
  /** A module action's or event's effect. */
  act: Event<{ id: string; seat: string; rest: Step[] }>;
  /** Whether a seat may play a module's event now: `why` null, a reason, or "hide"; null when not its own. */
  eventCheck: First<{ why: string | null }, { id: string; seat: string }>;
  actionLimit: Modifier<number, { seat: string }>;
  handLimit: Modifier<number, { seat: string }>;
  cureCost: Modifier<number, { seat: string; color: string }>;
  /** Samples on the seat's role card that may stand in for cards in a cure: `samples` of the colour for `cards` cards (0: none). */
  cureSwap: Modifier<{ cards: number; samples: number }, { seat: string; color: string }>;
  infectionRate: Modifier<number>;
  infectCubes: Modifier<number, { city: string; color: string }>;
  infectBonus: Modifier<number, { drawn: string[] }>;
  outbreakSteps: Modifier<number, { color: string }>;
  /** A reason the pawn may not leave the city, or null. */
  blockLeave: Modifier<string | null, { seat: string; from: string }>;
  /** Whether a flight's city card is discarded (false: shown and kept). */
  payCard: Modifier<boolean, { payer: string; card: string; kind: string }>;
  cureGoal: Modifier<boolean>;
  /** Setup: the epidemic cards are `n` drawn from `pool`. */
  epidemics: Modifier<{ pool: string[]; n: number }>;
  /** Setup: the player cards shuffled into the piles after the hands are dealt. */
  playerCards: Modifier<string[]>;
  /** Setup: cards put in the infection discards before play. */
  startDiscard: Modifier<string[]>;
  eventCount: Modifier<number, { seats: number }>;
  maxPlayers: Modifier<number>;
  maxEpidemics: Modifier<number>;
  /** Setup (draws): the seats that get a pawn. */
  pawnSeats: Drawing<string[]>;
  turnStart: Event<{ seat: string }>;
  onEnter: Event<{ seat: string; city: string; how: string }>;
  onCure: Event<{ seat: string; color: string }>;
  /** An epidemic card, after its Infect step ("infected") and after Intensify ("intensified"); draws. */
  epidemic: Event<{ step: string; card: string }>;
  /** A drawn player card that is neither city, event nor epidemic. */
  drawCard: Event<{ card: string }>;
  /** An infection card that is no city (any operation: handled). */
  infectCard: Event<{ card: string }>;
  /** The end (first answer wins): may replace the base's outcome, a lone winner included. */
  outcome: First<PDOutcome, { result: PDOutcome }>;
}

/** What a handler gets: the state (null in setup's first calls), its module's slice, a generator where the hook draws, and in `pawnSeats` the pack's options. */
export interface In<A = undefined> { state: PDState | null; slice: Json; args: A; options: Options; rng: Rng | null }
/** What an event handler returns: its new slice, operations for the base, and whether the step is a reveal (phases only). */
export interface Effect { slice?: Json; ops?: PDOp[]; reveal?: true }

type Handler<H> =
  H extends List<infer E> ? E[]
  : H extends Modifier<infer V, infer A> ? (i: In<A> & { value: V }) => V
  : H extends Drawing<infer V> ? (i: In & { value: V }) => V
  : H extends Event<infer A> ? (i: In<A>) => Effect
  : H extends First<infer R, infer A> ? (i: In<A>) => R | null
  : H extends All<infer R, infer A> ? (i: In<A>) => R
  : never;

type Hook<H> =
  H extends List<infer E> ? () => E[]
  : H extends Modifier<infer V, infer A> ? (state: PDState | null, value: V, ...rest: A extends undefined ? [] : [args: A]) => V
  : H extends Drawing<infer V> ? (value: V, rng: Rng, options: Options) => V
  : H extends Event<infer A> ? (state: PDState, args: A, rng?: Rng | null) => PDOp[]
  : H extends First<infer R, infer A> ? (state: PDState, args: A) => R | null
  : H extends All<infer R, infer A> ? (state: PDState, args: A) => R[]
  : never;

/** The base's side of the kernel: one plain function per hook. */
export type Hooks = { [K in keyof HookTable]: Hook<HookTable[K]> };

/** A module's own phase, placed before one of the base's (`rounds`: only in these rounds). */
export interface ModPhase {
  name: string;
  kind: PhaseKind;
  before: string;
  rounds?: number[];
  seats(i: { state: PDState; slice: Json }): SeatId[];
  begin?(i: { state: PDState; slice: Json }): Effect;
  choices(i: { state: PDState; slice: Json; seat: SeatId; partial: Action }): Prompt | null;
  apply(i: { state: PDState; slice: Json; seat: SeatId; action: Action; zones: Zones }): Effect;
}

export interface Module {
  id: ModId;
  contributes: { [K in keyof HookTable]?: Handler<HookTable[K]> };
  phases?: ModPhase[];
  /** The module's slice at the start (after the base's setup, before round 1 begins). */
  setup?(i: { state: PDState; options: Options }): Json;
  /** What a viewer sees of the slice. */
  view?(i: { slice: Json; view: PDView; viewer: Viewer }): Json;
  text?: { legend?(): string; state?(i: { view: Json }): string };
  /** The slice redrawn for a seat's world (D82): everything the seat can't see. */
  resampleHidden?(i: { state: PDState; slice: Json; seat: SeatId; rng: Rng }): Json;
}

const NONE: Options = {};
const sliceOf = (s: PDState | null, m: Module): Json => s?.slices?.[m.id] ?? null;
const input = <A>(s: PDState | null, m: Module, args: A, rng: Rng | null, options: Options = NONE): In<A> => ({ state: s, slice: sliceOf(s, m), args, options, rng });
/** A handler's effect as operations: its new slice first (set before anything else it asked for). */
export const opsOf = (m: Module, e: Effect): PDOp[] => (e.slice !== undefined ? [{ op: "slice", mod: m.id, slice: e.slice }, ...(e.ops ?? [])] : e.ops ?? []);

/** The hooks for the modules switched on, in order. */
export function hooks(mods: readonly Module[]): Hooks {
  const having = <K extends keyof HookTable>(k: K) => mods.flatMap((m) => (m.contributes[k] !== undefined ? [{ m, h: m.contributes[k] as never }] : []));
  const list = (k: "roles" | "events" | "diseases") => { const all = having(k).flatMap((x) => x.h as { id: string }[]); return () => all; };
  const modifier = (k: keyof HookTable) => {
    const hs = having(k) as { m: Module; h: (i: In<unknown> & { value: unknown }) => unknown }[];
    return (s: PDState | null, value: unknown, args?: unknown) => {
      for (const { m, h } of hs) value = h({ ...input(s, m, args, null), value });
      return value;
    };
  };
  // pawnSeats runs in setup, before there is a state: it gets the pack's options and setup's generator.
  const drawing = (k: keyof HookTable) => {
    const hs = having(k) as { m: Module; h: (i: In<unknown> & { value: unknown }) => unknown }[];
    return (value: unknown, rng: Rng, options: Options) => {
      for (const { m, h } of hs) value = h({ ...input(null, m, undefined, rng, options), value });
      return value;
    };
  };
  const event = (k: keyof HookTable) => {
    const hs = having(k) as { m: Module; h: (i: In<unknown>) => Effect }[];
    return (s: PDState, args: unknown, rng: Rng | null = null) => {
      const out: PDOp[] = [];
      for (const { m, h } of hs) out.push(...opsOf(m, h(input(s, m, args, rng))));
      return out;
    };
  };
  const first = (k: keyof HookTable) => {
    const hs = having(k) as { m: Module; h: (i: In<unknown>) => unknown }[];
    return (s: PDState, args: unknown) => {
      for (const { m, h } of hs) { const r = h(input(s, m, args, null)); if (r !== null) return r; }
      return null;
    };
  };
  const all = (k: keyof HookTable) => {
    const hs = having(k) as { m: Module; h: (i: In<unknown>) => unknown }[];
    return (s: PDState, args: unknown) => hs.map(({ m, h }) => h(input(s, m, args, null)));
  };
  const out: { [k: string]: unknown } = {
    roles: list("roles"), events: list("events"), diseases: list("diseases"),
    actions: all("actions"), steps: first("steps"), act: event("act"), eventCheck: first("eventCheck"), outcome: first("outcome"),
    pawnSeats: drawing("pawnSeats"),
  };
  for (const k of ["actionLimit", "handLimit", "cureCost", "cureSwap", "infectionRate", "infectCubes", "infectBonus", "outbreakSteps", "blockLeave", "payCard", "cureGoal", "epidemics", "playerCards", "startDiscard", "eventCount", "maxPlayers", "maxEpidemics"] as const) out[k] = modifier(k);
  for (const k of ["turnStart", "onEnter", "onCure", "epidemic", "drawCard", "infectCard"] as const) out[k] = event(k);
  return out as unknown as Hooks;
}

/** A module's phase as one of the runner's: its effects applied by the base (`apply`), a reveal marked on the call's reader. */
export function runnerPhase(m: Module, p: ModPhase, apply: (s: PDState, ops: PDOp[]) => PDState): Phase<PDState> {
  const inRound = (round: number) => !p.rounds || p.rounds.includes(round);
  const fold = (s: PDState, e: Effect, zones: Zones): PDState => {
    if (e.reveal) zones.reveal();
    return apply(s, opsOf(m, e));
  };
  return {
    id: p.name, kind: p.kind,
    seats: (s, round) => (inRound(round) ? p.seats({ state: s, slice: sliceOf(s, m) }) : []),
    begin: (s, ctx) => (p.begin && inRound(ctx.round) ? fold(s, p.begin({ state: s, slice: sliceOf(s, m) }), ctx.zones) : s),
    choices: (s, seat, partial) => p.choices({ state: s, slice: sliceOf(s, m), seat, partial }),
    apply: (s, seat, action, ctx) => fold(s, p.apply({ state: s, slice: sliceOf(s, m), seat, action, zones: ctx.zones }), ctx.zones),
  };
}
