// The base game: state, the turn loop, payments, military and scoring. Everything an expansion changes
// goes through an extension point (POINTS) or a registry (interrupts), so add-ons never fork this code.
import { compareStrings, idiv, shuffle, type Action, type Json, type Option, type Prompt, type Rng, type SeatId, type Step } from "@boardcore/pack-sdk";
import { cardDef, CARDS, parseCost, wonderDef, WONDERS, type Color, type Eff } from "./data";
import { makeHooks, type AddOn, type Hooks } from "./hooks";

export const RES = "WSCOGLP";
export const RAW = "WSCO";
export const RES_NAME: { [r: string]: string } = { W: "wood", S: "stone", C: "clay", O: "ore", G: "glass", L: "loom", P: "papyrus" };

/** The declared extension points (also listed in the pack's `extensionPoints`). */
export const POINTS = {
  /** chain(deckCards: {age, names}[], s, rng): the cards that go into the age decks. */
  decks: "chain",
  /** chain(s, rng): after the base setup (coins, wonders, decks). */
  setup: "chain",
  /** chain(s, rng): at the start of each age, before the first turn (an add-on may set a phase first). */
  ageStart: "chain",
  /** collect(s, seat): extra effects a seat has besides its cards and wonder (leaders, copies). */
  effects: "collect",
  /** chain(ctx: PayCtx, s, seat, item): payment sources and discounts for one build. */
  payment: "chain",
  /** first(s, seat, item): a reason this build costs nothing, or null. */
  freeBuild: "first",
  /** chain(s, seat, item, rng): after a build, for effects the base doesn't know (may queue interrupts). */
  onBuild: "chain",
  /** chain(s): end of a turn, after every interrupt (a place for per-turn bonuses). */
  endTurn: "chain",
  /** chain(seats, s): who takes part in this age's conflicts (diplomacy). */
  conflictSeats: "chain",
  /** chain(n, s, seat): a seat's shields in a conflict. */
  shields: "chain",
  /** chain(s, result: Conflict): one conflict's tokens, before they're handed out. */
  conflict: "chain",
  /** collect(s, seat): extra science wilds and masks. */
  science: "collect",
  /** collect(s, seat): extra scoring lines { cat, vp }. */
  score: "collect",
  /** collect(seatCount, opts): reasons the seat count is not allowed. */
  seatCheck: "collect",
  /** chain(s): at the end of an age, before its conflicts (diplomacy tokens are spent here). */
  ageEnd: "chain",
  /** chain(effs, s, seat, stageIndex): a built stage's effects (Manneken Pis copies a neighbour's). */
  stageEffects: "chain",
  /** first(s, seat, coins): how a coin loss is settled; null = the base rule (pay what you can). */
  settleLoss: "first",
} as const;
export type PointName = keyof typeof POINTS;

export interface Player {
  [k: string]: Json;
  wonder: string;
  side: "A" | "B";
  /** Stage indices built, in build order. */
  built: number[];
  /** Card keys "Name@age" in the city, in build order. */
  cards: string[];
  coins: number;
  debt: number;
  victories: number[];
  defeats: number;
  hand: string[];
  leaders: string[];
  leaderHand: string[];
  /** Leaders recruited but entombed (Abu Simbel): no effect, scored double their cost. */
  entombed: string[];
  diplomacy: number;
  /** The age Olympia A's free build was used in (0 = not this game). */
  freeAge: number;
  /** Cards used as stage markers, in stage-build order (face down). */
  stageCards: string[];
}

export interface Interrupt { [k: string]: Json; seat: SeatId; kind: string; data: Json }

export interface State {
  [k: string]: Json;
  seats: SeatId[];
  addons: string[];
  age: number;
  turn: number;
  /** A phase id from the phase registry ("start", "turn", "lastCard", add-on phases), "interrupt" or "over". */
  phase: string;
  players: { [seat: string]: Player };
  picks: { [seat: string]: Step[] | null };
  decks: string[][];
  discard: string[];
  /** Leaders not dealt, in the box (Rome B draws from here). */
  leaderBox: string[];
  /** The draft hands during the leader draft. */
  draft: { [seat: string]: string[] };
  draftRound: number;
  pending: Interrupt[];
  /** Coins each seat must lose at the end of this turn (paid, or taken as debt with Cities). */
  losses: { [seat: string]: number };
  /** What follows the interrupts: the phase that was just resolved. */
  after: string;
  /** Coins each seat took from the bank this turn (for per-turn bonuses). */
  gained: { [seat: string]: number };
  /** Seats that bought from each neighbour this turn: "seat>L" / "seat>R". */
  bought: string[];
  /** What the last resolution showed everyone, and the ply it happened on. */
  log: string[];
  logPly: number;
  ply: number;
  ext: { [addon: string]: Json };
}

export interface Item { type: "card" | "stage" | "leader"; name: string; age: number; color: Color | "wonder" | "leader"; free?: string }

export interface Ctx { hooks: Hooks; addons: { [id: string]: AddOn } }

export const nOf = (s: State) => s.seats.length;
export const idx = (s: State, seat: SeatId) => s.seats.indexOf(seat);
export const leftOf = (s: State, seat: SeatId): SeatId => s.seats[(idx(s, seat) + nOf(s) - 1) % nOf(s)]!;
export const rightOf = (s: State, seat: SeatId): SeatId => s.seats[(idx(s, seat) + 1) % nOf(s)]!;
export const nbrs = (s: State, seat: SeatId): SeatId[] => (nOf(s) < 2 ? [] : leftOf(s, seat) === rightOf(s, seat) ? [leftOf(s, seat)] : [leftOf(s, seat), rightOf(s, seat)]);
export const keyName = (key: string) => key.slice(0, key.lastIndexOf("@"));
export const keyAge = (key: string) => Number(key.slice(key.lastIndexOf("@") + 1));
export const defOf = (key: string) => cardDef(keyName(key), keyAge(key));
export const colorCount = (s: State, seat: SeatId, colors: readonly Color[]) =>
  s.players[seat]!.cards.filter((k) => colors.includes(defOf(k).color)).length;
export const stageDefs = (p: Player) => wonderDef(p.wonder)[p.side];

/** All effects a seat has, with where each came from (for scoring categories). */
export function effectsOf(s: State, seat: SeatId, ctx: Ctx, depth = 0): { eff: Eff; src: Color | "wonder" | "leader" }[] {
  const p = s.players[seat]!;
  const out: { eff: Eff; src: Color | "wonder" | "leader" }[] = [];
  for (const k of p.cards) for (const eff of defOf(k).eff) out.push({ eff, src: defOf(k).color });
  const w = wonderDef(p.wonder);
  for (const eff of w.board?.[p.side] ?? []) out.push({ eff, src: "wonder" });
  for (const i of p.built) for (const eff of stageEffects(s, seat, i, ctx)) out.push({ eff, src: "wonder" });
  void depth;
  for (const e of ctx.hooks.collect<{ eff: Eff; src: "leader" }>("effects", s, seat)) out.push(e);
  return out;
}

/** A built stage's effects, through the stageEffects point. */
export function stageEffects(s: State, seat: SeatId, i: number, ctx: Ctx): Eff[] {
  const effs = stageDefs(s.players[seat]!)[i]?.eff ?? [];
  return ctx.hooks.chain<Eff[]>("stageEffects", effs, s, seat, i);
}

export const has = (s: State, seat: SeatId, ctx: Ctx, k: Eff["k"]) => effectsOf(s, seat, ctx).some((e) => e.eff.k === k);

// ---- Payment ---------------------------------------------------------------------------------------------

export interface PayCtx {
  [k: string]: Json;
  /** Units the seat makes itself: each string is one unit of any one of its letters. */
  own: string[];
  left: string[];
  right: string[];
  /** Coins per unit bought, by side and resource. */
  price: { L: { [r: string]: number }; R: { [r: string]: number } };
  /** Free units of any resource (leader discounts). */
  discount: number;
  /** Units of any resource bought from the bank at 1 coin (Bilkis). */
  bank: number;
  /** Coins off the first unit bought from a side each turn (Clandestine Docks). */
  rebate: { L: number; R: number };
  /** The resource cost is waived (Architect Cabinet for stages). */
  waive: boolean;
}
export interface Plan { [k: string]: Json; L: number; R: number; B: number }

/** What a seat's neighbours could sell it: brown and grey units, and the board's starting resource. */
export function tradable(s: State, seat: SeatId, ctx: Ctx): string[] {
  const p = s.players[seat]!;
  const out = p.cards.flatMap((k) => (["brown", "grey"].includes(defOf(k).color) ? defOf(k).eff : []))
    .flatMap((e) => (e.k === "prod" && e.trade ? [e.any] : []));
  const base = wonderDef(p.wonder).base;
  if (base) out.push(base);
  void ctx;
  return out;
}

export function payCtx(s: State, seat: SeatId, item: Item, ctx: Ctx): PayCtx {
  const p = s.players[seat]!;
  const effs = effectsOf(s, seat, ctx).map((e) => e.eff);
  const own = effs.flatMap((e) => (e.k === "prod" ? [e.any] : []));
  const base = wonderDef(p.wonder).base;
  if (base) own.push(base);
  // Secret Warehouse: one more of what the city's brown/grey cards or board make; Black Market (and the
  // Great Wall B): one of what they don't. Both appear in more than one expansion, so the base reads them.
  const made = new Set((tradable(s, seat, ctx).join("")).split(""));
  for (const e of effs) {
    if (e.k === "warehouse" && made.size) own.push([...made].sort(compareStrings).join(""));
    if (e.k === "blackMarket") { const m = RES.split("").filter((r) => !made.has(r)).join(""); if (m) own.push(m); }
  }
  const price = { L: {} as { [r: string]: number }, R: {} as { [r: string]: number } };
  for (const r of RES) { price.L[r] = 2; price.R[r] = 2; }
  for (const e of effs) {
    if (e.k !== "trade") continue;
    const letters = e.kind === "raw" ? RAW : "GLP";
    for (const r of letters) {
      if (e.side !== "R") price.L[r] = 1;
      if (e.side !== "L") price.R[r] = 1;
    }
  }
  const pc: PayCtx = { own, left: tradable(s, leftOf(s, seat), ctx), right: tradable(s, rightOf(s, seat), ctx), price, discount: 0, bank: 0, rebate: { L: 0, R: 0 }, waive: false };
  return ctx.hooks.chain<PayCtx>("payment", pc, s, seat, item);
}

/** Every cheapest way to pay `res` (Pareto-minimal in left, right and bank coins), at most `budget` in total. */
export function plans(res: string, pc: PayCtx, budget: number): Plan[] {
  if (pc.waive || res === "") return budget >= 0 ? [{ L: 0, R: 0, B: 0 }] : [];
  // Own single-letter units first: always free and never worse to use.
  const need = res.split("").sort(compareStrings);
  const own = pc.own.slice();
  const rest: string[] = [];
  for (const r of need) {
    const i = own.indexOf(r);
    if (i >= 0) own.splice(i, 1);
    else rest.push(r);
  }
  interface Src { side: "own" | "L" | "R" | "disc" | "bank"; any: string; cap: number }
  const srcs: Src[] = [
    ...own.filter((a) => a.length > 1).map((any) => ({ side: "own" as const, any, cap: 1 })),
    { side: "disc", any: RES, cap: pc.discount },
    { side: "bank", any: RES, cap: pc.bank },
    ...pc.left.map((any) => ({ side: "L" as const, any, cap: 1 })),
    ...pc.right.map((any) => ({ side: "R" as const, any, cap: 1 })),
  ];
  const found = new Map<string, Plan>();
  let budgetNodes = 20000;
  const used = srcs.map(() => 0);
  const walk = (u: number, from: number, L: number, R: number, B: number, nL: number, nR: number) => {
    if (--budgetNodes < 0) return;
    const cL = nL > 0 ? Math.max(0, L - pc.rebate.L) : 0;
    const cR = nR > 0 ? Math.max(0, R - pc.rebate.R) : 0;
    if (cL + cR + B > budget) return;
    if (u === rest.length) {
      const key = `${cL},${cR},${B}`;
      if (!found.has(key)) found.set(key, { L: cL, R: cR, B });
      return;
    }
    const r = rest[u]!;
    const start = u > 0 && rest[u - 1] === r ? from : 0;
    for (let i = start; i < srcs.length; i++) {
      const sc = srcs[i]!;
      if (used[i]! >= sc.cap || !sc.any.includes(r)) continue;
      used[i]!++;
      if (sc.side === "L") walk(u + 1, i, L + pc.price.L[r]!, R, B, nL + 1, nR);
      else if (sc.side === "R") walk(u + 1, i, L, R + pc.price.R[r]!, B, nL, nR + 1);
      else if (sc.side === "bank") walk(u + 1, i, L, R, B + 1, nL, nR);
      else walk(u + 1, i, L, R, B, nL, nR);
      used[i]!--;
    }
  };
  walk(0, 0, 0, 0, 0, 0, 0);
  const all = [...found.values()];
  const best = all.filter((a) => !all.some((b) => b !== a && b.L <= a.L && b.R <= a.R && b.B <= a.B && (b.L < a.L || b.R < a.R || b.B < a.B)));
  return best.sort((a, b) => a.L + a.R + a.B - (b.L + b.R + b.B) || a.L - b.L || a.B - b.B).slice(0, 8);
}

export const planId = (p: Plan) => `pay:${p.L},${p.R},${p.B}`;
export const planLabel = (p: Plan) => {
  const parts = [p.L ? `${p.L} to the left` : "", p.R ? `${p.R} to the right` : "", p.B ? `${p.B} to the bank` : ""].filter(Boolean);
  return parts.length ? `Pay ${parts.join(", ")}` : "Use your own resources";
};

// ---- What a seat may do with a card ----------------------------------------------------------------------

export interface Way { id: string; label: string; disabled?: string; plans: Plan[]; coins: number; free?: string }

/** The coin and resource cost of an item for a seat, and whether it's free. */
export function waysFor(s: State, seat: SeatId, item: Item, cost: string, ctx: Ctx, extraCoins = 0): { plans: Plan[]; coins: number; free: string | null } {
  const p = s.players[seat]!;
  const free = ctx.hooks.first<string | null>("freeBuild", null, s, seat, item);
  const { coins, res } = parseCost(cost);
  const coinCost = coins + extraCoins;
  if (free) return { plans: [{ L: 0, R: 0, B: 0 }], coins: 0, free };
  if (coinCost > p.coins) return { plans: [], coins: coinCost, free: null };
  return { plans: plans(res, payCtx(s, seat, item, ctx), p.coins - coinCost), coins: coinCost, free: null };
}

export function cardWays(s: State, seat: SeatId, key: string, ctx: Ctx, allowStage: boolean): Way[] {
  const p = s.players[seat]!;
  const d = defOf(key);
  const item: Item = { type: "card", name: d.name, age: d.age, color: d.color };
  const ways: Way[] = [];
  const owned = p.cards.some((k) => keyName(k) === d.name);
  const chained = d.from.some((f) => p.cards.some((k) => keyName(k) === f));
  if (owned) ways.push({ id: "build", label: `Build ${d.name}`, disabled: "you already have one", plans: [], coins: 0 });
  else if (chained) ways.push({ id: "build", label: `Build ${d.name} free (chain)`, plans: [{ L: 0, R: 0, B: 0 }], coins: 0, free: "chain" });
  else {
    const w = waysFor(s, seat, item, d.cost, ctx);
    const way: Way = { id: "build", label: `Build ${d.name}${w.free ? ` free (${w.free})` : ""}`, plans: w.plans, coins: w.coins };
    if (w.free) way.free = w.free;
    if (!w.plans.length) way.disabled = "you can't pay for it";
    ways.push(way);
    if (!w.free && has(s, seat, ctx, "freeBuild") && p.freeAge !== s.age)
      ways.push({ id: "olympia", label: `Build ${d.name} free (Olympia, once this age)`, plans: [{ L: 0, R: 0, B: 0 }], coins: 0, free: "olympia" });
  }
  if (allowStage) ways.push(...stageWays(s, seat, ctx));
  ways.push({ id: "sell", label: "Discard for 3 coins", plans: [{ L: 0, R: 0, B: 0 }], coins: 0 });
  return ways;
}

export function openStages(p: Player): number[] {
  const defs = stageDefs(p);
  const w = wonderDef(p.wonder);
  if (w.anyOrder) return defs.map((_, i) => i).filter((i) => !p.built.includes(i));
  return p.built.length < defs.length ? [p.built.length] : [];
}

export function stageWays(s: State, seat: SeatId, ctx: Ctx): Way[] {
  const p = s.players[seat]!;
  const open = openStages(p);
  if (!open.length) return [{ id: "wonder", label: "Build a wonder stage", disabled: "your wonder is finished", plans: [], coins: 0 }];
  return open.map((i) => {
    const def = stageDefs(p)[i]!;
    const item: Item = { type: "stage", name: `${p.wonder} stage ${i + 1}`, age: s.age, color: "wonder" };
    const w = waysFor(s, seat, item, def.cost, ctx);
    const way: Way = { id: open.length > 1 ? `wonder:${i}` : "wonder", label: `Build ${p.wonder} stage ${i + 1}`, plans: w.plans, coins: w.coins };
    if (!w.plans.length) way.disabled = "you can't pay for it";
    return way;
  });
}

/** The prompts after the card step: the way to play it, then (when coins change hands) how to pay. */
export function wayPrompts(ways: Way[], rest: Step[], label: string): Prompt | null {
  if (rest.length === 0) return { kind: "pick", label, options: ways.map((w) => opt(w.id, w.label, w.disabled)) };
  const way = ways.find((w) => w.id === rest[0]);
  if (!way || way.disabled) return null;
  if (rest.length === 1) {
    if (way.plans.length === 1 && way.plans[0]!.L + way.plans[0]!.R + way.plans[0]!.B === 0) return null;
    return { kind: "pick", label: "How to pay", options: way.plans.map((p) => opt(planId(p), planLabel(p) + (way.coins ? ` (+${way.coins} coins to the bank)` : ""))) };
  }
  return null;
}

/** The plan chosen on a path (the only plan when no payment step was shown). */
export function chosenPlan(way: Way, rest: Step[]): Plan {
  return rest.length > 1 ? parsePlan(rest[1]) : way.plans[0] ?? { L: 0, R: 0, B: 0 };
}

export const opt = (id: string, label: string, disabled?: string): Option => (disabled ? { id, label, disabled } : { id, label });

/** True when `path` is a complete legal path through `choices`. */
export function validPath(choices: (partial: Step[]) => Prompt | null, path: Action): boolean {
  for (let i = 0; i <= path.length; i++) {
    const p = choices(path.slice(0, i));
    if (i === path.length) return p === null;
    if (!p) return false;
    const st = path[i];
    if (typeof st !== "string") return false;
    const o = p.options.find((x) => x.id === st);
    if (!o || o.disabled) return false;
  }
  return false;
}

// ---- Coins and building ----------------------------------------------------------------------------------

export function gain(s: State, seat: SeatId, n: number): State {
  if (n <= 0) return s;
  const p = s.players[seat]!;
  return { ...s, players: { ...s.players, [seat]: { ...p, coins: p.coins + n } }, gained: { ...s.gained, [seat]: (s.gained[seat] ?? 0) + n } };
}
export function setP(s: State, seat: SeatId, f: (p: Player) => Player): State {
  return { ...s, players: { ...s.players, [seat]: f(s.players[seat]!) } };
}

/** Immediate effects of something just built (base kinds); then the onBuild point for the rest. */
export function built(s: State, seat: SeatId, effs: Eff[], item: Item, ctx: Ctx, rng: Rng): State {
  for (const e of effs) {
    if (e.k === "coins") s = gain(s, seat, e.n);
    else if (e.k === "perCoins") s = gain(s, seat, e.n * perCount(s, seat, e));
    else if (e.k === "discardBuild") s = { ...s, pending: [...s.pending, { seat, kind: "discardBuild", data: null }] };
  }
  return ctx.hooks.chain<State>("onBuild", s, seat, item, effs, rng);
}

export function perCount(s: State, seat: SeatId, e: { who: "self" | "nbr" | "all"; colors?: Color[]; stages?: true; defeats?: true; victories?: true }): number {
  const who = e.who === "self" ? [seat] : e.who === "nbr" ? nbrs(s, seat) : [seat, ...nbrs(s, seat)];
  let n = 0;
  for (const x of who) {
    const p = s.players[x]!;
    if (e.colors) n += colorCount(s, x, e.colors);
    if (e.stages) n += p.built.length;
    if (e.defeats) n += p.defeats;
    if (e.victories) n += p.victories.length;
  }
  return n;
}

/** Pays a plan: coins to each neighbour and the bank; records who bought from whom. */
export function pay(s: State, seat: SeatId, coins: number, plan: Plan): State {
  const L = leftOf(s, seat), R = rightOf(s, seat);
  s = setP(s, seat, (p) => ({ ...p, coins: p.coins - coins - plan.L - plan.R - plan.B }));
  if (plan.L) s = setP(s, L, (p) => ({ ...p, coins: p.coins + plan.L }));
  if (plan.R) s = setP(s, R, (p) => ({ ...p, coins: p.coins + plan.R }));
  const bought = [...s.bought];
  if (plan.L) bought.push(`${seat}>L`);
  if (plan.R) bought.push(`${seat}>R`);
  return { ...s, bought };
}

export const parsePlan = (id: Step | undefined): Plan => {
  const m = /^pay:(\d+),(\d+),(\d+)$/.exec(String(id ?? ""));
  return m ? { L: Number(m[1]), R: Number(m[2]), B: Number(m[3]) } : { L: 0, R: 0, B: 0 };
};

// ---- Military ---------------------------------------------------------------------------------------------

export interface Conflict {
  [k: string]: Json;
  a: SeatId; b: SeatId; winner: SeatId | null; value: number; tokens: number;
  /** Who takes the loser's defeat token (Tomyris gives it to the winner). */
  defeatTo: SeatId | null;
  /** Coins from the bank, per seat (Nero). */
  bonus: { [seat: string]: number };
}

export function shieldsOf(s: State, seat: SeatId, ctx: Ctx): number {
  const n = effectsOf(s, seat, ctx).reduce((t, e) => t + (e.eff.k === "shields" ? e.eff.n : 0), 0);
  return ctx.hooks.chain<number>("shields", n, s, seat, ctx);
}

export function military(s: State, ctx: Ctx): State {
  const value = s.age === 1 ? 1 : s.age === 2 ? 3 : 5;
  const seats = ctx.hooks.chain<SeatId[]>("conflictSeats", s.seats.slice(), s);
  const pairs: [SeatId, SeatId][] = [];
  if (seats.length === 2) pairs.push([seats[0]!, seats[1]!]);
  else if (seats.length > 2) for (let i = 0; i < seats.length; i++) pairs.push([seats[i]!, seats[(i + 1) % seats.length]!]);
  const log: string[] = [];
  for (const [a, b] of pairs) {
    const sa = shieldsOf(s, a, ctx), sb = shieldsOf(s, b, ctx);
    const winner = sa > sb ? a : sb > sa ? b : null;
    let c: Conflict = { a, b, winner, value, tokens: 1, defeatTo: winner === null ? null : winner === a ? b : a, bonus: {} };
    c = ctx.hooks.chain<Conflict>("conflict", c, s, ctx);
    // tokens === 0: a hook cancelled the fight (Cities team play: teammates do not fight).
    if (c.tokens <= 0) continue;
    if (c.winner === null) { log.push(`${a} and ${b} tie (${sa} shields each)`); continue; }
    const w = c.winner, loser = c.winner === a ? b : a, to = c.defeatTo ?? loser;
    for (let t = 0; t < c.tokens; t++) {
      s = setP(s, w, (p) => ({ ...p, victories: [...p.victories, c.value] }));
      s = setP(s, to, (p) => ({ ...p, defeats: p.defeats + 1 }));
    }
    for (const [x, n] of Object.entries(c.bonus)) s = gain(s, x, n);
    log.push(`${c.winner} beats ${loser} (${Math.max(sa, sb)} to ${Math.min(sa, sb)} shields)`);
  }
  return { ...s, log: [...s.log, `Age ${s.age} conflicts: ${log.join("; ") || "none"}.`] };
}

// ---- Scoring ----------------------------------------------------------------------------------------------

export interface Line { [k: string]: Json; cat: string; vp: number }

export interface SciCounts { c: number; g: number; t: number; wild: number; masks: number; pool: { c: number; g: number; t: number } }

/** Symbols, wilds, and masks (Cities, Great Wall B): a mask copies the symbol of one green card in a
 *  neighbouring city, each mask a different card. */
export function sciCounts(s: State, seat: SeatId, ctx: Ctx): SciCounts {
  const r: SciCounts = { c: 0, g: 0, t: 0, wild: 0, masks: 0, pool: { c: 0, g: 0, t: 0 } };
  for (const e of effectsOf(s, seat, ctx)) {
    if (e.eff.k === "sci") { if (e.eff.s === "*") r.wild++; else r[e.eff.s]++; }
    if (e.eff.k === "mask") r.masks++;
  }
  for (const x of nbrs(s, seat)) for (const k of s.players[x]!.cards) for (const e of defOf(k).eff)
    if (defOf(k).color === "green" && e.k === "sci" && e.s !== "*") r.pool[e.s]++;
  for (const x of ctx.hooks.collect<{ wild?: number }>("science", s, seat)) if (x.wild) r.wild += x.wild;
  return r;
}

/** Best science score over every wild and mask choice. setBonus is 7 per set (Aristotle adds 3). */
export function sciScore(k: SciCounts, setBonus: number): number {
  let best = 0;
  const v = (c: number, g: number, t: number) => c * c + g * g + t * t + setBonus * Math.min(c, g, t);
  for (let x = 0; x <= Math.min(k.pool.c, k.masks); x++)
    for (let y = 0; y <= Math.min(k.pool.g, k.masks - x); y++)
      for (let z = 0; z <= Math.min(k.pool.t, k.masks - x - y); z++)
        for (let a = 0; a <= k.wild; a++)
          for (let b = 0; b <= k.wild - a; b++) {
            const n = v(k.c + x + a, k.g + y + b, k.t + z + (k.wild - a - b));
            if (n > best) best = n;
          }
  return best;
}

export function score(s: State, seat: SeatId, ctx: Ctx, noCopy = false): Line[] {
  const p = s.players[seat]!;
  const lines: Line[] = [];
  const add = (cat: string, vp: number) => { if (vp) lines.push({ cat, vp }); };
  add("military", p.victories.reduce((a, b) => a + b, 0) - p.defeats);
  add("treasury", idiv(p.coins, 3));
  for (const { eff, src } of effectsOf(s, seat, ctx)) {
    const cat = src === "wonder" ? "wonder" : src === "leader" ? "leaders" : src === "blue" ? "civic" : src === "yellow" ? "commerce" : src === "purple" ? "guilds" : src === "black" ? "cities" : "other";
    if (eff.k === "vp") add(cat, eff.n);
    else if (eff.k === "perVP") add(cat, eff.n * perCount(s, seat, eff));
  }
  const sc = sciCounts(s, seat, ctx);
  const bonus = 7 + effectsOf(s, seat, ctx).filter((e) => e.eff.k === "leaderVP" && e.eff.what === "sciSets").length * 3;
  add("science", sciScore(sc, bonus));
  for (const l of ctx.hooks.collect<Line>("score", s, seat, ctx)) add(l.cat, l.vp);
  // Olympia B: copy the guild of a neighbour worth the most to this city.
  if (!noCopy && effectsOf(s, seat, ctx).some((e) => e.eff.k === "copyGuild")) {
    const now = total(score(s, seat, ctx, true));
    let best = 0;
    for (const x of nbrs(s, seat)) for (const k of s.players[x]!.cards) {
      if (defOf(k).color !== "purple" || p.cards.includes(k)) continue;
      const v = total(score(setP(s, seat, (pp) => ({ ...pp, cards: [...pp.cards, k] })), seat, ctx, true)) - now;
      if (v > best) best = v;
    }
    add("guilds", best);
  }
  return lines;
}

export const total = (lines: Line[]) => lines.reduce((t, l) => t + l.vp, 0);

// ---- Setup ------------------------------------------------------------------------------------------------

export interface Opts { [k: string]: Json; leaders: boolean; leaderPromos?: boolean; cities: boolean; teamPlay?: boolean; wonderPack: boolean; sideB: boolean; randomSides: boolean }

export function baseDecks(n: number, opts: Opts): { age: number; names: string[] }[] {
  const count = Math.min(n, 7);
  return [1, 2, 3].map((age) => ({
    age,
    names: CARDS.filter((c) => c.age === age && c.set === "base" && c.color !== "purple").flatMap((c) => c.counts.filter((k) => k <= count).map(() => c.name)),
  })).map((d) => { void opts; return d; });
}

/** The three age decks, shuffled: base cards for the seat count, the guilds, then add-on cards (the decks point).
 *  Also used by resampleHidden to redraw decks a seat hasn't seen. */
export function buildDecks(n: number, opts: Opts, ctx: Ctx, rng: Rng): string[][] {
  let decks = baseDecks(n, opts);
  const guilds = shuffle(rng, CARDS.filter((c) => c.color === "purple" && c.set === "base").map((c) => c.name));
  decks = decks.map((d) => (d.age === 3 ? { ...d, names: [...d.names, ...guilds] } : d));
  decks = ctx.hooks.chain<{ age: number; names: string[] }[]>("decks", decks, opts, n, rng);
  // Guilds: players + 2 (concise; cheatsheet). The 8-player Cities variant is set up like 7 players, so
  // 9 guilds, not 10 — otherwise Age III would have 57 cards and would not deal evenly (56 / 8 = 7).
  decks = decks.map((d) => {
    if (d.age !== 3) return d;
    const isGuild = (nm: string) => CARDS.some((c) => c.name === nm && c.color === "purple");
    const want = n === 8 ? 9 : n + 2;
    const g = shuffle(rng, d.names.filter(isGuild)).slice(0, want);
    return { ...d, names: [...d.names.filter((x) => !isGuild(x)), ...g] };
  });
  return decks.map((d) => shuffle(rng, d.names.map((nm) => `${nm}@${d.age}`)));
}

export function setupState(seats: SeatId[], opts: Opts, addons: string[], table: { [id: string]: AddOn }, rng: Rng): State {
  const ctx: Ctx = { hooks: makeHooks(table, addons, POINTS), addons: table };
  const n = seats.length;
  const reasons = ctx.hooks.collect<string>("seatCheck", n, opts);
  if (n < 3 || n > 8) reasons.push("7 Wonders needs 3 to 7 players (8 with Cities)");
  if (n === 8 && !opts.cities) reasons.push("8 players needs the Cities expansion");
  if (reasons.length) throw new Error(reasons[0]);
  const pool = WONDERS.filter((w) => w.set === "base" || (w.set === "leaders" && opts.leaders) || (w.set === "cities" && opts.cities) || (w.set === "wonderPack" && opts.wonderPack))
    .filter((w) => !w.needs || addons.includes(w.needs)).map((w) => w.name);
  const wonders = shuffle(rng, pool).slice(0, n);
  const players: { [s: string]: Player } = {};
  seats.forEach((seat, i) => {
    const w = wonderDef(wonders[i]!);
    const side = opts.randomSides ? (rng.int(2) === 0 ? "A" : "B") : opts.sideB ? "B" : "A";
    players[seat] = { wonder: w.name, side, built: [], cards: [], coins: 3 + (w.coins ?? 0), debt: 0, victories: [], defeats: 0, hand: [], leaders: [], leaderHand: [], entombed: [], diplomacy: 0, freeAge: 0, stageCards: [] };
  });
  let s: State = {
    seats, addons, age: 0, turn: 0, phase: "start", players, picks: Object.fromEntries(seats.map((x) => [x, null])),
    decks: buildDecks(n, opts, ctx, rng), discard: [], leaderBox: [], draft: {}, draftRound: 0,
    pending: [], losses: {}, after: "turn", gained: {}, bought: [], log: [], logPly: -1, ply: 0, ext: {},
  };
  s = ctx.hooks.chain<State>("setup", s, rng);
  return s;
}

export function startAge(s: State, age: number, ctx: Ctx, rng: Rng): State {
  const deck = s.decks[age - 1]!;
  const per = idiv(deck.length, nOf(s));
  const players = { ...s.players };
  s.seats.forEach((seat, i) => { players[seat] = { ...players[seat]!, hand: deck.slice(i * per, (i + 1) * per) }; });
  s = { ...s, age, turn: 1, players, phase: "turn", picks: Object.fromEntries(s.seats.map((x) => [x, null])) };
  return ctx.hooks.chain<State>("ageStart", s, rng);
}

/** Hands move left in Ages I and III, right in Age II. */
export function passHands(s: State): State {
  const players = { ...s.players };
  for (const seat of s.seats) {
    const from = s.age === 2 ? leftOf(s, seat) : rightOf(s, seat);
    players[seat] = { ...players[seat]!, hand: s.players[from]!.hand };
  }
  return { ...s, players };
}

export function finalScores(s: State, ctx: Ctx): { [seat: string]: number } {
  return Object.fromEntries(s.seats.map((x) => [x, total(score(s, x, ctx))]));
}

export const sortSeats = (xs: SeatId[]) => xs.slice().sort(compareStrings);
