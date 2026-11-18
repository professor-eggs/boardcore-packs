// The base rules: effects, payments, building, military and scoring. Pure functions of the state and the
// room's content (`Lib`: the composed card and wonder registries and the base's point invokers), so an
// add-on reaches these rules only through the points the base declares (points.d.ts).
import { compareStrings, contents, idiv, withItems, type Invokers, type Option, type Prompt, type SeatId, type Step } from "@boardcore/pack-sdk";
import { parseCost } from "./data";

export type State = SWState;
export type Player = SWPlayer;
export type Eff = SWEff;
export type Item = SWItem;
export type Line = SWLine;
export type Plan = SWPlan;
export type Way = SWWay;
export type Op = SWOp;
export type Pts = Invokers<"boardcore/seven-wonders">;

/** The room's content and points, made once when the pack is loaded (a composed registry is fixed). */
export interface Lib {
  cards: Map<string, SWCardDef>;
  wonders: Map<string, SWWonderDef>;
  sets: string[];
  pts: Pts;
}

export const RES = "WSCOGLP";
export const RAW = "WSCO";
export const RES_NAME: { [r: string]: string } = { W: "wood", S: "stone", C: "clay", O: "ore", G: "glass", L: "loom", P: "papyrus" };

export const nOf = (s: State) => s.seats.length;
export const idx = (s: State, seat: SeatId) => s.seats.indexOf(seat);
export const leftOf = (s: State, seat: SeatId): SeatId => s.seats[(idx(s, seat) + nOf(s) - 1) % nOf(s)]!;
export const rightOf = (s: State, seat: SeatId): SeatId => s.seats[(idx(s, seat) + 1) % nOf(s)]!;
export const nbrs = (s: State, seat: SeatId): SeatId[] => (nOf(s) < 2 ? [] : leftOf(s, seat) === rightOf(s, seat) ? [leftOf(s, seat)] : [leftOf(s, seat), rightOf(s, seat)]);
export const keyName = (key: string) => key.slice(0, key.lastIndexOf("@"));
export const keyAge = (key: string) => Number(key.slice(key.lastIndexOf("@") + 1));
export const opt = (id: string, label: string, disabled?: string | null): Option => (disabled ? { id, label, disabled } : { id, label });
export const isBase = (e: Eff): boolean => !e.k.includes(":");

export function cardOf(lib: Lib, key: string): SWCardDef {
  const c = lib.cards.get(key);
  if (!c) throw new Error(`no card ${key}`);
  return c;
}
export function wonderOf(lib: Lib, id: string): SWWonderDef {
  const w = lib.wonders.get(id);
  if (!w) throw new Error(`no wonder ${id}`);
  return w;
}
export const stageDefs = (lib: Lib, p: Player) => wonderOf(lib, p.wonder)[p.side];
export const colorCount = (s: State, seat: SeatId, colors: readonly string[]) => colors.reduce((t, c) => t + (s.players[seat]!.colors[c] ?? 0), 0);

export function setP(s: State, seat: SeatId, f: (p: Player) => Player): State {
  return { ...s, players: { ...s.players, [seat]: f(s.players[seat]!) } };
}
export const say = (s: State, line: string): State => ({ ...s, log: [...s.log, line] });

/** The index a copy of stage `stage` reads on a board of `count` stages (a negative one counts from the last). */
export const copiedStage = (stage: number, count: number) => (stage < 0 ? count + stage : stage);

/** A built stage's effects; a copy of a neighbour's stage is that stage's (never another copy). */
export function stageEffects(lib: Lib, s: State, seat: SeatId, i: number): Eff[] {
  const effs = stageDefs(lib, s.players[seat]!)[i]?.eff ?? [];
  return effs.flatMap((e) => {
    if (e.k !== "copyStage") return [e];
    const c = e as Extract<Eff, { k: "copyStage" }>;
    const o = s.players[c.side === "L" ? leftOf(s, seat) : rightOf(s, seat)]!;
    const defs = stageDefs(lib, o);
    return (defs[copiedStage(c.stage, defs.length)]?.eff ?? []).filter((x) => x.k !== "copyStage");
  });
}

export type Src = SWColor | "wonder" | "extra";
/** Every effect a seat has, with where it comes from: cards, its board, built stages, and extras in play. */
export function effectsOf(lib: Lib, s: State, seat: SeatId): { eff: Eff; src: Src }[] {
  const p = s.players[seat]!;
  const out: { eff: Eff; src: Src }[] = [];
  for (const k of p.cards) { const d = cardOf(lib, k); for (const eff of d.eff) out.push({ eff, src: d.color }); }
  for (const eff of wonderOf(lib, p.wonder).board?.[p.side] ?? []) out.push({ eff, src: "wonder" });
  for (const i of p.built) for (const eff of stageEffects(lib, s, seat, i)) out.push({ eff, src: "wonder" });
  for (const x of p.extras) if (x.off === null) for (const eff of x.eff) out.push({ eff, src: "extra" });
  return out;
}
export const effs = (lib: Lib, s: State, seat: SeatId): Eff[] => effectsOf(lib, s, seat).map((e) => e.eff);
export const has = (lib: Lib, s: State, seat: SeatId, k: string) => effs(lib, s, seat).some((e) => e.k === k);
type K<T extends Eff["k"]> = Extract<Eff, { k: T }>;
export const ofKind = <T extends Eff["k"]>(list: Eff[], k: T): K<T>[] => list.filter((e) => e.k === k) as K<T>[];

// ---- Payment ---------------------------------------------------------------------------------------------

interface PayCtx {
  /** Units the seat makes itself: each string is one unit of any one of its letters. */
  own: string[];
  left: string[];
  right: string[];
  price: { L: { [r: string]: number }; R: { [r: string]: number } };
  /** Free units of any resource. */
  discount: number;
  /** Units of any resource bought from the bank at 1 coin. */
  bank: number;
  /** Coins off the first unit bought from a side. */
  rebate: { L: number; R: number };
  /** The resource cost is waived. */
  waive: boolean;
}

/** What a seat's neighbours could sell it: brown and grey units, and the board's starting resource. */
export function tradable(lib: Lib, s: State, seat: SeatId): string[] {
  const p = s.players[seat]!;
  const out: string[] = [];
  for (const k of p.cards) {
    const d = cardOf(lib, k);
    if (d.color === "brown" || d.color === "grey") for (const e of ofKind(d.eff, "prod")) if (e.trade) out.push(e.any);
  }
  const base = wonderOf(lib, p.wonder).base;
  if (base) out.push(base);
  return out;
}

function payCtx(lib: Lib, s: State, seat: SeatId, item: Item): PayCtx {
  const p = s.players[seat]!;
  const all = effs(lib, s, seat);
  const own = ofKind(all, "prod").map((e) => e.any);
  const base = wonderOf(lib, p.wonder).base;
  if (base) own.push(base);
  const made = new Set(tradable(lib, s, seat).join("").split(""));
  if (all.some((e) => e.k === "warehouse") && made.size) own.push([...made].sort(compareStrings).join(""));
  if (all.some((e) => e.k === "blackMarket")) { const m = RES.split("").filter((r) => !made.has(r)).join(""); if (m) own.push(m); }
  const price = { L: {} as { [r: string]: number }, R: {} as { [r: string]: number } };
  for (const r of RES) { price.L[r] = 2; price.R[r] = 2; }
  for (const e of ofKind(all, "trade")) {
    for (const r of e.kind === "raw" ? RAW : "GLP") {
      if (e.side !== "R") price.L[r] = 1;
      if (e.side !== "L") price.R[r] = 1;
    }
  }
  const rebate = { L: 0, R: 0 };
  for (const e of ofKind(all, "dock")) rebate[e.side] += 1;
  return {
    own, left: tradable(lib, s, leftOf(s, seat)), right: tradable(lib, s, rightOf(s, seat)), price,
    discount: ofKind(all, "discount").filter((e) => e.color === item.color).length,
    bank: all.some((e) => e.k === "bank") ? 1 : 0,
    rebate, waive: item.type === "stage" && all.some((e) => e.k === "noWonderRes"),
  };
}

/** Every cheapest way to pay `res` (Pareto-minimal in left, right and bank coins), at most `budget` in all. */
export function plans(res: string, pc: PayCtx, budget: number): Plan[] {
  if (pc.waive || res === "") return budget >= 0 ? [{ L: 0, R: 0, B: 0 }] : [];
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
export const parsePlan = (id: Step | undefined): Plan => {
  const m = /^pay:(\d+),(\d+),(\d+)$/.exec(String(id ?? ""));
  return m ? { L: Number(m[1]), R: Number(m[2]), B: Number(m[3]) } : { L: 0, R: 0, B: 0 };
};

// ---- What a seat may do with a card ----------------------------------------------------------------------

/** The base's pick phase running now ("turn1" ... "turn7", "last"), or null. */
const phaseNow = (s: State): string | null => (s.run ? s.run.order[s.run.at] ?? null : null);

/**
 * Why building this card from the hand is free, or null: a colour made free (once an age or always), or the
 * 2nd edition's Olympia (the first card of a colour in the city; the card played on an age's first turn; the
 * card played from a hand of two, the age's last turn). The hand still holds the card while this is asked, at
 * the prompt and at the resolve alike.
 */
function freeFor(lib: Lib, s: State, seat: SeatId, item: Item): string | null {
  if (item.type !== "card") return null;
  const all = effs(lib, s, seat);
  for (const e of ofKind(all, "freeColor")) {
    if (e.color !== item.color) continue;
    if (!e.perAge) return `free ${e.color}`;
    if (s.players[seat]!.freeUsed[`color:${e.color}`] !== s.age) return `free ${e.color}, once an age`;
  }
  const p = s.players[seat]!;
  const ph = phaseNow(s);
  if (all.some((e) => e.k === "freeFirstColor") && !(p.colors[item.color] ?? 0)) return `free as the first ${item.color} card`;
  if (all.some((e) => e.k === "freeFirstCard") && ph === "turn1") return "free as the first card of the age";
  if (all.some((e) => e.k === "freeLastCard") && ph !== null && /^turn\d+$/.test(ph) && p.hand.items.length === 2) return "free as the last card of the age";
  return null;
}

/** The coin and resource cost of an item for a seat, and whether it's free. */
function waysFor(lib: Lib, s: State, seat: SeatId, item: Item, cost: string): { plans: Plan[]; coins: number; free: string | null } {
  const p = s.players[seat]!;
  const free = freeFor(lib, s, seat, item);
  const { coins, res } = parseCost(cost);
  if (free) return { plans: [{ L: 0, R: 0, B: 0 }], coins: 0, free };
  if (coins > p.coins) return { plans: [], coins, free: null };
  return { plans: plans(res, payCtx(lib, s, seat, item), p.coins - coins), coins, free: null };
}

export function cardItem(d: SWCardDef, free: string | null = null): Item {
  return { type: "card", name: d.name, age: d.age, color: d.color, free };
}

export function cardWays(lib: Lib, s: State, seat: SeatId, key: string): Way[] {
  const p = s.players[seat]!;
  const d = cardOf(lib, key);
  const ways: Way[] = [];
  const owned = p.cards.some((k) => keyName(k) === d.name);
  const chained = d.from.some((f) => p.cards.some((k) => keyName(k) === f));
  const none = { L: 0, R: 0, B: 0 };
  if (owned) ways.push({ id: "build", label: `Build ${d.name}`, disabled: "you already have one", plans: [], coins: 0 });
  else if (chained) ways.push({ id: "build", label: `Build ${d.name} free (chain)`, disabled: null, plans: [none], coins: 0 });
  else {
    const w = waysFor(lib, s, seat, cardItem(d), d.cost);
    ways.push({ id: "build", label: `Build ${d.name}${w.free ? ` (${w.free})` : ""}`, disabled: w.plans.length ? null : "you can't pay for it", plans: w.plans, coins: w.coins });
  }
  ways.push(...stageWays(lib, s, seat));
  ways.push({ id: "sell", label: "Discard for 3 coins", disabled: null, plans: [none], coins: 0 });
  return ways;
}

/** The free reason a card's build way gives, as resolved: chain, a free colour or Olympia's. */
export function wayFree(lib: Lib, s: State, seat: SeatId, key: string, way: string): string | null {
  if (way !== "build") return null;
  const p = s.players[seat]!;
  const d = cardOf(lib, key);
  if (d.from.some((f) => p.cards.some((k) => keyName(k) === f))) return "chain";
  return freeFor(lib, s, seat, cardItem(d));
}

export function openStages(lib: Lib, p: Player): number[] {
  const defs = stageDefs(lib, p);
  if (wonderOf(lib, p.wonder).anyOrder) return defs.map((_, i) => i).filter((i) => !p.built.includes(i));
  return p.built.length < defs.length ? [p.built.length] : [];
}

export function stageWays(lib: Lib, s: State, seat: SeatId): Way[] {
  const p = s.players[seat]!;
  const open = openStages(lib, p);
  if (!open.length) return [{ id: "wonder", label: "Build a wonder stage", disabled: "your wonder is finished", plans: [], coins: 0 }];
  return open.map((i) => {
    const item: Item = { type: "stage", name: `${p.wonder} stage ${i + 1}`, age: s.age, color: "wonder", free: null };
    const printed = stageDefs(lib, p)[i]!.cost;
    // "?": a copy of a neighbour's stage, at the cost fixed at setup (SWStageDef).
    const w = waysFor(lib, s, seat, item, printed === "?" ? p.stageCosts[i] ?? "" : printed);
    return { id: open.length > 1 ? `wonder:${i}` : "wonder", label: `Build ${p.wonder} stage ${i + 1}`, disabled: w.plans.length ? null : "you can't pay for it", plans: w.plans, coins: w.coins };
  });
}
export const stageOf = (p: Player, wayId: string) => (wayId.includes(":") ? Number(wayId.slice(wayId.indexOf(":") + 1)) : p.built.length);

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
export const chosenPlan = (way: Way, rest: Step[]): Plan => (rest.length > 1 ? parsePlan(rest[1]) : way.plans[0] ?? { L: 0, R: 0, B: 0 });

// ---- Coins and building ----------------------------------------------------------------------------------

export function gain(s: State, seat: SeatId, n: number): State {
  if (n <= 0) return s;
  return { ...setP(s, seat, (p) => ({ ...p, coins: p.coins + n })), gained: { ...s.gained, [seat]: (s.gained[seat] ?? 0) + n } };
}

/** Pays a plan: coins to the bank, and to each neighbour and the bank; records who bought from whom. */
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

export function perCount(s: State, seat: SeatId, e: { who: SWWho; colors?: string[]; stages?: true; defeats?: true; victories?: true }): number {
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

export const cityOf = (lib: Lib, s: State, seat: SeatId): SWCityCard[] =>
  s.players[seat]!.cards.map((key) => { const d = cardOf(lib, key); return { key, color: d.color, eff: d.eff }; });

/** Immediate effects of something just built (base kinds), then the onBuild point for the add-ons' kinds. */
export function built(lib: Lib, s: State, seat: SeatId, list: Eff[], item: Item): State {
  for (const e of list) {
    if (e.k === "coins") s = gain(s, seat, e.n);
    else if (e.k === "perCoins") s = gain(s, seat, e.n * perCount(s, seat, e));
    else if (e.k === "nbrCoins") for (const x of nbrs(s, seat)) s = gain(s, x, e.n);
    else if (e.k === "discardBuild") s = { ...s, pending: [...s.pending, { seat, kind: "discardBuild" }] };
  }
  const ops = lib.pts.onBuild(s, { seat, item, effs: list, city: cityOf(lib, s, seat) });
  return applyOps(lib, s, ops);
}

/** Builds a card into a city (already paid for), with its effects. */
export function buildCard(lib: Lib, s: State, seat: SeatId, key: string, free: string | null): State {
  const d = cardOf(lib, key);
  s = setP(s, seat, (p) => ({ ...p, cards: [...p.cards, key], colors: { ...p.colors, [d.color]: (p.colors[d.color] ?? 0) + 1 } }));
  if (free?.endsWith("once an age")) s = setP(s, seat, (p) => ({ ...p, freeUsed: { ...p.freeUsed, [`color:${d.color}`]: s.age } }));
  s = say(s, `${seat} builds ${d.name}${free ? ` (free: ${free})` : ""}.`);
  return built(lib, s, seat, d.eff, cardItem(d, free));
}

/** Builds a wonder stage (already paid for) with `marker` under it, with its effects. */
export function buildStage(lib: Lib, s: State, seat: SeatId, st: number, marker: string): State {
  const p = s.players[seat]!;
  s = setP(s, seat, (pp) => ({ ...pp, built: [...pp.built, st], markers: withItems(pp.markers, [...pp.markers.items, marker]) }));
  s = say(s, `${seat} builds stage ${st + 1} of ${p.wonder}.`);
  return built(lib, s, seat, stageEffects(lib, s, seat, st), { type: "stage", name: `${p.wonder} stage ${st + 1}`, age: s.age, color: "wonder", free: null });
}

/** Applies an add-on's operations in order (11 §10 "What an add-on may change"). */
export function applyOps(lib: Lib, s: State, ops: readonly Op[]): State {
  for (const o of ops) {
    const seat = String((o as { seat?: string }).seat ?? "");
    if (o.op !== "log" && !s.players[seat]) throw new Error(`an operation ${o.op} for ${seat}, who isn't a seat`);
    switch (o.op) {
      case "coins":
        s = o.n >= 0 ? gain(s, seat, o.n) : setP(s, seat, (p) => ({ ...p, coins: Math.max(0, p.coins + o.n) }));
        break;
      case "pay":
        s = pay(s, seat, o.coins, { L: o.L, R: o.R, B: o.B });
        if (s.players[seat]!.coins < 0) throw new Error(`${seat} can't pay ${o.coins + o.L + o.R + o.B} coins`);
        break;
      case "loss":
        s = { ...s, losses: { ...s.losses, [seat]: (s.losses[seat] ?? 0) + o.n } };
        break;
      case "clearLoss": {
        const losses = { ...s.losses };
        delete losses[seat];
        s = { ...s, losses };
        break;
      }
      case "grant":
        s = setP(s, seat, (p) => ({ ...p, extras: [...p.extras, { ...o.extra, off: null }] }));
        s = built(lib, s, seat, o.extra.eff, { type: "leader", name: o.extra.name, age: s.age, color: "leader", free: null });
        break;
      case "off":
        s = setP(s, seat, (p) => ({ ...p, extras: p.extras.map((x) => (x.name === o.name && x.off === null ? { ...x, off: o.why } : x)) }));
        break;
      case "stage":
        if (!openStages(lib, s.players[seat]!).includes(o.stage)) throw new Error(`${seat} can't build stage ${o.stage + 1}`);
        s = buildStage(lib, s, seat, o.stage, o.marker);
        break;
      case "log":
        s = say(s, String(o.text));
        break;
      default:
        throw new Error(`no operation ${String((o as { op: string }).op)}`);
    }
  }
  return s;
}

/** Settles the coin losses the base's way (pay what you can), unless an add-on fills the `lossRule` slot. */
export function settleLosses(lib: Lib, s: State): State {
  if (!Object.keys(s.losses).length || lib.pts.lossRule(s) !== "pay") return s;
  for (const x of s.seats) {
    const n = s.losses[x] ?? 0;
    if (n > 0) s = setP(s, x, (p) => ({ ...p, coins: Math.max(0, p.coins - n) }));
  }
  return { ...s, losses: {} };
}

// ---- Military ---------------------------------------------------------------------------------------------

export function military(lib: Lib, s: State): State {
  const value = s.age === 1 ? 1 : s.age === 2 ? 3 : 5;
  const seats = lib.pts.conflictSeats(s, s.seats.slice()).filter((x) => s.seats.includes(x));
  const own: { [seat: string]: number } = {};
  for (const x of s.seats) own[x] = ofKind(effs(lib, s, x), "shields").reduce((t, e) => t + e.n, 0);
  const shields = lib.pts.shields(s, own);
  const pairs: [SeatId, SeatId][] = [];
  if (seats.length === 2) pairs.push([seats[0]!, seats[1]!]);
  else if (seats.length > 2) for (let i = 0; i < seats.length; i++) pairs.push([seats[i]!, seats[(i + 1) % seats.length]!]);
  let fights: SWConflict[] = pairs.map(([a, b]) => {
    const sa = shields[a] ?? 0, sb = shields[b] ?? 0;
    const winner = sa > sb ? a : sb > sa ? b : null;
    // Team play: teammates do not fight; every other fight is worth two tokens.
    const team = Object.keys(s.partner).length > 0;
    const tokens = team ? (s.partner[a] === b ? 0 : 2) : 1;
    return { a, b, winner, value, tokens, defeatTo: winner === null ? null : winner === a ? b : a, bonus: {} };
  });
  fights = lib.pts.conflicts(s, fights);
  const log: string[] = [];
  for (const c of fights) {
    if (c.tokens <= 0) continue;
    const sa = shields[c.a] ?? 0, sb = shields[c.b] ?? 0;
    if (c.winner === null) { log.push(`${c.a} and ${c.b} tie (${sa} shields each)`); continue; }
    const w = c.winner, loser = w === c.a ? c.b : c.a, to = c.defeatTo ?? loser;
    for (let t = 0; t < c.tokens; t++) {
      s = setP(s, w, (p) => ({ ...p, victories: [...p.victories, c.value] }));
      s = setP(s, to, (p) => ({ ...p, defeats: p.defeats + 1 }));
    }
    for (const x of Object.keys(c.bonus).sort(compareStrings)) if (s.players[x]) s = gain(s, x, c.bonus[x]!);
    log.push(`${w} beats ${loser} (${Math.max(sa, sb)} to ${Math.min(sa, sb)} shields)`);
  }
  return say(s, `Age ${s.age} conflicts: ${log.join("; ") || "none"}.`);
}

// ---- Scoring ----------------------------------------------------------------------------------------------

interface SciCounts { c: number; g: number; t: number; wild: number; masks: number; pool: { c: number; g: number; t: number } }

/** Symbols, wilds and masks: a mask copies the symbol of one green card next door, each mask a different card. */
function sciCounts(lib: Lib, s: State, seat: SeatId, list: Eff[]): SciCounts {
  const r: SciCounts = { c: 0, g: 0, t: 0, wild: 0, masks: 0, pool: { c: 0, g: 0, t: 0 } };
  for (const e of list) {
    if (e.k === "sci") { if (e.s === "*") r.wild++; else r[e.s]++; }
    if (e.k === "mask") r.masks++;
  }
  for (const x of nbrs(s, seat)) for (const k of s.players[x]!.cards) {
    const d = cardOf(lib, k);
    if (d.color === "green") for (const e of ofKind(d.eff, "sci")) if (e.s !== "*") r.pool[e.s]++;
  }
  return r;
}

/** Best science score over every wild and mask choice; `setBonus` per set of three. */
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

const catOf = (src: Src) => (src === "wonder" ? "wonder" : src === "extra" ? "leaders" : src === "blue" ? "civic" : src === "yellow" ? "commerce" : src === "purple" ? "guilds" : src === "black" ? "cities" : "other");

/** A seat's own lines: military, treasury, card and stage points, science. */
function baseLines(lib: Lib, s: State, seat: SeatId): Line[] {
  const p = s.players[seat]!;
  const lines: Line[] = [];
  const add = (cat: string, vp: number) => { if (vp) lines.push({ cat, vp }); };
  add("military", p.victories.reduce((a, b) => a + b, 0) - p.defeats);
  add("treasury", idiv(p.coins, 3));
  const all = effectsOf(lib, s, seat);
  for (const { eff, src } of all) {
    if (eff.k === "vp") add(catOf(src), eff.n);
    else if (eff.k === "perVP") add(catOf(src), eff.n * perCount(s, seat, eff));
    else if (eff.k === "wonderDoneVP" && openStages(lib, p).length === 0) add(catOf(src), eff.n);
  }
  const list = all.map((e) => e.eff);
  add("science", sciScore(sciCounts(lib, s, seat, list), 7 + ofKind(list, "sciSetBonus").reduce((t, e) => t + e.n, 0)));
  return lines;
}

export const total = (lines: Line[]) => lines.reduce((t, l) => t + l.vp, 0);

function scoreArgs(lib: Lib, s: State): SWScoreArgs {
  const effects: { [seat: string]: Eff[] } = {}, city: { [seat: string]: SWCityCard[] } = {}, markers: { [seat: string]: string[] } = {};
  for (const x of s.seats) {
    effects[x] = effs(lib, s, x);
    city[x] = cityOf(lib, s, x);
    markers[x] = contents(s.players[x]!.markers).map((k) => (k === "leader" ? "leader" : cardOf(lib, k).color));
  }
  return { effects, city, markers };
}

/** Every seat's scoring lines: the base's, then each add-on's (the `score` point). */
export function scoreAll(lib: Lib, s: State): { [seat: string]: Line[] } {
  const out: { [seat: string]: Line[] } = {};
  for (const x of s.seats) out[x] = baseLines(lib, s, x);
  for (const part of lib.pts.score(s, scoreArgs(lib, s))) for (const x of s.seats) for (const l of part[x] ?? []) if (l.vp) out[x]!.push({ cat: String(l.cat), vp: l.vp });
  return out;
}
