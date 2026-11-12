// The turn loop: phases, simultaneous picks, resolution, interrupts, the end of a turn and of an age.
// Add-ons add phases (the leader draft, recruiting) and interrupts (questions to one seat) through the
// registries on their AddOn; the loop below runs them like the base's own.
import type { Action, Prompt, Rng, SeatId, Step } from "@boardcore/pack-sdk";
import {
  built, cardWays, chosenPlan, defOf, gain, has, military, pay, passHands, setP, stageEffects, startAge, keyName, wayPrompts,
  opt, validPath, type Ctx, type Item, type State, type Way,
} from "./engine";
import type { Eff } from "./data";
import type { AddOn } from "./hooks";

export interface PhaseDef {
  /** Seats still to choose. */
  actors(s: State, ctx: Ctx): SeatId[];
  prompt(s: State, seat: SeatId, partial: Step[], ctx: Ctx): Prompt | null;
  /** Runs once every actor has chosen (their paths are in s.picks). */
  resolve(s: State, ctx: Ctx, rng: Rng): State;
  /** Runs after the resolution's interrupts and end of turn: where the game goes next. */
  next(s: State, ctx: Ctx, rng: Rng): State;
}

export interface InterruptDef {
  /** null: nothing to decide (auto runs instead). */
  prompt(s: State, seat: SeatId, partial: Step[], data: unknown, ctx: Ctx): Prompt | null;
  apply(s: State, seat: SeatId, action: Action, data: unknown, ctx: Ctx, rng: Rng): State;
  auto(s: State, seat: SeatId, data: unknown, ctx: Ctx, rng: Rng): State;
}

export interface SevenAddOn extends AddOn {
  phases?: { [id: string]: PhaseDef };
  interrupts?: { [kind: string]: InterruptDef };
}

export interface Flow extends Ctx {
  phases: { [id: string]: PhaseDef };
  interrupts: { [kind: string]: InterruptDef };
}

export function makeFlow(ctx: Ctx, table: { [id: string]: SevenAddOn }, active: readonly string[]): Flow {
  const phases: { [id: string]: PhaseDef } = { start: startPhase, turn: turnPhase, lastCard: lastCardPhase };
  const interrupts: { [kind: string]: InterruptDef } = { discardBuild, loss: payLoss };
  for (const id of active) {
    Object.assign(phases, table[id]?.phases ?? {});
    Object.assign(interrupts, table[id]?.interrupts ?? {});
  }
  return { ...ctx, phases, interrupts };
}

export function actors(s: State, f: Flow): SeatId[] {
  if (s.phase === "over") return [];
  if (s.phase === "interrupt") return s.pending.length ? [s.pending[0]!.seat] : [];
  return f.phases[s.phase]?.actors(s, f) ?? [];
}

export function prompt(s: State, seat: SeatId, partial: Step[], f: Flow): Prompt | null {
  if (!actors(s, f).includes(seat)) return null;
  if (s.phase === "interrupt") {
    const it = s.pending[0]!;
    return f.interrupts[it.kind]?.prompt(s, seat, partial, it.data, f) ?? null;
  }
  return f.phases[s.phase]?.prompt(s, seat, partial, f) ?? null;
}

export function act(s: State, seat: SeatId, action: Action, f: Flow, rng: Rng): State {
  if (!validPath((p) => prompt(s, seat, p, f), action)) throw new Error(`not a legal action for ${seat}: ${JSON.stringify(action)}`);
  s = { ...s, ply: s.ply + 1 };
  if (s.phase === "interrupt") {
    const it = s.pending[0]!;
    s = { ...s, pending: s.pending.slice(1), log: [], logPly: s.ply };
    s = f.interrupts[it.kind]!.apply(s, seat, action, it.data, f, rng);
    return settle(s, f, rng);
  }
  s = { ...s, picks: { ...s.picks, [seat]: action } };
  const ph = f.phases[s.phase]!;
  if (ph.actors(s, f).length) return s;
  s = { ...s, log: [], logPly: s.ply, after: s.phase, gained: {}, bought: [] };
  s = ph.resolve(s, f, rng);
  s = { ...s, picks: Object.fromEntries(s.seats.map((x) => [x, null])), phase: "interrupt" };
  return settle(s, f, rng);
}

/** Runs everything that needs no choice: auto interrupts, coin losses, the end of a turn, the next phase. */
export function settle(s: State, f: Flow, rng: Rng): State {
  for (let guard = 0; guard < 1000; guard++) {
    if (s.phase === "over") return s;
    if (s.phase !== "interrupt") {
      if (actors(s, f).length) return s;
      // A phase with nobody to act (e.g. no seat has a 7th card to play) resolves at once.
      s = { ...s, after: s.phase, phase: "interrupt" };
      continue;
    }
    if (s.pending.length) {
      const it = s.pending[0]!;
      const def = f.interrupts[it.kind]!;
      if (def.prompt(s, it.seat, [], it.data, f)) return s;
      s = def.auto({ ...s, pending: s.pending.slice(1) }, it.seat, it.data, f, rng);
      continue;
    }
    const lossSeats = s.seats.filter((x) => (s.losses[x] ?? 0) > 0);
    if (lossSeats.length) {
      const losses = s.losses;
      s = { ...s, losses: {} };
      for (const x of lossSeats) {
        const r = f.hooks.first<State | null>("settleLoss", null, s, x, losses[x]!);
        s = r ?? { ...s, pending: [...s.pending, { seat: x, kind: "loss", data: losses[x]! }] };
      }
      continue;
    }
    const before = s.pending.length;
    s = f.hooks.chain<State>("endTurn", s);
    if (s.pending.length > before || Object.keys(s.losses).length) continue;
    const ph = f.phases[s.after];
    if (!ph) throw new Error(`no phase ${s.after}`);
    s = ph.next({ ...s, gained: {}, bought: [] }, f, rng);
  }
  throw new Error("the turn loop did not settle");
}

// ---- Base phases -------------------------------------------------------------------------------------------

const handPrompt = (s: State, seat: SeatId, partial: Step[], f: Flow, label: string): Prompt | null => {
  const p = s.players[seat]!;
  if (partial.length === 0) return { kind: "pick", label, options: p.hand.map((k, i) => opt(`c:${i}`, keyName(k))) };
  const i = Number(String(partial[0]).slice(2));
  const key = p.hand[i];
  if (key === undefined) return null;
  return wayPrompts(cardWays(s, seat, key, f, true), partial.slice(1), `Play ${keyName(key)}`);
};

/** Plays every pick: payments first, then the cards, then their immediate effects (base rule: coins gained
 *  this turn can't pay for this turn). */
export function resolveHands(s: State, seats: SeatId[], f: Flow, rng: Rng): State {
  const done: { seat: SeatId; key: string; way: Way; item: Item | null; effs: Eff[] }[] = [];
  for (const seat of seats) {
    const path = s.picks[seat];
    if (!path) continue;
    const i = Number(String(path[0]).slice(2));
    const key = s.players[seat]!.hand[i]!;
    const way = cardWays(s, seat, key, f, true).find((w) => w.id === path[1])!;
    done.push({ seat, key, way, item: null, effs: [] });
  }
  for (const d of done) {
    const path = s.picks[d.seat]!;
    s = pay(s, d.seat, d.way.coins, chosenPlan(d.way, path.slice(1)));
    s = setP(s, d.seat, (p) => ({ ...p, hand: p.hand.filter((_, j) => j !== Number(String(path[0]).slice(2))) }));
    const def = defOf(d.key);
    if (d.way.id === "build" || d.way.id === "olympia") {
      s = setP(s, d.seat, (p) => ({ ...p, cards: [...p.cards, d.key], freeAge: d.way.id === "olympia" ? s.age : p.freeAge }));
      d.item = { type: "card", name: def.name, age: def.age, color: def.color, ...(d.way.free ? { free: d.way.free } : {}) };
      d.effs = def.eff;
      s = { ...s, log: [...s.log, `${d.seat} builds ${def.name}${d.way.free ? ` (free: ${d.way.free})` : ""}.`] };
    } else if (d.way.id.startsWith("wonder")) {
      const p = s.players[d.seat]!;
      const st = d.way.id.includes(":") ? Number(d.way.id.slice(7)) : p.built.length;
      s = setP(s, d.seat, (pp) => ({ ...pp, built: [...pp.built, st], stageCards: [...pp.stageCards, d.key] }));
      d.item = { type: "stage", name: `${p.wonder} stage ${st + 1}`, age: s.age, color: "wonder" };
      d.effs = stageEffects(s, d.seat, st, f);
      s = { ...s, log: [...s.log, `${d.seat} builds stage ${st + 1} of ${p.wonder}.`] };
    } else {
      s = { ...s, discard: [...s.discard, d.key], log: [...s.log, `${d.seat} discards a card for 3 coins.`] };
    }
  }
  for (const d of done) {
    if (d.item) s = built(s, d.seat, d.effs, d.item, f, rng);
    else s = gain(s, d.seat, 3);
  }
  return s;
}

const lastTurn = (s: State) => s.seats.every((x) => s.players[x]!.hand.length <= 1);

export const turnPhase: PhaseDef = {
  actors: (s) => s.seats.filter((x) => s.picks[x] === null && s.players[x]!.hand.length > 0),
  prompt: (s, seat, partial, f) => handPrompt(s, seat, partial, f as Flow, `Age ${s.age}, turn ${s.turn}: choose a card`),
  resolve(s, f, rng) {
    s = resolveHands(s, s.seats, f as Flow, rng);
    if (lastTurn(s)) s = discardLast(s, s.seats.filter((x) => !has(s, x, f, "lastCard")));
    return s;
  },
  next(s) {
    if (!lastTurn(s)) return { ...passHands(s), turn: s.turn + 1, phase: "turn" };
    return { ...s, phase: "lastCard" };
  },
};

/** Before Age I: nothing to choose in the base game. */
export const startPhase: PhaseDef = {
  actors: () => [],
  prompt: () => null,
  resolve: (s) => s,
  next: (s, f, rng) => startAge(s, 1, f, rng),
};

export const lastCardPhase: PhaseDef = {
  actors: (s, f) => s.seats.filter((x) => s.picks[x] === null && s.players[x]!.hand.length === 1 && has(s, x, f, "lastCard")),
  prompt: (s, seat, partial, f) => handPrompt(s, seat, partial, f as Flow, "Babylon: play your last card"),
  resolve: (s, f, rng) => resolveHands(s, s.seats, f as Flow, rng),
  next: (s, f, rng) => endAge(discardLast(s, s.seats), f as Flow, rng),
};

function discardLast(s: State, seats: SeatId[]): State {
  for (const x of seats) {
    const h = s.players[x]!.hand;
    if (!h.length) continue;
    s = { ...setP(s, x, (p) => ({ ...p, hand: [] })), discard: [...s.discard, ...h] };
  }
  return s;
}

export function endAge(s: State, f: Flow, rng: Rng): State {
  s = f.hooks.chain<State>("ageEnd", s);
  s = military(s, f);
  if (s.age >= 3) return { ...s, phase: "over" };
  return startAge(s, s.age + 1, f, rng);
}

// ---- Base interrupts ---------------------------------------------------------------------------------------

/** Halicarnassus, Solomon, the Great Wall A: build a card from the discard pile for free. */
export const discardBuild: InterruptDef = {
  prompt(s, seat, partial) {
    if (partial.length) return null;
    const p = s.players[seat]!;
    const ok = [...new Set(s.discard)].filter((k) => !p.cards.some((c) => keyName(c) === keyName(k)));
    if (!ok.length) return null;
    return { kind: "pick", label: "Build a discarded card for free", options: [...ok.map((k) => opt(`d:${k}`, `${keyName(k)} (Age ${defOf(k).age})`)), opt("skip", "Build nothing")] };
  },
  apply(s, seat, action, _d, f, rng) {
    const id = String(action[0]);
    if (id === "skip") return { ...s, log: [...s.log, `${seat} builds nothing from the discard pile.`] };
    const key = id.slice(2);
    const i = s.discard.indexOf(key);
    const def = defOf(key);
    s = { ...s, discard: s.discard.filter((_, j) => j !== i), log: [...s.log, `${seat} builds ${def.name} from the discard pile.`] };
    s = setP(s, seat, (p) => ({ ...p, cards: [...p.cards, key] }));
    return built(s, seat, def.eff, { type: "card", name: def.name, age: def.age, color: def.color, free: "discard" }, f, rng);
  },
  auto: (s) => s,
};

/** A coin loss with no add-on rule: pay what you can (Wonder Pack rule without Cities). */
export const payLoss: InterruptDef = {
  prompt: () => null,
  apply: (s) => s,
  auto: (s, seat, data) => setP(s, seat, (p) => ({ ...p, coins: Math.max(0, p.coins - Number(data)) })),
};

