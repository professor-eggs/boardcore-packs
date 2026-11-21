// The in-pack kernel: what an expansion module adds to the game, and the content of each mix of expansions.
// The expansions (Leaders, Cities, the Wonder Pack) are options of this pack; each is a module under
// ./expansions, and the rules call the modules switched on, in that fixed order, as plain functions. No
// engine machinery: a module is checked by TypeScript, sees the whole state and keeps its own part of it
// (`state.leaders`, `state.cities`, `state.wonderPack`).
import type { InterruptKind, Json, Options, PhaseCtx, QuestionInput, Rng, SeatId, Viewer } from "@boardcore/pack-sdk";
import { BASE_CARDS, BASE_WONDERS } from "./data";

export type State = SWState;
export type ExpansionId = "leaders" | "cities" | "wonderPack";
export const EXPANSION_IDS: readonly ExpansionId[] = ["leaders", "cities", "wonderPack"];
/** Which expansions a game plays with. */
export type Mix = { [id in ExpansionId]: boolean };

/** Some of a record's named keys (without its index signature), for an update. */
export type Part<T> = { [K in keyof T as string extends K ? never : K]?: T[K] };

/** Each module's own part of the state. */
export type Own = Pick<State, ExpansionId>;

/** What was just built, as a module's `onBuild` gets it. */
export interface Build { seat: SeatId; item: SWItem; effs: SWEff[]; city: SWCityCard[] }

export interface Expansion {
  id: ExpansionId;
  cards?: readonly SWCardDef[];
  wonders?: readonly SWWonderDef[];
  /** The most seats the game takes with this expansion. */
  maxSeats?: number;
  /** Setup and resampling: the card ids of each age deck, before the guilds are chosen and the decks shuffled. */
  decks?(ids: string[][], seats: number, rng: Rng): string[][];
  /** The module's own part of a new game's state (made before the first phase runs). */
  setup(g: { seats: SeatId[]; sets: string[] }, options: Options, rng: Rng): Own;
  /** After anything is built (a card, a stage, a leader), once its base effects are done. */
  onBuild?(lib: Lib, s: State, b: Build): State;
  /** At the end of a turn, before the hands pass: coins from the bank. Every module reads the same state. */
  endTurn?(s: State, turn: number): { seat: SeatId; n: number }[];
  /** At the end of an age, before its conflicts. */
  ageEnd?(s: State): State;
  /** Who takes part in this age's conflicts. */
  conflictSeats?(s: State, seats: SeatId[]): SeatId[];
  /** Each seat's shields in this age's conflicts. */
  shields?(s: State, shields: { [seat: string]: number }): { [seat: string]: number };
  /** This age's conflicts, before their tokens are handed out (`tokens` 0: no fight). */
  conflicts?(s: State, fights: SWConflict[]): SWConflict[];
  /** Whether the hands pass at the end of this turn. */
  passes?(s: State, turn: number): boolean;
  /** Coin losses settled this module's way (Cities: a debt choice) instead of "pay what you can". */
  losses?(s: State, ctx: PhaseCtx): State;
  /** Extra scoring lines per seat. */
  score?(s: State, args: SWScoreArgs): { [seat: string]: SWLine[] };
  /**
   * The question for a `pending` entry of each of the module's kinds, asked in the order written here: the
   * question, null for none, or "later" to keep it pending until the next phase begins (`answering`: the ask
   * comes from inside another question's answer).
   */
  asks?: { [kind: string]: (s: State, seat: SeatId, answering: boolean) => QuestionInput | null | "later" };
  /** The module's question kinds (the interrupt queue). */
  questions?(lib: Lib): { [kind: string]: InterruptKind<State> };
  /** The module's part of a viewer's view. */
  view?(s: State, viewer: Viewer): { [k: string]: Json };
  legend?: string;
  /** The module's line of the state text. */
  text?(v: SWView): string;
  /** resampleHidden: the module's hidden state redrawn for `seat`, counts kept. */
  resample?(s: State, seat: SeatId, rng: Rng): State;
}

/** The content of one mix of expansions: every card and board that can be dealt, and the modules switched on. */
export interface Lib {
  cards: Map<string, SWCardDef>;
  wonders: Map<string, SWWonderDef>;
  /** "base", then the expansions switched on. */
  sets: string[];
  on: Mix;
  mods: readonly Expansion[];
}

export const mixKey = (sets: readonly string[]) => sets.join("+");

export function makeLib(mods: readonly Expansion[]): Lib {
  const on: Mix = { leaders: false, cities: false, wonderPack: false };
  for (const m of mods) on[m.id] = true;
  return {
    cards: new Map([...BASE_CARDS, ...mods.flatMap((m) => m.cards ?? [])].map((c) => [c.id, c])),
    wonders: new Map([...BASE_WONDERS, ...mods.flatMap((m) => m.wonders ?? [])].map((w) => [w.id, w])),
    sets: ["base", ...mods.map((m) => m.id)],
    on, mods,
  };
}

/** Every mix of the given modules, each kept in the modules' order. */
export function mixes(all: readonly Expansion[]): Expansion[][] {
  let out: Expansion[][] = [[]];
  for (const m of all) out = out.flatMap((xs) => [xs, [...xs, m]]);
  return out;
}
