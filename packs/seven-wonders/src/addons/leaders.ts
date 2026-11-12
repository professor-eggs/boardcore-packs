// 7 Wonders: Leaders. A leader draft before Age I, a recruitment phase at the start of each age, 6 starting
// coins, Rome, four guilds, and the leaders' effects, all through the base's extension points.
import { idiv, shuffle, type SeatId } from "@boardcore/pack-sdk";
import { leaderDef, LEADERS, parseCost, type Color, type Eff } from "../data";
import {
  built, colorCount, effectsOf, gain, nbrs, opt, openStages, pay, chosenPlan, setP, stageDefs, stageEffects, stageWays, startAge, wayPrompts, leftOf,
  type Conflict, type Ctx, type Item, type Line, type PayCtx, type State, type Way,
} from "../engine";
import { turnPhase, type Flow, type SevenAddOn } from "../flow";

interface Ext { courtesan: { [seat: string]: string }; hatPly: number; estebanUsed?: string[]; frozen?: boolean }
const ext = (s: State): Ext => (s.ext.leaders as unknown as Ext | undefined) ?? { courtesan: {}, hatPly: -1 };
/** Esteban (a Leaders goodie): once per game, freeze the passing of hands for one turn. */
const canFreeze = (s: State, seat: SeatId) => !(ext(s).estebanUsed ?? []).includes(seat) && !ext(s).frozen &&
  s.players[seat]!.hand.length >= 3 && active(s, seat).some((l) => leaderDef(l).eff.some((e) => e.k === "esteban"));
const withExt = (s: State, e: Ext): State => ({ ...s, ext: { ...s.ext, leaders: e as unknown as State["ext"][string] } });

const active = (s: State, seat: SeatId) => s.players[seat]!.leaders.filter((l) => !s.players[seat]!.entombed.includes(l));
const effs = (s: State, seat: SeatId, ctx: Ctx) => effectsOf(s, seat, ctx).map((e) => e.eff);
const count = (s: State, seat: SeatId, ctx: Ctx, k: Eff["k"]) => effs(s, seat, ctx).filter((e) => e.k === k).length;

/** What recruiting a leader costs this seat: Maecenas and Rome make it cheaper. */
export function leaderCost(s: State, seat: SeatId, name: string, ctx: Ctx): number {
  if (count(s, seat, ctx, "freeLeaders")) return 0;
  let c = leaderDef(name).cost;
  for (const e of effs(s, seat, ctx)) if (e.k === "leaderCost") c -= e.self;
  for (const x of nbrs(s, seat)) for (const e of effs(s, x, ctx)) if (e.k === "leaderCost") c -= e.nbr;
  return Math.max(0, c);
}

function leaderWays(s: State, seat: SeatId, name: string, ctx: Ctx, extra: boolean): Way[] {
  const cost = leaderCost(s, seat, name, ctx);
  const ways: Way[] = [];
  const rec: Way = { id: "recruit", label: `Recruit ${name} (${cost} coins)`, plans: [{ L: 0, R: 0, B: 0 }], coins: cost };
  if (cost > s.players[seat]!.coins) rec.disabled = "not enough coins";
  ways.push(rec);
  if (!extra) ways.push(...stageWays(s, seat, ctx), { id: "sell", label: "Discard for 3 coins", plans: [{ L: 0, R: 0, B: 0 }], coins: 0 });
  // Stevie (aid p2): use him to build a wonder stage, paying 1 coin per resource of its cost instead.
  if (!extra && leaderDef(name).eff.some((e) => e.k === "stevie")) {
    const p = s.players[seat]!;
    for (const i of openStages(p)) {
      const { coins, res } = parseCost(stageDefs(p)[i]!.cost);
      const c = coins + res.length;
      const w: Way = { id: `stevie:${i}`, label: `Build ${p.wonder} stage ${i + 1} with Stevie (${c} coins)`, plans: [{ L: 0, R: 0, B: 0 }], coins: c };
      if (c > p.coins) w.disabled = "not enough coins";
      ways.push(w);
    }
  }
  return ways;
}

function leaderPrompt(s: State, seat: SeatId, partial: (string | string[] | { [k: string]: number })[], ctx: Ctx, extra: boolean) {
  const hand = s.players[seat]!.leaderHand;
  if (partial.length === 0) {
    const options = hand.map((l, i) => opt(`l:${i}`, `${l}: ${leaderText(l)}`));
    if (extra) options.push(opt("skip", "Recruit no one"));
    return { kind: "pick" as const, label: extra ? "Rome: put an extra leader into play" : `Recruitment for Age ${s.age}: choose a leader card`, options };
  }
  if (partial[0] === "skip") return null;
  const name = hand[Number(String(partial[0]).slice(2))];
  if (!name) return null;
  return wayPrompts(leaderWays(s, seat, name, ctx, extra), partial.slice(1), `Play ${name}`);
}

export function leaderText(name: string): string {
  return leaderDef(name).eff.map(effText).join("; ");
}

export function effText(e: Eff): string {
  switch (e.k) {
    case "vp": return `${e.n} VP`;
    case "coins": return `${e.n} coins now`;
    case "shields": return `${e.n} shield${e.n === 1 ? "" : "s"}`;
    case "sci": return e.s === "*" ? "any science symbol" : `science ${e.s === "c" ? "compass" : e.s === "g" ? "gear" : "tablet"}`;
    case "perVP": return `${e.n} VP per ${e.stages ? "wonder stage" : `${(e.colors ?? []).join("/")} card`}${e.who === "nbr" ? " next door" : ""}`;
    case "discount": return `${e.color === "wonder" ? "wonder stages" : `${e.color} cards`} cost one resource less`;
    case "leaderVP": return { victoryTokens: "+1 VP per victory token", sciSets: "+3 VP per science set", plato: "7 VP per set of 7 colours", justinian: "3 VP per red/blue/green set", coins3: "1 VP per 3 coins", louis: "7 VP minus your victory tokens" }[e.what];
    case "esteban": return "once a game, freeze the passing of hands for a turn";
    case "stevie": return "build a wonder stage paying 1 coin per resource instead";
    case "bilkis": return "buy one resource a turn from the bank for 1 coin";
    case "freeLeaders": return "later leaders are free";
    case "freeGuilds": return "guilds are free";
    case "tomyris": return "your defeat tokens go to the winner";
    case "hatshepsut": return "+1 coin per neighbour you buy from each turn";
    case "nero": return "+2 coins per victory token";
    case "xenophon": return "+2 coins per yellow card you build";
    case "vitruvius": return "+2 coins per chain build";
    case "discardBuild": return "build a discarded card free";
    case "diplomacy": return "a diplomacy token";
    case "berenice": return "+1 coin whenever you take coins from the bank (once a turn)";
    case "caligula": return "one black card free per age";
    case "semiramis": return "each defeat token counts as a shield";
    case "diocletian": return "+2 coins per black card you build";
    default: return e.k;
  }
}

function resolveLeaders(s: State, seats: SeatId[], ctx: Ctx, rng: { int(n: number): number }, extra: boolean): State {
  const done: { seat: SeatId; name: string; way: Way; path: (string | string[] | { [k: string]: number })[] }[] = [];
  for (const seat of seats) {
    const path = s.picks[seat];
    if (!path || path[0] === "skip") continue;
    const name = s.players[seat]!.leaderHand[Number(String(path[0]).slice(2))]!;
    done.push({ seat, name, way: leaderWays(s, seat, name, ctx, extra).find((w) => w.id === path[1])!, path });
  }
  const after: { seat: SeatId; effs: Eff[]; item: Item | null }[] = [];
  for (const d of done) {
    s = pay(s, d.seat, d.way.coins, chosenPlan(d.way, d.path.slice(1)));
    s = setP(s, d.seat, (p) => ({ ...p, leaderHand: p.leaderHand.filter((l) => l !== d.name) }));
    if (d.way.id === "recruit") {
      s = setP(s, d.seat, (p) => ({ ...p, leaders: [...p.leaders, d.name] }));
      s = { ...s, log: [...s.log, `${d.seat} recruits ${d.name}.`] };
      after.push({ seat: d.seat, effs: leaderDef(d.name).eff, item: { type: "leader", name: d.name, age: s.age, color: "leader" } });
    } else if (d.way.id.startsWith("stevie:")) {
      // Stevie stays under the board as the stage's construction marker.
      const p = s.players[d.seat]!;
      const st = Number(d.way.id.slice(7));
      s = setP(s, d.seat, (pp) => ({ ...pp, built: [...pp.built, st], stageCards: [...pp.stageCards, `leader:${d.name}`] }));
      s = { ...s, log: [...s.log, `${d.seat} builds stage ${st + 1} of ${p.wonder} with Stevie.`] };
      after.push({ seat: d.seat, effs: stageEffects(s, d.seat, st, ctx), item: { type: "stage", name: `${p.wonder} stage ${st + 1}`, age: s.age, color: "wonder" } });
    } else if (d.way.id.startsWith("wonder")) {
      const p = s.players[d.seat]!;
      const st = d.way.id.includes(":") ? Number(d.way.id.slice(7)) : p.built.length;
      s = setP(s, d.seat, (pp) => ({ ...pp, built: [...pp.built, st], stageCards: [...pp.stageCards, `leader:${d.name}`] }));
      s = { ...s, leaderBox: [...s.leaderBox, d.name], log: [...s.log, `${d.seat} builds stage ${st + 1} of ${p.wonder} with a leader.`] };
      after.push({ seat: d.seat, effs: stageEffects(s, d.seat, st, ctx), item: { type: "stage", name: `${p.wonder} stage ${st + 1}`, age: s.age, color: "wonder" } });
    } else {
      s = { ...s, leaderBox: [...s.leaderBox, d.name], log: [...s.log, `${d.seat} discards a leader for 3 coins.`] };
      after.push({ seat: d.seat, effs: [], item: null });
    }
  }
  for (const a of after) s = a.item ? built(s, a.seat, a.effs, a.item, ctx, rng) : gain(s, a.seat, 3);
  return s;
}

const draftSize = 4;

export const leaders: SevenAddOn = {
  id: "leaders",
  phases: {
    // The base turn, decorated for Esteban: one more option on his owner's card prompt, and no passing after
    // a frozen turn (everyone plays a second card from the same hand). Everything else is the base turn.
    turn: {
      actors: turnPhase.actors,
      prompt(s, seat, partial, f) {
        if (partial[0] === "freeze") return turnPhase.prompt(s, seat, partial.slice(1), f);
        const p = turnPhase.prompt(s, seat, partial, f);
        if (partial.length || !p || !canFreeze(s, seat)) return p;
        return { ...p, options: [...p.options, opt("freeze", "Esteban: freeze the passing of hands this turn (once a game), then choose a card")] };
      },
      resolve(s, f, rng) {
        const freezers = s.seats.filter((x) => s.picks[x]?.[0] === "freeze");
        if (freezers.length) {
          const picks = { ...s.picks };
          for (const x of freezers) picks[x] = picks[x]!.slice(1);
          const e = ext(s);
          s = withExt({ ...s, picks, log: [...s.log, `${freezers.join(", ")} freezes the passing of hands (Esteban).`] }, { ...e, frozen: true, estebanUsed: [...(e.estebanUsed ?? []), ...freezers] });
        }
        return turnPhase.resolve(s, f, rng);
      },
      next(s, f, rng) {
        if (ext(s).frozen) {
          s = withExt(s, { ...ext(s), frozen: false });
          if (s.seats.some((x) => s.players[x]!.hand.length > 1)) return { ...s, turn: s.turn + 1, phase: "turn" };
        }
        return turnPhase.next(s, f as Flow, rng);
      },
    },
    draft: {
      actors: (s) => s.seats.filter((x) => s.picks[x] === null && (s.draft[x]?.length ?? 0) > 1),
      prompt(s, seat, partial) {
        if (partial.length) return null;
        return { kind: "pick", label: `Leader draft, pick ${s.draftRound} of ${draftSize}`, options: s.draft[seat]!.map((l, i) => opt(`l:${i}`, `${l} (${leaderDef(l).cost} coins): ${leaderText(l)}`)) };
      },
      resolve(s) {
        const kept: { [x: string]: string[] } = {};
        const left: { [x: string]: string[] } = {};
        for (const x of s.seats) {
          const i = Number(String(s.picks[x]![0]).slice(2));
          kept[x] = [s.draft[x]![i]!];
          left[x] = s.draft[x]!.filter((_, j) => j !== i);
        }
        // The rest goes to the player on the right: each seat receives from its left.
        let players = { ...s.players };
        const draft: { [x: string]: string[] } = {};
        for (const x of s.seats) {
          players = { ...players, [x]: { ...players[x]!, leaderHand: [...players[x]!.leaderHand, ...kept[x]!] } };
          draft[x] = left[leftOf(s, x)]!;
        }
        return { ...s, players, draft, draftRound: s.draftRound + 1, log: [...s.log, `Leader draft: pick ${s.draftRound} made.`] };
      },
      next(s, ctx, rng) {
        if (s.seats.some((x) => (s.draft[x]?.length ?? 0) > 1)) return { ...s, phase: "draft" };
        let players = { ...s.players };
        for (const x of s.seats) players = { ...players, [x]: { ...players[x]!, leaderHand: [...players[x]!.leaderHand, ...(s.draft[x] ?? [])] } };
        return startAge({ ...s, players, draft: {} }, 1, ctx, rng);
      },
    },
    recruit: {
      actors: (s) => s.seats.filter((x) => s.picks[x] === null && s.players[x]!.leaderHand.length > 0),
      prompt: (s, seat, partial, ctx) => leaderPrompt(s, seat, partial, ctx, false),
      resolve: (s, ctx, rng) => resolveLeaders(s, s.seats, ctx, rng, false),
      next(s) {
        // Before Age III the unplayed leader goes back to the box.
        if (s.age === 3) {
          let box = s.leaderBox;
          let players = { ...s.players };
          for (const x of s.seats) { box = [...box, ...players[x]!.leaderHand]; players = { ...players, [x]: { ...players[x]!, leaderHand: [] } }; }
          s = { ...s, players, leaderBox: box };
        }
        return { ...s, phase: "turn", turn: 1 };
      },
    },
  },
  interrupts: {
    extraLeader: {
      prompt: (s, seat, partial, _d, ctx) => (s.players[seat]!.leaderHand.length ? leaderPrompt(s, seat, partial, ctx, true) : null),
      apply: (s, seat, action, _d, ctx, rng) => resolveLeaders({ ...s, picks: { ...s.picks, [seat]: action } }, [seat], ctx, rng, true),
      auto: (s) => s,
    },
    courtesan: {
      prompt(s, seat, partial) {
        if (partial.length) return null;
        const opts = nbrs(s, seat).flatMap((x) => active(s, x).map((l) => opt(`c:${x}:${l}`, `Copy ${x}'s ${l}: ${leaderText(l)}`)));
        return opts.length ? { kind: "pick", label: "Courtesans' Guild: copy a neighbour's leader", options: opts } : null;
      },
      apply(s, seat, action) {
        const [, , name] = String(action[0]).split(":");
        const e = ext(s);
        return withExt({ ...s, log: [...s.log, `${seat} copies ${name} with the Courtesans' Guild.`] }, { ...e, courtesan: { ...e.courtesan, [seat]: name! } });
      },
      auto: (s) => s,
    },
  },
  handlers: {
    decks: (decks: { age: number; names: string[] }[]) =>
      decks.map((d) => (d.age === 3 ? { ...d, names: [...d.names, "Courtesans Guild", "Diplomats Guild", "Gamers Guild", "Architects Guild"] } : d)),
    setup(s: State, rng: { int(n: number): number }): State {
      const pool = shuffle(rng, LEADERS.filter((l) => l.set === "leaders" || (l.set === "cities" && s.addons.includes("cities")) || (l.set === "promo" && s.addons.includes("leaderPromos"))).map((l) => l.name));
      const draft: { [x: string]: string[] } = {};
      let players = { ...s.players };
      s.seats.forEach((x, i) => {
        draft[x] = pool.slice(i * draftSize, (i + 1) * draftSize);
        players = { ...players, [x]: { ...players[x]!, coins: players[x]!.coins + 3 } };
      });
      return { ...s, players, draft, draftRound: 1, leaderBox: pool.slice(s.seats.length * draftSize), phase: "draft" };
    },
    ageStart: (s: State) => (s.seats.some((x) => s.players[x]!.leaderHand.length) ? { ...s, phase: "recruit" } : s),
    effects(s: State, seat: SeatId) {
      const out = active(s, seat).flatMap((l) => leaderDef(l).eff.map((eff) => ({ eff, src: "leader" as const })));
      const copy = ext(s).courtesan[seat];
      if (copy) for (const eff of leaderDef(copy).eff) out.push({ eff, src: "leader" });
      return out;
    },
    payment(pc: PayCtx, s: State, seat: SeatId, item: Item, ctx: Ctx): PayCtx {
      void ctx;
      const mine = active(s, seat).flatMap((l) => leaderDef(l).eff).concat(ext(s).courtesan[seat] ? leaderDef(ext(s).courtesan[seat]!).eff : []);
      const disc = mine.filter((e) => e.k === "discount" && e.color === item.color).length;
      const bank = mine.some((e) => e.k === "bilkis") ? 1 : 0;
      return { ...pc, discount: pc.discount + disc, bank: pc.bank + bank };
    },
    freeBuild(s: State, seat: SeatId, item: Item) {
      if (item.type !== "card" || item.color !== "purple") return null;
      return active(s, seat).some((l) => leaderDef(l).eff.some((e) => e.k === "freeGuilds")) ? "Ramses" : null;
    },
    onBuild(s: State, seat: SeatId, item: Item, effsBuilt: Eff[], rng: { int(n: number): number }, ctx?: Ctx): State {
      void rng; void ctx;
      const mine = active(s, seat).flatMap((l) => leaderDef(l).eff);
      if (item.type === "card" && item.color === "yellow") s = gain(s, seat, 2 * mine.filter((e) => e.k === "xenophon").length);
      if (item.type === "card" && item.free === "chain") s = gain(s, seat, 2 * mine.filter((e) => e.k === "vitruvius").length);
      for (const e of effsBuilt) {
        if (e.k === "courtesan") s = { ...s, pending: [...s.pending, { seat, kind: "courtesan", data: null }] };
        if (e.k === "drawLeaders") s = setP({ ...s, leaderBox: s.leaderBox.slice(e.n) }, seat, (p) => ({ ...p, leaderHand: [...p.leaderHand, ...s.leaderBox.slice(0, e.n)] }));
        if (e.k === "extraLeader") s = { ...s, pending: [...s.pending, { seat, kind: "extraLeader", data: null }] };
      }
      return s;
    },
    endTurn(s: State): State {
      // Hatshepsut: 1 coin per neighbour bought from this turn (once per turn).
      const e = ext(s);
      if (e.hatPly === s.logPly) return s;
      for (const x of s.seats) {
        const n = active(s, x).filter((l) => leaderDef(l).eff.some((f) => f.k === "hatshepsut")).length;
        if (!n) continue;
        s = gain(s, x, n * s.bought.filter((b) => b.startsWith(`${x}>`)).length);
      }
      return withExt(s, { ...ext(s), hatPly: s.logPly });
    },
    conflict(c: Conflict, s: State): Conflict {
      if (c.winner === null) return c;
      const loser = c.winner === c.a ? c.b : c.a;
      const has = (x: SeatId, k: Eff["k"]) => active(s, x).some((l) => leaderDef(l).eff.some((e) => e.k === k)) || (ext(s).courtesan[x] ? leaderDef(ext(s).courtesan[x]!).eff.some((e) => e.k === k) : false);
      let r = c;
      if (has(loser, "tomyris")) r = { ...r, defeatTo: c.winner };
      if (has(c.winner, "nero")) r = { ...r, bonus: { ...r.bonus, [c.winner]: (r.bonus[c.winner] ?? 0) + 2 * r.tokens } };
      return r;
    },
    score(s: State, seat: SeatId, ctx: Ctx): Line[] {
      const p = s.players[seat]!;
      const lines: Line[] = [];
      for (const { eff, src } of effectsOf(s, seat, ctx)) {
        const cat = src === "leader" ? "leaders" : src === "purple" ? "guilds" : "other";
        if (eff.k === "leaderVP") {
          const all: Color[] = ["brown", "grey", "blue", "yellow", "green", "red", "purple"];
          const vp = eff.what === "victoryTokens" ? p.victories.length
            : eff.what === "plato" ? 7 * Math.min(...all.map((c) => colorCount(s, seat, [c])))
            : eff.what === "justinian" ? 3 * Math.min(...(["red", "blue", "green"] as Color[]).map((c) => colorCount(s, seat, [c])))
            : eff.what === "coins3" ? idiv(p.coins, 3)
            : eff.what === "louis" ? Math.max(0, 7 - p.victories.length) : 0;
          lines.push({ cat, vp });
        }
        if (eff.k === "perLeaderNbrVP") lines.push({ cat, vp: eff.n * nbrs(s, seat).reduce((t, x) => t + s.players[x]!.leaders.length, 0) });
        if (eff.k === "nbrGuildsVP") lines.push({ cat, vp: eff.n * nbrs(s, seat).reduce((t, x) => t + colorCount(s, x, ["purple"]), 0) });
      }
      return lines;
    },
  },
};

