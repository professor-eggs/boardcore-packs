// Pandemic base game: state helpers, cubes and outbreaks, moving pawns, cards, cures, epidemics, infection and
// the operations add-ons return (PDOp in points.d.ts). Add-ons reach the base only through the points declared
// in index.ts; none edits this file. Mechanics only.
import { shuffle, withItems, type Prompt, type Rng, type SeatId, type Option, type Zones, type QuestionInput, type Invokers } from "@boardcore/pack-sdk";
import { ADJ, CITIES, OUTBREAK_LIMIT, RATES } from "./data";

export type State = PDState;
export type Op = PDOp;
export type Pl = PDPl;

/** What the base knows after compose: its invokers and the registries it read once. */
export interface Lib {
  pts: Invokers<"boardcore/pandemic">;
  roles: string[];
  events: Map<string, { id: string; inEpidemic?: boolean }>;
  baseEvents: Set<string>;
}

/** The effects context: the call's zone reader and its question queue (absent for an add-on phase's operations). */
export interface Fx { zones: Zones; ask(q: QuestionInput): void; rng: Rng | null }

export const opt = (id: string, label: string, disabled?: string | null): Option => (disabled ? { id, label, disabled } : { id, label });
export const pick = (label: string, options: Option[]): Prompt | null => (options.length ? { kind: "pick", label, options } : null);
export const cur = (s: State): SeatId => s.players[s.current]!;
export const isCity = (card: string) => card.startsWith("city:");
export const cityOf = (card: string) => card.slice(5);
export const isEvent = (card: string) => card.startsWith("event:");
export const isEpidemic = (card: string) => card === "epidemic" || card.startsWith("epidemic:");
export const cubesIn = (s: State, city: string, c: string) => s.cubes[city]?.[c] ?? 0;
export const onBoard = (s: State, c: string) => Object.values(s.cubes).reduce((t, m) => t + (m[c] ?? 0), 0);
export const say = (s: State, line: string): State => ({ ...s, log: [...s.log, line] });
export const setPl = (s: State, seat: SeatId, f: (p: Pl) => Pl): State => ({ ...s, pl: { ...s.pl, [seat]: f(s.pl[seat]!) } });
export const hasRole = (s: State, seat: SeatId, role: string) => s.pl[seat]?.role === role;
export const roleIn = (s: State, role: string): SeatId | null => s.players.find((x) => s.pl[x]!.role === role) ?? null;
export const pawnsIn = (s: State, city: string) => s.players.filter((x) => s.pl[x]!.city === city);
/** A hand's cards, unmarked: the seat's own (its prompt, its own action) or for `view`. */
export const handOf = (s: State, seat: SeatId) => s.pl[seat]!.hand.items.slice();
export const setHand = (s: State, seat: SeatId, items: string[]) => setPl(s, seat, (p) => ({ ...p, hand: withItems(p.hand, items) }));
export const cardLabel = (card: string) => (isCity(card) ? `${cityOf(card)} (${CITIES[cityOf(card)]})` : isEvent(card) ? `${card.slice(6)} (event)` : card.replace(/^[a-z]+:/, ""));
export const markUsed = (s: State, seat: SeatId, flag: string) => setPl(s, seat, (p) => ({ ...p, used: [...p.used, flag] }));
export const used = (s: State, seat: SeatId, flag: string) => s.pl[seat]!.used.includes(flag);
export const diseaseOf = (s: State, c: string) => s.diseases.find((d) => d.id === c);
export const holds = (s: State, seat: SeatId, ev: string) => handOf(s, seat).includes(`event:${ev}`) || s.pl[seat]!.stored === `event:${ev}`;
export const currentRate = (s: State, L: Lib) => L.pts.infectionRate(s, RATES[s.rateIdx]!);

// ---- The end --------------------------------------------------------------------------------------------

/** Ends the game with the base's result, unless an add-on's `outcome` point replaces it (a lone winner). */
export function finish(s: State, L: Lib, result: PDOutcome): State {
  if (s.outcome) return s;
  const out = L.pts.outcome(s, { result }) ?? result;
  return say({ ...s, outcome: out }, `Game over: ${out.text}.`);
}
export const lose = (s: State, L: Lib, text: string) => finish(s, L, { winners: [], text: `the players lose (${text})` });
export const goalMet = (s: State, L: Lib) => L.pts.cureGoal(s, s.diseases.filter((d) => d.standard).every((d) => s.cured.includes(d.id)));
export const checkWin = (s: State, L: Lib): State =>
  s.outcome || !goalMet(s, L) ? s : finish(s, L, { winners: s.players.slice(), text: "the players cure the diseases and win" });

// ---- Cubes and outbreaks ---------------------------------------------------------------------------------

function prevented(s: State, city: string, c: string): string | null {
  for (const x of s.players) {
    const p = s.pl[x]!;
    if (p.role === "Quarantine Specialist" && (p.city === city || (ADJ[p.city] ?? []).includes(city))) return "The Quarantine Specialist";
    if (p.role === "Medic" && p.city === city && s.cured.includes(c)) return "The Medic";
  }
  return null;
}

const addCube = (s: State, city: string, c: string): State =>
  ({ ...s, supply: { ...s.supply, [c]: s.supply[c]! - 1 }, cubes: { ...s.cubes, [city]: { ...s.cubes[city], [c]: cubesIn(s, city, c) + 1 } } });

/**
 * Puts n cubes of a colour on a city: nothing for an eradicated disease or a protected city; a 4th cube means an
 * outbreak instead; no cube left in the supply loses. Setup placements ignore the roles.
 */
export function place(s: State, L: Lib, city: string, c: string, n: number, setup = false): State {
  for (let i = 0; i < n && !s.outcome; i++) {
    if (s.eradicated.includes(c)) return s;
    const why = setup ? null : prevented(s, city, c);
    if (why) return say(s, `${why} keeps ${c} out of ${city}.`);
    if (cubesIn(s, city, c) >= 3) return outbreak(s, L, city, c);
    if ((s.supply[c] ?? 0) <= 0) return lose(s, L, `no ${c} cubes left`);
    s = addCube(s, city, c);
  }
  return s;
}

/** An outbreak and its chain reactions, breadth first; a city breaks out at most once per card or action. */
export function outbreak(s: State, L: Lib, city: string, c: string): State {
  const broke: string[] = [];
  const queue = [city];
  const flare = diseaseOf(s, c)?.flare ?? 0;
  while (queue.length && !s.outcome) {
    const x = queue.shift()!;
    if (broke.includes(x)) continue;
    broke.push(x);
    if (flare) s = removeCubes(s, x, c, flare);
    const steps = L.pts.outbreakSteps(s, 1, { color: c });
    s = say({ ...s, outbreaks: s.outbreaks + steps }, `Outbreak of ${c} in ${x}!`);
    if (s.outbreaks >= OUTBREAK_LIMIT) return lose(s, L, `${OUTBREAK_LIMIT} outbreaks`);
    for (const n of ADJ[x] ?? []) {
      if (s.outcome) return s;
      if (broke.includes(n) || s.eradicated.includes(c)) continue;
      const why = prevented(s, n, c);
      if (why) { s = say(s, `${why} keeps ${c} out of ${n}.`); continue; }
      if (cubesIn(s, n, c) >= 3) { if (!queue.includes(n)) queue.push(n); continue; }
      if ((s.supply[c] ?? 0) <= 0) return lose(s, L, `no ${c} cubes left`);
      s = addCube(s, n, c);
    }
  }
  return s;
}

/** Removes up to n cubes of a colour from a city to the supply; a cured colour with none left is eradicated. */
export function removeCubes(s: State, city: string, c: string, n: number, toSupply = true): State {
  const k = Math.min(n, cubesIn(s, city, c));
  if (!k) return s;
  s = { ...s, cubes: { ...s.cubes, [city]: { ...s.cubes[city]!, [c]: cubesIn(s, city, c) - k } } };
  if (toSupply) s = { ...s, supply: { ...s.supply, [c]: (s.supply[c] ?? 0) + k } };
  return checkEradicated(s, c);
}

export function checkEradicated(s: State, c: string): State {
  if (s.cured.includes(c) && !s.eradicated.includes(c) && onBoard(s, c) === 0) return say({ ...s, eradicated: [...s.eradicated, c] }, `${c} is eradicated.`);
  return s;
}

/**
 * Infects one city from an infection card: 1 cube of its colour (a modifier may say 2), and in the infection
 * step 1 more of each `follows` disease already there. An epidemic puts 3 cubes of the card's colour only.
 * A card that is no city is the add-ons' (`infectCard`).
 */
export function infectCity(s: State, L: Lib, card: string, why: "infect" | "epidemic", fx: Fx | null): State {
  if (!CITIES[card]) {
    const ops = L.pts.infectCard(s, { card });
    return ops.length ? applyOps(s, L, ops, fx) : say(s, `${card} has no effect.`);
  }
  const c = CITIES[card]!;
  const also = why === "infect" ? s.diseases.filter((d) => d.follows && d.id !== c && cubesIn(s, card, d.id) > 0).map((d) => d.id) : [];
  const n = why === "epidemic" ? 3 : L.pts.infectCubes(s, 1, { city: card, color: c });
  s = say(s, `${card} is infected (${n} ${c}${also.map((x) => `, 1 ${x}`).join("")}).`);
  s = place(s, L, card, c, n);
  for (const x of also) if (!s.outcome) s = place(s, L, card, x, 1);
  return s;
}

// ---- Moving pawns ----------------------------------------------------------------------------------------

export const canLeave = (s: State, L: Lib, seat: SeatId): string | null => L.pts.blockLeave(s, null, { seat, from: s.pl[seat]!.city });

/** Moves a pawn; `how` is the kind of move ("drive", "direct", ..., "event"). */
export function movePawn(s: State, L: Lib, seat: SeatId, city: string, how: string, fx: Fx | null): State {
  s = setPl(s, seat, (p) => ({ ...p, city }));
  if (hasRole(s, seat, "Medic")) for (const c of s.cured) s = removeCubes(s, city, c, 3);
  return applyOps(s, L, L.pts.onEnter(s, { seat, city, how }), fx);
}

/** A move paid by `payer` (the Dispatcher pays for others): the card for a direct or charter flight. */
export function doMove(s: State, L: Lib, pawn: SeatId, payer: SeatId, kind: string, to: string, fx: Fx | null): State {
  const from = s.pl[pawn]!.city;
  const pay = (card: string) => (L.pts.payCard(s, true, { payer, card, kind }) ? discardFrom(s, payer, card) : say(s, `${payer} shows ${cityOf(card)}.`));
  if (kind === "direct") s = pay(`city:${to}`);
  if (kind === "charter") s = pay(`city:${from}`);
  s = say(s, `${pawn} ${kind === "drive" ? "drives" : kind === "shuttle" ? "shuttles" : kind === "join" ? "is dispatched" : "flies"} from ${from} to ${to}.`);
  return movePawn(s, L, pawn, to, kind, fx);
}

// ---- Cards -----------------------------------------------------------------------------------------------

export const handLimit = (s: State, L: Lib, seat: SeatId) => L.pts.handLimit(s, 7, { seat });

export function discardFrom(s: State, seat: SeatId, card: string): State {
  const hand = handOf(s, seat);
  const i = hand.indexOf(card);
  if (i < 0) throw new Error(`${seat} has no ${card}`);
  return { ...setHand(s, seat, hand.filter((_, j) => j !== i)), playerDiscard: [...s.playerDiscard, card] };
}

/** Asks the seat to discard while it is over its hand limit (a question per card over). */
export function checkHand(s: State, L: Lib, seat: SeatId, fx: Fx | null): State {
  if (!fx || !s.players.includes(seat) || s.outcome) return s;
  if (handOf(s, seat).length > handLimit(s, L, seat)) fx.ask({ kind: "discard", seat, default: ["d:0"] });
  return s;
}

/** A card moves from one hand to another (a share, a take). */
export function moveCard(s: State, from: SeatId, to: SeatId, card: string): State {
  const h = handOf(s, from);
  const i = h.indexOf(card);
  if (i < 0) throw new Error(`${from} has no ${card}`);
  return setHand(setHand(s, from, h.filter((_, j) => j !== i)), to, [...handOf(s, to), card]);
}

/** The event card goes: from the hand to the discards, or (stored) out of the game. */
export function spendEvent(s: State, seat: SeatId, name: string): State {
  const card = `event:${name}`;
  if (handOf(s, seat).includes(card)) return say(discardFrom(s, seat, card), `${seat} plays ${name}.`);
  if (s.pl[seat]!.stored === card) return say({ ...setPl(s, seat, (p) => ({ ...p, stored: null })), removed: [...s.removed, card] }, `${seat} plays ${name}.`);
  throw new Error(`${seat} has no ${name}`);
}

// ---- Cures -----------------------------------------------------------------------------------------------

export const cureCost = (s: State, L: Lib, seat: SeatId, c: string) => L.pts.cureCost(s, hasRole(s, seat, "Scientist") ? 4 : 5, { seat, color: c });

/** The city cards in the seat's hand that may go towards curing `c`, and the rule for "at least one". */
export function cureCards(s: State, seat: SeatId, c: string): { cards: string[]; mustOne?: (k: string) => boolean } {
  const cities = handOf(s, seat).filter(isCity);
  if (diseaseOf(s, c)?.cure === "any") return { cards: cities, mustOne: (k) => cubesIn(s, cityOf(k), c) > 0 };
  return { cards: cities.filter((k) => CITIES[cityOf(k)] === c) };
}

export function cure(s: State, L: Lib, seat: SeatId, c: string, cards: string[], samples: number, fx: Fx | null): State {
  for (const k of cards) s = discardFrom(s, seat, k);
  if (samples) s = setPl({ ...s, supply: { ...s.supply, [c]: (s.supply[c] ?? 0) + samples } }, seat, (p) => ({ ...p, samples: { ...p.samples, [c]: (p.samples[c] ?? 0) - samples } }));
  s = say({ ...s, cured: [...s.cured, c], justCured: c }, `${seat} discovers a cure for ${c}!`);
  const medic = roleIn(s, "Medic");
  if (medic) s = removeCubes(s, s.pl[medic]!.city, c, 3);
  s = checkEradicated(s, c);
  s = applyOps(s, L, L.pts.onCure(s, { seat, color: c }), fx);
  return checkWin(s, L);
}

// ---- Infection deck --------------------------------------------------------------------------------------

/** Takes n top infection cards (a reveal: the reader marks it), keeping segments and known counts in step. */
export function takeTop(s: State, n: number, fx: Fx | null): [State, string[]] {
  const deck = fx ? fx.zones.items(s.infDeck) : s.infDeck.items.slice();
  const k = Math.min(n, deck.length);
  const top = deck.slice(0, k);
  let left = k;
  const segs: number[] = [];
  for (const g of s.infSegs) { const d = Math.min(g, left); left -= d; if (g - d > 0) segs.push(g - d); }
  const infKnown = Object.fromEntries(Object.entries(s.infKnown).map(([x, m]) => [x, Math.max(0, m - k)]).filter(([, m]) => (m as number) > 0));
  return [{ ...s, infDeck: withItems(s.infDeck, deck.slice(k)), infSegs: segs, infKnown }, top];
}

/** Takes the bottom infection card (part of the bottom segment). */
export function takeBottom(s: State, fx: Fx | null): [State, string | null] {
  const deck = fx ? fx.zones.items(s.infDeck) : s.infDeck.items.slice();
  const card = deck[deck.length - 1];
  if (card === undefined) return [s, null];
  const segs = s.infSegs.slice();
  segs[segs.length - 1] = segs[segs.length - 1]! - 1;
  const infKnown = Object.fromEntries(Object.entries(s.infKnown).map(([x, m]) => [x, Math.min(m, deck.length - 1)]));
  return [{ ...s, infDeck: withItems(s.infDeck, deck.slice(0, -1)), infSegs: segs.filter((g) => g > 0), infKnown, infDiscard: [...s.infDiscard, card] }, card];
}

/** Epidemic steps 1 and 2: the rate goes up; the bottom infection card gets 3 cubes. */
export function epidemicInfect(s: State, L: Lib, card: string, fx: Fx): State {
  s = say({ ...s, removed: [...s.removed, card], rateIdx: Math.min(s.rateIdx + 1, RATES.length - 1), epidemicCard: card }, "Epidemic!");
  fx.zones.reveal();
  const [t, bottom] = takeBottom(s, fx);
  s = t;
  if (bottom !== null) s = infectCity(s, L, bottom, "epidemic", fx);
  if (s.outcome) return s;
  return applyOps(s, L, L.pts.epidemic(s, { step: "infected", card }), fx);
}

/** Epidemic step 3: the discards are shuffled onto the top of the infection deck (a segment of their own). */
export function intensify(s: State, L: Lib, fx: Fx): State {
  const card = s.epidemicCard!;
  const pile = shuffle(fx.rng!, s.infDiscard);
  const deck = fx.zones.items(s.infDeck);
  s = { ...s, infDeck: withItems(s.infDeck, [...pile, ...deck]), infSegs: [...(pile.length ? [pile.length] : []), ...s.infSegs], infKnown: {}, infDiscard: [], epidemicCard: null };
  return applyOps(s, L, L.pts.epidemic(s, { step: "intensified", card }), fx);
}

// ---- Operations ------------------------------------------------------------------------------------------

const noFx = (what: string): never => { throw new Error(`the operation ${what} needs an action's context (it asks a seat)`); };

/** Applies add-on operations in order (11 §10 "What an add-on may change"). */
export function applyOps(s: State, L: Lib, ops: readonly PDJsonOp[], fx: Fx | null): State {
  for (const raw of ops) {
    if (s.outcome) return s;
    const o = raw as Op;
    switch (o.op) {
      case "log": s = say(s, o.text); break;
      case "place": s = place(s, L, o.city, o.color, o.n); break;
      case "remove": s = removeCubes(s, o.city, o.color, o.n); break;
      case "supply": s = { ...s, supply: { ...s.supply, [o.color]: Math.max(0, (s.supply[o.color] ?? 0) + o.n) } }; break;
      case "uneradicate": s = { ...s, eradicated: s.eradicated.filter((c) => c !== o.color) }; break;
      case "actions": s = { ...s, actionsLeft: s.actionsLeft + o.n }; break;
      case "move": s = doMove(s, L, o.pawn, o.payer, o.kind, o.to, fx); break;
      case "give": s = moveCard(s, o.from, o.to, o.card); break;
      case "handToDiscard": s = discardFrom(s, o.seat, o.card); break;
      case "discardToHand": {
        const i = s.playerDiscard.indexOf(o.card);
        if (i < 0) throw new Error(`${o.card} isn't in the discards`);
        s = setHand({ ...s, playerDiscard: s.playerDiscard.filter((_, j) => j !== i) }, o.seat, [...handOf(s, o.seat), o.card]);
        break;
      }
      case "spendEvent": s = spendEvent(s, o.seat, o.name); break;
      case "role": {
        // The old role card's contents go: a stored event to the discards, samples to the supply.
        const p = s.pl[o.seat]!;
        if (p.stored) s = { ...s, playerDiscard: [...s.playerDiscard, p.stored] };
        for (const [c, n] of Object.entries(p.samples)) s = { ...s, supply: { ...s.supply, [c]: (s.supply[c] ?? 0) + n } };
        const old = p.role;
        s = setPl({ ...s, unusedRoles: [...s.unusedRoles.filter((r) => r !== o.role), old] }, o.seat, (q) => ({ ...q, role: o.role, stored: null, samples: {} }));
        // The current player becoming the Generalist (or leaving it) mid-turn: the action limit's difference.
        if (o.seat === cur(s) && s.step === "actions") {
          const before = L.pts.actionLimit({ ...s, pl: { ...s.pl, [o.seat]: { ...s.pl[o.seat]!, role: old } } }, 4, { seat: o.seat });
          s = { ...s, actionsLeft: Math.max(0, s.actionsLeft + Math.max(0, L.pts.actionLimit(s, 4, { seat: o.seat }) - before)) };
        }
        s = say(s, `${o.seat} becomes the ${o.role}.`);
        break;
      }
      case "sample": {
        s = { ...s, cubes: { ...s.cubes, [o.city]: { ...s.cubes[o.city]!, [o.color]: cubesIn(s, o.city, o.color) - 1 } } };
        s = checkEradicated(setPl(s, o.seat, (p) => ({ ...p, samples: { ...p.samples, [o.color]: (p.samples[o.color] ?? 0) + 1 } })), o.color);
        break;
      }
      case "unsample":
        s = setPl({ ...s, supply: { ...s.supply, [o.color]: (s.supply[o.color] ?? 0) + o.n } }, o.seat, (p) => ({ ...p, samples: { ...p.samples, [o.color]: (p.samples[o.color] ?? 0) - o.n } }));
        break;
      case "cure": s = cure(s, L, o.seat, o.color, o.cards, o.samples, fx); break;
      case "unstation": s = { ...s, stations: s.stations.filter((c) => c !== o.city) }; break;
      case "hold": {
        const [t, top] = takeTop(s, o.n, null);
        s = { ...t, held: { ...t.held, [o.seat]: withItems(t.held[o.seat]!, [...t.held[o.seat]!.items, ...top]) } };
        break;
      }
      case "unhold": {
        const h = s.held[o.seat]!.items.slice();
        const out = o.cards ?? h;
        const rest = h.slice();
        for (const k of out) { const i = rest.indexOf(k); if (i < 0) throw new Error(`${o.seat} holds no ${k}`); rest.splice(i, 1); }
        s = { ...s, held: { ...s.held, [o.seat]: withItems(s.held[o.seat]!, rest) }, infDiscard: [...s.infDiscard, ...out] };
        break;
      }
      case "infectBottom": {
        const [t, card] = takeBottom(s, fx);
        if (fx) fx.zones.reveal();
        s = t;
        if (card !== null && CITIES[card]) s = place(say(s, `${card} gets ${o.n} ${o.color}.`), L, card, o.color, o.n);
        break;
      }
      case "peek": {
        const n = Math.min(currentRate(s, L), s.infDeck.items.length);
        if (fx) fx.zones.items(s.infDeck); else noFx("peek");
        s = say({ ...s, infKnown: { ...s.infKnown, [o.seat]: Math.max(n, s.infKnown[o.seat] ?? 0) } }, `${o.seat} looks at the top ${n} infection cards.`);
        break;
      }
      case "grant": s = say({ ...s, grant: o.pawn }, `${cur(s)} may move ${o.pawn} this turn.`); break;
      case "use": s = markUsed(s, o.seat, o.flag); break;
      case "reveal": if (fx) fx.zones.reveal(); break;
      case "handLimit": s = checkHand(s, L, o.seat, fx); break;
      case "ask":
        if (!fx) noFx("ask");
        fx!.ask({ kind: "choose", seat: o.seat, args: { label: o.label, choices: o.choices }, default: [o.choices[0]!.id] });
        break;
      case "askCard":
        if (!fx) noFx("askCard");
        fx!.ask({ kind: "give", seat: o.from, args: { to: o.to, city: o.city, cost: o.cost, flag: o.flag }, default: ["refuse"] });
        break;
      case "consent":
        if (!fx) noFx("consent");
        fx!.ask({ kind: "consent", seat: o.seat, args: { from: o.from, text: o.text, ops: o.ops, cost: o.cost }, default: ["no"] });
        break;
      default: throw new Error(`unknown operation ${JSON.stringify(raw)}`);
    }
  }
  return s;
}
type PDJsonOp = import("@boardcore/pack-sdk").Json;
