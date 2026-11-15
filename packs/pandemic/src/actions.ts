// The base actions, the base roles' abilities and the base events. Each runs with the call's effects context
// (Fx): an action that needs another seat asks it through the interrupt queue (G2), so the asker's prompt names
// only what it can see.
import type { Prompt, SeatId, Step } from "@boardcore/pack-sdk";
import { ADJ, CITIES, CITY_NAMES, MAX_STATIONS } from "./data";
import {
  applyOps, canLeave, cardLabel, cityOf, cur, cure, cureCards, cureCost, discardFrom, doMove, handOf, hasRole, isCity, isEvent, markUsed,
  movePawn, opt, pawnsIn, pick, removeCubes, say, setPl, spendEvent, used, type Fx, type Lib, type Op, type State,
} from "./engine";
import { withItems, zone } from "@boardcore/pack-sdk";

export interface ActionDef {
  id: string;
  cost: number;
  /** null: offered; a string: shown disabled with that reason; "hide": not offered. */
  check(s: State, L: Lib, seat: SeatId): string | null;
  label(s: State, seat: SeatId): string;
  steps(s: State, L: Lib, seat: SeatId, rest: Step[]): Prompt | null;
  apply(s: State, L: Lib, seat: SeatId, rest: Step[], fx: Fx): State;
}

export interface EventDef {
  name: string;
  inEpidemic?: boolean;
  check(s: State, L: Lib, seat: SeatId): string | null;
  steps(s: State, L: Lib, seat: SeatId, rest: Step[]): Prompt | null;
  /** Spends the card itself (or leaves that to a consent it asks for). */
  apply(s: State, L: Lib, seat: SeatId, rest: Step[], fx: Fx): State;
}

const here = (s: State, seat: SeatId) => s.pl[seat]!.city;
const cityCards = (s: State, seat: SeatId) => handOf(s, seat).filter(isCity);

/** Moves for a pawn, paid from `payer`'s hand. */
export function moveOptions(s: State, pawn: SeatId, payer: SeatId, kind: string): Prompt["options"] {
  const from = here(s, pawn);
  if (kind === "drive") return (ADJ[from] ?? []).map((c) => opt(c, `Drive to ${c}`));
  if (kind === "direct") return [...new Set(cityCards(s, payer).map(cityOf))].filter((c) => c !== from).map((c) => opt(c, `Fly to ${c} (discard ${c})`));
  if (kind === "charter") return cityCards(s, payer).includes(`city:${from}`) ? CITY_NAMES.filter((c) => c !== from).map((c) => opt(c, `Charter to ${c} (discard ${from})`)) : [];
  if (kind === "shuttle") return s.stations.includes(from) ? s.stations.filter((c) => c !== from).map((c) => opt(c, `Shuttle to ${c}`)) : [];
  if (kind === "join") return [...new Set(s.players.filter((x) => x !== pawn).map((x) => here(s, x)))].filter((c) => c !== from).map((c) => opt(c, `Join the pawn in ${c}`));
  return [];
}

const moveAction = (kind: "drive" | "direct" | "charter" | "shuttle", word: string): ActionDef => ({
  id: kind, cost: 1,
  check: (s, L, seat) => (moveOptions(s, seat, seat, kind).length ? canLeave(s, L, seat) : "hide"),
  label: () => word,
  steps: (s, _L, seat, rest) => (rest.length ? null : pick(word, moveOptions(s, seat, seat, kind))),
  apply: (s, L, seat, rest, fx) => doMove(s, L, seat, seat, kind, String(rest[0]), fx),
});

const stationSteps = (s: State, rest: Step[]): Prompt | null =>
  s.stations.length >= MAX_STATIONS && rest.length === 0 ? pick("All research stations are out: move one", s.stations.map((c) => opt(`rm:${c}`, `Move the one in ${c}`))) : null;
const putStation = (s: State, city: string, rest: Step[]): State => {
  const rm = rest.find((x) => String(x).startsWith("rm:"));
  const stations = rm ? s.stations.filter((c) => c !== String(rm).slice(3)) : s.stations;
  return say({ ...s, stations: [...stations, city] }, `A research station goes up in ${city}.`);
};

/**
 * Choosing `need` cards out of `eligible`, one at a time in hand order (each set one path); with `mustOne`, at
 * least one chosen card must pass it. null when complete, or when every eligible card is needed.
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
export const pickedCards = (eligible: string[], need: number, chosen: Step[]) => (chosen.length ? chosen.map(String) : eligible.slice(0, need));
export const canPick = (eligible: string[], need: number, mustOne?: (k: string) => boolean) => eligible.length >= need && (!mustOne || eligible.some(mustOne));

/** The asker's Share Knowledge options: its own cards to give, and whom to ask for a card (never their cards). */
function shareOptions(s: State, seat: SeatId): Prompt["options"] {
  const city = here(s, seat);
  const out: Prompt["options"] = [];
  for (const o of pawnsIn(s, city).filter((x) => x !== seat)) {
    for (const k of [...new Set(cityCards(s, seat))]) if (cityOf(k) === city || hasRole(s, seat, "Researcher")) out.push(opt(`give:${o}:${k}`, `Offer ${cityOf(k)} to ${o}`));
    const what = hasRole(s, o, "Researcher") ? "any city card" : `the ${city} card`;
    out.push(opt(`take:${o}`, `Ask ${o} for ${what}`, s.pl[o]!.hand.items.length ? null : `${o} has no cards`));
  }
  return out;
}

const curable = (s: State) => s.diseases.filter((d) => !s.cured.includes(d.id) && (d.standard || d.cure === "any")).map((d) => d.id);

export const BASE_ACTIONS: ActionDef[] = [
  moveAction("drive", "Drive / ferry"),
  moveAction("direct", "Direct flight"),
  moveAction("charter", "Charter flight"),
  moveAction("shuttle", "Shuttle flight"),
  {
    id: "build", cost: 1,
    check: (s, _L, seat) => (s.stations.includes(here(s, seat)) ? "hide" : hasRole(s, seat, "Operations Expert") || cityCards(s, seat).includes(`city:${here(s, seat)}`) ? null : "hide"),
    label: (s, seat) => `Build a research station in ${here(s, seat)}`,
    steps: (s, _L, _seat, rest) => stationSteps(s, rest),
    apply(s, _L, seat, rest) {
      if (!hasRole(s, seat, "Operations Expert")) s = discardFrom(s, seat, `city:${here(s, seat)}`);
      return putStation(s, here(s, seat), rest);
    },
  },
  {
    id: "treat", cost: 1,
    check: (s, _L, seat) => (Object.values(s.cubes[here(s, seat)] ?? {}).some((n) => n > 0) ? null : "hide"),
    label: () => "Treat disease",
    steps: (s, _L, seat, rest) => (rest.length ? null : pick("Treat which disease", Object.entries(s.cubes[here(s, seat)] ?? {}).filter(([, n]) => n > 0).map(([c, n]) => opt(c, `Treat ${c} (${n} here)`)))),
    apply(s, _L, seat, rest) {
      const c = String(rest[0]);
      const all = hasRole(s, seat, "Medic") || s.cured.includes(c);
      s = say(s, `${seat} treats ${c} in ${here(s, seat)}.`);
      s = removeCubes(s, here(s, seat), c, all ? 3 : 1);
      return markUsed(s, seat, `treated:${here(s, seat)}:${c}`);
    },
  },
  {
    // Both players must agree: a give asks the receiver to accept; a take asks the other seat to give one of its
    // matching cards or refuse. The action is paid when the other seat agrees.
    id: "share", cost: 1,
    check: (s, _L, seat) => (shareOptions(s, seat).length ? null : "hide"),
    label: () => "Share knowledge",
    steps: (s, _L, seat, rest) => (rest.length ? null : pick("Share knowledge", shareOptions(s, seat))),
    apply(s, L, seat, rest, fx) {
      const [dir, other, ...card] = String(rest[0]).split(":");
      if (dir === "take") {
        const city = hasRole(s, other!, "Researcher") ? null : here(s, seat);
        return applyOps(say(s, `${seat} asks ${other} for ${city ? `the ${city} card` : "a city card"}.`), L, [{ op: "askCard", from: other!, to: seat, city, cost: 1, flag: null }], fx);
      }
      const k = card.join(":");
      const ops: Op[] = [{ op: "log", text: `${seat} gives ${cityOf(k)} to ${other}.` }, { op: "handLimit", seat: other! }];
      return applyOps(say(s, `${seat} offers ${cityOf(k)} to ${other}.`), L, [{ op: "consent", seat: other!, from: seat, text: `${seat} offers you ${cityOf(k)}`, ops: [{ op: "give", from: seat, to: other!, card: k }, ...ops], cost: 1 }], fx);
    },
  },
  {
    id: "cure", cost: 1,
    check: (s, L, seat) => (s.stations.includes(here(s, seat)) && curable(s).some((c) => { const e = cureCards(s, seat, c); return canPick(e.cards, cureCost(s, L, seat, c), e.mustOne); }) ? null : "hide"),
    label: () => "Discover a cure",
    steps(s, L, seat, rest) {
      if (rest.length === 0) {
        const options = curable(s).map((c) => {
          const need = cureCost(s, L, seat, c);
          const e = cureCards(s, seat, c);
          return opt(c, `Cure ${c} (${need} cards)`, canPick(e.cards, need, e.mustOne) ? null : `you need ${need} cards for ${c}`);
        });
        return options.some((o) => !o.disabled) ? pick("Cure which disease", options) : null;
      }
      const c = String(rest[0]);
      const e = cureCards(s, seat, c);
      return pickCards(e.cards, cureCost(s, L, seat, c), rest.slice(1), "Discard which card", e.mustOne);
    },
    apply(s, L, seat, rest, fx) {
      const c = String(rest[0]);
      return cure(s, L, seat, c, pickedCards(cureCards(s, seat, c).cards, cureCost(s, L, seat, c), rest.slice(1)), 0, fx);
    },
  },
  {
    // Dispatcher: another pawn as if it were his own (its player agreeing), or any pawn to a city with a pawn.
    id: "dispatch", cost: 1,
    check: (s, _L, seat) => (hasRole(s, seat, "Dispatcher") && s.players.length > 1 ? null : "hide"),
    label: () => "Dispatch a pawn",
    steps(s, L, seat, rest) {
      const kindsOf = (pawn: SeatId) => (pawn === seat ? ["join"] : ["drive", "direct", "charter", "shuttle", "join"]);
      if (rest.length === 0)
        return pick("Move whose pawn", s.players.map((x) => opt(x, `${x} (${s.pl[x]!.role}) in ${here(s, x)}`, canLeave(s, L, x) ?? (kindsOf(x).some((k) => moveOptions(s, x, seat, k).length) ? null : "nowhere to go"))));
      const pawn = String(rest[0]);
      if (rest.length === 1) return pick("How", kindsOf(pawn).map((k) => opt(k, k === "join" ? "to a city with another pawn" : k, moveOptions(s, pawn, seat, k).length ? null : "not possible")));
      if (rest.length === 2) return pick("Where", moveOptions(s, pawn, seat, String(rest[1])));
      return null;
    },
    apply(s, L, seat, rest, fx) {
      const [pawn, kind, to] = rest.map(String) as [string, string, string];
      if (pawn === seat) return doMove(s, L, pawn, seat, kind, to, fx);
      return applyOps(s, L, [{ op: "consent", seat: pawn, from: seat, text: `${seat} wants to move your pawn to ${to} (${kind})`, ops: [{ op: "move", pawn, payer: seat, kind, to }], cost: 1 }], fx);
    },
  },
  {
    // Operations Expert: once a turn, from a research station to any city by discarding any city card.
    id: "opsMove", cost: 1,
    check: (s, L, seat) => (hasRole(s, seat, "Operations Expert") && s.stations.includes(here(s, seat)) && !used(s, seat, "opsMove") && cityCards(s, seat).length ? canLeave(s, L, seat) : "hide"),
    label: () => "Fly from the station anywhere (discard any city card)",
    steps(s, _L, seat, rest) {
      if (rest.length === 0) return pick("Discard which card", [...new Set(cityCards(s, seat))].map((k) => opt(k, cityOf(k))));
      if (rest.length === 1) return pick("Fly where", CITY_NAMES.filter((c) => c !== here(s, seat)).map((c) => opt(c, c)));
      return null;
    },
    apply: (s, L, seat, rest, fx) => markUsed(movePawn(say(discardFrom(s, seat, String(rest[0])), `${seat} flies to ${String(rest[1])}.`), L, seat, String(rest[1]), "charter", fx), seat, "opsMove"),
  },
  {
    // Contingency Planner: an event from the discard pile onto the role card (outside the hand limit).
    id: "cpTake", cost: 1,
    check: (s, _L, seat) => (hasRole(s, seat, "Contingency Planner") && !s.pl[seat]!.stored && s.playerDiscard.some(isEvent) ? null : "hide"),
    label: () => "Take an event from the discard pile",
    steps: (s, _L, _seat, rest) => (rest.length ? null : pick("Which event", [...new Set(s.playerDiscard.filter(isEvent))].map((k) => opt(k, cardLabel(k))))),
    apply(s, _L, seat, rest) {
      const k = String(rest[0]);
      const i = s.playerDiscard.indexOf(k);
      return say(setPl({ ...s, playerDiscard: s.playerDiscard.filter((_, j) => j !== i) }, seat, (p) => ({ ...p, stored: k })), `${seat} stores ${cardLabel(k)}.`);
    },
  },
  {
    // A pawn another player's event lets the current player move as his own this turn (paying himself).
    id: "granted", cost: 1,
    check: (s, L, seat) => (s.grant && seat === cur(s) ? canLeave(s, L, s.grant) : "hide"),
    label: (s) => `Move ${s.grant ?? "the pawn"} as your own`,
    steps(s, _L, seat, rest) {
      const pawn = s.grant!;
      if (rest.length === 0) return pick("How", ["drive", "direct", "charter", "shuttle"].map((k) => opt(k, k, moveOptions(s, pawn, seat, k).length ? null : "not possible")));
      if (rest.length === 1) return pick("Where", moveOptions(s, pawn, seat, String(rest[0])));
      return null;
    },
    apply: (s, L, seat, rest, fx) => doMove(s, L, s.grant!, seat, String(rest[0]), String(rest[1]), fx),
  },
];

// ---- Base events -----------------------------------------------------------------------------------------

const anyTime = (s: State) => (s.outcome ? "hide" : null);

export const BASE_EVENTS: EventDef[] = [
  {
    name: "Airlift", check: anyTime,
    steps(s, L, _seat, rest) {
      if (rest.length === 0) return pick("Airlift whose pawn", s.players.map((x) => opt(x, `${x} in ${here(s, x)}`, canLeave(s, L, x))));
      if (rest.length === 1) return pick("To where", CITY_NAMES.filter((c) => c !== here(s, String(rest[0]))).map((c) => opt(c, c)));
      return null;
    },
    apply(s, L, seat, rest, fx) {
      const pawn = String(rest[0]), to = String(rest[1]);
      const ops: Op[] = [{ op: "spendEvent", seat, name: "Airlift" }, { op: "move", pawn, payer: seat, kind: "airlift", to }];
      if (pawn !== seat) return applyOps(s, L, [{ op: "consent", seat: pawn, from: seat, text: `${seat} wants to airlift your pawn to ${to}`, ops, cost: 0 }], fx);
      return applyOps(s, L, ops, fx);
    },
  },
  {
    // The player looks at the top 6 infection cards (a zone only he sees) and then puts them back in an order of
    // his choice, through a question to himself.
    name: "Forecast", check: (s) => (s.outcome || !s.infDeck.items.length || s.forecast ? "hide" : null),
    steps: () => null,
    apply(s, _L, seat, _rest, fx) {
      s = spendEvent(s, seat, "Forecast");
      const top = fx.zones.items(s.infDeck).slice(0, 6);
      if (top.length < 2) return say({ ...s, infKnown: { ...s.infKnown, [seat]: top.length } }, `${seat} looks at the top ${top.length} infection card.`);
      // One pick per place from the top, the last card going under the others (the kit walks picks only).
      fx.ask({ kind: "forecast", seat, default: top.slice(0, -1).map((_, i) => `f:${i}`) });
      return say({ ...s, forecast: zone(top, [seat]), infKnown: { ...s.infKnown, [seat]: top.length } }, `${seat} looks at the top ${top.length} infection cards.`);
    },
  },
  {
    name: "Government Grant", check: anyTime,
    steps(s, _L, _seat, rest) {
      if (rest.length === 0) return pick("Build a research station where", CITY_NAMES.filter((c) => !s.stations.includes(c)).map((c) => opt(c, c)));
      return stationSteps(s, rest.slice(1));
    },
    apply: (s, _L, seat, rest) => putStation(spendEvent(s, seat, "Government Grant"), String(rest[0]), rest.slice(1)),
  },
  {
    name: "One Quiet Night", check: (s) => (s.outcome || s.quiet ? "hide" : null), steps: () => null,
    apply: (s, _L, seat) => say({ ...spendEvent(s, seat, "One Quiet Night"), quiet: true }, "The next infection step is skipped."),
  },
  {
    // City cards only (no special infection card), also between an epidemic's Infect and Intensify steps.
    name: "Resilient Population", inEpidemic: true, check: (s) => (s.outcome || !s.infDiscard.some((c) => CITIES[c]) ? "hide" : null),
    steps: (s, _L, _seat, rest) => (rest.length ? null : pick("Remove which infection card", [...new Set(s.infDiscard.filter((c) => CITIES[c]))].map((c) => opt(c, c)))),
    apply(s, _L, seat, rest) {
      const c = String(rest[0]);
      s = spendEvent(s, seat, "Resilient Population");
      const i = s.infDiscard.indexOf(c);
      return say({ ...s, infDiscard: s.infDiscard.filter((_, j) => j !== i), removed: [...s.removed, `inf:${c}`] }, `${c} is removed from the infection discards.`);
    },
  },
];

/**
 * Forecast's answer: the top cards in the chosen order. The table knows they are the same cards, so the
 * segments that held them become one; the player knows their order.
 */
export function forecastBack(s: State, seat: SeatId, order: string[], fx: Fx): State {
  const cards = fx.zones.items(s.forecast!);
  const picked = order.map((id) => Number(id.slice(2)));
  const back = [...picked, ...cards.map((_, i) => i).filter((i) => !picked.includes(i))].map((i) => cards[i]!);
  const deck = fx.zones.items(s.infDeck);
  let left = back.length;
  const rest: number[] = [];
  for (const g of s.infSegs) { const d = Math.min(g, left); left -= d; if (g - d > 0) rest.push(g - d); }
  return say({ ...s, forecast: null, infDeck: withItems(s.infDeck, [...back, ...deck.slice(back.length)]), infSegs: [back.length, ...rest], infKnown: { [seat]: back.length } }, "The top of the infection deck is rearranged.");
}
