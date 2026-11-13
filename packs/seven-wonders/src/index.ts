// 7 Wonders (base game) with Leaders, Cities and the Wonder Pack as switchable add-ons. Mechanics only:
// card names and numbers, no rulebook text. Rules summary and gaps: ../README.md.
import { compareStrings, definePack, type Action, type Json, type Prompt, type SeatId, type Step, type Viewer } from "@boardcore/pack-sdk";
import { leaderDef, wonderDef } from "./data";
import {
  finalScores, keyName, POINTS, RES_NAME, score, setupState, stageDefs, total, type Ctx, type Line, type Opts, type State,
} from "./engine";
import { act, actors, makeFlow, prompt, settle, type Flow, type SevenAddOn } from "./flow";
import { checkAddOns, makeHooks } from "./hooks";
import { cities } from "./addons/cities";
import { leaders, effText } from "./addons/leaders";
import { wonderPack } from "./addons/wonder-pack";
import { resample } from "./resample";

/** The Leaders goodies (Louis, Stevie, Esteban): only adds them to the leader pool; their rules live in leaders.ts. */
const leaderPromos: SevenAddOn = { id: "leaderPromos", requires: ["leaders"], handlers: {} };
/** Cities team play (4/6/8): adjacent pairs, no teammate fights, doubled tokens. Rules live in cities.ts. */
const teamPlay: SevenAddOn = { id: "teamPlay", requires: ["cities"], handlers: {} };
const ADDONS: { [id: string]: SevenAddOn } = { leaders, leaderPromos, cities, teamPlay, wonderPack };
const ORDER = ["leaders", "leaderPromos", "cities", "teamPlay", "wonderPack"] as const;

/** A short heading for where the game is: "Leader draft, pick 2 of 4", "Age II, turn 3", ... */
function heading(v: { phase: string; age: number; turn: number; draftRound: number }): string {
  const roman = ["", "I", "II", "III"][v.age] ?? String(v.age);
  if (v.phase === "over") return "Game over";
  if (v.phase === "draft" || v.phase === "start") return v.age === 0 && v.draftRound > 0 ? `Leader draft, pick ${v.draftRound} of 4` : "Setting up";
  if (v.phase === "recruit") return `Age ${roman}: leader recruitment`;
  if (v.phase === "lastCard") return `Age ${roman}: last card`;
  if (v.age === 0) return v.draftRound > 0 ? "Leader draft" : "Setting up";
  return `Age ${roman}, turn ${v.turn}`;
}

const flowOf = (s: State): Flow => {
  const ctx: Ctx = { hooks: makeHooks(ADDONS, s.addons, POINTS), addons: ADDONS };
  return makeFlow(ctx, ADDONS, s.addons);
};

interface PublicPlayer {
  [k: string]: Json;
  wonder: string; side: string; base: string; stages: number[]; stageCount: number; cards: string[]; coins: number; debt: number;
  victories: number[]; defeats: number; leaders: string[]; entombed: string[]; diplomacy: number; handSize: number; leaderCards: number; waiting: boolean;
}
interface View {
  [k: string]: Json;
  viewer: Viewer;
  seats: SeatId[];
  addons: string[];
  age: number; turn: number; phase: string; draftRound: number;
  players: { [seat: string]: PublicPlayer };
  discardSize: number;
  actors: SeatId[];
  log: string[];
  hand: string[];
  leaderHand: string[];
  draft: string[];
  /** The discard pile, only while this viewer is choosing from it. */
  discard: string[];
  pick: Json;
  scores: { [seat: string]: Line[] } | null;
}

function viewOf(s: State, viewer: Viewer): View {
  const f = flowOf(s);
  const own = viewer !== "spectator" && s.seats.includes(viewer) ? viewer : null;
  const acting = actors(s, f);
  const players: { [seat: string]: PublicPlayer } = {};
  for (const x of s.seats) {
    const p = s.players[x]!;
    players[x] = {
      wonder: p.wonder, side: p.side, base: wonderDef(p.wonder).base, stages: p.built, stageCount: stageDefs(p).length, cards: p.cards.map(keyName), coins: p.coins, debt: p.debt,
      victories: p.victories, defeats: p.defeats, leaders: p.leaders, entombed: p.entombed, diplomacy: p.diplomacy,
      handSize: p.hand.length, leaderCards: p.leaderHand.length, waiting: acting.includes(x),
    };
  }
  const mine = own ? s.players[own]! : null;
  const choosingDiscard = own !== null && s.phase === "interrupt" && s.pending[0]?.seat === own && s.pending[0]?.kind === "discardBuild";
  return {
    viewer, seats: s.seats, addons: s.addons, age: s.age, turn: s.turn, phase: s.phase, draftRound: s.draftRound, players, discardSize: s.discard.length, actors: acting, log: s.log,
    hand: mine ? mine.hand.map(keyName) : [], leaderHand: mine ? mine.leaderHand : [], draft: own ? s.draft[own] ?? [] : [],
    discard: choosingDiscard ? s.discard.map(keyName) : [], pick: own ? s.picks[own] ?? null : null,
    scores: s.phase === "over" ? Object.fromEntries(s.seats.map((x) => [x, score(s, x, f)])) : null,
  };
}

/** The first legal path, for timeouts: the first enabled option at each step. */
function firstPath(s: State, seat: SeatId, f: Flow): Action | null {
  const path: Step[] = [];
  for (let i = 0; i < 6; i++) {
    const p: Prompt | null = prompt(s, seat, path, f);
    if (!p) return path.length ? path : null;
    const sell = p.options.find((o) => (o.id === "sell" || o.id === "skip") && !o.disabled);
    const o = sell ?? p.options.find((x) => !x.disabled);
    if (!o) return null;
    path.push(o.id);
  }
  return null;
}

/**
 * The outcome (11 §2, D79): places by points, a tie broken by the most coins, still tied shares the place;
 * scores are the points. Places are competition ranks (1, 1, 3), so the winners are the seats at place 1.
 */
export function outcomeOf(s: State, pts: { [seat: string]: number }) {
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

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export default definePack<State, View>({
  setup({ options, seats, rng }) {
    const opts: Opts = {
      leaders: options.leaders === true, leaderPromos: options.leaderPromos === true, cities: options.cities === true, teamPlay: options.teamPlay === true, wonderPack: options.wonderPack === true,
      sideB: options.sideB === true, randomSides: options.randomSides === true,
    };
    const addons = ORDER.filter((id) => opts[id]);
    const bad = checkAddOns(ADDONS, addons);
    if (bad) throw new Error(bad);
    const s = setupState(seats.map((x) => x.seat), opts, [...addons], ADDONS, rng);
    return settle(s, flowOf(s), rng);
  },

  choices: (s, seat, partial) => prompt(s, seat, partial, flowOf(s)),

  apply(s, seat, action, rng) {
    const before = s.phase;
    const next = act(s, seat, action, flowOf(s), rng);
    // A resolution turns up hidden picks (and dealt hands): a commit point. A lone pick reveals nothing.
    return next.logPly === next.ply || before === "interrupt" ? { state: next, reveal: true } : { state: next };
  },

  view: viewOf,

  status(s) {
    const f = flowOf(s);
    if (s.phase !== "over") return { actors: actors(s, f) };
    return { actors: [], outcome: outcomeOf(s, finalScores(s, f)) };
  },

  describe(s, seat, action, viewer) {
    const resolved = s.logPly === s.ply;
    const id = String(action[0]);
    let head: string;
    if (resolved) head = "";
    else if (viewer === seat) {
      const p = s.players[seat]!;
      const name = id.startsWith("c:") ? keyName(p.hand[Number(id.slice(2))] ?? "?@0") : id.startsWith("l:") ? (s.phase === "draft" ? "a leader" : p.leaderHand[Number(id.slice(2))] ?? "a leader") : id;
      head = `You choose ${name}${action[1] ? ` (${String(action[1])})` : ""}.`;
    } else head = `${seat} has chosen.`;
    return [head, ...(resolved ? s.log : [])].filter(Boolean).join(" ") || null;
  },

  audience: () => "seat",

  onTimeout: (s, seat) => firstPath(s, seat, flowOf(s)),

  resampleHidden: (s, seat, rng) => resample(s, seat, flowOf(s), rng),

  extensionPoints: Object.entries(POINTS).map(([name, combine]) => ({ name, combine })),

  text: {
    legend: (v) =>
      `7 Wonders${v.addons.length ? ` with ${v.addons.join(", ")}` : ""}. Three ages; each turn everyone picks a card at once and builds it, ` +
      "builds a wonder stage with it, or discards it for 3 coins, then passes the rest of the hand on (left in Ages I and III, right in Age II). " +
      "Resources you lack can be bought from your two neighbours for 2 coins each. Military is compared with both neighbours at the end of each age. " +
      "Most victory points after Age III wins.",
    state(v) {
      const parts: string[] = [];
      parts.push(`${heading(v)}.`);
      for (const x of v.seats) {
        const p = v.players[x]!;
        parts.push(`${x}: ${p.wonder} ${p.side} (${p.base ? RES_NAME[p.base] : "no resource"}), stages ${p.stages.length}/${p.stageCount}, ${plural(p.coins, "coin")}` +
          `${p.debt ? `, ${p.debt} debt` : ""}, military ${p.victories.join("+") || "0"}${p.defeats ? ` -${p.defeats}` : ""}` +
          `${p.leaders.length ? `, leaders ${p.leaders.join(", ")}` : ""}${p.diplomacy ? `, ${p.diplomacy} diplomacy` : ""}; city: ${p.cards.join(", ") || "empty"}${p.waiting ? " (choosing)" : ""}.`);
      }
      if (v.hand.length) parts.push(`Your hand: ${v.hand.join(", ")}.`);
      if (v.leaderHand.length) parts.push(`Your leaders: ${v.leaderHand.map((l) => `${l} (${leaderDef(l).cost}): ${leaderDef(l).eff.map(effText).join("; ")}`).join(", ")}.`);
      if (v.draft.length) parts.push(`Draft hand: ${v.draft.join(", ")}.`);
      if (v.discard.length) parts.push(`Discard pile: ${v.discard.join(", ")}.`);
      if (v.log.length) parts.push(`Last: ${v.log.join(" ")}`);
      if (v.scores) for (const x of v.seats) parts.push(`${x} scores ${total(v.scores[x]!)}: ${v.scores[x]!.map((l) => `${l.cat} ${l.vp}`).join(", ")}.`);
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
});

