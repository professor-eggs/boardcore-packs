// 7 Wonders (base game) on the phase runner, with typed points for its expansions (each its own add-on pack:
// boardcore/seven-wonders-leaders, -cities, -wonder-pack). Mechanics only: card names and numbers, no rulebook
// text. Each age is a round: deal, ready, then turn1/end1 ... turn7/end7 (a simultaneous hidden pick and the
// end of that turn), last (a last card some boards play) and war. Questions to one seat go through the
// interrupt queue. Rules summary and gaps: ../README.md, ../CONTRACT-GAPS.md.
import {
  compareStrings, contents, defineBase, idiv, phaseRunner, sample, shuffle, withItems, zone,
  type Action, type Phase, type PhaseCtx, type PointDecl, type Prompt, type Question, type Rng, type SeatId, type Step, type Viewer,
} from "@boardcore/pack-sdk";
import { BASE_CARDS, BASE_WONDERS } from "./data";
import {
  applyOps, buildStage, built, cardItem, cardOf, cardWays, chosenPlan, effs, gain, has, keyAge, keyName, military, opt, pay, RES_NAME,
  say, scoreAll, setP, settleLosses, stageDefs, stageOf, stageWays, total, wayFree, wayPrompts, wonderOf, cardOf as defOf, rightOf, leftOf,
  type Lib, type Line, type Op, type Player, type State, type Way,
} from "./engine";
import { resampleBase } from "./resample";

export const TURNS = 7;
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
export const PHASES = ["deal", "ready", ...range(TURNS).flatMap((n) => [`turn${n}`, `end${n}`]), "last", "war"];
const OPS = ["coins", "pay", "loss", "clearLoss", "grant", "off", "stage", "log"];

const POINTS: PointDecl[] = [
  { name: "cards", shape: "registry", result: "object" },
  { name: "wonders", shape: "registry", result: "object" },
  { name: "sets", shape: "registry", result: "object" },
  { name: "phases", shape: "phases", result: "value", ops: OPS, interrupts: true },
  { name: "decks", shape: "modifier", result: "list", draws: true },
  { name: "maxSeats", shape: "modifier", result: "integer" },
  { name: "onBuild", shape: "event", result: "value", ops: OPS },
  { name: "endTurn", shape: "event", result: "value", ops: OPS },
  { name: "ageEnd", shape: "event", result: "value", ops: OPS },
  { name: "conflictSeats", shape: "modifier", result: "list" },
  { name: "shields", shape: "modifier", result: "object" },
  { name: "conflicts", shape: "modifier", result: "list" },
  { name: "passes", shape: "modifier", result: "boolean" },
  { name: "lossRule", shape: "slot", result: "text", default: true },
  { name: "score", shape: "scoring", result: "object" },
];

const roman = (age: number) => ["", "I", "II", "III"][age] ?? String(age);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * The age decks: the base cards for the seat count, then what the add-ons add (the `decks` point, which
 * may draw), then players + 2 guilds (9 at 8 seats, set up like 7) chosen from every guild in Age III, and
 * each deck shuffled. `setup` and `resampleHidden` both build them here, drawing alike (11 §3 `sample`).
 */
export function buildDecks(lib: Lib, n: number, rng: Rng): string[][] {
  const count = Math.min(n, 7);
  let ids = [1, 2, 3].map((age) => BASE_CARDS.filter((c) => c.age === age).flatMap((c) => (c.color === "purple" ? [c.id] : c.counts.filter((k) => k <= count).map(() => c.id))));
  ids = lib.pts.decks(null, ids, { seats: n });
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

export default defineBase<"boardcore/seven-wonders">({
  points: POINTS,
  own: {
    cards: BASE_CARDS,
    wonders: BASE_WONDERS,
    sets: [{ id: "base" }],
    phases: PHASES,
    lossRule: () => "pay",
  },
  make(pts) {
    const lib: Lib = {
      cards: new Map(pts.cards().map((c) => [c.id, c])),
      wonders: new Map(pts.wonders().map((w) => [w.id, w])),
      sets: pts.sets().map((x) => x.id),
      pts,
    };

    /** The base's questions raised outside a phase of its own (an add-on's operation built a card): asked now. */
    const askPending = (s: State, ctx: PhaseCtx): State => {
      if (!s.pending.length) return s;
      let discard = s.discard;
      for (const p of s.pending) {
        ctx.ask({ kind: p.kind, seat: p.seat, args: null, default: ["skip"] });
        // The seat looks through the discard pile while it is asked (its view shows it).
        if (p.kind === "discardBuild" && discard.seenBy !== "all" && !discard.seenBy.includes(p.seat)) discard = { ...discard, seenBy: [...discard.seenBy, p.seat] };
      }
      return { ...s, discard, pending: [] };
    };

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
        return askPending(s, ctx);
      },
    });

    const endPhase = (n: number): Phase<State> => ({
      id: `end${n}`, kind: "auto",
      begin: (s, ctx) => {
        if (s.turn !== n) return s;
        s = settleLosses(lib, askPending(s, ctx));
        s = applyOps(lib, s, pts.endTurn(s, { turn: n }));
        if (!s.seats.some((x) => s.players[x]!.hand.items.length > 1)) return s;
        if (!pts.passes(s, true, { turn: n })) return say(s, "The hands don't pass this turn.");
        // Hands move left in Ages I and III, right in Age II. Each seat now sees the hand it gets, so the hands
        // are read through the zone reader: the action that ends the turn is a reveal (it can be an add-on's
        // answer to a question asked before this phase, not only the last pick).
        const players = { ...s.players };
        for (const seat of s.seats) {
          const from = s.age === 2 ? leftOf(s, seat) : rightOf(s, seat);
          players[seat] = { ...players[seat]!, hand: withItems(players[seat]!.hand, ctx.zones.items(s.players[from]!.hand)) };
        }
        return { ...s, players };
      },
    });

    const phases: Phase<State>[] = [
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
      { id: "ready", kind: "auto", begin: (s, ctx) => settleLosses(lib, askPending(s, ctx)) },
      ...range(TURNS).flatMap((n) => [turnPhase(n), endPhase(n)]),
      {
        id: "last", kind: "pick",
        seats: (s) => s.seats.filter((x) => s.players[x]!.hand.items.length === 1 && has(lib, s, x, "lastCard")),
        choices: (s, seat, partial) => handPrompt(s, seat, partial, "Play your last card"),
        resolve: (s, picks, ctx) => askPending(resolveHands({ ...s, gained: {}, bought: [] }, picks), ctx),
      },
      {
        id: "war", kind: "auto",
        begin: (s, ctx) => {
          s = discardLast(askPending(s, ctx), s.seats);
          s = applyOps(lib, s, pts.ageEnd(s, { age: s.age }));
          return settleLosses(lib, military(lib, s));
        },
      },
    ];

    const run = phaseRunner<State>({
      point: pts.phases,
      applyOps: (s, ops) => applyOps(lib, s, ops as Op[]),
      phases,
      interrupts: {
        // Build a card from the discard pile for free (boards, and add-ons' content), or nothing.
        discardBuild: {
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
            return askPending(built(lib, s, q.seat, c.eff, cardItem(c, "discard")), ctx);
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
        viewer, seats: s.seats, age: s.age, turn: s.turn, run: run.view(s), players, partner: s.partner, discardSize: s.discard.items.length, actors: acting, log: s.log,
        hand: own ? handOf(s, own).map(keyName) : [],
        pick: own && Object.prototype.hasOwnProperty.call(s.run.picks, own) ? s.run.picks[own]! : null,
        discard: seesDiscard ? contents(s.discard).map(keyName) : [],
        stageWays: own && !s.run.over ? stageWays(lib, s, own) : [],
        scores: s.run.over ? scoreAll(lib, s) : null,
      };
    };

    const heading = (v: SWView) => {
      if (v.scores) return "Game over";
      if (v.run.phase === null) return "Setting up";
      const ph = v.run.phase;
      if (v.age === 0) return "Before Age I";
      if (/^(turn|end)\d+$/.test(ph)) return `Age ${roman(v.age)}, turn ${ph.replace(/\D/g, "")}`;
      if (ph === "last") return `Age ${roman(v.age)}: last card`;
      if (ph === "war" || ph === "deal" || ph === "ready") return `Age ${roman(v.age)}`;
      return `Age ${roman(v.age)}`;
    };

    return {
      setup({ options, seats, rng }) {
        const ids = seats.map((x) => x.seat);
        const n = ids.length;
        const max = pts.maxSeats(null, 7);
        if (n < 3 || n > max) throw new Error(max >= 8 ? "7 Wonders needs 3 to 8 players here" : "7 Wonders needs 3 to 7 players (8 with the Cities add-on)");
        const team = options.teamPlay === true;
        if (team && (n < 4 || n % 2 !== 0)) throw new Error("Team play needs 4, 6 or 8 players");
        const pool = [...lib.wonders.values()].filter((w) => (w.needs ?? []).every((x) => lib.sets.includes(x))).map((w) => w.id);
        const wonders = sample(rng, pool, n);
        const coins0 = Number.isSafeInteger(options.startCoins) ? Number(options.startCoins) : 3;
        const players: { [seat: string]: Player } = {};
        ids.forEach((seat, i) => {
          const w = wonderOf(lib, wonders[i]!);
          const side: "A" | "B" = options.randomSides === true ? (rng.int(2) === 0 ? "A" : "B") : options.sideB === true ? "B" : "A";
          players[seat] = {
            wonder: w.id, side, built: [], stageCosts: w[side].map((x) => x.cost), cards: [], colors: {}, coins: coins0 + (w.coins ?? 0),
            victories: [], defeats: 0, hand: zone<string>([], [seat]), markers: zone<string>([], [seat]), extras: [], freeUsed: {},
          };
        });
        const partner: { [seat: string]: string } = {};
        // Team play: adjacent pairs in seat order (0 with 1, 2 with 3, ...).
        if (team) for (let i = 0; i + 1 < n; i += 2) { partner[ids[i]!] = ids[i + 1]!; partner[ids[i + 1]!] = ids[i]!; }
        const decks = buildDecks(lib, n, rng).map((d) => zone(d, []));
        const s = {
          seats: ids, sets: lib.sets, age: 0, turn: 0, players, decks, discard: zone<string>([], []), pending: [], losses: {}, gained: {}, bought: [], partner,
          log: team ? [`Team play: ${ids.filter((_, i) => i % 2 === 0).map((a) => `${a} & ${partner[a]}`).join(", ")}.`] : [],
        };
        return run.start(s, { seats: ids, rounds: 3, rng });
      },

      choices: (s, seat, partial) => run.choices(s, seat, partial),

      apply: (s, seat, action, rng) => run.apply({ ...s, log: [] }, seat, action, rng),

      view: viewOf,

      status(s) {
        if (!s.run.over) return { actors: run.actors(s) };
        const lines = scoreAll(lib, s);
        return { actors: [], outcome: outcomeOf(s, Object.fromEntries(s.seats.map((x) => [x, total(lines[x]!)]))) };
      },

      describe(s, seat, action, viewer) {
        if (s.log.length) return s.log.join(" ");
        const id = String(action[0]);
        if (viewer !== seat) return `${seat} has chosen.`;
        const key = id.startsWith("c:") ? handOf(s, seat)[Number(id.slice(2))] : undefined;
        return `You choose ${key ? keyName(key) : id}${action[1] ? ` (${String(action[1])})` : ""}.`;
      },

      audience: () => "seat",

      onTimeout: (s, seat) => firstPath((p) => run.choices(s, seat, p)),

      resampleHidden: (s, seat, rng) => run.resample(resampleBase(lib, s, seat, rng, buildDecks), seat, rng),

      text: {
        legend: () =>
          "7 Wonders. Three ages; each turn everyone picks a card at once and builds it, builds a wonder stage with it, or discards it for 3 coins, " +
          "then passes the rest of the hand on (left in Ages I and III, right in Age II). Resources you lack can be bought from your two neighbours " +
          "for 2 coins each. Military is compared with both neighbours at the end of each age. Most victory points after Age III wins.",
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
          return parts.join(" ");
        },
        layout(v) {
          const rows = v.seats.map((x) => {
            const p = v.players[x]!;
            return `${x.padEnd(7)} ${p.wonder.padEnd(14)} ${p.side} st ${p.stages.length}/${p.stageCount} $${String(p.coins).padStart(2)} mil ${String(p.victories.reduce((a, b) => a + b, 0) - p.defeats).padStart(3)} ${p.waiting ? "…" : " "} ${p.cards.join(", ")}`;
          });
          return [heading(v), ...rows, v.hand.length ? `Hand: ${v.hand.join(" | ")}` : ""].filter(Boolean).join("\n");
        },
      },
    };
  },
});
