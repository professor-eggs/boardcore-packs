// resampleHidden (11 §2, D52, D82): the same state with everything one seat can't see redrawn. Test kit only.
//
// What a seat can't see: the other seats' hands, the discard pile (unless it is choosing from it), the cards
// under other wonders' stages, the decks of ages not dealt yet (which guilds and black cards are in them),
// the other seats' leaders in hand, in the draft and in the box, and the other seats' picks this turn.
// The redraw keeps every public fact: hand, pile and stage counts, each slot's age, who has picked.
//
// It is coarser than a player's real knowledge: the state keeps no history, so the cards a seat passed on
// (and so knows are in its neighbour's hand) are redrawn like any other (CONTRACT-GAPS.md).
import { shuffle, type Rng, type SeatId, type Step } from "@boardcore/pack-sdk";
import { buildDecks, keyAge, setP, type Opts, type State } from "./engine";
import { prompt, type Flow } from "./flow";

/** Refills slots from a shuffled pool of their own contents, grouped by a key (the card's age). */
function redraw(slots: string[][], group: (card: string) => string, rng: Rng): string[][] {
  const pools = new Map<string, string[]>();
  for (const xs of slots) for (const k of xs) pools.set(group(k), [...(pools.get(group(k)) ?? []), k]);
  const keys = [...pools.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const shuffled = new Map<string, string[]>();
  for (const g of keys) shuffled.set(g, shuffle(rng, pools.get(g)!));
  return slots.map((xs) => xs.map((k) => shuffled.get(group(k))!.shift()!));
}

const ageOf = (k: string) => String(keyAge(k));

/** A random complete path through the seat's prompt (used to redraw another seat's hidden pick). */
function randomPath(s: State, seat: SeatId, f: Flow, rng: Rng): Step[] | null {
  const path: Step[] = [];
  for (let i = 0; i < 8; i++) {
    const p = prompt(s, seat, path, f);
    if (!p) return path.length ? path : null;
    const ok = p.options.filter((o) => !o.disabled);
    if (!ok.length) return null;
    path.push(ok[rng.int(ok.length)]!.id);
  }
  return null;
}

export function resample(s: State, seat: SeatId, f: Flow, rng: Rng): State {
  const others = s.seats.filter((x) => x !== seat);
  const seesDiscard = s.phase === "interrupt" && s.pending[0]?.seat === seat && s.pending[0]?.kind === "discardBuild";

  // Age cards: other hands, the discard pile and the cards under other stages, pooled by age.
  const markers = (x: SeatId) => s.players[x]!.stageCards.filter((k) => !k.startsWith("leader:"));
  const slots = [...others.map((x) => s.players[x]!.hand), seesDiscard ? [] : s.discard, ...others.map(markers)];
  const drawn = redraw(slots, ageOf, rng);
  others.forEach((x, i) => { s = setP(s, x, (p) => ({ ...p, hand: drawn[i]! })); });
  if (!seesDiscard) s = { ...s, discard: drawn[others.length]! };
  others.forEach((x, i) => {
    const fresh = drawn[others.length + 1 + i]!.slice();
    s = setP(s, x, (p) => ({ ...p, stageCards: p.stageCards.map((k) => (k.startsWith("leader:") ? k : fresh.shift()!)) }));
  });

  // Leaders: other leader hands, other draft hands, the box, and leaders under other stages.
  if (s.addons.includes("leaders")) {
    const lslots = [
      ...others.map((x) => s.players[x]!.leaderHand), ...others.map((x) => s.draft[x] ?? []), s.leaderBox,
      ...others.map((x) => s.players[x]!.stageCards.filter((k) => k.startsWith("leader:")).map((k) => k.slice(7))),
    ];
    const l = redraw(lslots, () => "", rng);
    const n = others.length;
    others.forEach((x, i) => { s = setP(s, x, (p) => ({ ...p, leaderHand: l[i]! })); });
    const draft = { ...s.draft };
    others.forEach((x, i) => { if (s.draft[x]) draft[x] = l[n + i]!; });
    s = { ...s, draft, leaderBox: l[2 * n]! };
    others.forEach((x, i) => {
      const fresh = l[2 * n + 1 + i]!.slice();
      s = setP(s, x, (p) => ({ ...p, stageCards: p.stageCards.map((k) => (k.startsWith("leader:") ? `leader:${fresh.shift()!}` : k)) }));
    });
  }

  // Decks: redrawn whole (only the decks of ages still to come are ever read again).
  const opts: Opts = { leaders: s.addons.includes("leaders"), cities: s.addons.includes("cities"), wonderPack: s.addons.includes("wonderPack"), sideB: false, randomSides: false };
  s = { ...s, decks: buildDecks(s.seats.length, opts, f, rng) };

  // Other seats' picks this turn: who has picked is public, what they picked is not.
  for (const x of others) {
    if (s.picks[x] === null || s.picks[x] === undefined) continue;
    const blank = { ...s, picks: { ...s.picks, [x]: null } };
    const path = randomPath(blank, x, f, rng);
    s = { ...blank, picks: { ...blank.picks, [x]: path } };
  }
  return s;
}
