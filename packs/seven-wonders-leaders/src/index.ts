// 7 Wonders: Leaders, an add-on of boardcore/seven-wonders 1.x. Before Age I each seat drafts four leaders
// (three simultaneous hidden picks, passing the rest on; the last card is kept); at the start of each age it
// recruits one (a simultaneous hidden pick after the deal): it pays the leader's cost and the leader's effects
// join its public extras (the `grant` operation), or it uses the leader to build a wonder stage or discards it
// for 3 coins. Roma, four guilds and 6 starting coins (a preset) come with it. Questions to one seat (the
// Courtesans' Guild, Roma's extra leader) are asked in this add-on's own phases; Esteban (a promo) freezes the
// passing of hands for one turn through the `passes` point. The leaders' hands and the box are this add-on's
// hidden slice; resampleHidden redraws them.
import { defineAddon, shuffle, type Json, type Option, type Prompt, type SeatId, type Step } from "@boardcore/pack-sdk";
import { LEADER, LEADERS, LEADERS_GUILDS, ROMA, type LeaderDef } from "./data";

const ID = "boardcore/seven-wonders-leaders";
const DRAFT = 4;
const TURNS = [1, 2, 3, 4, 5, 6, 7];

type Hands = { [seat: string]: string[] };
interface Slice {
  [k: string]: Json;
  /** The draft hands (before Age I), the leaders each seat holds, the undealt leaders, and each seat's used ones (face down). */
  draft: Hands; hands: Hands; box: string[]; out: Hands;
  /** Seats to ask: the Courtesans' Guild, Roma's extra leader. */
  askCopy: SeatId[]; askExtra: SeatId[];
  /** Esteban: who used him, and the turn the hands don't pass. */
  used: SeatId[]; frozen: { [k: string]: Json; age: number; turn: number } | null;
}
const EMPTY: Slice = { draft: {}, hands: {}, box: [], out: {}, askCopy: [], askExtra: [], used: [], frozen: null };
const sliceOf = (j: Json): Slice => (j as Slice | null) ?? EMPTY;
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

/** What a seat shows: its board and extras (a player in the state, or in the base's view). */
interface Shown { wonder: string; side: string; extras: SWExtra[]; coins: number }
const activeEffs = (p: Shown): SWEff[] => p.extras.filter((x) => x.off === null).flatMap((x) => x.eff);
const boardEffs = (p: Shown): SWEff[] => (p.wonder === ROMA.id ? ROMA.board![p.side === "B" ? "B" : "A"] : []);
const count = (list: SWEff[], k: string) => list.filter((e) => e.k === k).length;

/** A leader's recruiting cost for a seat: Maecenas makes it free; Roma makes it cheaper (next door too). */
function costOf(players: { [seat: string]: Shown }, seats: readonly SeatId[], seat: SeatId, name: string): number {
  const own = [...activeEffs(players[seat]!), ...boardEffs(players[seat]!)];
  if (count(own, "leaders:free")) return 0;
  let c = def(name).cost;
  for (const e of own) if (e.k === "leaders:cost") c -= Number(e.self);
  for (const x of nbrs(seats, seat)) for (const e of boardEffs(players[x]!)) if (e.k === "leaders:cost") c -= Number(e.nbr);
  return Math.max(0, c);
}
const coinsIn = (cost: string) => (/^\$(\d+)/.exec(cost) ? Number(/^\$(\d+)/.exec(cost)![1]) : 0);
const stevieCost = (cost: string) => coinsIn(cost) + cost.replace(/^\$\d+/, "").length;
const stageAt = (built: number, wayId: string) => (wayId.includes(":") ? Number(wayId.slice(wayId.indexOf(":") + 1)) : built);
const planId = (p: SWPlan) => `pay:${p.L},${p.R},${p.B}`;
const parsePlan = (id: Step | undefined): SWPlan => {
  const m = /^pay:(\d+),(\d+),(\d+)$/.exec(String(id ?? ""));
  return m ? { L: Number(m[1]), R: Number(m[2]), B: Number(m[3]) } : { L: 0, R: 0, B: 0 };
};
const opt = (id: string, label: string, disabled?: string | null): Option => (disabled ? { id, label, disabled } : { id, label });
const grantOf = (name: string): SWExtra => ({ from: "leaders", name, cost: def(name).cost, eff: def(name).eff, off: null });

/** The ways to play a leader in a recruitment: recruit, build a wonder stage with it (Stevie: paying coins), discard. */
function leaderWays(v: SWView, seat: SeatId, name: string): SWWay[] {
  const p = v.players[seat]!;
  const none = [{ L: 0, R: 0, B: 0 }];
  const cost = costOf(v.players, v.seats, seat, name);
  const ways: SWWay[] = [{ id: "recruit", label: `Recruit ${name} (${cost} coins)`, disabled: cost > p.coins ? "not enough coins" : null, plans: none, coins: cost }];
  for (const w of v.stageWays) ways.push({ ...w, label: `${w.label} with this leader` });
  if (count(def(name).eff, "leaders:stevie")) {
    for (const w of v.stageWays) {
      if (w.disabled === "your wonder is finished") continue;
      const i = stageAt(p.stages.length, w.id);
      const c = stevieCost(p.stageCosts[i] ?? "");
      ways.push({ id: `stevie:${i}`, label: `Build ${p.wonder} stage ${i + 1} with Stevie (${c} coins)`, disabled: c > p.coins ? "not enough coins" : null, plans: none, coins: c });
    }
  }
  ways.push({ id: "sell", label: "Discard for 3 coins", disabled: null, plans: none, coins: 0 });
  return ways;
}

function effText(e: SWEff): string {
  switch (e.k) {
    case "vp": return `${e.n} VP`;
    case "coins": return `${e.n} coins now`;
    case "shields": return `${e.n} shield${e.n === 1 ? "" : "s"}`;
    case "sci": return "a science symbol";
    case "perVP": return `${e.n} VP per ${e.stages ? "wonder stage" : `${(e.colors ?? []).join("/")} card`}`;
    case "discount": return `${e.color === "wonder" ? "wonder stages" : `${e.color} cards`} cost one resource less`;
    case "sciSetBonus": return `${e.n} more VP per science set`;
    case "bank": return "buy a resource from the bank for 1 coin each turn";
    case "freeColor": return `${e.color} cards free${e.perAge ? " once an age" : ""}`;
    case "discardBuild": return "build a discarded card free";
    case "leaders:vp": return `VP for ${String(e.what)}`;
    default: return e.k.replace(/^\w+:/, "");
  }
}
const leaderText = (name: string) => `${name} (${def(name).cost} coins): ${def(name).eff.map(effText).join("; ")}`;

function recruitPrompt(v: SWView, hand: string[], seat: SeatId, partial: Step[], extra: boolean): Prompt | null {
  if (partial.length === 0) {
    const options = hand.map((l) => opt(`l:${l}`, leaderText(l), extra && costOf(v.players, v.seats, seat, l) > v.players[seat]!.coins ? "not enough coins" : null));
    if (extra) options.push(opt("skip", "Recruit no one"));
    return { kind: "pick", label: extra ? "Roma: put another leader into play" : `Recruitment for Age ${roman(v.age)}: choose a leader`, options };
  }
  if (partial[0] === "skip" || extra) return null;
  const name = String(partial[0]).slice(2);
  if (!hand.includes(name)) return null;
  const ways = leaderWays(v, seat, name);
  if (partial.length === 1) return { kind: "pick", label: `Play ${name}`, options: ways.map((w) => opt(w.id, w.label, w.disabled)) };
  const way = ways.find((w) => w.id === partial[1]);
  if (!way || partial.length > 2) return null;
  if (way.plans.length === 1 && way.plans[0]!.L + way.plans[0]!.R + way.plans[0]!.B === 0) return null;
  return { kind: "pick", label: "How to pay", options: way.plans.map((p) => opt(planId(p), `Pay ${p.L} left, ${p.R} right, ${p.B} bank${way.coins ? ` (+${way.coins} coins)` : ""}`)) };
}

type Phase = NonNullable<NonNullable<Parameters<typeof defineAddon<"boardcore/seven-wonders">>[0]["contributes"]>["phases"]>[number];

/** One pick of the draft: keep a leader, pass the rest to the right; the last pick keeps the card left too. */
const draftPhase = (k: number, anchor: { before?: string; after?: string }): Phase => ({
  name: `draft${k}`, kind: "pick", rounds: [1], ...anchor,
  // The first draft phase starts inside the base's setup, before this add-on's slice exists: every seat.
  seats: ({ slice }) => (slice === null ? null : Object.keys(sliceOf(slice).draft).filter((x) => sliceOf(slice).draft[x]!.length > 1).sort()),
  choices: ({ slice, seat, partial }) => {
    if (partial.length) return null;
    return { kind: "pick", label: `Leader draft, pick ${k} of ${DRAFT - 1}`, options: (sliceOf(slice).draft[seat] ?? []).map((l) => opt(`l:${l}`, leaderText(l))) };
  },
  resolve: ({ state, slice, picks }) => {
    const s = state!, sl = sliceOf(slice);
    const hands = { ...sl.hands }, left: Hands = {};
    for (const x of s.seats) {
      const name = String(picks[x]?.[0] ?? "").slice(2);
      hands[x] = [...(hands[x] ?? []), name];
      left[x] = without(sl.draft[x] ?? [], name);
    }
    const draft: Hands = {};
    for (const x of s.seats) draft[x] = left[leftOf(s.seats, x)]!;
    if (k === DRAFT - 1) for (const x of s.seats) { hands[x] = [...hands[x]!, ...draft[x]!]; draft[x] = []; }
    return { slice: { ...sl, hands, draft }, ops: [{ op: "log", text: k === DRAFT - 1 ? "The leader draft is over." : `Leader draft: pick ${k} made.` }] };
  },
});

/** Before the end of a turn (and the war, and Age I's first turn): the Courtesans' Guild and Roma's extra leader. */
const askPhase = (name: string, before: string): Phase => ({
  name, kind: "auto", before,
  begin: ({ state, slice }) => {
    const s = state!, sl = sliceOf(slice);
    if (!sl.askCopy.length && !sl.askExtra.length) return {};
    const ask: { kind: string; seat: SeatId; args: Json; default: string[] }[] = [];
    for (const x of sl.askCopy) {
      const first = nbrs(s.seats, x).flatMap((y) => s.players[y]!.extras.filter((e) => e.from === "leaders" && e.off === null).map((e) => `c:${y}:${e.name}`))[0];
      if (first) ask.push({ kind: "copy", seat: x, args: null, default: [first] });
    }
    for (const x of sl.askExtra) if ((sl.hands[x] ?? []).length) ask.push({ kind: "extra", seat: x, args: null, default: ["skip"] });
    return { slice: { ...sl, askCopy: [], askExtra: [] }, ask };
  },
  choices: () => null,
});

/** Esteban: before a turn, his owner may freeze the passing of hands after it (once a game). */
const freezePhase = (n: number): Phase => ({
  name: `freeze${n}`, kind: "pick", before: `turn${n}`,
  seats: ({ state, slice }) => {
    if (slice === null || !state) return [];
    const sl = sliceOf(slice);
    if (sl.frozen && sl.frozen.age === state.age) return [];
    return state.seats.filter((x) => !sl.used.includes(x) && count(activeEffs(state.players[x]!), "leaders:esteban") > 0 && state.players[x]!.hand.items.length >= 3);
  },
  choices: ({ partial }) => (partial.length ? null : { kind: "pick", label: "Esteban: freeze the passing of hands after this turn?", options: [opt("freeze", "Freeze it (once a game)"), opt("pass", "Not now")] }),
  resolve: ({ state, slice, picks }) => {
    const sl = sliceOf(slice);
    const freezers = state!.seats.filter((x) => picks[x]?.[0] === "freeze");
    if (!freezers.length) return {};
    return { slice: { ...sl, used: [...sl.used, ...freezers], frozen: { age: state!.age, turn: n } }, ops: [{ op: "log", text: `${freezers.join(", ")} freeze${freezers.length === 1 ? "s" : ""} the passing of hands (Esteban).` }] };
  },
});

export default defineAddon<"boardcore/seven-wonders">({
  contributes: {
    cards: LEADERS_GUILDS,
    wonders: [ROMA],
    sets: [{ id: "leaders" }],
    decks: ({ value }) => value.map((d, i) => (i === 2 ? [...d, ...LEADERS_GUILDS.map((c) => c.id)] : d)),
    onBuild: ({ state, slice, args }) => {
      const s = state!;
      let sl = sliceOf(slice);
      const ops: SWOp[] = [];
      const mine = activeEffs(s.players[args.seat]!);
      if (args.item.type === "card" && args.item.color === "yellow" && count(mine, "leaders:xenophon")) ops.push({ op: "coins", seat: args.seat, n: 2 * count(mine, "leaders:xenophon") });
      if (args.item.type === "card" && args.item.free === "chain" && count(mine, "leaders:vitruvius")) ops.push({ op: "coins", seat: args.seat, n: 2 * count(mine, "leaders:vitruvius") });
      for (const e of args.effs) {
        if (e.k === "leaders:courtesan") sl = { ...sl, askCopy: [...sl.askCopy, args.seat] };
        if (e.k === "leaders:extra") sl = { ...sl, askExtra: [...sl.askExtra, args.seat] };
        if (e.k === "leaders:draw") {
          const n = Number(e.n);
          sl = { ...sl, hands: { ...sl.hands, [args.seat]: [...(sl.hands[args.seat] ?? []), ...sl.box.slice(0, n)] }, box: sl.box.slice(n) };
          ops.push({ op: "log", text: `${args.seat} draws ${Math.min(n, sliceOf(slice).box.length)} leaders.` });
        }
      }
      return { slice: sl, ops };
    },
    // Hatshepsut: a coin for each neighbour the seat bought from this turn.
    endTurn: ({ state }) => {
      const s = state!;
      const ops: SWOp[] = [];
      for (const x of s.seats) {
        const n = count(activeEffs(s.players[x]!), "leaders:hatshepsut");
        const k = s.bought.filter((b) => b.startsWith(`${x}>`)).length;
        if (n && k) ops.push({ op: "coins", seat: x, n: n * k });
      }
      return { ops };
    },
    // Tomyris: the seat's defeat tokens go to the winner. Nero: 2 coins per victory token taken.
    conflicts: ({ value, state }) => value.map((c) => {
      if (c.winner === null || c.tokens <= 0) return c;
      const loser = c.winner === c.a ? c.b : c.a;
      let r = c;
      if (count(activeEffs(state!.players[loser]!), "leaders:tomyris")) r = { ...r, defeatTo: c.winner };
      const nero = count(activeEffs(state!.players[c.winner]!), "leaders:nero");
      if (nero) r = { ...r, bonus: { ...r.bonus, [c.winner]: (r.bonus[c.winner] ?? 0) + 2 * nero * r.tokens } };
      return r;
    }),
    passes: ({ value, slice, state, args }) => {
      const f = sliceOf(slice).frozen;
      return value && !(f && f.age === state!.age && f.turn === args.turn);
    },
    score: ({ state, args }) => {
      const s = state!;
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
    phases: [
      draftPhase(1, { before: "deal" }),
      ...[2, 3].map((k) => draftPhase(k, { after: `${ID}:draft${k - 1}` })),
      {
        name: "recruit", kind: "pick", after: "deal",
        seats: ({ slice, state }) => (slice === null || !state ? [] : state.seats.filter((x) => (sliceOf(slice).hands[x] ?? []).length > 0)),
        choices: ({ view, slice, seat, partial }) => recruitPrompt(view, sliceOf(slice).hands[seat] ?? [], seat, partial, false),
        resolve: ({ state, slice, picks }) => {
          const s = state!;
          let sl = sliceOf(slice);
          const pays: SWOp[] = [], plays: SWOp[] = [], sells: SWOp[] = [];
          for (const x of s.seats) {
            const path = picks[x];
            if (!path) continue;
            const name = String(path[0]).slice(2), way = String(path[1]);
            const p = s.players[x]!;
            sl = { ...sl, hands: { ...sl.hands, [x]: without(sl.hands[x] ?? [], name) } };
            if (way === "recruit") {
              pays.push({ op: "pay", seat: x, coins: costOf(s.players, s.seats, x, name), L: 0, R: 0, B: 0 });
              plays.push({ op: "log", text: `${x} recruits ${name}.` }, { op: "grant", seat: x, extra: grantOf(name) });
              continue;
            }
            sl = { ...sl, out: { ...sl.out, [x]: [...(sl.out[x] ?? []), name] } };
            if (way === "sell") { sells.push({ op: "log", text: `${x} discards a leader for 3 coins.` }, { op: "coins", seat: x, n: 3 }); continue; }
            const st = stageAt(p.built.length, way);
            const plan = parsePlan(path[2]);
            const coins = way.startsWith("stevie:") ? stevieCost(p.stageCosts[st] ?? "") : coinsIn(p.stageCosts[st] ?? "");
            pays.push({ op: "pay", seat: x, coins, L: way.startsWith("stevie:") ? 0 : plan.L, R: way.startsWith("stevie:") ? 0 : plan.R, B: way.startsWith("stevie:") ? 0 : plan.B });
            plays.push({ op: "stage", seat: x, stage: st, marker: "leader" });
          }
          // Before Age III the leader left in each hand goes out of the game.
          if (s.age === 3) {
            const out = { ...sl.out }, hands = { ...sl.hands };
            for (const x of s.seats) { out[x] = [...(out[x] ?? []), ...(hands[x] ?? [])]; hands[x] = []; }
            sl = { ...sl, out, hands };
          }
          return { slice: sl, ops: [...pays, ...plays, ...sells] };
        },
      },
      ...TURNS.map(freezePhase),
      askPhase("askStart", "turn1"),
      ...TURNS.map((n) => askPhase(`ask${n}`, `end${n}`)),
      askPhase("askWar", "war"),
    ],
  },
  interrupts: {
    // The Courtesans' Guild: copy a leader next door (its lasting effects, not what it gave once).
    copy: {
      choices: ({ view, seat, partial }) => {
        if (partial.length) return null;
        const options = nbrs(view.seats, seat).flatMap((y) => view.players[y]!.extras.filter((e) => e.from === "leaders" && e.off === null).map((e) => opt(`c:${y}:${e.name}`, `Copy ${y}'s ${leaderText(e.name)}`)));
        return { kind: "pick", label: "Courtesans' Guild: copy a neighbour's leader", options };
      },
      answer: ({ seat, action }) => {
        const name = String(action[0]).split(":").slice(2).join(":");
        const eff = def(name).eff.filter((e) => e.k !== "coins" && e.k !== "discardBuild" && e.k !== "cities:diplomacy");
        return { ops: [{ op: "log", text: `${seat} copies ${name} with the Courtesans' Guild.` }, { op: "grant", seat, extra: { from: "leaders:copy", name: `${name} (copy)`, cost: 0, eff, off: null } }] };
      },
    },
    // Roma B: put one more leader from the hand into play, paying for it.
    extra: {
      choices: ({ view, slice, seat, partial }) => recruitPrompt(view, sliceOf(slice).hands[seat] ?? [], seat, partial, true),
      answer: ({ state, slice, seat, action }) => {
        const id = String(action[0]);
        if (id === "skip") return {};
        const name = id.slice(2), sl = sliceOf(slice);
        return {
          slice: { ...sl, hands: { ...sl.hands, [seat]: without(sl.hands[seat] ?? [], name) } },
          ops: [{ op: "pay", seat, coins: costOf(state!.players, state!.seats, seat, name), L: 0, R: 0, B: 0 }, { op: "log", text: `${seat} recruits ${name} (Roma).` }, { op: "grant", seat, extra: grantOf(name) }],
        };
      },
    },
  },
  // Four leaders a seat for the draft, from the leaders of the sets in the room; the rest stay in the box.
  setup: ({ options, state, rng }) => {
    const pool = shuffle(rng, LEADERS.filter((l) => l.set === "leaders" || (l.set === "cities" && state.sets.includes("cities")) || (l.set === "promo" && options.promos === true)).map((l) => l.name));
    const draft: Hands = {}, hands: Hands = {}, out: Hands = {};
    state.seats.forEach((x, i) => { draft[x] = pool.slice(i * DRAFT, (i + 1) * DRAFT); hands[x] = []; out[x] = []; });
    return { ...EMPTY, draft, hands, out, box: pool.slice(state.seats.length * DRAFT) };
  },
  view: ({ slice, viewer }) => {
    const sl = sliceOf(slice);
    const sizes = (h: Hands) => Object.fromEntries(Object.keys(h).sort().map((x) => [x, h[x]!.length]));
    const own = typeof viewer === "string" && viewer !== "spectator" && sl.hands[viewer] ? viewer : null;
    return {
      hand: own ? sl.hands[own]! : [], draft: own ? sl.draft[own] ?? [] : [],
      handSizes: sizes(sl.hands), draftSizes: sizes(sl.draft), outSizes: sizes(sl.out), box: sl.box.length,
      esteban: sl.used, frozen: sl.frozen,
    };
  },
  text: {
    legend: () => "Leaders: draft four leaders before Age I; at the start of each age recruit one (pay its cost), build a wonder stage with it, or discard it for 3 coins.",
    state: ({ view }) => {
      const v = view as { hand: string[]; draft: string[]; handSizes: { [x: string]: number } } | null;
      if (!v) return "";
      const parts: string[] = [];
      if (v.draft.length) parts.push(`Your draft: ${v.draft.join(", ")}.`);
      if (v.hand.length) parts.push(`Your leaders: ${v.hand.join(", ")}.`);
      parts.push(`Leaders in hand: ${Object.entries(v.handSizes).map(([x, n]) => `${x} ${n}`).join(", ") || "none"}.`);
      return parts.join(" ");
    },
  },
  describe: ({ view, seat, viewer, action }) => {
    if (view.log.length) return view.log.join(" ");
    if (viewer !== seat) return `${seat} has chosen.`;
    const first = String(action[0]).replace(`${ID}:`, "");
    return `You choose ${first.startsWith("l:") ? first.slice(2) : first}.`;
  },
  // Every leader `seat` can't see (other seats' draft and hands, their used ones, the box) redrawn, counts kept.
  resampleHidden: ({ state, slice, seat, rng }) => {
    const sl = sliceOf(slice);
    const others = state.seats.filter((x) => x !== seat);
    const slots: string[][] = [...others.map((x) => sl.draft[x] ?? []), ...others.map((x) => sl.hands[x] ?? []), ...others.map((x) => sl.out[x] ?? []), sl.box];
    const pool = shuffle(rng, slots.flat());
    const fresh = slots.map((xs) => xs.map(() => pool.shift()!));
    const n = others.length;
    const pick = (h: Hands, k: number) => { const r = { ...h }; others.forEach((x, i) => { if (h[x] !== undefined) r[x] = fresh[k * n + i]!; }); return r; };
    return { ...sl, draft: pick(sl.draft, 0), hands: pick(sl.hands, 1), out: pick(sl.out, 2), box: fresh[3 * n]! };
  },
});
