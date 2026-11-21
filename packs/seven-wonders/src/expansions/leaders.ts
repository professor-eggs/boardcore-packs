// Leaders (the `leaders` option; 1st edition). Before Age I each seat drafts four leaders (three simultaneous
// hidden picks, passing the rest on; the last card is kept); at the start of each age it recruits one (a
// simultaneous hidden pick before the deal): it pays the leader's cost and the leader's effects join its public
// extras, or it uses the leader to build a wonder stage or discards it for 3 coins. Roma, four guilds and 6
// starting coins come with it. Questions to one seat (the Courtesans' Guild, Roma's extra leader) are raised by
// the build and asked with the base's own; Esteban (a promo) freezes the passing of hands for one turn. The
// leaders' hands and the box are hidden (`state.leaders`); `resample` redraws them.
import { shuffle, type InterruptKind, type Option, type Phase, type Prompt, type SeatId, type Step } from "@boardcore/pack-sdk";
import { askPending, buildOpenStage, gain, grant, parsePlan, payFor, planId, say, stageOf, stageWays, type Lib, type State } from "../engine";
import type { Expansion, Part } from "../kernel";
import { LEADER, LEADERS, LEADERS_GUILDS, ROMA, type LeaderDef } from "./leaders-data";

const DRAFT = 4;
/** The coins every city starts with when Leaders is on (3 without). */
export const LEADERS_START_COINS = 6;

type Hands = SWHands;
const def = (name: string): LeaderDef => {
  const l = LEADER.get(name);
  if (!l) throw new Error(`no leader ${name}`);
  return l;
};
const without = (xs: readonly string[], x: string) => { const i = xs.indexOf(x); return i < 0 ? xs.slice() : [...xs.slice(0, i), ...xs.slice(i + 1)]; };
const roman = (age: number) => ["", "I", "II", "III"][age] ?? String(age);
const rightOf = (seats: readonly SeatId[], x: SeatId) => seats[(seats.indexOf(x) + 1) % seats.length]!;
const leftOf = (seats: readonly SeatId[], x: SeatId) => seats[(seats.indexOf(x) + seats.length - 1) % seats.length]!;
const nbrs = (seats: readonly SeatId[], x: SeatId) => [...new Set([leftOf(seats, x), rightOf(seats, x)])].filter((y) => y !== x);
const own = (s: Pick<State, "leaders">): SWLeaders => s.leaders!;
const put = (s: State, part: Part<SWLeaders>): State => ({ ...s, leaders: { ...own(s), ...part } });

/** What a seat shows: its board, extras and coins. */
type Shown = Pick<SWPlayer, "wonder" | "side" | "extras" | "coins">;
const activeEffs = (p: Shown): SWEff[] => p.extras.filter((x) => x.off === null).flatMap((x) => x.eff);
const boardEffs = (p: Shown): SWEff[] => (p.wonder === ROMA.id ? ROMA.board![p.side === "B" ? "B" : "A"] : []);
const count = (list: SWEff[], k: string) => list.filter((e) => e.k === k).length;

/** A leader's recruiting cost for a seat: Maecenas makes it free; Roma makes it cheaper (next door too). */
export function costOf(players: { [seat: string]: Shown }, seats: readonly SeatId[], seat: SeatId, name: string): number {
  const mine = [...activeEffs(players[seat]!), ...boardEffs(players[seat]!)];
  if (count(mine, "leaders:free")) return 0;
  let c = def(name).cost;
  for (const e of mine) if (e.k === "leaders:cost") c -= Number(e.self);
  for (const x of nbrs(seats, seat)) for (const e of boardEffs(players[x]!)) if (e.k === "leaders:cost") c -= Number(e.nbr);
  return Math.max(0, c);
}
const coinsIn = (cost: string) => (/^\$(\d+)/.exec(cost) ? Number(/^\$(\d+)/.exec(cost)![1]) : 0);
const stevieCost = (cost: string) => coinsIn(cost) + cost.replace(/^\$\d+/, "").length;
const opt = (id: string, label: string, disabled?: string | null): Option => (disabled ? { id, label, disabled } : { id, label });
const grantOf = (name: string): SWExtra => ({ from: "leaders", name, cost: def(name).cost, eff: def(name).eff, off: null });

/** The ways to play a leader in a recruitment: recruit, build a wonder stage with it (Stevie: paying coins), discard. */
function leaderWays(lib: Lib, s: State, seat: SeatId, name: string): SWWay[] {
  const p = s.players[seat]!;
  const none = [{ L: 0, R: 0, B: 0 }];
  const cost = costOf(s.players, s.seats, seat, name);
  const stages = stageWays(lib, s, seat);
  const ways: SWWay[] = [{ id: "recruit", label: `Recruit ${name} (${coins(cost)})`, disabled: cost > p.coins ? "not enough coins" : null, plans: none, coins: cost }];
  for (const w of stages) ways.push({ ...w, label: `${w.label} with this leader` });
  if (count(def(name).eff, "leaders:stevie")) {
    for (const w of stages) {
      if (w.disabled === "your wonder is finished") continue;
      const i = stageOf(p, w.id);
      const c = stevieCost(p.stageCosts[i] ?? "");
      ways.push({ id: `stevie:${i}`, label: `Build ${p.wonder} stage ${i + 1} with Stevie (${coins(c)})`, disabled: c > p.coins ? "not enough coins" : null, plans: none, coins: c });
    }
  }
  ways.push({ id: "sell", label: "Discard for 3 coins", disabled: null, plans: none, coins: 0 });
  return ways;
}

function effText(e: SWEff): string {
  switch (e.k) {
    case "vp": return `${e.n} VP`;
    case "coins": return `${coins(e.n)} now`;
    case "shields": return `${e.n} shield${e.n === 1 ? "" : "s"}`;
    case "sci": return "a science symbol";
    case "perVP": return `${e.n} VP per ${e.stages ? "wonder stage" : `${(e.colors ?? []).join("/")} card`}`;
    case "discount": return `${e.color === "wonder" ? "wonder stages" : `${e.color} cards`} cost one resource less`;
    case "sciSetBonus": return `${e.n} more VP per science set`;
    case "bank": return "buy a resource from the bank for 1 coin each turn";
    case "freeColor": return `${e.color} cards free${e.perAge ? " once an age" : ""}`;
    case "discardBuild": return "build a discarded card free";
    case "leaders:vp": return LEADER_VP[String(e.what)] ?? "VP at the end";
    case "leaders:hatshepsut": return "1 coin for each resource bought from a neighbour, once a neighbour a turn";
    case "leaders:free": return "recruit later leaders free";
    case "leaders:nero": return "2 coins for each victory token won";
    case "leaders:tomyris": return "your defeat tokens go to the neighbour who beat you";
    case "leaders:vitruvius": return "2 coins for each card built free by a chain";
    case "leaders:xenophon": return "2 coins for each yellow card built";
    case "leaders:stevie": return "build a wonder stage paying 1 coin per resource";
    case "leaders:esteban": return "once a game, hold the hands for a turn: everyone plays a second card";
    case "leaders:courtesan": return "copy a neighbour's leader";
    case "leaders:perNbrLeader": return `${e.n} VP per leader your neighbours have`;
    case "cities:berenice": return "1 coin at the end of each turn you took coins from the bank";
    case "cities:diplomacy": return "a diplomacy token";
    case "cities:semiramis": return "your defeat tokens count as shields";
    case "cities:diocletian": return "2 coins for each black card built";
    default: return "a special effect";
  }
}
/** What a leader's `leaders:vp` scores, in words. */
export const LEADER_VP: { [what: string]: string } = {
  victories: "1 VP per victory token", justinian: "3 VP per set of a red, a blue and a green card",
  coins3: "1 VP per 3 coins", plato: "7 VP per set of one card of each of the seven colours", louis: "7 VP minus 1 per victory token",
};
const coins = (n: number) => `${n} coin${n === 1 ? "" : "s"}`;
export const leaderText = (name: string) => `${name} (${coins(def(name).cost)}): ${def(name).eff.map(effText).join("; ")}`;

function recruitPrompt(lib: Lib, s: State, seat: SeatId, partial: Step[], extra: boolean): Prompt | null {
  const hand = own(s).hands[seat] ?? [];
  if (partial.length === 0) {
    const options = hand.map((l) => opt(`l:${l}`, leaderText(l), extra && costOf(s.players, s.seats, seat, l) > s.players[seat]!.coins ? "not enough coins" : null));
    if (extra) options.push(opt("skip", "Recruit no one"));
    return { kind: "pick", label: extra ? "Roma: put another leader into play" : `Recruitment for Age ${roman(s.age + 1)}: choose a leader`, options };
  }
  if (partial[0] === "skip" || extra) return null;
  const name = String(partial[0]).slice(2);
  if (!hand.includes(name)) return null;
  const ways = leaderWays(lib, s, seat, name);
  if (partial.length === 1) return { kind: "pick", label: `Play ${name}`, options: ways.map((w) => opt(w.id, w.label, w.disabled)) };
  const way = ways.find((w) => w.id === partial[1]);
  if (!way || partial.length > 2) return null;
  if (way.plans.length === 1 && way.plans[0]!.L + way.plans[0]!.R + way.plans[0]!.B === 0) return null;
  return { kind: "pick", label: "How to pay", options: way.plans.map((p) => opt(planId(p), `Pay ${p.L} left, ${p.R} right, ${p.B} bank${way.coins ? ` (+${way.coins} coins)` : ""}`)) };
}

/**
 * One pick of the draft, before Age I's deal: keep a leader, pass the rest to the right; the last pick keeps the
 * card left too. Nobody holds a draft hand in Ages II and III, so the phase is passed over there.
 */
export const draftPhase = (k: number): Phase<State> => ({
  id: `draft${k}`, kind: "pick",
  seats: (s) => s.seats.filter((x) => (own(s).draft[x] ?? []).length > 1),
  choices: (s, seat, partial) => {
    if (partial.length) return null;
    return { kind: "pick", label: `Leader draft, pick ${k} of ${DRAFT - 1}`, options: (own(s).draft[seat] ?? []).map((l) => opt(`l:${l}`, leaderText(l))) };
  },
  resolve: (s, picks) => {
    if (!Object.keys(picks).length) return s;
    const sl = own(s);
    const hands = { ...sl.hands }, left: Hands = {};
    for (const x of s.seats) {
      const name = String(picks[x]?.[0] ?? "").slice(2);
      hands[x] = [...(hands[x] ?? []), name];
      left[x] = without(sl.draft[x] ?? [], name);
    }
    const draft: Hands = {};
    for (const x of s.seats) draft[x] = left[leftOf(s.seats, x)]!;
    if (k === DRAFT - 1) for (const x of s.seats) { hands[x] = [...hands[x]!, ...draft[x]!]; draft[x] = []; }
    return say(put(s, { hands, draft }), k === DRAFT - 1 ? "The leader draft is over." : `Leader draft: pick ${k} made.`);
  },
});

/**
 * At the start of each age, before the age's cards are dealt: a seat chooses its leader without seeing its age
 * hand. The base's `age` is still the last age's here. Payments first, then the leaders and stages go down, then
 * the coins; the questions they raise are asked before the deal.
 */
export const recruitPhase = (lib: Lib): Phase<State> => ({
  id: "recruit", kind: "pick",
  seats: (s) => s.seats.filter((x) => (own(s).hands[x] ?? []).length > 0),
  choices: (s, seat, partial) => recruitPrompt(lib, s, seat, partial, false),
  resolve: (s0, picks, ctx) => {
    let sl = own(s0);
    type Change = (s: State) => State;
    const pays: Change[] = [], plays: Change[] = [], sells: Change[] = [];
    for (const x of s0.seats) {
      const path = picks[x];
      if (!path) continue;
      const name = String(path[0]).slice(2), way = String(path[1]);
      const p = s0.players[x]!;
      sl = { ...sl, hands: { ...sl.hands, [x]: without(sl.hands[x] ?? [], name) } };
      if (way === "recruit") {
        const cost = costOf(s0.players, s0.seats, x, name);
        pays.push((s) => payFor(s, x, cost, { L: 0, R: 0, B: 0 }));
        plays.push((s) => grant(lib, say(s, `${x} recruits ${name}.`), x, grantOf(name)));
        continue;
      }
      sl = { ...sl, out: { ...sl.out, [x]: [...(sl.out[x] ?? []), name] } };
      if (way === "sell") { sells.push((s) => gain(say(s, `${x} discards a leader for 3 coins.`), x, 3)); continue; }
      const stevie = way.startsWith("stevie:");
      const st = stageOf(p, way);
      const plan = stevie ? { L: 0, R: 0, B: 0 } : parsePlan(path[2]);
      const cost = stevie ? stevieCost(p.stageCosts[st] ?? "") : coinsIn(p.stageCosts[st] ?? "");
      pays.push((s) => payFor(s, x, cost, plan));
      plays.push((s) => buildOpenStage(lib, s, x, st, "leader"));
      // Hatshepsut: buying from a neighbour here counts too. The deal and the first turn clear the purchases
      // before any end of turn, so it is paid now.
      const hat = count(activeEffs(p), "leaders:hatshepsut");
      const sides = (plan.L ? 1 : 0) + (plan.R ? 1 : 0);
      if (hat && sides) sells.push((s) => gain(s, x, hat * sides));
    }
    // Before Age III the leader left in each hand goes out of the game.
    if (s0.age + 1 === 3) {
      const out = { ...sl.out }, hands = { ...sl.hands };
      for (const x of s0.seats) { out[x] = [...(out[x] ?? []), ...(hands[x] ?? [])]; hands[x] = []; }
      sl = { ...sl, out, hands };
    }
    let s: State = { ...s0, leaders: sl };
    for (const f of [...pays, ...plays, ...sells]) s = f(s);
    return askPending(lib, s, ctx);
  },
});

/** A leader in play the Courtesans' Guild may copy: never Esteban (7w-1, 7w-3). */
const copyable = (e: SWExtra) => e.from === "leaders" && e.off === null && !count(e.eff, "leaders:esteban");
/** The leaders next door a seat may copy, the left neighbour's first. */
export const copies = (s: Pick<State, "seats" | "players">, seat: SeatId) =>
  nbrs(s.seats, seat).flatMap((y) => s.players[y]!.extras.filter(copyable).map((e) => ({ id: `c:${y}:${e.name}`, from: y, name: e.name })));

/** Esteban: before a turn, his owner may freeze the passing of hands after it (once a game). */
export const freezePhase = (n: number): Phase<State> => ({
  id: `freeze${n}`, kind: "pick",
  seats: (s) => {
    const sl = own(s);
    if (sl.frozen && sl.frozen.age === s.age) return [];
    return s.seats.filter((x) => !sl.used.includes(x) && count(activeEffs(s.players[x]!), "leaders:esteban") > 0 && s.players[x]!.hand.items.length >= 3);
  },
  choices: (_s, _seat, partial) => (partial.length ? null : { kind: "pick", label: "Esteban: freeze the passing of hands after this turn?", options: [opt("freeze", "Freeze it (once a game)"), opt("pass", "Not now")] }),
  resolve: (s, picks) => {
    const freezers = s.seats.filter((x) => picks[x]?.[0] === "freeze");
    if (!freezers.length) return s;
    return say(put(s, { used: [...own(s).used, ...freezers], frozen: { age: s.age, turn: n } }), `${freezers.join(", ")} freeze${freezers.length === 1 ? "s" : ""} the passing of hands (Esteban).`);
  },
});

const questions = (lib: Lib): { [kind: string]: InterruptKind<State> } => ({
  // The Courtesans' Guild: copy a leader next door (its lasting effects, not what it gave once).
  copy: {
    choices: (s, q, partial) => {
      if (partial.length) return null;
      return { kind: "pick", label: "Courtesans' Guild: copy a neighbour's leader", options: copies(s, q.seat).map((c) => opt(c.id, `Copy ${c.from}'s ${leaderText(c.name)}`)) };
    },
    answer: (s, q, action, ctx) => {
      const name = String(action[0]).split(":").slice(2).join(":");
      const eff = def(name).eff.filter((e) => e.k !== "coins" && e.k !== "discardBuild" && e.k !== "cities:diplomacy");
      s = say(s, `${q.seat} copies ${name} with the Courtesans' Guild.`);
      return askPending(lib, grant(lib, s, q.seat, { from: "leaders:copy", name: `${name} (copy)`, cost: 0, eff, off: null }), ctx, true);
    },
  },
  // Roma B: put one more leader from the hand into play, paying for it.
  extra: {
    choices: (s, q, partial) => recruitPrompt(lib, s, q.seat, partial, true),
    answer: (s, q, action, ctx) => {
      const id = String(action[0]);
      if (id === "skip") return s;
      const name = id.slice(2), seat = q.seat, sl = own(s);
      const cost = costOf(s.players, s.seats, seat, name);
      s = payFor(put(s, { hands: { ...sl.hands, [seat]: without(sl.hands[seat] ?? [], name) } }), seat, cost, { L: 0, R: 0, B: 0 });
      return askPending(lib, grant(lib, say(s, `${seat} recruits ${name} (Roma).`), seat, grantOf(name)), ctx, true);
    },
  },
});

const sizes = (h: Hands) => Object.fromEntries(Object.keys(h).sort().map((x) => [x, h[x]!.length]));

export const leaders: Expansion = {
  id: "leaders",
  cards: LEADERS_GUILDS,
  wonders: [ROMA],
  decks: (ids) => ids.map((d, i) => (i === 2 ? [...d, ...LEADERS_GUILDS.map((c) => c.id)] : d)),
  // Four leaders a seat for the draft, from the leaders of the sets in the game; the rest stay in the box.
  setup: (s, options, rng) => {
    const pool = shuffle(rng, LEADERS.filter((l) => l.set === "leaders" || (l.set === "cities" && s.sets.includes("cities")) || (l.set === "promo" && options.leaderPromos === true)).map((l) => l.name));
    const draft: Hands = {}, hands: Hands = {}, out: Hands = {};
    s.seats.forEach((x, i) => { draft[x] = pool.slice(i * DRAFT, (i + 1) * DRAFT); hands[x] = []; out[x] = []; });
    return { leaders: { draft, hands, out, box: pool.slice(s.seats.length * DRAFT), used: [], frozen: null } };
  },
  onBuild: (_lib, s, b) => {
    const mine = activeEffs(s.players[b.seat]!);
    const xenophon = b.item.type === "card" && b.item.color === "yellow" ? count(mine, "leaders:xenophon") : 0;
    const vitruvius = b.item.type === "card" && b.item.free === "chain" ? count(mine, "leaders:vitruvius") : 0;
    s = gain(gain(s, b.seat, 2 * xenophon), b.seat, 2 * vitruvius);
    for (const e of b.effs) {
      if (e.k === "leaders:courtesan") s = { ...s, pending: [...s.pending, { seat: b.seat, kind: "copy" }] };
      if (e.k === "leaders:extra") s = { ...s, pending: [...s.pending, { seat: b.seat, kind: "extra" }] };
      if (e.k === "leaders:draw") {
        const n = Number(e.n), sl = own(s);
        s = say(put(s, { hands: { ...sl.hands, [b.seat]: [...(sl.hands[b.seat] ?? []), ...sl.box.slice(0, n)] }, box: sl.box.slice(n) }), `${b.seat} draws ${Math.min(n, sl.box.length)} leaders.`);
      }
    }
    return s;
  },
  // Hatshepsut: a coin for each neighbour the seat bought from this turn.
  endTurn: (s) => s.seats.flatMap((x) => {
    const n = count(activeEffs(s.players[x]!), "leaders:hatshepsut");
    const k = s.bought.filter((b) => b.startsWith(`${x}>`)).length;
    return n && k ? [{ seat: x, n: n * k }] : [];
  }),
  // Tomyris: the seat's defeat tokens go to the winner. Nero: 2 coins per victory token taken.
  conflicts: (s, fights) => fights.map((c) => {
    if (c.winner === null || c.tokens <= 0) return c;
    const loser = c.winner === c.a ? c.b : c.a;
    let r = c;
    if (count(activeEffs(s.players[loser]!), "leaders:tomyris")) r = { ...r, defeatTo: c.winner };
    const nero = count(activeEffs(s.players[c.winner]!), "leaders:nero");
    if (nero) r = { ...r, bonus: { ...r.bonus, [c.winner]: (r.bonus[c.winner] ?? 0) + 2 * nero * r.tokens } };
    return r;
  }),
  passes: (s, turn) => {
    const f = own(s).frozen;
    return !(f && f.age === s.age && f.turn === turn);
  },
  score: (s, args) => {
    const out: { [seat: string]: SWLine[] } = {};
    for (const x of s.seats) {
      const p = s.players[x]!;
      const n = (c: SWColor) => p.colors[c] ?? 0;
      const vpOf = (e: SWEff): number => {
        if (e.k === "leaders:perNbrLeader") return Number(e.n) * nbrs(s.seats, x).reduce((t, y) => t + s.players[y]!.extras.filter((l) => l.from === "leaders").length, 0);
        if (e.k !== "leaders:vp") return 0;
        switch (e.what) {
          case "victories": return p.victories.length;
          case "plato": return 7 * Math.min(...(["brown", "grey", "blue", "yellow", "green", "red", "purple"] as SWColor[]).map(n));
          case "justinian": return 3 * Math.min(n("red"), n("blue"), n("green"));
          case "coins3": return Math.floor(p.coins / 3);
          case "louis": return Math.max(0, 7 - p.victories.length);
          default: return 0;
        }
      };
      const lines: SWLine[] = [];
      for (const e of activeEffs(p)) { const vp = vpOf(e); if (vp) lines.push({ cat: "leaders", vp }); }
      for (const c of args.city[x] ?? []) for (const e of c.eff) { const vp = vpOf(e); if (vp) lines.push({ cat: "guilds", vp }); }
      out[x] = lines;
    }
    return out;
  },
  asks: {
    // The default names the first leader next door. An entombing queued before this question could turn that
    // leader off, so a copy raised by an answer waits for the next phase while one is queued.
    copy: (s, seat, answering) => {
      const first = copies(s, seat)[0];
      if (!first) return null;
      return answering && s.run.questions.some((q) => q.kind === "entomb") ? "later" : { kind: "copy", seat, default: [first.id] };
    },
    extra: (s, seat) => ((own(s).hands[seat] ?? []).length ? { kind: "extra", seat, default: ["skip"] } : null),
  },
  questions,
  view: (s, viewer) => {
    const sl = own(s);
    const me = viewer !== "spectator" && sl.hands[viewer] ? viewer : null;
    return { leaders: {
      hand: me ? sl.hands[me]! : [], draft: me ? sl.draft[me] ?? [] : [],
      handSizes: sizes(sl.hands), draftSizes: sizes(sl.draft), outSizes: sizes(sl.out), box: sl.box.length,
      esteban: sl.used, frozen: sl.frozen,
    } };
  },
  legend: "Leaders: draft four leaders before Age I; at the start of each age recruit one (pay its cost), build a wonder stage with it, or discard it for 3 coins.",
  text: (view) => {
    const v = view.leaders;
    if (!v) return "";
    const parts: string[] = [];
    if (v.draft.length) parts.push(`Your draft: ${v.draft.join(", ")}.`);
    if (v.hand.length) parts.push(`Your leaders: ${v.hand.join(", ")}.`);
    parts.push(`Leaders in hand: ${Object.entries(v.handSizes).map(([x, n]) => `${x} ${n}`).join(", ") || "none"}.`);
    return parts.join(" ");
  },
  // Every leader `seat` can't see (other seats' draft and hands, their used ones, the box) redrawn, counts kept.
  resample: (s, seat, rng) => {
    const sl = own(s);
    const others = s.seats.filter((x) => x !== seat);
    const slots: string[][] = [...others.map((x) => sl.draft[x] ?? []), ...others.map((x) => sl.hands[x] ?? []), ...others.map((x) => sl.out[x] ?? []), sl.box];
    const pool = shuffle(rng, slots.flat());
    const fresh = slots.map((xs) => xs.map(() => pool.shift()!));
    const n = others.length;
    const pick = (h: Hands, k: number) => { const r = { ...h }; others.forEach((x, i) => { if (h[x] !== undefined) r[x] = fresh[k * n + i]!; }); return r; };
    return put(s, { draft: pick(sl.draft, 0), hands: pick(sl.hands, 1), out: pick(sl.out, 2), box: fresh[3 * n]! });
  },
};
