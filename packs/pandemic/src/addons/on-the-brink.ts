// Pandemic: On the Brink — six roles, eight events, the 5th player, 2 events per player, the legendary game.
// (Virulent Strain, Mutation and the Bio-Terrorist are separate add-ons. The Petri dishes hold the cube
// supplies: the limits are in data.ts.)
import type { SeatId, Step } from "@boardcore/pack-sdk";
import { ADJ, CITIES, CITY_NAMES, OTB_EVENTS, OTB_ROLES, RATES } from "../data";
import { canPick, doMove, markTreated, markUsed, moveOptions, pickCards, pickedCards } from "../actions";
import {
  checkEradicated, checkHands, cityOf, cubesIn, cur, cure, cureCost, hasRole, isCity, opt, removeCubes, say, setPl, touch, canLeave,
  type ActionDef, type Ctx, type EventDef, type InterruptDef, type State,
} from "../engine";
import { canPurple, pickPurple, purpleCards } from "../purple";
import type { PandemicAddOn } from "../addon";

interface Ext {
  samples: { [seat: string]: { [c: string]: number } };
  peek: { [seat: string]: string[] };
  /** Commercial Travel Ban: in front of this player until his next turn begins. */
  ctb: SeatId | null;
  /** Mobile Hospital is on for this turn. */
  mobile: boolean;
  /** Special Orders: the current player may move this pawn this turn. */
  orders: SeatId | null;
  justCured: { color: string; ply: number } | null;
}
const E0: Ext = { samples: {}, peek: {}, ctb: null, mobile: false, orders: null, justCured: null };
const ext = (s: State): Ext => ({ ...E0, ...(s.ext.onTheBrink as unknown as Ext | undefined) });
const withExt = (s: State, e: Partial<Ext>): State => ({ ...s, ext: { ...s.ext, onTheBrink: { ...ext(s), ...e } as unknown as State["ext"][string] } });
const pick = (label: string, options: { id: string; label: string; disabled?: string }[]) => (options.length ? { kind: "pick" as const, label, options } : null);
const here = (s: State, seat: SeatId) => s.pl[seat]!.city;
const used = (s: State, seat: SeatId, f: string) => s.pl[seat]!.used.includes(f);
const samples = (s: State, seat: SeatId) => ext(s).samples[seat] ?? {};
const cubesHere = (s: State, city: string) => Object.entries(s.cubes[city] ?? {}).filter(([, n]) => n > 0);
const purpleOn = (s: State) => s.addons.includes("mutation") || s.addons.includes("bioterrorist");

const sameColour = (s: State, seat: SeatId, c: string) => s.pl[seat]!.hand.filter((k) => isCity(k) && CITIES[cityOf(k)] === c);
/** Field Operative: cards still needed when 3 samples stand in for 2 of them. */
const foNeed = (s: State, seat: SeatId, c: string, ctx: Ctx) => cureCost(s, seat, c, ctx) - 2;
const foCan = (s: State, seat: SeatId, c: string, ctx: Ctx) =>
  !s.cured.includes(c) && (samples(s, seat)[c] ?? 0) >= 3 && (c === "purple" ? purpleOn(s) && canPurple(s, seat, foNeed(s, seat, c, ctx)) : canPick(sameColour(s, seat, c), foNeed(s, seat, c, ctx)));

const ACTIONS: ActionDef[] = [
  {
    id: "archive", cost: 1,
    check: (s, seat) => (hasRole(s, seat, "Archivist") && !used(s, seat, "archive") && s.playerDiscard.includes(`city:${here(s, seat)}`) ? null : "hide"),
    label: (s, seat) => `Take ${here(s, seat)} back from the discard pile`,
    steps: () => null,
    apply(s, seat, _rest, ctx) {
      const k = `city:${here(s, seat)}`;
      const i = s.playerDiscard.indexOf(k);
      s = setPl({ ...s, playerDiscard: s.playerDiscard.filter((_, j) => j !== i) }, seat, (p) => ({ ...p, hand: [...p.hand, k] }));
      return checkHands(markUsed(say(s, `${seat} takes ${cityOf(k)} from the discard pile.`), seat, "archive"), ctx);
    },
  },
  {
    id: "epidemiologist", cost: 0,
    check: (s, seat) => (hasRole(s, seat, "Epidemiologist") && !used(s, seat, "epi") && takeable(s, seat).length ? null : "hide"),
    label: () => "Take a city card from a player here (with permission; free, once a turn)",
    steps: (s, seat, rest) => (rest.length ? null : pick("Take which card", takeable(s, seat))),
    apply(s, seat, rest, _ctx) {
      const [from, ...k] = String(rest[0]).split(":");
      const card = k.join(":");
      s = setPl(setPl(s, from!, (p) => ({ ...p, hand: p.hand.filter((x) => x !== card) })), seat, (p) => ({ ...p, hand: [...p.hand, card] }));
      return checkHands(markUsed(say(s, `${seat} takes ${cityOf(card)} from ${from}.`), seat, "epi"), _ctx);
    },
  },
  {
    id: "sample", cost: 1,
    check: (s, seat) => (hasRole(s, seat, "Field Operative") && !used(s, seat, "sample") && cubesHere(s, here(s, seat)).length ? null : "hide"),
    label: () => "Move a cube here onto your role card as a sample",
    steps: (s, seat, rest) => (rest.length ? null : pick("Sample which disease", cubesHere(s, here(s, seat)).map(([c]) => opt(c, c)))),
    apply(s, seat, rest) {
      const c = String(rest[0]);
      const city = here(s, seat);
      // The cube leaves the board but not for the supply: it sits on the role card.
      s = { ...s, cubes: { ...s.cubes, [city]: { ...s.cubes[city]!, [c]: cubesIn(s, city, c) - 1 } } };
      const mine = samples(s, seat);
      s = withExt(s, { samples: { ...ext(s).samples, [seat]: { ...mine, [c]: (mine[c] ?? 0) + 1 } } });
      return checkEradicated(markUsed(say(s, `${seat} takes a ${c} sample in ${city}.`), seat, "sample"), c);
    },
  },
  {
    id: "returnSamples", cost: 0,
    check: (s, seat) => (hasRole(s, seat, "Field Operative") && Object.values(samples(s, seat)).some((n) => n > 0) ? null : "hide"),
    label: () => "Return samples to the supply (free)",
    steps: (s, seat, rest) => (rest.length ? null : pick("Return which colour", Object.entries(samples(s, seat)).filter(([, n]) => n > 0).map(([c, n]) => opt(c, `${c} (${n})`)))),
    apply(s, seat, rest) {
      const c = String(rest[0]);
      const n = samples(s, seat)[c] ?? 0;
      s = withExt({ ...s, supply: { ...s.supply, [c]: (s.supply[c] ?? 0) + n } }, { samples: { ...ext(s).samples, [seat]: { ...samples(s, seat), [c]: 0 } } });
      return say(s, `${seat} returns ${n} ${c} samples.`);
    },
  },
  {
    id: "foCure", cost: 1,
    check: (s, seat, ctx) => (hasRole(s, seat, "Field Operative") && s.stations.includes(here(s, seat)) && Object.keys(samples(s, seat)).some((c) => foCan(s, seat, c, ctx)) ? null : "hide"),
    label: () => "Discover a cure with 3 samples in place of 2 cards",
    steps(s, seat, rest, ctx) {
      if (rest.length === 0) {
        const opts = Object.keys(samples(s, seat)).filter((c) => (samples(s, seat)[c] ?? 0) >= 3 && !s.cured.includes(c))
          .map((c) => opt(c, `Cure ${c} (${foNeed(s, seat, c, ctx)} cards and 3 samples)`, foCan(s, seat, c, ctx) ? null : "not enough cards"));
        return opts.some((o) => !o.disabled) ? pick("Cure which disease", opts) : null;
      }
      const c = String(rest[0]);
      return c === "purple" ? pickPurple(s, seat, foNeed(s, seat, c, ctx), rest.slice(1)) : pickCards(sameColour(s, seat, c), foNeed(s, seat, c, ctx), rest.slice(1), "Discard which card");
    },
    apply(s, seat, rest, ctx) {
      const c = String(rest[0]);
      const need = foNeed(s, seat, c, ctx);
      const cards = pickedCards(c === "purple" ? purpleCards(s, seat) : sameColour(s, seat, c), need, rest.slice(1));
      const mine = samples(s, seat);
      s = withExt({ ...s, supply: { ...s.supply, [c]: s.supply[c]! + 3 } }, { samples: { ...ext(s).samples, [seat]: { ...mine, [c]: mine[c]! - 3 } } });
      return cure(s, seat, c, cards, ctx);
    },
  },
  {
    id: "orders", cost: 1,
    check: (s, seat, ctx) => { const pawn = ext(s).orders; return pawn && seat === cur(s) ? canLeave(s, pawn, ctx) : "hide"; },
    label: (s) => `Special Orders: move ${ext(s).orders ?? "a pawn"} as your own`,
    steps(s, seat, rest) {
      const pawn = ext(s).orders!;
      if (rest.length === 0) return pick("How", ["drive", "direct", "charter", "shuttle"].map((k) => opt(k, k, moveOptions(s, pawn, seat, k).length ? null : "not possible")));
      if (rest.length === 1) return pick("Where", moveOptions(s, pawn, seat, String(rest[0])));
      return null;
    },
    apply: (s, seat, rest, ctx) => doMove(s, ext(s).orders!, seat, String(rest[0]), String(rest[1]), ctx),
  },
];

function takeable(s: State, seat: SeatId) {
  return s.players.filter((x) => x !== seat && here(s, x) === here(s, seat))
    .flatMap((x) => s.pl[x]!.hand.filter(isCity).map((k) => opt(`${x}:${k}`, `${cityOf(k)} from ${x}`)));
}

const onlyCurrent = (s: State, seat: SeatId) => (s.outcome ? "hide" : seat === cur(s) && s.phase === "actions" ? null : "only during your own actions");
const anyTime = (s: State) => (s.outcome ? "hide" : null);

/** Rapid Vaccine Deployment: cubes picked one at a time (cities in map order, a city may repeat), then "done". */
function rvdSteps(s: State, rest: Step[]) {
  const c = ext(s).justCured?.color ?? "";
  const chosen = rest.filter((x) => x !== "done").map(String);
  if (rest.includes("done") || chosen.length >= 5) return null;
  const last = chosen.length ? CITY_NAMES.indexOf(chosen[chosen.length - 1]!) : 0;
  const options = CITY_NAMES.filter((x, i) => i >= last && cubesIn(s, x, c) > chosen.filter((y) => y === x).length).map((x) => opt(x, `${x} (${cubesIn(s, x, c)})`));
  if (chosen.length) options.unshift(opt("done", `Done (${chosen.length} cube${chosen.length === 1 ? "" : "s"})`, rvdValid(chosen) ? null : "each city must be connected to another chosen city"));
  return pick(`Remove ${c} cube ${chosen.length + 1} of up to 5`, options);
}
/** Every affected city is connected to another affected city, unless only one city is affected. */
const rvdValid = (chosen: string[]) => { const cities = [...new Set(chosen)]; return cities.length === 1 || cities.every((x) => cities.some((y) => y !== x && (ADJ[x] ?? []).includes(y))); };

const EVENTS: EventDef[] = [
  // Not on the draw: the player is past his actions by then.
  { name: "Borrowed Time", check: onlyCurrent, steps: () => null, apply: (s) => say({ ...s, actionsLeft: s.actionsLeft + 2 }, `${cur(s)} takes 2 extra actions this turn.`) },
  { name: "Commercial Travel Ban", check: anyTime, steps: () => null, apply: (s) => say(withExt(s, { ctb: cur(s) }), `Infection rate is 1 until ${cur(s)}'s next turn begins.`) },
  { name: "Mobile Hospital", check: (s) => (s.outcome || ext(s).mobile ? "hide" : null), steps: () => null, apply: (s) => say(withExt(s, { mobile: true }), `This turn ${cur(s)} removes a cube from each city driven or ferried to.`) },
  {
    name: "New Assignment", check: (s) => (s.outcome || !s.unusedRoles.length ? "hide" : null),
    steps(s, _seat, rest) {
      if (rest.length === 0) return pick("Whose role", s.players.map((x) => opt(x, `${x} (${s.pl[x]!.role})`)));
      if (rest.length === 1) return pick("New role", s.unusedRoles.map((r) => opt(r, r)));
      return null;
    },
    apply(s, _seat, rest) {
      const x = String(rest[0]), r = String(rest[1]), old = s.pl[x]!.role;
      // What the old role card held goes: a stored event to the discard pile, samples to the supply.
      const stored = s.pl[x]!.stored;
      if (stored) s = { ...s, playerDiscard: [...s.playerDiscard, stored] };
      for (const [c, n] of Object.entries(samples(s, x))) s = { ...s, supply: { ...s.supply, [c]: (s.supply[c] ?? 0) + n } };
      s = withExt(s, { samples: { ...ext(s).samples, [x]: {} } });
      s = setPl({ ...s, unusedRoles: [...s.unusedRoles.filter((u) => u !== r), old] }, x, (p) => ({ ...p, role: r, stored: null }));
      // The current player swapping to the Generalist may do 5 actions this turn (from it: still 5).
      if (x === cur(s) && s.phase === "actions" && r === "Generalist") s = { ...s, actionsLeft: s.actionsLeft + 1 };
      return say(s, `${x} becomes the ${r}.`);
    },
  },
  {
    name: "Rapid Vaccine Deployment",
    check: (s) => (s.outcome ? "hide" : rvdNow(s) ? null : "only right after a Discover a Cure action"),
    holdsTurn: rvdNow,
    steps: (s, _seat, rest) => rvdSteps(s, rest),
    apply(s, _seat, rest) {
      const c = ext(s).justCured!.color;
      const chosen = rest.filter((x) => x !== "done").map(String);
      for (const x of chosen) s = removeCubes(s, x, c, 1);
      return say(withExt(s, { justCured: null }), `Rapid vaccine deployment: ${chosen.length} ${c} cubes removed (${[...new Set(chosen)].join(", ")}).`);
    },
  },
  {
    name: "Re-examined Research", check: (s) => (s.outcome || !s.playerDiscard.some(isCity) ? "hide" : null),
    steps(s, _seat, rest) {
      if (rest.length === 0) return pick("Which player takes a card", s.players.map((x) => opt(x, x)));
      if (rest.length === 1) return pick("Take which card", [...new Set(s.playerDiscard.filter(isCity))].map((k) => opt(k, cityOf(k))));
      return null;
    },
    apply(s, _seat, rest, ctx) {
      const x = String(rest[0]), k = String(rest[1]);
      const i = s.playerDiscard.indexOf(k);
      s = setPl({ ...s, playerDiscard: s.playerDiscard.filter((_, j) => j !== i) }, x, (p) => ({ ...p, hand: [...p.hand, k] }));
      return checkHands(say(s, `${x} takes ${cityOf(k)} from the discard pile.`), ctx);
    },
  },
  {
    name: "Remote Treatment", check: (s) => (s.outcome || !cubeIds(s, []).length ? "hide" : null),
    steps: (s, _seat, rest) => (rest.length >= 2 || (rest.length === 1 && !cubeIds(s, rest).length) ? null : pick(`Remove cube ${rest.length + 1} of 2`, cubeIds(s, rest).map((id) => opt(id, id.replace(":", ": "))))),
    apply(s, _seat, rest) {
      for (const id of rest) { const [city, c] = String(id).split(":"); s = removeCubes(s, city!, c!, 1); }
      return say(s, `Remote treatment: ${rest.join(", ")}.`);
    },
  },
  {
    name: "Special Orders", check: (s) => (s.outcome || ext(s).orders ? "hide" : null),
    steps: (s, _seat, rest) => (rest.length ? null : pick(`Which pawn may ${cur(s)} move this turn`, s.players.filter((x) => x !== cur(s)).map((x) => opt(x, x)))),
    apply: (s, _seat, rest) => say(withExt(s, { orders: String(rest[0]) }), `${cur(s)} may move ${String(rest[0])} this turn.`),
  },
];
function rvdNow(s: State) { return ext(s).justCured?.ply === s.ply; }

/** Cubes on the board as "city:colour" (a city's cube may be picked twice when it has two). */
function cubeIds(s: State, chosen: Step[]): string[] {
  const out: string[] = [];
  for (const city of CITY_NAMES) for (const [c, n] of Object.entries(s.cubes[city] ?? {})) {
    const taken = chosen.filter((x) => x === `${city}:${c}`).length;
    if (n - taken > 0) out.push(`${city}:${c}`);
  }
  return out;
}

/** Mobile Hospital in a city with cubes of several colours: the player picks which one goes. */
const mobileInterrupt: InterruptDef = {
  prompt: (s, _seat, partial, data) => (partial.length || cubesHere(s, String(data)).length < 2 ? null : pick(`Mobile Hospital: remove a cube in ${String(data)}`, cubesHere(s, String(data)).map(([c, n]) => opt(c, `${c} (${n})`)))),
  apply: (s, seat, action, data) => mobileRemove(s, seat, String(data), String(action[0])),
  auto(s, seat, data) { const cs = cubesHere(s, String(data)); return cs.length ? mobileRemove(s, seat, String(data), cs[0]![0]) : s; },
};
function mobileRemove(s: State, seat: SeatId, city: string, c: string): State {
  s = say(removeCubes(s, city, c, 1), `Mobile Hospital removes a ${c} cube in ${city}.`);
  return here(s, seat) === city ? markTreated(s, seat, c) : s;
}

export const onTheBrink: PandemicAddOn = {
  id: "onTheBrink",
  actions: ACTIONS,
  events: EVENTS,
  interrupts: { mobileHospital: mobileInterrupt },
  handlers: (ctx: Ctx) => ({
    roles: () => [...OTB_ROLES],
    events: () => [...OTB_EVENTS],
    handLimit: (n: number, s: State, seat: SeatId) => (hasRole(s, seat, "Archivist") ? 8 : n),
    actionLimit: (n: number, s: State, seat: SeatId) => (hasRole(s, seat, "Generalist") ? 5 : n),
    turnStart(s: State): State {
      const seat = cur(s);
      const e = ext(s);
      s = withExt(s, { mobile: false, orders: null, ctb: e.ctb === seat ? null : e.ctb, peek: {} });
      if (hasRole(s, seat, "Troubleshooter")) {
        // As many as the current infection rate (Rate Effect adds no extra look).
        const n = ctx.hooks.chain<number>("infectionRate", RATES[s.rateIdx]!, s);
        s = touch(say(withExt(s, { peek: { [seat]: s.infDeck.slice(0, n) } }), `${seat} looks at the top ${n} infection cards.`));
      }
      return s;
    },
    infectionRate: (n: number, s: State) => (ext(s).ctb ? Math.min(n, 1) : n),
    // The Troubleshooter shows the card for her own Direct Flights (and Special Orders moves she pays for).
    payCard: (pay: boolean, s: State, payer: SeatId, _card: string, kind: string) => (kind === "direct" && hasRole(s, payer, "Troubleshooter") ? false : pay),
    onEnter(s: State, seat: SeatId, city: string, how: string): State {
      if (hasRole(s, seat, "Containment Specialist"))
        for (const [c, n] of Object.entries(s.cubes[city] ?? {})) if (n >= 2) s = say(removeCubes(s, city, c, 1), `The Containment Specialist removes a ${c} cube in ${city}.`);
      if (ext(s).mobile && seat === cur(s) && how === "drive" && cubesHere(s, city).length)
        s = { ...s, pending: [...s.pending, { seat, kind: "mobileHospital", data: city }] };
      return s;
    },
    onCure: (s: State, _seat: SeatId, c: string) => withExt(s, { justCured: { color: c, ply: s.ply } }),
    view(s: State, viewer: string) {
      const e = ext(s);
      return { samples: e.samples, peek: e.peek[viewer] ?? [], travelBan: e.ctb, mobileHospital: e.mobile, specialOrders: e.orders } as never;
    },
  }),
};

