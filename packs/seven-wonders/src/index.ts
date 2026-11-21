// 7 Wonders (2nd edition) on the phase runner, with its expansions as options: Leaders, Cities and the Wonder
// Pack (1st edition), each a module under ./expansions that the rules call when its option is on (./kernel.ts).
// Mechanics only: card names and numbers, no rulebook text. Each age is a round: deal, ready, then turn1/end1 ...
// turn7/end7 (a simultaneous hidden pick and the end of that turn), last (a last card some boards play) and war;
// Leaders adds its draft and recruitment before the deal, Cities a debt question before each end of turn.
// Questions to one seat go through the interrupt queue. Rules summary and option rules: ../README.md.
import {
  compareStrings, contents, definePack, idiv, phaseRunner, sample, shuffle, withItems, zone,
  type Action, type Options, type Phase, type Prompt, type Rng, type SeatId, type Step, type Viewer,
} from "@boardcore/pack-sdk";
import { BASE_CARDS } from "./data";
import {
  askPending, buildStage, built, cardItem, cardOf, cardWays, chosenPlan, DISCARD_BUILD, gain, has, keyAge, keyName, military, opt, pay, RES_NAME,
  say, scoreAll, setP, settleLosses, stageDefs, stageOf, total, wayFree, wayPrompts, wonderOf, copiedStage, cardOf as defOf, rightOf, leftOf,
  type Lib, type Line, type Player, type State, type Way,
} from "./engine";
import { cities } from "./expansions/cities";
import { draftPhase, freezePhase, leaders, LEADERS_START_COINS, recruitPhase } from "./expansions/leaders";
import { wonderPack } from "./expansions/wonder-pack";
import { EXPANSION_IDS, makeLib, mixes, mixKey, type Expansion } from "./kernel";
import { resampleBase } from "./resample";

export const TURNS = 7;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
/** The phases of an age with no expansion on. */
export const PHASES = ["deal", "ready", ...range(TURNS).flatMap((n) => [`turn${n}`, `end${n}`]), "last", "war"];
/** The expansion modules, in the order the rules call them. */
export const EXPANSIONS: readonly Expansion[] = [leaders, cities, wonderPack];
export const START_COINS = 3;

const roman = (age: number) => ["", "I", "II", "III"][age] ?? String(age);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * The age decks: the base cards for the seat count, then what the expansions add (which may draw),
 * then players + 2 guilds (9 at 8 seats, set up like 7) chosen from every guild in Age III, and
 * each deck shuffled. `setup` and `resampleHidden` both build them here, drawing alike (11 §3 `sample`).
 */
export function buildDecks(lib: Lib, n: number, rng: Rng): string[][] {
  const count = Math.min(n, 7);
  let ids = [1, 2, 3].map((age) => BASE_CARDS.filter((c) => c.age === age).flatMap((c) => (c.color === "purple" ? [c.id] : c.counts.filter((k) => k <= count).map(() => c.id))));
  for (const m of lib.mods) if (m.decks) ids = m.decks(ids, n, rng);
  const isGuild = (id: string) => lib.cards.get(id)?.color === "purple";
  const guilds = sample(rng, ids[2]!.filter(isGuild), n === 8 ? 9 : n + 2);
  ids = ids.map((d, i) => (i === 2 ? [...d.filter((x) => !isGuild(x)), ...guilds] : d));
  for (const d of ids) for (const id of d) cardOf(lib, id);
  return ids.map((d) => shuffle(rng, d));
}

/** The first legal path, for a timeout: discarding (or skipping) where it can, else the first enabled option. */
function firstPath(choices: (p: Step[]) => Prompt | null): Action | null {
  const path: Step[] = [];
  for (let i = 0; i < 8; i++) {
    const p = choices(path);
    if (!p) return path.length ? path : null;
    if (p.kind !== "pick") return null;
    const o = p.options.find((x) => !x.disabled && /(^|:)(sell|skip|pass)$/.test(x.id)) ?? p.options.find((x) => !x.disabled);
    if (!o) return null;
    path.push(o.id);
  }
  return null;
}

/** The board text's width: what a phone shows of it (about 36 columns). */
export const BOARD_WIDTH = 34;
/** One line of board text wrapped at word breaks to BOARD_WIDTH, the rest indented by two spaces. */
export function wrap(line: string, width = BOARD_WIDTH): string[] {
  const lead = /^ */.exec(line)![0];
  const out: string[] = [];
  let ind = lead, cur = "";
  for (const w of line.slice(lead.length).split(" ")) {
    if (cur && ind.length + cur.length + 1 + w.length > width) { out.push(ind + cur); ind = `${lead}  `; cur = w; }
    else cur = cur ? `${cur} ${w}` : w;
  }
  out.push(ind + cur);
  return out.flatMap((l) => (l.length <= width ? [l] : l.match(new RegExp(`.{1,${width}}`, "g"))!));
}

/**
 * The outcome (11 §2, D79): places by points, a tie broken by the most coins, still tied shares the place;
 * scores are the points. Places are competition ranks (1, 1, 3), so the winners are the seats at place 1.
 */
export function outcomeOf(s: { seats: SeatId[]; players: { [seat: string]: { coins: number } } }, pts: { [seat: string]: number }) {
  const coins = (x: SeatId) => s.players[x]!.coins;
  const beats = (a: SeatId, b: SeatId) => pts[a]! > pts[b]! || (pts[a] === pts[b] && coins(a) > coins(b));
  const places: { [seat: string]: number } = {};
  for (const x of s.seats) places[x] = 1 + s.seats.filter((y) => beats(y, x)).length;
  const scores: { [seat: string]: number } = {};
  for (const x of s.seats) scores[x] = pts[x]!;
  const top = s.seats.filter((x) => places[x] === 1);
  const ranking = s.seats.slice().sort((a, b) => places[a]! - places[b]! || compareStrings(a, b)).map((x) => `${x} ${pts[x]}`).join(", ");
  return { winners: top, places, scores, text: `${top.join(" and ")} win${top.length === 1 ? "s" : ""}: ${ranking}` };
}

const LEGEND =
  "7 Wonders. Three ages; each turn everyone picks a card at once and builds it, builds a wonder stage with it, or discards it for 3 coins, " +
  "then passes the rest of the hand on (left in Ages I and III, right in Age II). Resources you lack can be bought from your two neighbours " +
  "for 2 coins each. Military is compared with both neighbours at the end of each age. Most victory points after Age III wins.";

/** One mix of expansions as a game: its content, its phases in order and its runner. */
function makeGame(lib: Lib) {
  const handOf = (s: State, seat: SeatId) => contents(s.players[seat]!.hand);
  const handPrompt = (s: State, seat: SeatId, partial: Step[], label: string): Prompt | null => {
    const hand = handOf(s, seat);
    if (partial.length === 0) return { kind: "pick", label, options: hand.map((k, i) => opt(`c:${i}`, keyName(k))) };
    const key = hand[Number(String(partial[0]).slice(2))];
    if (key === undefined || typeof partial[0] !== "string" || !partial[0].startsWith("c:")) return null;
    return wayPrompts(cardWays(lib, s, seat, key), partial.slice(1), `Play ${keyName(key)}`);
  };

  /** Plays every pick: payments first, then the cards go down, then their effects (coins gained this turn can't pay this turn). */
  const resolveHands = (s: State, picks: { [seat: string]: Action }): State => {
    const done: { seat: SeatId; i: number; key: string; way: Way; free: string | null }[] = [];
    for (const seat of s.seats) {
      const path = picks[seat];
      if (!path) continue;
      const i = Number(String(path[0]).slice(2));
      const key = handOf(s, seat)[i]!;
      const way = cardWays(lib, s, seat, key).find((w) => w.id === path[1])!;
      done.push({ seat, i, key, way, free: wayFree(lib, s, seat, key, way.id) });
      s = pay(s, seat, way.coins, chosenPlan(way, path.slice(1)));
    }
    const after: (() => void)[] = [];
    for (const d of done) {
      s = setP(s, d.seat, (p) => ({ ...p, hand: withItems(p.hand, p.hand.items.filter((_, j) => j !== d.i)) }));
      if (d.way.id === "build") {
        const c = defOf(lib, d.key);
        s = setP(s, d.seat, (p) => ({ ...p, cards: [...p.cards, d.key], colors: { ...p.colors, [c.color]: (p.colors[c.color] ?? 0) + 1 } }));
        if (d.free?.endsWith("once an age")) s = setP(s, d.seat, (p) => ({ ...p, freeUsed: { ...p.freeUsed, [`color:${c.color}`]: s.age } }));
        s = say(s, `${d.seat} builds ${c.name}${d.free ? ` (free: ${d.free})` : ""}.`);
        after.push(() => { s = built(lib, s, d.seat, c.eff, cardItem(c, d.free)); });
      } else if (d.way.id.startsWith("wonder")) {
        const st = stageOf(s.players[d.seat]!, d.way.id);
        after.push(() => { s = buildStage(lib, s, d.seat, st, d.key); });
      } else {
        s = say({ ...s, discard: withItems(s.discard, [...s.discard.items, d.key]) }, `${d.seat} discards a card for 3 coins.`);
        after.push(() => { s = gain(s, d.seat, 3); });
      }
    }
    for (const f of after) f();
    return s;
  };

  const discardLast = (s: State, seats: SeatId[]): State => {
    for (const x of seats) {
      const h = s.players[x]!.hand.items;
      if (!h.length) continue;
      s = setP(s, x, (p) => ({ ...p, hand: withItems(p.hand, []) }));
      s = { ...s, discard: withItems(s.discard, [...s.discard.items, ...h]) };
    }
    return s;
  };

  const turnPhase = (n: number): Phase<State> => ({
    id: `turn${n}`, kind: "pick",
    seats: (s) => s.seats.filter((x) => s.players[x]!.hand.items.length >= 2),
    choices: (s, seat, partial) => handPrompt(s, seat, partial, `Age ${roman(s.age)}, turn ${n}: choose a card`),
    resolve: (s, picks, ctx) => {
      // Nobody had two cards (turn 7 without the eighth card a seat): no turn is played, so `turn` stays and
      // the end phase after it fires nothing (PR #118 second review).
      if (!Object.keys(picks).length) return s;
      s = resolveHands({ ...s, turn: n, gained: {}, bought: [] }, picks);
      if (s.seats.every((x) => s.players[x]!.hand.items.length <= 1)) s = discardLast(s, s.seats.filter((x) => !has(lib, s, x, "lastCard")));
      return askPending(lib, s, ctx);
    },
  });

  /** Before the end of a turn (and the war): the coin losses, when an expansion settles them by a question. */
  const lossPhase = (id: string): Phase<State> => ({ id, kind: "auto", begin: (s, ctx) => settleLosses(lib, askPending(lib, s, ctx), ctx) });

  const endPhase = (n: number): Phase<State> => ({
    id: `end${n}`, kind: "auto",
    begin: (s, ctx) => {
      if (s.turn !== n) return s;
      s = settleLosses(lib, askPending(lib, s, ctx), ctx);
      // Every module reads the turn as it ended, before any of these coins.
      for (const g of lib.mods.flatMap((m) => (m.endTurn ? m.endTurn(s, n) : []))) s = gain(s, g.seat, g.n);
      if (!s.seats.some((x) => s.players[x]!.hand.items.length > 1)) return s;
      if (!lib.mods.every((m) => !m.passes || m.passes(s, n))) return say(s, "The hands don't pass this turn.");
      // Hands move left in Ages I and III, right in Age II. Each seat now sees the hand it gets, so the hands
      // are read through the zone reader: the action that ends the turn is a reveal (it can be the answer
      // to a question asked before this phase, not only the last pick).
      const players = { ...s.players };
      for (const seat of s.seats) {
        const from = s.age === 2 ? leftOf(s, seat) : rightOf(s, seat);
        players[seat] = { ...players[seat]!, hand: withItems(players[seat]!.hand, ctx.zones.items(s.players[from]!.hand)) };
      }
      return { ...s, players };
    },
  });

  const asks = lib.mods.some((m) => m.losses);
  const phases: Phase<State>[] = [
    ...(lib.on.leaders ? [...range(3).map(draftPhase), recruitPhase(lib)] : []),
    {
      id: "deal", kind: "auto",
      begin: (s, ctx) => {
        const age = ctx.round;
        const deck = ctx.zones.items(s.decks[age - 1]!);
        const per = idiv(deck.length, s.seats.length);
        const players = { ...s.players };
        s.seats.forEach((x, i) => { players[x] = { ...players[x]!, hand: withItems(players[x]!.hand, deck.slice(i * per, (i + 1) * per)) }; });
        const decks = s.decks.map((d, i) => (i === age - 1 ? withItems(d, []) : d));
        return say({ ...s, age, turn: 0, players, decks, gained: {}, bought: [] }, `Age ${roman(age)} begins.`);
      },
    },
    { id: "ready", kind: "auto", begin: (s, ctx) => settleLosses(lib, askPending(lib, s, ctx), ctx) },
    ...range(TURNS).flatMap((n) => [...(lib.on.leaders ? [freezePhase(n)] : []), turnPhase(n), ...(asks ? [lossPhase(`debt${n}`)] : []), endPhase(n)]),
    {
      id: "last", kind: "pick",
      seats: (s) => s.seats.filter((x) => s.players[x]!.hand.items.length === 1 && has(lib, s, x, "lastCard")),
      choices: (s, seat, partial) => handPrompt(s, seat, partial, "Play your last card"),
      resolve: (s, picks, ctx) => askPending(lib, resolveHands({ ...s, gained: {}, bought: [] }, picks), ctx),
    },
    ...(asks ? [lossPhase("debtWar")] : []),
    {
      id: "war", kind: "auto",
      begin: (s, ctx) => {
        s = discardLast(askPending(lib, s, ctx), s.seats);
        for (const m of lib.mods) if (m.ageEnd) s = m.ageEnd(s);
        return settleLosses(lib, military(lib, s), ctx);
      },
    },
  ];

  const run = phaseRunner<State>({
    phases,
    interrupts: {
      ...Object.assign({}, ...lib.mods.map((m) => (m.questions ? m.questions(lib) : {}))),
      // Build a card from the discard pile for free (boards, Solomon), or nothing.
      [DISCARD_BUILD]: {
        choices: (s, q, partial) => {
          if (partial.length) return null;
          const p = s.players[q.seat]!;
          const ok = [...new Set(contents(s.discard))].filter((k) => !p.cards.some((c) => keyName(c) === keyName(k)));
          return { kind: "pick", label: "Build a discarded card for free", options: [...ok.map((k) => opt(`d:${k}`, `${keyName(k)} (Age ${roman(keyAge(k))})`)), opt("skip", "Build nothing")] };
        },
        answer: (s, q, action, ctx) => {
          const seen = s.discard.seenBy === "all" ? "all" : s.discard.seenBy.filter((x) => x !== q.seat);
          const pile = ctx.zones.items(s.discard);
          s = { ...s, discard: { ...s.discard, seenBy: seen } };
          const id = String(action[0]);
          if (id === "skip") return say(s, `${q.seat} builds nothing from the discard pile.`);
          const key = id.slice(2);
          const i = pile.indexOf(key);
          if (i < 0) throw new Error(`${key} isn't in the discard pile`);
          s = { ...s, discard: withItems(s.discard, pile.filter((_, j) => j !== i)) };
          const c = defOf(lib, key);
          s = setP(s, q.seat, (p) => ({ ...p, cards: [...p.cards, key], colors: { ...p.colors, [c.color]: (p.colors[c.color] ?? 0) + 1 } }));
          s = say(s, `${q.seat} builds ${c.name} from the discard pile.`);
          return askPending(lib, built(lib, s, q.seat, c.eff, cardItem(c, "discard")), ctx, true);
        },
      },
    },
  });

  const viewOf = (s: State, viewer: Viewer): SWView => {
    const own = viewer !== "spectator" && s.players[viewer] ? viewer : null;
    const acting = run.actors(s);
    const players: SWView["players"] = {};
    for (const x of s.seats) {
      const p = s.players[x]!;
      players[x] = {
        wonder: p.wonder, side: p.side, base: wonderOf(lib, p.wonder).base, stages: p.built, stageCount: stageDefs(lib, p).length, stageCosts: p.stageCosts,
        cards: p.cards.map(keyName), colors: p.colors, coins: p.coins, victories: p.victories, defeats: p.defeats, extras: p.extras,
        handSize: p.hand.items.length, waiting: acting.includes(x),
      };
    }
    const seesDiscard = own !== null && s.discard.seenBy !== "all" && s.discard.seenBy.includes(own);
    return {
      viewer, seats: s.seats, sets: s.sets, age: s.age, turn: s.turn, run: run.view(s), players, partner: s.partner, discardSize: s.discard.items.length, actors: acting, log: s.log,
      hand: own ? handOf(s, own).map(keyName) : [],
      pick: own && Object.prototype.hasOwnProperty.call(s.run.picks, own) ? s.run.picks[own]! : null,
      discard: seesDiscard ? contents(s.discard).map(keyName) : [],
      scores: s.run.over ? scoreAll(lib, s) : null,
      ...Object.assign({}, ...lib.mods.map((m) => (m.view ? m.view(s, viewer) : {}))),
    };
  };

  return {
    lib, run,
    /** A new game of this mix: the boards and decks, each expansion's own state, then the first phase. */
    setup(options: Options, ids: SeatId[], rng: Rng): State {
      const n = ids.length;
      const team = options.teamPlay === true;
      const pool = [...lib.wonders.values()].filter((w) => (w.needs ?? []).every((x) => lib.sets.includes(x))).map((w) => w.id);
      const wonders = sample(rng, pool, n);
      const coins0 = lib.on.leaders ? LEADERS_START_COINS : START_COINS;
      const players: { [seat: string]: Player } = {};
      ids.forEach((seat, i) => {
        const w = wonderOf(lib, wonders[i]!);
        const side: "A" | "B" = options.randomSides === true ? (rng.int(2) === 0 ? "A" : "B") : options.sideB === true ? "B" : "A";
        players[seat] = {
          wonder: w.id, side, built: [], stageCosts: w[side].map((x) => x.cost), cards: [], colors: {}, coins: coins0 + (w.coins ?? 0),
          victories: [], defeats: 0, hand: zone<string>([], [seat]), markers: zone<string>([], [seat]), extras: [], freeUsed: {},
        };
      });
      // A stage costing "?" copies a neighbour's stage and costs what that stage costs (the Wonder Pack's
      // Manneken Pis A): fixed here, once every board is dealt. A copy of a copy costs nothing.
      ids.forEach((seat, i) => {
        const p = players[seat]!, defs = wonderOf(lib, p.wonder)[p.side];
        players[seat] = { ...p, stageCosts: p.stageCosts.map((cost, k) => {
          if (cost !== "?") return cost;
          const c = defs[k]!.eff.find((e) => e.k === "copyStage") as Extract<SWEff, { k: "copyStage" }> | undefined;
          if (!c) return "";
          const o = players[ids[(i + (c.side === "L" ? n - 1 : 1)) % n]!]!;
          const copied = o.stageCosts[copiedStage(c.stage, o.stageCosts.length)];
          return copied === undefined || copied === "?" ? "" : copied;
        }) };
      });
      const partner: { [seat: string]: string } = {};
      // Team play: adjacent pairs in seat order (0 with 1, 2 with 3, ...).
      if (team) for (let i = 0; i + 1 < n; i += 2) { partner[ids[i]!] = ids[i + 1]!; partner[ids[i + 1]!] = ids[i]!; }
      const decks = buildDecks(lib, n, rng).map((d) => zone(d, []));
      const s: Omit<State, "run"> = {
        seats: ids, sets: lib.sets, age: 0, turn: 0, players, decks, discard: zone<string>([], []), pending: [], losses: {}, gained: {}, bought: [], partner,
        log: team ? [`Team play: ${ids.filter((_, i) => i % 2 === 0).map((a) => `${a} & ${partner[a]}`).join(", ")}.`] : [],
      };
      const own = lib.mods.map((m) => m.setup({ seats: ids, sets: lib.sets }, options, rng));
      return run.start(Object.assign(s, ...own), { seats: ids, rounds: 3, rng });
    },
    view: viewOf,
    describe(s: State, seat: SeatId, action: Action, viewer: Viewer): string | null {
      if (s.log.length) return s.log.join(" ");
      if (viewer !== seat) return `${seat} has chosen.`;
      const id = String(action[0]);
      // A leader (the draft, a recruitment) is named alone; a card with the way it is played.
      if (id.startsWith("l:")) return `You choose ${id.slice(2)}.`;
      const key = id.startsWith("c:") ? handOf(s, seat)[Number(id.slice(2))] : undefined;
      return `You choose ${key ? keyName(key) : id}${action[1] ? ` (${String(action[1])})` : ""}.`;
    },
    resample(s: State, seat: SeatId, rng: Rng): State {
      s = resampleBase(lib, s, seat, rng, buildDecks);
      for (const m of lib.mods) if (m.resample) s = m.resample(s, seat, rng);
      // Last: the other seats' pending picks, redrawn from the prompts this world offers them.
      return run.resample(s, seat, rng);
    },
  };
}

/** Every mix of expansions, made once when the pack is loaded: a state's `sets` names its mix. */
const GAMES = new Map(mixes(EXPANSIONS).map((mods) => { const g = makeGame(makeLib(mods)); return [mixKey(g.lib.sets), g] as const; }));
const gameOf = (sets: readonly string[]) => {
  const g = GAMES.get(mixKey(sets));
  if (!g) throw new Error(`no game with ${sets.join(", ")}`);
  return g;
};
const game = (s: State) => gameOf(s.sets);
const modsOf = (v: SWView) => gameOf(v.sets).lib.mods;

/**
 * The option rules (README "Option rules"): the combinations and seat counts a game can't start with, each
 * refused in words. Returns the mix to play.
 */
export function checkOptions(options: Options, n: number): string[] {
  const on = EXPANSION_IDS.filter((id) => options[id] === true);
  if (options.leaderPromos === true && !on.includes("leaders")) throw new Error("The promo leaders need the Leaders expansion: switch Leaders on, or the promo leaders off");
  const max = Math.max(7, ...EXPANSIONS.filter((m) => on.includes(m.id)).map((m) => m.maxSeats ?? 0));
  if (n < 3 || n > 8) throw new Error("7 Wonders needs 3 to 7 players, or 8 with the Cities expansion");
  if (n > max) throw new Error("8 players need the Cities expansion: switch Cities on, or play with 3 to 7 players");
  if (options.teamPlay === true && (n < 4 || n % 2 !== 0)) throw new Error("Team play needs 4, 6 or 8 players (8 with the Cities expansion)");
  return ["base", ...on];
}

const heading = (v: SWView) => {
  if (v.scores) return "Game over";
  if (v.run.phase === null) return "Setting up";
  const ph = v.run.phase;
  if (v.age === 0) return "Before Age I";
  if (ph === "recruit" || /^draft\d+$/.test(ph)) return `Before Age ${roman(v.age + 1)}`;
  if (/^(freeze|turn|debt|end)\d+$/.test(ph)) return `Age ${roman(v.age)}, turn ${ph.replace(/\D/g, "")}`;
  if (ph === "last") return `Age ${roman(v.age)}: last card`;
  return `Age ${roman(v.age)}`;
};

export default definePack<State, SWView>({
  setup({ options, seats, rng }) {
    const ids = seats.map((x) => x.seat);
    return gameOf(checkOptions(options, ids.length)).setup(options, ids, rng);
  },

  choices: (s, seat, partial) => game(s).run.choices(s, seat, partial),

  apply: (s, seat, action, rng) => game(s).run.apply({ ...s, log: [] }, seat, action, rng),

  view: (s, viewer) => game(s).view(s, viewer),

  status(s) {
    const g = game(s);
    if (!s.run.over) return { actors: g.run.actors(s) };
    const lines = scoreAll(g.lib, s);
    return { actors: [], outcome: outcomeOf(s, Object.fromEntries(s.seats.map((x) => [x, total(lines[x]!)]))) };
  },

  describe: (s, seat, action, viewer) => game(s).describe(s, seat, action, viewer),

  audience: () => "seat",

  onTimeout: (s, seat) => firstPath((p) => game(s).run.choices(s, seat, p)),

  resampleHidden: (s, seat, rng) => game(s).resample(s, seat, rng),

  text: {
    legend: (v) => [LEGEND, ...modsOf(v).flatMap((m) => (m.legend ? [m.legend] : []))].join("\n"),
    state(v) {
      const parts: string[] = [`${heading(v)}.`];
      for (const x of v.seats) {
        const p = v.players[x]!;
        const ex = p.extras.filter((e) => e.off === null).map((e) => e.name);
        parts.push(`${x}: ${p.wonder} ${p.side} (${p.base ? RES_NAME[p.base] : "no resource"}), stages ${p.stages.length}/${p.stageCount}, ${plural(p.coins, "coin")}` +
          `, military ${p.victories.join("+") || "0"}${p.defeats ? ` -${p.defeats}` : ""}${ex.length ? `, ${ex.join(", ")}` : ""}` +
          `${v.partner[x] ? `, partner ${v.partner[x]}` : ""}; city: ${p.cards.join(", ") || "empty"}${p.waiting ? " (choosing)" : ""}.`);
      }
      if (v.hand.length) parts.push(`Your hand: ${v.hand.join(", ")}.`);
      if (v.discard.length) parts.push(`Discard pile: ${v.discard.join(", ")}.`);
      if (v.log.length) parts.push(`Last: ${v.log.join(" ")}`);
      if (v.scores) for (const x of v.seats) parts.push(`${x} scores ${total(v.scores[x]! as Line[])}: ${v.scores[x]!.map((l) => `${l.cat} ${l.vp}`).join(", ")}.`);
      // Each expansion's own line (Leaders: the viewer's leaders; Cities: debt and diplomacy tokens).
      return [parts.join(" "), ...modsOf(v).flatMap((m) => (m.text ? [m.text(v)] : []))].join("\n");
    },
    layout(v) {
      // Narrow enough for a phone (about 36 columns): a few short lines a seat, wrapped at word breaks.
      const out: string[] = [heading(v)];
      for (const x of v.seats) {
        const p = v.players[x]!;
        const ex = p.extras.filter((e) => e.off === null).map((e) => e.name);
        const mil = p.victories.reduce((a, b) => a + b, 0) - p.defeats;
        out.push(...wrap(`${x}: ${p.wonder} ${p.side}${p.waiting ? " (choosing)" : ""}`));
        out.push(...wrap(`  stage ${p.stages.length}/${p.stageCount}, ${plural(p.coins, "coin")}, military ${mil}${v.partner[x] ? `, partner ${v.partner[x]}` : ""}`));
        const city = [...p.cards, ...ex];
        if (city.length) out.push(...wrap(`  ${city.join(", ")}`));
      }
      if (v.hand.length) out.push(...wrap(`Your hand: ${v.hand.join(", ")}`));
      if (v.scores) {
        for (const x of v.seats) {
          const sum = new Map<string, number>();
          for (const l of v.scores[x]! as Line[]) sum.set(l.cat, (sum.get(l.cat) ?? 0) + l.vp);
          const n = total(v.scores[x]! as Line[]);
          out.push(...wrap(`${x} ${plural(n, "point")}: ${[...sum].map(([c, k]) => `${c} ${k}`).join(", ")}`));
        }
      }
      return out.join("\n");
    },
  },
});
