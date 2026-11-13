// Pandemic base game: state, cubes and outbreaks, the player and infection decks, epidemics, the turn
// loop and the end. Add-ons (On the Brink, Virulent Strain, Mutation, the Bio-Terrorist) reach it through
// the extension points in POINTS and the action, role and event registries; none forks this file.
import { shuffle, type Json, type Option, type Prompt, type Rng, type SeatId, type Step } from "@boardcore/pack-sdk";
import { ADJ, CITIES, COLORS, OUTBREAK_LIMIT, POPULATION, RATES, SUPPLY, type Color } from "./data";
import type { Hooks } from "./hooks";

export const POINTS = {
  /** chain(s, rng): after the base setup, before the first turn. */
  setup: "chain",
  /** chain(cards, s, rng): the player cards left after the hands are dealt, before the epidemics go in. */
  playerCards: "chain",
  /** chain(epidemics: string[], s, rng): the epidemic cards (Virulent Strain swaps them). */
  epidemics: "chain",
  /** collect(s): role names to draw from. */
  roles: "collect",
  /** collect(s): event names to draw from. */
  events: "collect",
  /** chain(n, s, seat): actions per turn. */
  actionLimit: "chain",
  /** chain(n, s, seat): hand limit. */
  handLimit: "chain",
  /** chain(s): at the start of a player's turn. */
  turnStart: "chain",
  /** chain(s, seat, city, how): a pawn just entered a city (also moved by others). */
  onEnter: "chain",
  /** first(s, seat, from): a reason the pawn may not leave its city, or null. */
  blockLeave: "first",
  /** first(s, city, color): a reason no cube goes there (prevention), or null. */
  preventCube: "first",
  /** chain(n, s, city, color, why): how many cubes an infection places. */
  infectCubes: "chain",
  /** chain(n, s, color): outbreak marker steps for one outbreak. */
  outbreakSteps: "chain",
  /** first(s, city, color): adjusts the outbreaking city before its neighbours are hit (the Bio-Terrorist's
   *  purple flare-out takes 2 cubes back), or null. */
  outbreakSource: "first",
  /** chain(n, s, seat, color): cards needed to cure. */
  cureCost: "chain",
  /** chain(s, seat, color): right after a cure. */
  onCure: "chain",
  /** first(s, card, rng): resolves a special (non-epidemic) player card when drawn, or null. */
  drawCard: "first",
  /** first(s, card): whether a drawn player card is an epidemic (Virulent Strain's cards are), or null. */
  isEpidemic: "first",
  /** first(s, specials: string[]): true when the player picks the order of two drawn special cards. */
  drawChoice: "first",
  /** first(s, card, rng): resolves a special infection card, or null for the base. */
  infectCard: "first",
  /** chain(n, s): infection cards to draw this turn. */
  infectionRate: "chain",
  /** chain(n, s, drawn: string[]): extra infection cards once the rate's cards are drawn (Rate Effect). */
  infectBonus: "chain",
  /** collect(s, city): other colours that also get 1 cube when the city is drawn to infect (purple). */
  infectAlso: "collect",
  /** chain(s, step: "infected" | "intensified", rng, card): during an epidemic (after Infect; after Intensify). */
  epidemic: "chain",
  /** chain(discard: boolean, s, payer, card): whether a flight's city card is discarded (the Troubleshooter shows it). */
  payCard: "chain",
  /** chain(phases: string[], s): phases after the infection step before the next player (the Bio-Terrorist). */
  betweenTurns: "chain",
  /** first(s): an outcome the add-on decides, or null. */
  outcome: "first",
  /** chain(won: boolean, s): whether the cure goal is met. */
  cureGoal: "chain",
  /** collect(s, seat): seats that may act now besides the base's (event holders are the base's). */
  actors: "collect",
  /** collect(s, viewer): extra view fields, merged in. */
  view: "collect",
  /** collect(n, players, opts): reasons the seat count is not allowed. */
  seatCheck: "collect",
} as const;

export interface Pl {
  [k: string]: Json;
  role: string;
  city: string;
  hand: string[];
  /** Contingency Planner's stored event. */
  stored: string | null;
  /** Per-turn flags (once-per-turn abilities). */
  used: string[];
}

export interface Interrupt { [k: string]: Json; seat: SeatId; kind: string; data: Json }
export interface Outcome { [k: string]: Json; winners: SeatId[]; text: string }

export interface State {
  [k: string]: Json;
  seats: SeatId[];
  /** Seats that play the cure side, in turn order. */
  players: SeatId[];
  addons: string[];
  pl: { [seat: string]: Pl };
  cubes: { [city: string]: { [c: string]: number } };
  supply: { [c: string]: number };
  stations: string[];
  cured: string[];
  eradicated: string[];
  outbreaks: number;
  rateIdx: number;
  playerDeck: string[];
  playerDiscard: string[];
  infDeck: string[];
  infDiscard: string[];
  /** Out of the game (Resilient Population, stored events played). */
  removed: string[];
  unusedRoles: string[];
  current: number;
  actionsLeft: number;
  /** "actions" | "epidemic" | "infect" | an add-on phase | "interrupt" | "over". */
  phase: string;
  /** Phases still to run between this player's infection step and the next player's turn. */
  queue: string[];
  /** Special cards (epidemics, Mutation events) drawn this draw step and not yet resolved, in order. */
  drawn: string[];
  /** The epidemic waiting for its Intensify step (an event window is open), or null. */
  epidemicCard: string | null;
  /** The infection step under way: cards left, city cards drawn so far, and whether extras were added. */
  inf: { left: number; drawn: string[]; bonus: boolean } | null;
  /** Hands are face up (introductory game, or the open-hands option). */
  openHands: boolean;
  pending: Interrupt[];
  /** Skip the next infection step (One Quiet Night). */
  quiet: boolean;
  outcome: Outcome | null;
  log: string[];
  logPly: number;
  ply: number;
  /** Bumped whenever hidden information is read: the action is a commit point (reveal). */
  touched: number;
  ext: { [addon: string]: Json };
}

export interface ActionDef {
  id: string;
  /** Actions this costs (0 for free abilities). */
  cost: number;
  /** null: offered; a string: shown disabled with that reason; "hide": not offered. */
  check(s: State, seat: SeatId, ctx: Ctx): string | null;
  label(s: State, seat: SeatId): string;
  /** Prompts after the action id (null when complete). */
  steps(s: State, seat: SeatId, rest: Step[], ctx: Ctx): Prompt | null;
  apply(s: State, seat: SeatId, rest: Step[], ctx: Ctx, rng: Rng): State;
}

export interface EventDef {
  name: string;
  /** Also playable in the epidemic window between Infect and Intensify (Resilient Population). */
  inEpidemic?: boolean;
  /** True while the event's moment would pass if the turn moved on (Rapid Vaccine Deployment after a cure). */
  holdsTurn?(s: State): boolean;
  /** null: playable now by this seat; a string: why not; "hide": not offered. */
  check(s: State, seat: SeatId, ctx: Ctx): string | null;
  steps(s: State, seat: SeatId, rest: Step[], ctx: Ctx): Prompt | null;
  apply(s: State, seat: SeatId, rest: Step[], ctx: Ctx, rng: Rng): State;
}

export interface PhaseDef {
  actors(s: State, ctx: Ctx): SeatId[];
  prompt(s: State, seat: SeatId, partial: Step[], ctx: Ctx): Prompt | null;
  apply(s: State, seat: SeatId, action: Step[], ctx: Ctx, rng: Rng): State;
}

export interface InterruptDef {
  prompt(s: State, seat: SeatId, partial: Step[], data: Json, ctx: Ctx): Prompt | null;
  apply(s: State, seat: SeatId, action: Step[], data: Json, ctx: Ctx, rng: Rng): State;
  auto(s: State, seat: SeatId, data: Json, ctx: Ctx, rng: Rng): State;
}

export interface Ctx {
  hooks: Hooks;
  actions: ActionDef[];
  events: { [name: string]: EventDef };
  phases: { [id: string]: PhaseDef };
  interrupts: { [kind: string]: InterruptDef };
}

export const opt = (id: string, label: string, disabled?: string | null): Option => (disabled ? { id, label, disabled } : { id, label });
export const cur = (s: State): SeatId => s.players[s.current]!;
export const pawnsIn = (s: State, city: string) => s.players.filter((x) => s.pl[x]!.city === city);
export const isCity = (card: string) => card.startsWith("city:");
export const cityOf = (card: string) => card.slice(5);
export const isEvent = (card: string) => card.startsWith("event:");
export const cubesIn = (s: State, city: string, c: string) => s.cubes[city]?.[c] ?? 0;
export const onBoard = (s: State, c: string) => Object.values(s.cubes).reduce((t, m) => t + (m[c] ?? 0), 0);
export const say = (s: State, line: string): State => ({ ...s, log: [...s.log, line] });
export const touch = (s: State): State => ({ ...s, touched: s.touched + 1 });
export const setPl = (s: State, seat: SeatId, f: (p: Pl) => Pl): State => ({ ...s, pl: { ...s.pl, [seat]: f(s.pl[seat]!) } });
export const hasRole = (s: State, seat: SeatId, role: string) => s.pl[seat]?.role === role;
export const roleIn = (s: State, role: string): SeatId | null => s.players.find((x) => s.pl[x]!.role === role) ?? null;
export const lose = (s: State, text: string): State => (s.outcome ? s : { ...s, outcome: { winners: [], text: `lost: ${text}` }, phase: "over" });

// ---- Cubes and outbreaks ---------------------------------------------------------------------------------

/** Why a cube can't go on a city right now (a role or a hook), or null. */
export const prevented = (s: State, city: string, c: Color, ctx: Ctx) => ctx.hooks.first<string | null>("preventCube", basePrevent(s, city, c), s, city, c);

const addCube = (s: State, city: string, c: Color): State =>
  ({ ...s, supply: { ...s.supply, [c]: s.supply[c]! - 1 }, cubes: { ...s.cubes, [city]: { ...s.cubes[city], [c]: cubesIn(s, city, c) + 1 } } });

/**
 * Puts n cubes of a colour on a city: nothing for an eradicated disease or a protected city; a 4th cube
 * means an outbreak instead (one per placement); no cube left in the supply loses. Setup placements ignore
 * the roles (the Quarantine Specialist doesn't protect during setup).
 */
export function place(s: State, city: string, c: Color, n: number, ctx: Ctx, setup = false): State {
  for (let i = 0; i < n && !s.outcome; i++) {
    if (s.eradicated.includes(c)) return s;
    const why = setup ? null : prevented(s, city, c, ctx);
    if (why) return say(s, `${why} keeps ${c} out of ${city}.`);
    if (cubesIn(s, city, c) >= 3) return outbreak(s, city, c, ctx);
    if ((s.supply[c] ?? 0) <= 0) return lose(s, `no ${c} cubes left`);
    s = addCube(s, city, c);
  }
  return s;
}

function basePrevent(s: State, city: string, c: Color): string | null {
  for (const x of s.players) {
    const p = s.pl[x]!;
    if (p.role === "Quarantine Specialist" && (p.city === city || (ADJ[p.city] ?? []).includes(city))) return "The Quarantine Specialist";
    if (p.role === "Medic" && p.city === city && s.cured.includes(c)) return "The Medic";
  }
  return null;
}

/**
 * An outbreak and its chain reactions, breadth first: every neighbour gets 1 cube; a neighbour already at 3
 * breaks out next, after this outbreak is done; a city that already broke out during this card or action
 * gets nothing more.
 */
export function outbreak(s: State, city: string, c: Color, ctx: Ctx): State {
  const broke: string[] = [];
  const queue = [city];
  while (queue.length && !s.outcome) {
    const x = queue.shift()!;
    if (broke.includes(x)) continue;
    broke.push(x);
    s = ctx.hooks.first<State | null>("outbreakSource", null, s, x, c) ?? s;
    const steps = ctx.hooks.chain<number>("outbreakSteps", 1, s, c);
    s = say({ ...s, outbreaks: s.outbreaks + steps }, `Outbreak of ${c} in ${x}!`);
    if (s.outbreaks >= OUTBREAK_LIMIT) return lose(s, `${OUTBREAK_LIMIT} outbreaks`);
    for (const n of ADJ[x] ?? []) {
      if (s.outcome) return s;
      if (broke.includes(n) || s.eradicated.includes(c)) continue;
      const why = prevented(s, n, c, ctx);
      if (why) { s = say(s, `${why} keeps ${c} out of ${n}.`); continue; }
      if (cubesIn(s, n, c) >= 3) { if (!queue.includes(n)) queue.push(n); continue; }
      if ((s.supply[c] ?? 0) <= 0) return lose(s, `no ${c} cubes left`);
      s = addCube(s, n, c);
    }
  }
  return s;
}

/** Removes up to n cubes of a colour from a city; a cured colour with none left is eradicated. */
export function removeCubes(s: State, city: string, c: string, n: number): State {
  const k = Math.min(n, cubesIn(s, city, c));
  if (!k) return s;
  s = { ...s, supply: { ...s.supply, [c]: (s.supply[c] ?? 0) + k }, cubes: { ...s.cubes, [city]: { ...s.cubes[city]!, [c]: cubesIn(s, city, c) - k } } };
  return checkEradicated(s, c);
}

export function checkEradicated(s: State, c: string): State {
  if (s.cured.includes(c) && !s.eradicated.includes(c) && onBoard(s, c) === 0) return say({ ...s, eradicated: [...s.eradicated, c] }, `${c} is eradicated.`);
  return s;
}

/**
 * Infects one city from an infection card: 1 cube of its colour (Chronic Effect may say 2), and during the
 * infection step 1 more of each colour a hook adds (purple, on a city that already has purple). An epidemic
 * puts 3 cubes of the card's colour only.
 */
export function infectCity(s: State, card: string, ctx: Ctx, why: "infect" | "epidemic", rng: Rng): State {
  const special = ctx.hooks.first<State | null>("infectCard", null, s, card, rng);
  if (special) return special;
  const c = CITIES[card] as Color;
  const also = why === "infect" ? ctx.hooks.collect<Color>("infectAlso", s, card) : [];
  const n = why === "epidemic" ? 3 : ctx.hooks.chain<number>("infectCubes", 1, s, card, c, why);
  s = say(s, `${card} is infected (${n} ${c}${also.map((x) => `, 1 ${x}`).join("")}).`);
  s = place(s, card, c, n, ctx);
  for (const x of also) if (!s.outcome) s = place(s, card, x, 1, ctx);
  return s;
}

// ---- Moving pawns ------------------------------------------------------------------------------------------

/** Moves a pawn; `how` is the kind of move ("drive", "direct", ... or "event"). */
export function movePawn(s: State, seat: SeatId, city: string, ctx: Ctx, how = "move"): State {
  s = setPl(s, seat, (p) => ({ ...p, city }));
  if (hasRole(s, seat, "Medic")) for (const c of s.cured) s = removeCubes(s, city, c, 3);
  return ctx.hooks.chain<State>("onEnter", s, seat, city, how);
}

export const canLeave = (s: State, seat: SeatId, ctx: Ctx) => ctx.hooks.first<string | null>("blockLeave", null, s, seat, s.pl[seat]!.city);

// ---- Cards -------------------------------------------------------------------------------------------------

export const handLimit = (s: State, seat: SeatId, ctx: Ctx) => ctx.hooks.chain<number>("handLimit", 7, s, seat);

/** Queues a discard for every seat over its hand limit. */
export function checkHands(s: State, ctx: Ctx): State {
  for (const x of s.players) {
    if (s.pl[x]!.hand.length > handLimit(s, x, ctx) && !s.pending.some((i) => i.seat === x && i.kind === "discard"))
      s = { ...s, pending: [...s.pending, { seat: x, kind: "discard", data: null }] };
  }
  return s;
}

export function discardFrom(s: State, seat: SeatId, card: string): State {
  const i = s.pl[seat]!.hand.indexOf(card);
  if (i < 0) throw new Error(`${seat} has no ${card}`);
  return { ...setPl(s, seat, (p) => ({ ...p, hand: p.hand.filter((_, j) => j !== i) })), playerDiscard: [...s.playerDiscard, card] };
}

export const cardLabel = (card: string) => (isCity(card) ? `${cityOf(card)} (${CITIES[cityOf(card)]})` : isEvent(card) ? `${card.slice(6)} (event)` : card);

// ---- The turn ----------------------------------------------------------------------------------------------

export function startTurn(s: State, ctx: Ctx): State {
  const seat = cur(s);
  s = { ...s, phase: "actions", actionsLeft: ctx.hooks.chain<number>("actionLimit", 4, s, seat), pl: Object.fromEntries(Object.entries(s.pl).map(([k, p]) => [k, { ...p, used: [] }])) };
  return ctx.hooks.chain<State>("turnStart", s);
}

export const isEpidemicCard = (s: State, card: string, ctx: Ctx) => card === "epidemic" || ctx.hooks.first<boolean | null>("isEpidemic", null, s, card) === true;

/**
 * The Draw step begins: fewer than 2 cards left loses; both cards are drawn together; city and event cards go
 * to the hand; epidemics and other special cards wait in `drawn`, Mutation events first (a hook may let the
 * player order two of them).
 */
export function beginDraw(s: State, ctx: Ctx): State {
  s = touch(s);
  if (s.playerDeck.length < 2) return lose(s, "the player deck ran out");
  const two = s.playerDeck.slice(0, 2);
  s = { ...s, playerDeck: s.playerDeck.slice(2), phase: "draw" };
  const specials: string[] = [];
  for (const card of two) {
    if (isCity(card) || isEvent(card)) s = say(setPl(s, cur(s), (p) => ({ ...p, hand: [...p.hand, card] })), `${cur(s)} draws ${cardLabel(card)}.`);
    else specials.push(card);
  }
  const rank = (k: string) => (isEpidemicCard(s, k, ctx) ? 1 : 0);
  const drawn = specials.slice().sort((a, b) => rank(a) - rank(b));
  s = { ...s, drawn };
  if (drawn.length === 2 && drawn[0] !== drawn[1] && ctx.hooks.first<boolean | null>("drawChoice", null, s, drawn))
    s = { ...s, pending: [...s.pending, { seat: cur(s), kind: "drawOrder", data: drawn }] };
  return s;
}

/** An epidemic: Increase and Infect, then a window for Resilient Population if anyone holds it, then Intensify. */
export function startEpidemic(s: State, card: string, ctx: Ctx, rng: Rng): State {
  // The bottom infection card is turned up: a reveal even when no shuffle follows in this action.
  s = say(touch({ ...s, removed: [...s.removed, card] }), "Epidemic!");
  s = epidemicInfect(s, card, ctx, rng);
  if (s.outcome) return s;
  if (rpHolders(s, ctx).length) return { ...s, phase: "epidemic", epidemicCard: card };
  return finishEpidemic(s, card, ctx, rng);
}

export const finishEpidemic = (s: State, card: string, ctx: Ctx, rng: Rng): State => ({ ...intensify(s, card, ctx, rng), epidemicCard: null, phase: "draw" });

/** Epidemic steps 1 and 2: the rate goes up (it stays at the top of the track); the bottom infection card gets 3 cubes. */
export function epidemicInfect(s: State, card: string, ctx: Ctx, rng: Rng): State {
  s = { ...s, rateIdx: Math.min(s.rateIdx + 1, RATES.length - 1) };
  const bottom = s.infDeck[s.infDeck.length - 1];
  if (bottom !== undefined) {
    s = { ...s, infDeck: s.infDeck.slice(0, -1), infDiscard: [...s.infDiscard, bottom] };
    s = infectCity(s, bottom, ctx, "epidemic", rng);
  }
  return ctx.hooks.chain<State>("epidemic", s, "infected", rng, card);
}

/** Epidemic step 3: the discards are shuffled onto the top of the infection deck. */
export function intensify(s: State, card: string, ctx: Ctx, rng: Rng): State {
  s = { ...s, infDeck: [...shuffle(rng, s.infDiscard), ...s.infDeck], infDiscard: [] };
  return ctx.hooks.chain<State>("epidemic", s, "intensified", rng, card);
}

export const rpHolders = (s: State, ctx: Ctx) => s.players.filter((x) => holds(s, x, "Resilient Population") && ctx.events["Resilient Population"] && s.infDiscard.some((c) => CITIES[c]));
export const holds = (s: State, seat: SeatId, ev: string) => s.pl[seat]!.hand.includes(`event:${ev}`) || s.pl[seat]!.stored === `event:${ev}`;

/** The infection step begins (no cards drawn yet). */
export const beginInfect = (s: State): State => ({ ...s, phase: "infect", inf: null });

/**
 * Draws one infection card (starting the step on the first call: One Quiet Night skips it). After the rate's
 * cards, a hook may add more (once). Then the step ends and the between-turns phases run.
 */
export function infectOne(s: State, ctx: Ctx, rng: Rng): State {
  // Every infection card drawn is hidden until now (a reveal), not only the first of the step.
  s = touch(s);
  if (!s.inf) {
    if (s.quiet) return endInfect(say({ ...s, quiet: false }, "One quiet night: no infections."), ctx);
    s = { ...s, inf: { left: ctx.hooks.chain<number>("infectionRate", RATES[s.rateIdx]!, s), drawn: [], bonus: false } };
  }
  const inf = s.inf!;
  const card = s.infDeck[0];
  if (card === undefined || inf.left <= 0) return endInfect(s, ctx);
  s = { ...s, infDeck: s.infDeck.slice(1), infDiscard: [...s.infDiscard, card], inf: { ...inf, left: inf.left - 1, drawn: CITIES[card] ? [...inf.drawn, card] : inf.drawn } };
  s = infectCity(s, card, ctx, "infect", rng);
  if (s.outcome || s.inf!.left > 0) return s;
  if (!s.inf!.bonus) {
    const more = ctx.hooks.chain<number>("infectBonus", 0, s, s.inf!.drawn);
    s = { ...s, inf: { ...s.inf!, bonus: true, left: more } };
    if (more > 0) return s;
  }
  return endInfect(s, ctx);
}

function endInfect(s: State, ctx: Ctx): State {
  s = { ...s, inf: null };
  const queue = ctx.hooks.chain<string[]>("betweenTurns", [], s);
  return nextQueued({ ...s, queue }, ctx);
}

/** Runs the next queued between-turns phase, or the next player's turn. */
export function nextQueued(s: State, ctx: Ctx): State {
  if (s.queue.length) return { ...s, phase: s.queue[0]!, queue: s.queue.slice(1) };
  return startTurn({ ...s, current: (s.current + 1) % s.players.length }, ctx);
}

/** Cards needed to cure a colour. */
export const cureCost = (s: State, seat: SeatId, c: string, ctx: Ctx) =>
  ctx.hooks.chain<number>("cureCost", hasRole(s, seat, "Scientist") ? 4 : 5, s, seat, c);

export function cure(s: State, seat: SeatId, c: string, cards: string[], ctx: Ctx): State {
  for (const k of cards) s = discardFrom(s, seat, k);
  s = say({ ...s, cured: [...s.cured, c] }, `${seat} discovers a cure for ${c}!`);
  const medic = roleIn(s, "Medic");
  if (medic) s = removeCubes(s, s.pl[medic]!.city, c, 3);
  s = checkEradicated(s, c);
  return ctx.hooks.chain<State>("onCure", s, seat, c);
}

export function goalMet(s: State, ctx: Ctx): boolean {
  return ctx.hooks.chain<boolean>("cureGoal", COLORS.every((c) => s.cured.includes(c)), s);
}

export function checkWin(s: State, ctx: Ctx): State {
  if (s.outcome || !goalMet(s, ctx)) return s;
  return { ...s, phase: "over", outcome: { winners: s.players.slice(), text: "the players cure the diseases and win" } };
}

// ---- Setup -------------------------------------------------------------------------------------------------

export interface Opts {
  [k: string]: Json;
  epidemics: number; onTheBrink: boolean; virulentStrain: boolean; mutation: boolean; bioterrorist: boolean;
  openHands: boolean; bioterroristSeat: string;
}

/** The seat holding the highest city population card in its starting hand (ties: the earlier seat). */
export function firstPlayer(s: State): number {
  let best = 0, at = 0;
  s.players.forEach((x, i) => {
    for (const k of s.pl[x]!.hand) if (isCity(k) && (POPULATION[cityOf(k)] ?? 0) > best) { best = POPULATION[cityOf(k)] ?? 0; at = i; }
  });
  return at;
}

export function setupState(seatIds: SeatId[], opts: Opts, addons: string[], ctx: Ctx, rng: Rng): State {
  // The Bio-Terrorist is the last seat (a volunteer) or a random one.
  const btSeat = !opts.bioterrorist ? null : opts.bioterroristSeat === "random" ? seatIds[rng.int(seatIds.length)]! : seatIds[seatIds.length - 1]!;
  const players = seatIds.filter((x) => x !== btSeat);
  const reasons = ctx.hooks.collect<string>("seatCheck", seatIds.length, players.length, opts);
  const maxP = opts.bioterrorist ? 4 : opts.onTheBrink ? 5 : 4;
  if (players.length < 2 || players.length > maxP) reasons.push(`Pandemic needs 2 to ${maxP} players${opts.bioterrorist ? " besides the Bio-Terrorist" : opts.onTheBrink ? "" : " (5 with On the Brink)"}`);
  if (opts.epidemics < 4 || opts.epidemics > (opts.onTheBrink ? 7 : 6)) reasons.push("epidemics: 4 to 6 (7, legendary, with On the Brink)");
  if (reasons.length) throw new Error(reasons[0]);
  let s: State = {
    seats: seatIds, players, addons, pl: {}, cubes: {}, supply: { ...SUPPLY }, stations: ["Atlanta"], cured: [], eradicated: [], outbreaks: 0, rateIdx: 0,
    playerDeck: [], playerDiscard: [], infDeck: shuffle(rng, Object.keys(CITIES)), infDiscard: [], removed: [], unusedRoles: [],
    current: 0, actionsLeft: 0, phase: "actions", queue: [], drawn: [], epidemicCard: null, inf: null, openHands: opts.openHands || opts.epidemics === 4,
    pending: [], quiet: false, outcome: null, log: [], logPly: -1, ply: 0, touched: 0, ext: btSeat ? { btSeat } : {},
  };
  if (!opts.mutation && !opts.bioterrorist) s = { ...s, supply: { ...s.supply, purple: 0 } };
  const roles = shuffle(rng, ctx.hooks.collect<string>("roles", s));
  players.forEach((x, i) => { s.pl[x] = { role: roles[i]!, city: "Atlanta", hand: [], stored: null, used: [] }; });
  s = { ...s, unusedRoles: roles.slice(players.length) };
  // Initial infections: 3 cities with 3 cubes, 3 with 2, 3 with 1.
  for (const n of [3, 3, 3, 2, 2, 2, 1, 1, 1]) {
    const card = s.infDeck[0]!;
    s = { ...s, infDeck: s.infDeck.slice(1), infDiscard: [...s.infDiscard, card] };
    s = place(s, card, CITIES[card] as Color, n, ctx, true);
  }
  // Player deck: cities and events (On the Brink: 2 per player, the Bio-Terrorist counted), deal hands, then
  // split into piles as equal as possible with one epidemic each, the bigger piles on top.
  const events = shuffle(rng, ctx.hooks.collect<string>("events", s));
  const nEvents = opts.onTheBrink ? Math.min(events.length, 2 * seatIds.length) : events.length;
  let cards = shuffle(rng, [...Object.keys(CITIES).map((c) => `city:${c}`), ...events.slice(0, nEvents).map((e) => `event:${e}`)]);
  const hand = players.length === 2 ? 4 : players.length === 3 ? 3 : 2;
  for (const x of players) { s = setPl(s, x, (p) => ({ ...p, hand: cards.slice(0, hand) })); cards = cards.slice(hand); }
  cards = shuffle(rng, ctx.hooks.chain<string[]>("playerCards", cards, s, rng));
  const epis = ctx.hooks.chain<string[]>("epidemics", Array.from({ length: opts.epidemics }, () => "epidemic"), s, rng);
  const piles: string[][] = epis.map(() => []);
  cards.forEach((c, i) => piles[i % piles.length]!.push(c));
  const deck = piles.flatMap((pile, i) => shuffle(rng, [...pile, epis[i]!]));
  s = { ...s, playerDeck: deck, current: firstPlayer(s) };
  s = startTurn(s, ctx);
  return ctx.hooks.chain<State>("setup", s, rng);
}
