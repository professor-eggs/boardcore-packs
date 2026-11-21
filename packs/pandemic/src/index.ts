// Pandemic on the phase runner, with On the Brink's modules as options of this pack (roles, events, Virulent
// Strain, Mutation, the Bio-Terrorist: ./expansions, called through the in-pack kernel, ./kernel.ts). Mechanics
// only. Each round is one player's turn: actions, a response window, the draw (special cards one at a time, with
// a window inside an epidemic and between two special cards), hand limits, the infection step (a window before
// each card), the next player. Out-of-turn events are played in `window` phases where every seat that may hold
// one by public information is an actor with Pass (Q65's interim shape, gap G1); a seat's consent and choice from
// its closed hand go through the interrupt queue (Q66, gap G2). Rules summary and gaps: ../README.md,
// ../CONTRACT-GAPS.md.
import {
  contents, definePack, phaseRunner, sample, shuffle, zone, canSee,
  type Action, type Options, type Phase, type PhaseCtx, type Prompt, type Question, type Rng, type SeatId, type SetupContext, type Status, type Step, type Viewer, type Option,
} from "@boardcore/pack-sdk";
import { BASE_EVENTS as EVENT_NAMES, BASE_ROLES, CITIES, CITY_NAMES, POPULATION, RATES, STANDARD } from "./data";
import { BASE_ACTIONS, BASE_EVENTS, forecastBack, type EventDef } from "./actions";
import {
  applyOps, cardLabel, checkHand, cityOf, cur, currentRate, discardFrom, epidemicInfect, handLimit, handOf, intensify, isCity, isEpidemic, isEvent,
  lose, moveCard, opt, pick, place, say, setHand, setPl, takeTop, infectCity, type Fx, type Lib, type Op, type State,
} from "./engine";
import { hooks, MOD_IDS, runnerPhase, type ModId, type Module } from "./kernel";
import { resampleBase } from "./resample";
import type { PDDisease, PDView } from "./types";
import roles from "./expansions/roles";
import events from "./expansions/events";
import virulentStrain from "./expansions/virulent-strain";
import mutation from "./expansions/mutation";
import bioterrorist from "./expansions/bioterrorist";

const MODULES: { [K in ModId]: Module } = { roles, events, virulentStrain, mutation, bioterrorist };

/**
 * Why these options can't be played at this seat count, or null (the README's "Option rules"). The manifest
 * can't say any of it, so `setup` refuses with this text.
 */
export function optionProblem(options: Options, seats: number): string | null {
  const on = (id: ModId) => options[id] === true;
  if (on("mutation") && on("bioterrorist")) return "Mutation and the Bio-Terrorist can't be played together: switch one of them off";
  if (on("bioterrorist") && seats < 3) return "the Bio-Terrorist needs 3 to 5 seats (one is his, the others are the players): add a seat or switch him off";
  const players = seats - (on("bioterrorist") ? 1 : 0);
  if (players < 2) return "Pandemic needs at least 2 players";
  if (players > 4 && !on("roles")) return "5 players need the On the Brink roles: switch that option on, or play with 2 to 4";
  if (players > 5) return "Pandemic takes at most 5 players";
  const epis = Number.isSafeInteger(options.epidemics) ? Number(options.epidemics) : 4;
  if (epis === 7 && !on("roles")) return "7 epidemics (legendary) need the On the Brink roles: switch that option on, or choose 4 to 6 epidemics";
  if (epis < 4 || epis > 7) return "epidemics: 4 to 7";
  return null;
}

/** Infection cards one step may draw: the top rate (4) and one more (a modifier's bonus). */
const INFECT_MAX = 5;
/** Seconds every seat's prompt gets in a response window (11 §10 "The response window"). */
const WINDOW_SECONDS = 30;
/** The base's own phases, one round; the Bio-Terrorist's go before `actions` (his start) and `next` (his turn). */
export const PHASES = [
  "actions", "beforeDraw", "draw", "special1", "epidemic1", "intensify1", "between", "special2", "epidemic2", "intensify2", "hands", "infect",
  ...Array.from({ length: INFECT_MAX }, (_, i) => [`w${i + 1}`, `i${i + 1}`]).flat(), "next",
];

const DISEASES: PDDisease[] = STANDARD.map((id) => ({ id, cubes: 24, cure: "color", standard: true }));

/** The seat holding the highest city population card in its starting hand (ties: the earlier seat). */
function firstPlayer(s: State): number {
  let best = 0, at = 0;
  s.players.forEach((x, i) => {
    for (const k of handOf(s, x)) if (isCity(k) && (POPULATION[cityOf(k)] ?? 0) > best) { best = POPULATION[cityOf(k)] ?? 0; at = i; }
  });
  return at;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** Words wrapped within 34 columns, later lines indented (a phone's table, phone play 2026-11-18). */
function wrap(text: string, indent = "", width = 34): string[] {
  const lines: string[] = [];
  let line = indent;
  for (const w of text.split(" ")) {
    if (line.trim() && line.length + 1 + w.length > width) { lines.push(line); line = `${indent}  ${w}`; }
    else line = line.trim() ? `${line} ${w}` : `${indent}${w}`;
  }
  if (line.trim()) lines.push(line);
  return lines;
}

/** The whole game for one set of modules: what the composer made of the base and its add-ons, as plain code. */
function make(modIds: readonly ModId[]) {
  const mods = modIds.map((id) => MODULES[id]);
  const pts = hooks(mods);
  const ownEvents: { id: string; inEpidemic?: boolean }[] = EVENT_NAMES.map((id) => (id === "Resilient Population" ? { id, inEpidemic: true } : { id }));
  const L: Lib = {
    pts,
    roles: [...BASE_ROLES, ...pts.roles().map((r) => r.id)],
    events: new Map([...ownEvents, ...pts.events()].map((e) => [e.id, e])),
    baseEvents: new Set(EVENT_NAMES),
  };
  const baseEvent = new Map<string, EventDef>(BASE_EVENTS.map((e) => [e.name, e]));
  const baseAction = new Map(BASE_ACTIONS.map((a) => [a.id, a]));

  /**
   * The runner's context as the effects context, counting the questions an action asks that another seat
   * agrees to (`give`, `consent`): their answer pays the action (`charge`). A colour choice or a hand-limit
   * discard on the way pays nothing, so it never makes the action free (PR #118 second review).
   */
  const fxOf = (ctx: PhaseCtx) => {
    let paying = 0;
    const fx: Fx & { paidByAnswer(): boolean } = {
      zones: ctx.zones, rng: ctx.rng,
      ask: (q) => { if (q.kind === "give" || q.kind === "consent") paying++; ctx.ask(q); },
      paidByAnswer: () => paying > 0,
    };
    return fx;
  };

  // ---- Events ----------------------------------------------------------------------------------------

  /** The events a seat may play now: `turn` (its own prompt), `window`, `epidemic` (only those allowed inside one). */
  const eventOptions = (s: State, seat: SeatId, where: "turn" | "window" | "epidemic"): Option[] => {
    if (!s.players.includes(seat) || s.outcome) return [];
    const p = s.pl[seat]!;
    const names = [...new Set([...handOf(s, seat).filter(isEvent), ...(p.stored ? [p.stored] : [])].map((k) => k.slice(6)))];
    return names.flatMap((n) => {
      const e = L.events.get(n);
      if (!e) return [];
      if (where === "epidemic" && !e.inEpidemic) return [];
      const def = baseEvent.get(n);
      const why = def ? def.check(s, L, seat) : (pts.eventCheck(s, { id: n, seat })?.why ?? "hide");
      return why === "hide" ? [] : [opt(`ev:${n}`, `Play ${n}`, why)];
    });
  };
  const eventSteps = (s: State, seat: SeatId, partial: Step[]): Prompt | null => {
    const n = String(partial[0]).slice(3);
    const def = baseEvent.get(n);
    if (def) return def.steps(s, L, seat, partial.slice(1));
    return (pts.steps(s, { id: n, seat, rest: partial.slice(1) })?.prompt ?? null) as Prompt | null;
  };
  /** Plays an event: the base's own, or a module's operations (a lone consent carries the card's spending). */
  const playEvent = (s: State, seat: SeatId, action: Action, fx: Fx): State => {
    const n = String(action[0]).slice(3);
    const def = baseEvent.get(n);
    if (def) return def.apply(s, L, seat, action.slice(1), fx);
    const ops = pts.act(s, { id: n, seat, rest: action.slice(1) });
    const spend: Op = { op: "spendEvent", seat, name: n };
    if (ops.length === 1 && ops[0]!.op === "consent") return applyOps(s, L, [{ ...ops[0]!, ops: [spend, ...(ops[0]!.ops as Op[])] } as Op], fx);
    return applyOps(s, L, [spend, ...ops], fx);
  };
  const eventPrompt = (s: State, seat: SeatId, partial: Step[], where: "turn" | "window" | "epidemic", label: string): Prompt | null => {
    if (partial.length) return String(partial[0]).startsWith("ev:") ? eventSteps(s, seat, partial) : null;
    return pick(label, eventOptions(s, seat, where));
  };

  /**
   * Who is offered a window, from public information only (G1): with open hands, the seats holding an event
   * they may play; with closed hands, every pawn seat with cards while some event card is still unaccounted
   * for (not in the discards, out of the game or stored face up), and any seat with a stored event.
   */
  const responders = (s: State, epidemic: boolean): SeatId[] => {
    if (s.outcome) return [];
    if (s.openHands) return s.players.filter((x) => eventOptions(s, x, epidemic ? "epidemic" : "window").some((o) => !o.disabled));
    const stored = s.players.filter((x) => s.pl[x]!.stored !== null && (!epidemic || L.events.get(s.pl[x]!.stored!.slice(6))?.inEpidemic));
    let open: boolean;
    if (epidemic) {
      const known = (n: string) => s.playerDiscard.includes(`event:${n}`) || s.removed.includes(`event:${n}`) || s.players.some((x) => s.pl[x]!.stored === `event:${n}`);
      open = [...L.events.values()].some((e) => e.inEpidemic && !known(e.id)) && s.infDiscard.some((c) => CITIES[c]);
    } else {
      const known = [...s.playerDiscard, ...s.removed].filter(isEvent).length + s.players.filter((x) => s.pl[x]!.stored).length;
      open = s.nEvents - known > 0;
    }
    return s.players.filter((x) => stored.includes(x) || (open && s.pl[x]!.hand.items.length > 0));
  };

  // ---- The actions phase ---------------------------------------------------------------------------------

  const canCall = (s: State, seat: SeatId) => !s.called && responders({ ...s, players: s.players.filter((x) => x !== seat) }, false).length > 0;

  function actionPrompt(s: State, seat: SeatId, partial: Step[]): Prompt | null {
    if (partial.length === 0) {
      const own: Option[] = [];
      if (s.actionsLeft > 0) {
        for (const a of BASE_ACTIONS) {
          const why = a.check(s, L, seat);
          if (why === "hide") continue;
          own.push(opt(a.id, a.label(s, seat), why ?? (a.cost > s.actionsLeft ? "no actions left" : null)));
        }
      }
      // A role's free ability (the Epidemiologist's take, returning samples) is no action: it stays on offer
      // during the player's turn after the last action too.
      for (const a of pts.actions(s, { seat }).flat()) {
        if (a.cost > 0 && s.actionsLeft <= 0) continue;
        own.push(opt(a.id, a.label, a.disabled ?? (a.cost > s.actionsLeft ? "no actions left" : null)));
      }
      const call = canCall(s, seat) ? [opt("call", "Wait for the other players' events")] : [];
      return pick(`${plural(s.actionsLeft, "action")} left`, [...own, ...eventOptions(s, seat, "turn"), ...call, opt("end", s.actionsLeft ? `End your actions (${s.actionsLeft} left)` : "End your actions")]);
    }
    const id = String(partial[0]);
    if (id === "end" || id === "call") return null;
    if (id.startsWith("ev:")) return eventSteps(s, seat, partial);
    const a = baseAction.get(id);
    if (a) return a.steps(s, L, seat, partial.slice(1));
    return (pts.steps(s, { id, seat, rest: partial.slice(1) })?.prompt ?? null) as Prompt | null;
  }

  function actionApply(s: State, seat: SeatId, action: Action, ctx: PhaseCtx): State {
    const fx = fxOf(ctx);
    const id = String(action[0]);
    if (id === "end") return say({ ...s, actionsLeft: 0, justCured: null }, `${seat} ends the actions.`);
    ctx.stay();
    if (id === "call") {
      const n = s.players.length;
      for (let i = 1; i < n; i++) fx.ask({ kind: "respond", seat: s.players[(s.current + i) % n]!, default: ["pass"] });
      return say({ ...s, called: true }, `${seat} waits for the other players' events.`);
    }
    if (id.startsWith("ev:")) return playEvent(s, seat, action, fx);
    s = { ...s, justCured: null, called: false };
    const a = baseAction.get(id);
    let cost: number;
    if (a) {
      cost = a.cost;
      s = a.apply(s, L, seat, action.slice(1), fx);
    } else {
      const found = pts.actions(s, { seat }).flat().find((x) => x.id === id);
      if (!found) throw new Error(`no action ${id}`);
      cost = found.cost;
      s = applyOps(s, L, pts.act(s, { id, seat, rest: action.slice(1) }), fx);
    }
    // An action another seat must agree to is paid by the answer (G2); every other action is paid now,
    // whatever else it asked (a colour choice, a hand-limit discard), whose answers never charge.
    if (!fx.paidByAnswer()) s = { ...s, actionsLeft: s.actionsLeft - cost };
    return s;
  }

  // ---- Phases ----------------------------------------------------------------------------------------------

  const window = (id: string, open: (s: State) => boolean, epidemic = false): Phase<State> => ({
    id, kind: "window", deadline: WINDOW_SECONDS,
    seats: (s) => (open(s) ? responders(s, epidemic) : []),
    begin: (s) => (open(s) ? { ...s, step: epidemic ? "epidemic" : "window" } : s),
    choices: (s, seat, partial) => eventPrompt(s, seat, partial, epidemic ? "epidemic" : "window", epidemic ? "Epidemic: before the infection discards are shuffled back" : "Play an event"),
    apply: (s, seat, action, ctx) => playEvent(s, seat, action, fxOf(ctx)),
  });

  const special = (id: string): Phase<State> => ({
    id, kind: "auto",
    begin(s, ctx) {
      if (s.outcome || !s.drawn.length) return s;
      const card = s.drawn[0]!;
      s = { ...s, drawn: s.drawn.slice(1), step: "draw" };
      if (isEpidemic(card)) return epidemicInfect(s, L, card, fxOf(ctx));
      const ops = pts.drawCard(s, { card });
      return applyOps({ ...s, removed: [...s.removed, card] }, L, ops.length ? ops : [{ op: "log", text: `${cardLabel(card)} has no effect.` }], fxOf(ctx));
    },
  });
  const intensifyPhase = (id: string): Phase<State> => ({
    id, kind: "auto",
    begin: (s, ctx) => (s.outcome || !s.epidemicCard ? s : intensify(s, L, fxOf(ctx))),
  });
  const infectPair = (k: number): Phase<State>[] => [
    window(`w${k}`, (s) => !!s.inf && s.inf.left > 0),
    {
      id: `i${k}`, kind: "auto",
      begin(s, ctx) {
        if (s.outcome || !s.inf || s.inf.left <= 0) return s;
        const fx = fxOf(ctx);
        const [t, top] = takeTop({ ...s, step: "infect" }, 1, fx);
        s = t;
        const card = top[0];
        if (card === undefined) return { ...s, inf: { ...s.inf!, left: 0 } };
        s = { ...s, infDiscard: [...s.infDiscard, card], inf: { ...s.inf!, left: s.inf!.left - 1, drawn: CITIES[card] ? [...s.inf!.drawn, card] : s.inf!.drawn } };
        s = infectCity(s, L, card, "infect", fx);
        if (s.outcome || !s.inf || s.inf.left > 0 || s.inf.bonus) return s;
        return { ...s, inf: { ...s.inf, bonus: true, left: pts.infectBonus(s, 0, { drawn: s.inf.drawn }) } };
      },
    },
  ];

  const own: Phase<State>[] = [
    {
      id: "actions", kind: "turns",
      seats: (s) => (s.outcome ? [] : [cur(s)]),
      begin(s, ctx) {
        if (s.outcome) return s;
        const seat = cur(s);
        s = {
          ...s, turn: s.turn + 1, step: "actions", grant: null, called: false, justCured: null, inf: null,
          actionsLeft: pts.actionLimit(s, 4, { seat }), pl: Object.fromEntries(Object.entries(s.pl).map(([k, p]) => [k, { ...p, used: [] }])),
        };
        return applyOps(say(s, `${seat}'s turn.`), L, pts.turnStart(s, { seat }), fxOf(ctx));
      },
      choices: (s, seat, partial) => actionPrompt(s, seat, partial),
      apply: (s, seat, action, ctx) => actionApply(s, seat, action, ctx),
    },
    window("beforeDraw", () => true),
    {
      // Both cards are drawn together; city and event cards go to the hand, special cards wait in order (others
      // before epidemics; two others drawn together: the player picks the order).
      id: "draw", kind: "auto",
      begin(s, ctx) {
        if (s.outcome) return s;
        s = { ...s, step: "draw", justCured: null, grant: null };
        const deck = ctx.zones.items(s.playerDeck);
        if (deck.length < 2) return lose(s, L, "the player deck ran out");
        const seat = cur(s);
        const two = deck.slice(0, 2);
        s = { ...s, playerDeck: { ...s.playerDeck, items: deck.slice(2) } };
        const specials: string[] = [];
        for (const card of two) {
          if (isCity(card) || isEvent(card)) s = say(setHand(s, seat, [...handOf(s, seat), card]), s.openHands ? `${seat} draws ${cardLabel(card)}.` : `${seat} draws a card.`);
          else specials.push(card);
        }
        const drawn = [...specials.filter((k) => !isEpidemic(k)), ...specials.filter(isEpidemic)];
        if (drawn.length === 2 && !isEpidemic(drawn[0]!) && !isEpidemic(drawn[1]!) && drawn[0] !== drawn[1]) ctx.ask({ kind: "drawOrder", seat, args: drawn, default: [`o:${drawn[0]}`] });
        return { ...s, drawn };
      },
    },
    special("special1"), window("epidemic1", (s) => !!s.epidemicCard, true), intensifyPhase("intensify1"),
    window("between", (s) => s.drawn.length > 0),
    special("special2"), window("epidemic2", (s) => !!s.epidemicCard, true), intensifyPhase("intensify2"),
    {
      id: "hands", kind: "auto",
      begin(s, ctx) {
        if (s.outcome) return s;
        s = { ...s, step: "other" };
        for (const x of s.players) s = checkHand(s, L, x, fxOf(ctx));
        return s;
      },
    },
    {
      id: "infect", kind: "auto",
      begin(s) {
        if (s.outcome) return s;
        if (s.quiet) return say({ ...s, quiet: false, inf: null, step: "infect" }, "One quiet night: no infections.");
        return { ...s, step: "infect", inf: { left: currentRate(s, L), drawn: [], bonus: false } };
      },
    },
    ...Array.from({ length: INFECT_MAX }, (_, i) => infectPair(i + 1)).flat(),
    {
      id: "next", kind: "auto",
      begin: (s) => (s.outcome ? s : { ...s, inf: null, step: "other", grant: null, current: (s.current + 1) % s.players.length }),
    },
  ];

  // ---- Questions -------------------------------------------------------------------------------------------

  type QA = { cost?: number; to?: string; from?: string; city?: string | null; flag?: string | null; text?: string; ops?: Op[]; label?: string; choices?: { id: string; label: string; ops: Op[] }[] };
  const argsOf = (q: Question) => q.args as unknown as QA;
  /** An action agreed by another seat is paid now (only by the current player in his actions). */
  const charge = (s: State, seat: SeatId, n: number): State => (n && seat === cur(s) && s.step === "actions" ? { ...s, actionsLeft: Math.max(0, s.actionsLeft - n) } : s);

  // The modules' phases, each before the base phase it names; their operations run without a question queue.
  const phases = own.flatMap((p) => [...mods.flatMap((m) => (m.phases ?? []).filter((x) => x.before === p.id).map((x) => runnerPhase(m, x, (s, ops) => applyOps(s, L, ops, null)))), p]);

  const run = phaseRunner<State>({
    phases,
    // Won or lost at any action: the runner stops there, walking no remaining round (s11 X7).
    ended: (s) => s.outcome !== null,
    interrupts: {
      discard: {
        choices: (s, q, partial) => {
          if (partial.length) return String(partial[0]).startsWith("ev:") ? eventSteps(s, q.seat, partial) : null;
          const hand = handOf(s, q.seat);
          return { kind: "pick", label: `Too many cards (limit ${handLimit(s, L, q.seat)}): discard one or play an event`, options: [...hand.map((k, i) => opt(`d:${i}`, `Discard ${cardLabel(k)}`)), ...eventOptions(s, q.seat, "window")] };
        },
        answer: (s, q, action, ctx) => {
          const fx = fxOf(ctx);
          const id = String(action[0]);
          if (id.startsWith("ev:")) s = playEvent(s, q.seat, action, fx);
          else {
            const card = fx.zones.items(s.pl[q.seat]!.hand)[Number(id.slice(2))]!;
            s = say(discardFrom(s, q.seat, card), `${q.seat} discards ${cardLabel(card)}.`);
          }
          return checkHand(s, L, q.seat, fx);
        },
      },
      give: {
        // The asked seat's own matching cards and Refuse; a seat with none gets Refuse only (s11 A41).
        choices: (s, q, partial) => {
          if (partial.length) return null;
          const a = argsOf(q);
          const mine = [...new Set(handOf(s, q.seat).filter((k) => isCity(k) && (a.city === null || cityOf(k) === a.city)))];
          return { kind: "pick", label: `${a.to} asks you for ${a.city ? `the ${a.city} card` : "a city card"}`, options: [...mine.map((k) => opt(`g:${k}`, `Give ${cityOf(k)}`)), opt("refuse", "Refuse")] };
        },
        answer: (s, q, action, ctx) => {
          const a = argsOf(q);
          const fx = fxOf(ctx);
          if (action[0] === "refuse") return say(s, `${q.seat} refuses.`);
          const card = String(action[0]).slice(2);
          if (!fx.zones.items(s.pl[q.seat]!.hand).includes(card)) throw new Error(`${q.seat} has no ${card}`);
          s = say(moveCard(s, q.seat, a.to!, card), `${q.seat} gives ${cityOf(card)} to ${a.to}.`);
          s = charge(s, a.to!, a.cost ?? 0);
          if (a.flag) s = setPl(s, a.to!, (p) => ({ ...p, used: [...p.used, a.flag!] }));
          return checkHand(s, L, a.to!, fx);
        },
      },
      consent: {
        choices: (_s, q, partial) => (partial.length ? null : { kind: "pick", label: `${argsOf(q).text}: agree?`, options: [opt("yes", "Agree"), opt("no", "Refuse")] }),
        answer: (s, q, action, ctx) => {
          const a = argsOf(q);
          const fx = fxOf(ctx);
          if (action[0] === "no") return say(s, `${q.seat} refuses.`);
          // What the asker offered comes from his hand: the answer is shown to him, so it is read as a reveal.
          fx.zones.items(s.pl[a.from!]!.hand);
          return applyOps(charge(say(s, `${q.seat} agrees.`), a.from!, a.cost ?? 0), L, a.ops ?? [], fx);
        },
      },
      choose: {
        choices: (_s, q, partial) => (partial.length ? null : { kind: "pick", label: argsOf(q).label!, options: argsOf(q).choices!.map((c) => opt(c.id, c.label)) }),
        answer: (s, q, action, ctx) => applyOps(s, L, argsOf(q).choices!.find((c) => c.id === action[0])!.ops, fxOf(ctx)),
      },
      forecast: {
        choices: (s, _q, partial) => {
          if (!s.forecast) return null;
          const cards = contents(s.forecast);
          if (partial.length >= cards.length - 1) return null;
          const taken = partial.map(String);
          return pick(`Forecast: the card to put back ${partial.length ? "next" : "on top"}`, cards.map((c, i) => opt(`f:${i}`, c)).filter((o) => !taken.includes(o.id)));
        },
        answer: (s, q, action, ctx) => forecastBack(s, q.seat, action.map(String), fxOf(ctx)),
      },
      drawOrder: {
        choices: (_s, q, partial) => (partial.length ? null : { kind: "pick", label: "Resolve which card first", options: (q.args as string[]).map((k) => opt(`o:${k}`, cardLabel(k))) }),
        answer: (s, q, action) => {
          const first = String(action[0]).slice(2);
          return { ...s, drawn: [first, ...(q.args as string[]).filter((k) => k !== first)] };
        },
      },
      respond: {
        choices: (s, q, partial) => {
          if (partial.length) return String(partial[0]).startsWith("ev:") ? eventSteps(s, q.seat, partial) : null;
          return { kind: "pick", label: `${cur(s)} waits: play an event, or pass`, options: [...eventOptions(s, q.seat, "window"), opt("pass", "Pass")] };
        },
        answer: (s, q, action, ctx) => (action[0] === "pass" ? s : playEvent(s, q.seat, action, fxOf(ctx))),
      },
    },
  });

  // ---- View and text -------------------------------------------------------------------------------------

  const baseView = (s: State, viewer: Viewer): PDView => {
    const sees = (seat: SeatId) => canSee(s.pl[seat]!.hand, viewer);
    const known = viewer !== "spectator" ? (s.infKnown[viewer] ?? 0) : 0;
    const pl: PDView["pl"] = {};
    for (const x of s.players) {
      const p = s.pl[x]!;
      pl[x] = { role: p.role, city: p.city, hand: sees(x) ? contents(p.hand) : [], handSize: p.hand.items.length, stored: p.stored, used: p.used, samples: p.samples, held: [], heldSize: 0 };
    }
    for (const x of s.seats) if (!pl[x] && s.held[x]) {
      const h = s.held[x]!;
      pl[x] = { role: "", city: "", hand: [], handSize: 0, stored: null, used: [], samples: {}, held: canSee(h, viewer) ? contents(h) : [], heldSize: h.items.length };
    }
    const cubes: PDView["cubes"] = {};
    for (const [c, m] of Object.entries(s.cubes)) { const k = Object.entries(m).filter(([, n]) => n > 0); if (k.length) cubes[c] = Object.fromEntries(k); }
    return {
      viewer, mods: s.mods, modules: {}, players: s.players, current: cur(s), turn: s.turn, step: s.step, actionsLeft: s.actionsLeft, pl, cubes, supply: s.supply, stations: s.stations,
      cured: s.cured, eradicated: s.eradicated, outbreaks: s.outbreaks, infectionRate: RATES[s.rateIdx]!, playerDeck: s.playerDeck.items.length,
      playerDiscard: s.playerDiscard, infectionDeck: s.infDeck.items.length, infectionDiscard: s.infDiscard, known: s.infDeck.items.slice(0, known),
      forecast: s.forecast && canSee(s.forecast, viewer) ? contents(s.forecast) : [], grant: s.grant, justCured: s.justCured,
      actors: s.outcome ? [] : run.actors(s), run: run.view(s), log: s.log, outcome: s.outcome,
    };
  };

  /** The base's view with each module's view of its own slice (the Bio-Terrorist's city only for those who see him). */
  const viewOf = (s: State, viewer: Viewer): PDView => {
    const v = baseView(s, viewer);
    const modules: PDView["modules"] = {};
    for (const m of mods) if (m.view) modules[m.id] = m.view({ slice: s.slices[m.id] ?? null, view: v, viewer });
    return { ...v, modules };
  };
  /** Each module's lines for the table (the travel ban, the strain, the Bio-Terrorist and his sheet). */
  const moduleLines = (v: PDView): string[] => mods.flatMap((m) => { const t = m.text?.state ? m.text.state({ view: v.modules[m.id] ?? null }) : ""; return t ? [t] : []; });

  const heading = (v: PDView) => {
    if (v.outcome) return `Game over: ${v.outcome.text}.`;
    const steps: { [k: string]: string } = { window: "events may be played", draw: "drawing cards", epidemic: "an epidemic", infect: "infecting cities", other: "between steps" };
    const where = v.step === "actions" ? `actions, ${v.actionsLeft} left` : steps[v.step] ?? "between steps";
    return `Turn ${v.turn}: ${v.current} (${where}).`;
  };

  /** The first legal path, for a timeout: ending, passing or refusing where it can, else the first enabled option. */
  const firstPath = (choices: (p: Step[]) => Prompt | null): Action | null => {
    const path: Step[] = [];
    for (let i = 0; i < 12; i++) {
      const p = choices(path);
      if (!p) return path.length ? path : null;
      if (p.kind === "order") { path.push(p.options.map((o) => o.id)); continue; }
      if (p.kind !== "pick") return null;
      const o = p.options.find((x) => !x.disabled && /(^|:)(end|pass|refuse|no)$/.test(x.id)) ?? p.options.find((x) => !x.disabled && !x.id.startsWith("ev:"));
      if (!o) return null;
      path.push(o.id);
    }
    return null;
  };

  return {
    setup({ options, seats, rng }: SetupContext): State {
      const why = optionProblem(options, seats.length);
      if (why) throw new Error(why);
      const ids = seats.map((x) => x.seat);
      const players = pts.pawnSeats(ids, rng, options);
      const epis = Number.isSafeInteger(options.epidemics) ? Number(options.epidemics) : 4;
      const diseases: PDDisease[] = [...DISEASES, ...pts.diseases()].map((d) => ({ ...d }));
      const supply = Object.fromEntries(diseases.map((d) => [d.id, d.cubes]));
      let s: State = {
        seats: ids, mods: modIds.slice(), slices: {}, players, pl: {}, diseases, cubes: {}, supply, stations: ["Atlanta"], cured: [], eradicated: [], outbreaks: 0, rateIdx: 0,
        playerDeck: zone([], []), piles: [], epiPool: [], playerDiscard: [], infDeck: zone(shuffle(rng, CITY_NAMES), []), infSegs: [CITY_NAMES.length], infKnown: {},
        infDiscard: [], held: Object.fromEntries(ids.map((x) => [x, zone([], [x])])), forecast: null, removed: [], unusedRoles: [], nEvents: 0,
        current: 0, turn: 0, actionsLeft: 0, step: "other", drawn: [], epidemicCard: null, inf: null, openHands: options.openHands === true || epis === 4,
        quiet: false, justCured: null, grant: null, called: false, outcome: null, log: [], run: null as never,
      };
      const roles = shuffle(rng, L.roles);
      const seen = s.openHands ? "all" : null;
      players.forEach((x, i) => { s.pl[x] = { role: roles[i]!, city: "Atlanta", hand: zone([], seen ?? [x]), stored: null, used: [], samples: {} }; });
      s = { ...s, unusedRoles: roles.slice(players.length) };
      // Initial infections: 3 cities with 3 cubes, 3 with 2, 3 with 1.
      for (const n of [3, 3, 3, 2, 2, 2, 1, 1, 1]) {
        const [t, top] = takeTop(s, 1, null);
        s = { ...t, infDiscard: [...t.infDiscard, top[0]!] };
        s = place(s, L, top[0]!, CITIES[top[0]!]!, n, true);
      }
      s = { ...s, infDiscard: [...s.infDiscard, ...pts.startDiscard(s, [])] };
      // Player deck: cities and the events in play, the hands dealt, then piles as equal as possible with one
      // epidemic each, the bigger piles on top.
      const names = [...L.events.keys()];
      const nEvents = Math.min(names.length, pts.eventCount(s, names.length, { seats: ids.length }));
      const events = sample(rng, names, nEvents);
      let cards = shuffle(rng, [...CITY_NAMES.map((c) => `city:${c}`), ...events.map((e) => `event:${e}`)]);
      const hand = players.length === 2 ? 4 : players.length === 3 ? 3 : 2;
      for (const x of players) { s = setHand(s, x, cards.slice(0, hand)); cards = cards.slice(hand); }
      cards = shuffle(rng, pts.playerCards(s, cards));
      const ep = pts.epidemics(s, { pool: Array.from({ length: epis }, () => "epidemic"), n: epis });
      const epiCards = sample(rng, ep.pool, ep.n);
      const piles: string[][] = epiCards.map(() => []);
      cards.forEach((c, i) => piles[i % piles.length]!.push(c));
      const deck = piles.flatMap((p, i) => shuffle(rng, [...p, epiCards[i]!]));
      s = { ...s, nEvents, playerDeck: zone(deck, []), piles: piles.map((p) => p.length + 1), epiPool: ep.pool, current: 0 };
      s = { ...s, current: firstPlayer(s), log: [] };
      for (const m of mods) if (m.setup) s = { ...s, slices: { ...s.slices, [m.id]: m.setup({ state: s, options }) } };
      return run.start(s, { seats: ids, rounds: Math.floor(deck.length / 2) + 3, rng });
    },

    choices: (s: State, seat: SeatId, partial: Step[]) => (s.outcome ? null : run.choices(s, seat, partial)),

    apply: (s: State, seat: SeatId, action: Action, rng: Rng) => run.apply({ ...s, log: [] }, seat, action, rng),

    view: viewOf,

    status: (s: State): Status => (s.outcome ? { actors: [], outcome: { winners: s.outcome.winners, text: s.outcome.text } } : { actors: run.actors(s) }),

    onTimeout: (s: State, seat: SeatId) => firstPath((p) => run.choices(s, seat, p)),

    // The base's zones, then each module's slice (the Bio-Terrorist's city), on the one generator.
    resampleHidden: (s: State, seat: SeatId, rng: Rng) => {
      s = resampleBase(s, seat, rng);
      for (const m of mods) if (m.resampleHidden) s = { ...s, slices: { ...s.slices, [m.id]: m.resampleHidden({ state: s, slice: s.slices[m.id] ?? null, seat, rng }) } };
      return run.resample(s, seat, rng);
    },

    text: {
      legend: () => [
        "Pandemic. A cooperative game: the players travel the world treating disease cubes and trading city cards to discover cures " +
        "(5 cards of one colour at a research station). Each turn: 4 actions, draw 2 player cards (epidemics raise the infection rate and " +
        "reshuffle), then infect cities one card at a time. Events may be played at any time: the table pauses for them between the steps. " +
        "8 outbreaks, an empty cube supply or too few player cards to draw loses; curing every disease wins at once.",
        ...mods.flatMap((m) => (m.text?.legend ? [m.text.legend()] : [])),
      ].join("\n"),
      state(v: PDView) {
        const parts = [heading(v)];
        parts.push(`Outbreaks ${v.outbreaks}/8, infection rate ${v.infectionRate}, cured: ${v.cured.join(", ") || "none"}${v.eradicated.length ? `, eradicated: ${v.eradicated.join(", ")}` : ""}.`);
        parts.push(`Research stations: ${v.stations.join(", ")}.`);
        for (const x of v.players) {
          const p = v.pl[x]!;
          const hand = p.hand.length || p.handSize === 0 ? p.hand.map(cardLabel).join(", ") || "no cards" : `${plural(p.handSize, "card")} (hidden)`;
          const samples = Object.entries(p.samples).filter(([, n]) => n > 0).map(([c, n]) => `${n} ${c}`).join(", ");
          parts.push(`${x} (${p.role}) in ${p.city}: ${hand}${p.stored ? `; stored ${cardLabel(p.stored)}` : ""}${samples ? `; samples ${samples}` : ""}.`);
        }
        const cubes = Object.entries(v.cubes).map(([c, m]) => `${c} ${Object.entries(m).map(([k, n]) => `${n} ${k}`).join(" ")}`);
        parts.push(`Cubes: ${cubes.join("; ") || "none"}.`);
        parts.push(`Supply: ${Object.entries(v.supply).map(([k, n]) => `${k} ${n}`).join(", ")}. Player deck ${v.playerDeck}, infection deck ${v.infectionDeck}.`);
        if (v.known.length) parts.push(`You know the top of the infection deck: ${v.known.join(", ")}.`);
        if (v.forecast.length) parts.push(`Forecast: ${v.forecast.join(", ")}.`);
        if (v.log.length) parts.push(`Last: ${v.log.join(" ")}`);
        return [parts.join(" "), ...moduleLines(v)].join("\n");
      },
      layout(v: PDView) {
        // A phone shows about 36 columns: every line is wrapped within 34 (phone play, 2026-11-18).
        const out: string[] = [];
        const put = (t: string, indent = "") => out.push(...wrap(t, indent));
        put(heading(v));
        put(`Outbreaks ${v.outbreaks}/8, infection rate ${v.infectionRate}.`);
        put(`Cured: ${v.cured.join(", ") || "none"}${v.eradicated.length ? `; eradicated: ${v.eradicated.join(", ")}` : ""}.`);
        put(`Player deck ${v.playerDeck}, infection deck ${v.infectionDeck}.`);
        if (v.infectionDiscard.length) put(`Infection discard: ${v.infectionDiscard.join(", ")}.`);
        if (v.known.length) put(`Top of the infection deck: ${v.known.join(", ")}.`);
        if (v.forecast.length) put(`Forecast: ${v.forecast.join(", ")}.`);
        out.push("");
        for (const x of v.players) {
          const p = v.pl[x]!;
          put(`${x}: ${p.role} in ${p.city}`);
          const hand = p.hand.length || p.handSize === 0 ? p.hand.map(cardLabel).join(", ") || "no cards" : `${plural(p.handSize, "card")} (hidden)`;
          put(`${hand}.`, "  ");
          if (p.stored) put(`Stored: ${cardLabel(p.stored)}.`, "  ");
          const samples = Object.entries(p.samples).filter(([, n]) => n > 0).map(([c, n]) => `${n} ${c}`).join(", ");
          if (samples) put(`Samples: ${samples}.`, "  ");
        }
        out.push("", "Cities (R: research station)");
        for (const c of CITY_NAMES.filter((c) => v.cubes[c] || v.stations.includes(c) || v.players.some((x) => v.pl[x]!.city === c))) {
          const cubes = Object.entries(v.cubes[c] ?? {}).map(([k, n]) => `${n} ${k}`).join(", ");
          const pawns = v.players.filter((x) => v.pl[x]!.city === c);
          const row = wrap(`${c}${cubes ? `: ${cubes}` : ""}${pawns.length ? ` (${pawns.join(", ")})` : ""}`, "", 32);
          out.push(...row.map((l, i) => (i === 0 ? (v.stations.includes(c) ? "R " : "  ") : "  ") + l));
        }
        // Each module's lines under the table, already wrapped.
        const lines = moduleLines(v);
        if (lines.length) out.push("", ...lines);
        return out.join("\n");
      },
    },
  };
}

type Game = ReturnType<typeof make>;
const games = new Map<string, Game>();
/** The game for a set of modules (32 at most), made on first use. */
function gameOf(mods: readonly string[]): Game {
  const ids = MOD_IDS.filter((id) => mods.includes(id));
  const key = ids.join();
  let g = games.get(key);
  if (!g) { g = make(ids); games.set(key, g); }
  return g;
}

export default definePack<State, PDView>({
  // The modules are the options switched on; a combination that can't be played is refused in `setup`.
  setup: (ctx) => gameOf(MOD_IDS.filter((id) => ctx.options[id] === true)).setup(ctx),
  choices: (s, seat, partial) => gameOf(s.mods).choices(s, seat, partial),
  apply: (s, seat, action, rng) => gameOf(s.mods).apply(s, seat, action, rng),
  view: (s, viewer) => gameOf(s.mods).view(s, viewer),
  status: (s) => gameOf(s.mods).status(s),
  describe: (s) => (s.log.length ? s.log.join(" ") : null),
  onTimeout: (s, seat) => gameOf(s.mods).onTimeout(s, seat),
  resampleHidden: (s, seat, rng) => gameOf(s.mods).resampleHidden(s, seat, rng),
  text: {
    legend: (v) => gameOf(v.mods).text.legend(),
    state: (v) => gameOf(v.mods).text.state(v),
    layout: (v) => gameOf(v.mods).text.layout(v),
  },
});
