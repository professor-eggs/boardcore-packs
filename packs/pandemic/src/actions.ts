// Base actions, the base roles' abilities, the base events, and the turn loop that runs them.
import type { Action, Prompt, Rng, SeatId, Step } from "@boardcore/pack-sdk";
import { ADJ, CITIES, CITY_NAMES, MAX_STATIONS } from "./data";
import {
  beginDraw, beginInfect, cardLabel, checkHands, checkWin, cityOf, cur, cure, cureCost, discardFrom, finishEpidemic, hasRole, infectOne, isCity,
  isEpidemicCard, isEvent, movePawn, canLeave, opt, pawnsIn, removeCubes, say, setPl, startEpidemic, touch,
  type ActionDef, type Ctx, type EventDef, type InterruptDef, type State,
} from "./engine";

const cityCards = (s: State, seat: SeatId) => s.pl[seat]!.hand.filter(isCity);
const here = (s: State, seat: SeatId) => s.pl[seat]!.city;
const pick = (label: string, options: Prompt["options"]): Prompt | null => (options.length ? { kind: "pick", label, options } : null);
const used = (s: State, seat: SeatId, flag: string) => s.pl[seat]!.used.includes(flag);
export const markUsed = (s: State, seat: SeatId, flag: string) => setPl(s, seat, (p) => ({ ...p, used: [...p.used, flag] }));

/** Moves for a pawn, paid from `payer`'s hand (the Dispatcher pays for others). */
export function moveOptions(s: State, pawn: SeatId, payer: SeatId, kind: string): Prompt["options"] {
  const from = here(s, pawn);
  if (kind === "drive") return (ADJ[from] ?? []).map((c) => opt(c, `Drive to ${c}`));
  if (kind === "direct") return cityCards(s, payer).map(cityOf).filter((c) => c !== from).map((c) => opt(c, `Fly to ${c} (discard ${c})`));
  if (kind === "charter") return cityCards(s, payer).includes(`city:${from}`) ? CITY_NAMES.filter((c) => c !== from).map((c) => opt(c, `Charter to ${c} (discard ${from})`)) : [];
  if (kind === "shuttle") return s.stations.includes(from) ? s.stations.filter((c) => c !== from).map((c) => opt(c, `Shuttle to ${c}`)) : [];
  if (kind === "join") return [...new Set(s.players.filter((x) => x !== pawn).map((x) => here(s, x)))].filter((c) => c !== from).map((c) => opt(c, `Join the pawn in ${c}`));
  return [];
}

export function doMove(s: State, pawn: SeatId, payer: SeatId, kind: string, to: string, ctx: Ctx): State {
  const from = here(s, pawn);
  const pay = (card: string) => (ctx.hooks.chain<boolean>("payCard", true, s, payer, card, kind) ? discardFrom(s, payer, card) : say(s, `${payer} shows ${cityOf(card)}.`));
  if (kind === "direct") s = pay(`city:${to}`);
  if (kind === "charter") s = pay(`city:${from}`);
  s = say(s, `${pawn} ${kind === "drive" ? "drives" : kind === "shuttle" ? "shuttles" : kind === "join" ? "is dispatched" : "flies"} from ${from} to ${to}.`);
  return movePawn(s, pawn, to, ctx, kind);
}

const moveAction = (kind: "drive" | "direct" | "charter" | "shuttle", word: string): ActionDef => ({
  id: kind, cost: 1,
  check: (s, seat, ctx) => (moveOptions(s, seat, seat, kind).length ? canLeave(s, seat, ctx) : "hide"),
  label: () => word,
  steps: (s, seat, rest) => (rest.length ? null : pick(word, moveOptions(s, seat, seat, kind))),
  apply: (s, seat, rest, ctx) => doMove(s, seat, seat, kind, String(rest[0]), ctx),
});

/** Station placement, removing one when all six are out. */
const stationSteps = (s: State, rest: Step[], _city: string): Prompt | null =>
  s.stations.length >= MAX_STATIONS && rest.length === 0 ? pick("All research stations are out: move one", s.stations.map((c) => opt(`rm:${c}`, `Move the one in ${c}`))) : null;
export const putStation = (s: State, city: string, rest: Step[]): State => {
  const rm = rest.find((x) => String(x).startsWith("rm:"));
  const stations = rm ? s.stations.filter((c) => c !== String(rm).slice(3)) : s.stations;
  return say({ ...s, stations: [...stations, city] }, `A research station goes up in ${city}.`);
};

/**
 * Choosing `need` cards out of `eligible`, one at a time in hand order (so each set is one path). With
 * `mustOne`, at least one chosen card must pass it. Returns null when the choice is complete, or when every
 * eligible card is needed (no choice to make).
 */
export function pickCards(eligible: string[], need: number, chosen: Step[], label: string, mustOne?: (k: string) => boolean): Prompt | null {
  if (chosen.length >= need || (chosen.length === 0 && eligible.length === need)) return null;
  const last = chosen.length ? eligible.indexOf(String(chosen[chosen.length - 1])) : -1;
  const has = !mustOne || chosen.some((k) => mustOne(String(k)));
  const after = need - chosen.length - 1;
  const ok = eligible.flatMap((k, i) => {
    if (i <= last) return [];
    const later = eligible.slice(i + 1);
    if (later.length < after) return [];
    if (!has && !mustOne!(k) && !(after > 0 && later.some(mustOne!))) return [];
    return [opt(k, cardLabel(k))];
  });
  return pick(`${label} (${chosen.length + 1} of ${need})`, ok);
}

/** The cards picked by pickCards (all eligible ones when there was no choice). */
export const pickedCards = (eligible: string[], need: number, chosen: Step[]) => (chosen.length ? chosen.map(String) : eligible.slice(0, need));

/** Whether `need` cards can be chosen with at least one passing `mustOne`. */
export const canPick = (eligible: string[], need: number, mustOne?: (k: string) => boolean) => eligible.length >= need && (!mustOne || eligible.some(mustOne));

const cureCards = (s: State, seat: SeatId, c: string) => cityCards(s, seat).filter((k) => CITIES[cityOf(k)] === c);

export function shareOptions(s: State, seat: SeatId): Prompt["options"] {
  const city = here(s, seat);
  const out: Prompt["options"] = [];
  for (const o of pawnsIn(s, city).filter((x) => x !== seat)) {
    for (const k of cityCards(s, seat)) if (cityOf(k) === city || hasRole(s, seat, "Researcher")) out.push(opt(`give:${o}:${k}`, `Give ${cityOf(k)} to ${o}`));
    for (const k of cityCards(s, o)) if (cityOf(k) === city || hasRole(s, o, "Researcher")) out.push(opt(`take:${o}:${k}`, `Take ${cityOf(k)} from ${o}`));
  }
  return out;
}

export const BASE_ACTIONS: ActionDef[] = [
  moveAction("drive", "Drive / ferry"),
  moveAction("direct", "Direct flight"),
  moveAction("charter", "Charter flight"),
  moveAction("shuttle", "Shuttle flight"),
  {
    id: "build", cost: 1,
    check: (s, seat) => s.stations.includes(here(s, seat)) ? "hide" : hasRole(s, seat, "Operations Expert") || cityCards(s, seat).includes(`city:${here(s, seat)}`) ? null : "hide",
    label: (s, seat) => `Build a research station in ${here(s, seat)}`,
    steps: (s, seat, rest) => stationSteps(s, rest, here(s, seat)),
    apply(s, seat, rest) {
      if (!hasRole(s, seat, "Operations Expert")) s = discardFrom(s, seat, `city:${here(s, seat)}`);
      return putStation(s, here(s, seat), rest);
    },
  },
  {
    id: "treat", cost: 1,
    check: (s, seat) => (Object.entries(s.cubes[here(s, seat)] ?? {}).some(([, n]) => n > 0) ? null : "hide"),
    label: () => "Treat disease",
    steps: (s, seat, rest) => (rest.length ? null : pick("Treat which disease", Object.entries(s.cubes[here(s, seat)] ?? {}).filter(([, n]) => n > 0).map(([c, n]) => opt(c, `Treat ${c} (${n} here)`)))),
    apply(s, seat, rest) {
      const c = String(rest[0]);
      const all = hasRole(s, seat, "Medic") || s.cured.includes(c);
      s = say(s, `${seat} treats ${c} in ${here(s, seat)}.`);
      s = removeCubes(s, here(s, seat), c, all ? 3 : 1);
      return markTreated(s, seat, c);
    },
  },
  {
    id: "share", cost: 1,
    check: (s, seat) => (shareOptions(s, seat).length ? null : "hide"),
    label: () => "Share knowledge",
    steps: (s, seat, rest) => (rest.length ? null : pick("Share knowledge", shareOptions(s, seat))),
    apply(s, seat, rest, ctx) {
      const [dir, other, ...card] = String(rest[0]).split(":");
      const k = card.join(":");
      const [from, to] = dir === "give" ? [seat, other!] : [other!, seat];
      s = setPl(setPl(s, from, (p) => ({ ...p, hand: p.hand.filter((x) => x !== k) })), to, (p) => ({ ...p, hand: [...p.hand, k] }));
      return checkHands(say(s, `${from} gives ${cityOf(k)} to ${to}.`), ctx);
    },
  },
  {
    id: "cure", cost: 1,
    check: (s, seat, ctx) => (s.stations.includes(here(s, seat)) && ["blue", "yellow", "black", "red"].some((c) => !s.cured.includes(c) && canPick(cureCards(s, seat, c), cureCost(s, seat, c, ctx))) ? null : "hide"),
    label: () => "Discover a cure",
    steps(s, seat, rest, ctx) {
      if (rest.length === 0) {
        const options = ["blue", "yellow", "black", "red"].filter((c) => !s.cured.includes(c)).map((c) => {
          const need = cureCost(s, seat, c, ctx);
          return opt(c, `Cure ${c} (${need} cards)`, canPick(cureCards(s, seat, c), need) ? null : `you need ${need} ${c} cards`);
        });
        return options.some((o) => !o.disabled) ? pick("Cure which disease", options) : null;
      }
      const c = String(rest[0]);
      return pickCards(cureCards(s, seat, c), cureCost(s, seat, c, ctx), rest.slice(1), "Discard which card");
    },
    apply(s, seat, rest, ctx) {
      const c = String(rest[0]);
      return cure(s, seat, c, pickedCards(cureCards(s, seat, c), cureCost(s, seat, c, ctx), rest.slice(1)), ctx);
    },
  },
  // Dispatcher: move another pawn as if it were his own, or to a city with another pawn.
  {
    id: "dispatch", cost: 1,
    check: (s, seat) => (hasRole(s, seat, "Dispatcher") && s.players.length > 1 ? null : "hide"),
    label: () => "Dispatch a pawn",
    steps(s, seat, rest, ctx) {
      // Any pawn (his own too) to a city with another pawn; another player's pawn as if it were his own.
      const kindsOf = (pawn: SeatId) => (pawn === seat ? ["join"] : ["drive", "direct", "charter", "shuttle", "join"]);
      if (rest.length === 0) {
        return pick("Move whose pawn", s.players.map((x) => opt(x, `${x} (${s.pl[x]!.role}) in ${here(s, x)}`,
          canLeave(s, x, ctx) ?? (kindsOf(x).some((k) => moveOptions(s, x, seat, k).length) ? null : "nowhere to go"))));
      }
      const pawn = String(rest[0]);
      const kinds = kindsOf(pawn);
      if (rest.length === 1) return pick("How", kinds.map((k) => opt(k, k === "join" ? "to a city with another pawn" : k, moveOptions(s, pawn, seat, k).length ? null : "not possible")));
      if (rest.length === 2) return pick("Where", moveOptions(s, pawn, seat, String(rest[1])));
      return null;
    },
    apply: (s, seat, rest, ctx) => doMove(s, String(rest[0]), seat, String(rest[1]), String(rest[2]), ctx),
  },
  // Operations Expert: once a turn, from a research station to any city by discarding any city card.
  {
    id: "opsMove", cost: 1,
    check: (s, seat, ctx) => (hasRole(s, seat, "Operations Expert") && s.stations.includes(here(s, seat)) && !used(s, seat, "opsMove") && cityCards(s, seat).length ? canLeave(s, seat, ctx) : "hide"),
    label: () => "Fly from the station anywhere (discard any city card)",
    steps(s, seat, rest) {
      if (rest.length === 0) return pick("Discard which card", cityCards(s, seat).map((k) => opt(k, cityOf(k))));
      if (rest.length === 1) return pick("Fly where", CITY_NAMES.filter((c) => c !== here(s, seat)).map((c) => opt(c, c)));
      return null;
    },
    apply: (s, seat, rest, ctx) => markUsed(movePawn(say(discardFrom(s, seat, String(rest[0])), `${seat} flies to ${String(rest[1])}.`), seat, String(rest[1]), ctx, "charter"), seat, "opsMove"),
  },
  // Contingency Planner: take an event from the discard pile onto the role card.
  {
    id: "cpTake", cost: 1,
    check: (s, seat) => (hasRole(s, seat, "Contingency Planner") && !s.pl[seat]!.stored && s.playerDiscard.some(isEvent) ? null : "hide"),
    // The stored card sits on the role card (outside the hand limit) and leaves the game once played.
    label: () => "Take an event from the discard pile",
    steps: (s, seat, rest) => (rest.length ? null : pick("Which event", [...new Set(s.playerDiscard.filter(isEvent))].map((k) => opt(k, cardLabel(k))))),
    apply(s, seat, rest) {
      const k = String(rest[0]);
      const i = s.playerDiscard.indexOf(k);
      return say(setPl({ ...s, playerDiscard: s.playerDiscard.filter((_, j) => j !== i) }, seat, (p) => ({ ...p, stored: k })), `${seat} stores ${cardLabel(k)}.`);
    },
  },
];

/** Records a treated cube for "leave only after treating" rules (Government Interference). */
export const markTreated = (s: State, seat: SeatId, c: string) => markUsed(s, seat, `treated:${here(s, seat)}:${c}`);

// ---- Base events ------------------------------------------------------------------------------------------

const anyTime = (s: State) => (s.outcome ? "hide" : null);

export const BASE_EVENTS: EventDef[] = [
  {
    name: "Airlift", check: anyTime,
    steps(s, _seat, rest, ctx) {
      if (rest.length === 0) return pick("Airlift whose pawn", s.players.map((x) => opt(x, `${x} in ${here(s, x)}`, canLeave(s, x, ctx))));
      if (rest.length === 1) return pick("To where", CITY_NAMES.filter((c) => c !== here(s, String(rest[0]))).map((c) => opt(c, c)));
      return null;
    },
    apply: (s, _seat, rest, ctx) => movePawn(say(s, `${String(rest[0])} is airlifted to ${String(rest[1])}.`), String(rest[0]), String(rest[1]), ctx, "event"),
  },
  {
    name: "Forecast", check: (s) => (s.outcome || !s.infDeck.length ? "hide" : null),
    steps(s, _seat, rest) {
      const top = s.infDeck.slice(0, 6);
      if (rest.length >= top.length) return null;
      return pick(`Forecast: choose card ${rest.length + 1} from the top`, top.filter((c) => !rest.includes(c)).map((c) => opt(c, c)));
    },
    apply(s, _seat, rest) {
      const order = rest.map(String);
      return touch(say({ ...s, infDeck: [...order, ...s.infDeck.slice(order.length)] }, "The top of the infection deck is rearranged."));
    },
  },
  {
    name: "Government Grant", check: anyTime,
    steps(s, _seat, rest) {
      if (rest.length === 0) return pick("Build a research station where", CITY_NAMES.filter((c) => !s.stations.includes(c)).map((c) => opt(c, c)));
      return stationSteps(s, rest.slice(1), String(rest[0]));
    },
    apply: (s, _seat, rest) => putStation(s, String(rest[0]), rest.slice(1)),
  },
  { name: "One Quiet Night", check: (s) => (s.outcome || s.quiet ? "hide" : null), steps: () => null, apply: (s) => say({ ...s, quiet: true }, "The next infection step is skipped.") },
  {
    // City cards only: a Mutation card can't be removed.
    name: "Resilient Population", inEpidemic: true, check: (s) => (s.outcome || !s.infDiscard.some((c) => CITIES[c]) ? "hide" : null),
    steps: (s, _seat, rest) => (rest.length ? null : pick("Remove which infection card", [...new Set(s.infDiscard.filter((c) => CITIES[c]))].map((c) => opt(c, c)))),
    apply(s, _seat, rest) {
      const c = String(rest[0]);
      const i = s.infDiscard.indexOf(c);
      return say({ ...s, infDiscard: s.infDiscard.filter((_, j) => j !== i), removed: [...s.removed, `inf:${c}`] }, `${c} is removed from the infection discards.`);
    },
  },
];

// ---- Base interrupts --------------------------------------------------------------------------------------

export const discardInterrupt: InterruptDef = {
  prompt(s, seat, partial, _data, ctx) {
    const hand = s.pl[seat]!.hand;
    if (partial.length === 0) {
      return pick(`Too many cards (limit ${ctx.hooks.chain<number>("handLimit", 7, s, seat)}): discard one or play an event`,
        [...hand.map((k) => opt(`d:${k}`, `Discard ${cardLabel(k)}`)), ...eventOptions(s, seat, ctx)]);
    }
    return String(partial[0]).startsWith("ev:") ? eventSteps(s, seat, partial, ctx) : null;
  },
  apply(s, seat, action, _data, ctx, rng) {
    const id = String(action[0]);
    s = id.startsWith("ev:") ? playEvent(s, seat, action, ctx, rng) : say(discardFrom(s, seat, id.slice(2)), `${seat} discards ${cardLabel(id.slice(2))}.`);
    return checkHands(s, ctx);
  },
  auto: (s) => s,
};

/** Two special cards drawn together whose order the player picks (two Mutation events). */
export const drawOrderInterrupt: InterruptDef = {
  prompt: (s, _seat, partial, data) => (partial.length ? null : pick("Resolve which card first", (data as string[]).map((k) => opt(k, k.replace(/^[a-z]+:/, ""))))),
  apply(s, _seat, action, data) {
    const first = String(action[0]);
    return { ...s, drawn: [first, ...(data as string[]).filter((k) => k !== first)] };
  },
  auto: (s) => s,
};

// ---- Events through the loop ------------------------------------------------------------------------------

export function eventOptions(s: State, seat: SeatId, ctx: Ctx): Prompt["options"] {
  if (!s.players.includes(seat)) return [];
  const p = s.pl[seat]!;
  const names = [...new Set([...p.hand.filter(isEvent), ...(p.stored ? [p.stored] : [])].map((k) => k.slice(6)))];
  return names.flatMap((n) => {
    const def = ctx.events[n];
    if (!def) return [];
    // Between an epidemic's Infect and Intensify steps only Resilient Population may be played.
    if (s.phase === "epidemic" && !def.inEpidemic) return [];
    const why = def.check(s, seat, ctx);
    if (why === "hide") return [];
    return [opt(`ev:${n}`, `Play ${n}`, why)];
  });
}

export function eventSteps(s: State, seat: SeatId, partial: Step[], ctx: Ctx): Prompt | null {
  const def = ctx.events[String(partial[0]).slice(3)];
  return def ? def.steps(s, seat, partial.slice(1), ctx) : null;
}

export function playEvent(s: State, seat: SeatId, action: Action, ctx: Ctx, rng: Rng): State {
  const name = String(action[0]).slice(3);
  const card = `event:${name}`;
  const p = s.pl[seat]!;
  s = p.hand.includes(card) ? discardFrom(s, seat, card) : { ...setPl(s, seat, (x) => ({ ...x, stored: null })), removed: [...s.removed, card] };
  s = say(s, `${seat} plays ${name}.`);
  return ctx.events[name]!.apply(s, seat, action.slice(1), ctx, rng);
}

/** Seats holding an event they may play now (they can act out of turn). */
export const eventHolders = (s: State, ctx: Ctx) => s.players.filter((x) => eventOptions(s, x, ctx).some((o) => !o.disabled));

export function actionOptions(s: State, seat: SeatId, ctx: Ctx): Prompt["options"] {
  const out: Prompt["options"] = [];
  for (const a of ctx.actions) {
    const why = a.check(s, seat, ctx);
    if (why === "hide") continue;
    const need = a.cost > s.actionsLeft ? "no actions left" : null;
    out.push(opt(a.id, a.label(s, seat), why ?? need));
  }
  return out;
}

// ---- The loop ---------------------------------------------------------------------------------------------

const WINDOWS = ["actions", "infect", "epidemic", "drawWindow"];

export function actors(s: State, ctx: Ctx): SeatId[] {
  if (s.outcome) return [];
  if (s.pending.length) return [s.pending[0]!.seat];
  const extra = ctx.hooks.collect<SeatId>("actors", s);
  if (WINDOWS.includes(s.phase)) return [...new Set([cur(s), ...eventHolders(s, ctx), ...extra])];
  const ph = ctx.phases[s.phase];
  return ph ? [...new Set([...ph.actors(s, ctx), ...extra])] : [];
}

const WINDOW_TEXT: { [phase: string]: [string, string, string] } = {
  infect: ["infect", "Infect cities", "Before the infection step"],
  epidemic: ["continue", "Continue the epidemic (intensify)", "Epidemic: before the infection discards are shuffled back"],
  drawWindow: ["continue", "Resolve the next drawn card", "Between the drawn cards"],
};

export function prompt(s: State, seat: SeatId, partial: Step[], ctx: Ctx): Prompt | null {
  if (!actors(s, ctx).includes(seat)) return null;
  if (s.pending.length) {
    const it = s.pending[0]!;
    return ctx.interrupts[it.kind]!.prompt(s, seat, partial, it.data, ctx);
  }
  if (partial.length && String(partial[0]).startsWith("ev:")) return eventSteps(s, seat, partial, ctx);
  const evs = eventOptions(s, seat, ctx);
  const isCur = seat === cur(s);
  if (s.phase === "actions") {
    if (partial.length === 0) {
      const own = isCur ? [...actionOptions(s, seat, ctx), opt("end", s.actionsLeft ? `End your actions (${s.actionsLeft} left)` : "End your actions")] : [];
      return pick(isCur ? `${s.actionsLeft} action${s.actionsLeft === 1 ? "" : "s"} left` : "Play an event", [...own, ...evs]);
    }
    if (!isCur || partial[0] === "end") return null;
    const a = ctx.actions.find((x) => x.id === partial[0]);
    return a ? a.steps(s, seat, partial.slice(1), ctx) : null;
  }
  const w = WINDOW_TEXT[s.phase];
  if (w) {
    if (partial.length) return null;
    const label = s.phase === "infect" && s.inf ? `Draw the next infection card (${s.inf.left} left)` : w[1];
    const go = isCur ? [opt(w[0], label)] : [];
    return pick(s.phase === "infect" && s.inf ? "During the infection step" : w[2], [...go, ...evs]);
  }
  const ph = ctx.phases[s.phase];
  return ph ? ph.prompt(s, seat, partial, ctx) : null;
}

const validPath = (s: State, seat: SeatId, path: Action, ctx: Ctx) => {
  for (let i = 0; i <= path.length; i++) {
    const p = prompt(s, seat, path.slice(0, i), ctx);
    if (i === path.length) return p === null && i > 0;
    if (!p || typeof path[i] !== "string") return false;
    const o = p.options.find((x) => x.id === path[i]);
    if (!o || o.disabled) return false;
  }
  return false;
};

/** Someone holds an event whose moment would pass if the turn moved on (Rapid Vaccine Deployment). */
const held = (s: State, ctx: Ctx) => s.players.some((x) => eventOptions(s, x, ctx).some((o) => !o.disabled && ctx.events[o.id.slice(3)]?.holdsTurn?.(s)));

export function act(s: State, seat: SeatId, action: Action, ctx: Ctx, rng: Rng): State {
  if (!validPath(s, seat, action, ctx)) throw new Error(`not a legal action for ${seat}: ${JSON.stringify(action)}`);
  s = { ...s, ply: s.ply + 1, log: [], logPly: s.ply + 1 };
  const id = String(action[0]);
  if (s.pending.length) {
    const it = s.pending[0]!;
    s = { ...s, pending: s.pending.slice(1) };
    s = ctx.interrupts[it.kind]!.apply(s, seat, action, it.data, ctx, rng);
  } else if (id.startsWith("ev:")) s = playEvent(s, seat, action, ctx, rng);
  else if (s.phase === "actions") {
    if (id === "end") s = beginDraw({ ...s, actionsLeft: 0 }, ctx);
    else {
      const a = ctx.actions.find((x) => x.id === id)!;
      s = a.apply({ ...s, actionsLeft: s.actionsLeft - a.cost }, seat, action.slice(1), ctx, rng);
    }
  } else if (s.phase === "epidemic") {
    s = finishEpidemic(s, s.epidemicCard ?? "epidemic", ctx, rng);
    if (s.drawn.length && eventHolders(s, ctx).length) s = { ...s, phase: "drawWindow" };
  }
  else if (s.phase === "drawWindow") s = { ...s, phase: "draw" };
  else if (s.phase === "infect") s = infectOne(s, ctx, rng);
  else s = ctx.phases[s.phase]!.apply(s, seat, action, ctx, rng);
  return settle(s, ctx, rng);
}

/** Resolves the drawn special cards in order, opening a window between them for anyone holding an event. */
function drawNext(s: State, ctx: Ctx, rng: Rng): State {
  while (s.drawn.length && !s.outcome) {
    const card = s.drawn[0]!;
    s = { ...s, drawn: s.drawn.slice(1) };
    if (isEpidemicCard(s, card, ctx)) {
      s = startEpidemic(s, card, ctx, rng);
      if (s.phase === "epidemic") return s;
    } else s = ctx.hooks.first<State | null>("drawCard", null, s, card, rng) ?? say(s, `${card} has no effect.`);
    if (s.outcome) return s;
    if (s.drawn.length && eventHolders(s, ctx).length) return { ...s, phase: "drawWindow" };
  }
  if (s.outcome) return s;
  return beginInfect(checkHands(s, ctx));
}

/** Runs what needs no choice: wins, automatic interrupts, drawn cards, an infection step no one can interrupt. */
export function settle(s: State, ctx: Ctx, rng: Rng): State {
  for (let guard = 0; guard < 500; guard++) {
    s = checkWin(s, ctx);
    const out = ctx.hooks.first<State | null>("outcome", null, s);
    if (out) s = out;
    if (s.outcome) return { ...s, phase: "over", pending: [] };
    if (s.pending.length) {
      const it = s.pending[0]!;
      const def = ctx.interrupts[it.kind]!;
      if (def.prompt(s, it.seat, [], it.data, ctx)) return s;
      s = def.auto({ ...s, pending: s.pending.slice(1) }, it.seat, it.data, ctx, rng);
      continue;
    }
    // Out of actions: on to the Draw step, unless an event's moment is still open (Rapid Vaccine Deployment).
    if (s.phase === "actions" && s.actionsLeft <= 0 && !held(s, ctx)) { s = beginDraw(s, ctx); continue; }
    if (s.phase === "draw") { s = drawNext(s, ctx, rng); continue; }
    // No one can play an event now: the infection step goes on by itself.
    if (s.phase === "infect" && !eventHolders(s, ctx).length) { s = infectOne(s, ctx, rng); continue; }
    return s;
  }
  throw new Error("the turn loop did not settle");
}
