// resampleHidden (11 §2, D52, D82) for the base: the same state with everything one seat can't see redrawn.
// Test kit only.
//
// What a seat can't see: the player deck's order (and where in its pile each remaining epidemic lies, and which
// epidemic cards of the pool are still in it), the other players' closed hands, the infection deck's order
// within each segment the table knows as a set (beyond the top cards this seat has looked at), other seats'
// held infection cards, and a forecast someone else is ordering. Counts, segments and piles stay.
//
// What stays in a hand it can't see: a card a pending question already commits from that hand (an offered city
// card a consent gives, an event a consent spends, the city card a dispatched flight pays). The question is on
// the table (the runner's record is public), so every world keeps it there, at a fresh place in the hand: a
// world without it would offer an answer its own `apply` can't play (PR #109 second review, "blue has no
// city:Cairo").
import { canSee, shuffle, withItems, type Json, type Rng, type SeatId } from "@boardcore/pack-sdk";
import { isEpidemic, type State } from "./engine";

/** `pool` less one copy of each of `out`. */
function less(pool: readonly string[], out: readonly string[]): string[] {
  const rest = pool.slice();
  for (const k of out) { const i = rest.indexOf(k); if (i >= 0) rest.splice(i, 1); }
  return rest;
}

type O = { [k: string]: Json };
/** The hand cards an operation (and the operations it carries) takes from a seat's hand, as [seat, card]. */
function committedBy(s: State, raw: Json, out: [SeatId, string][]): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const o = raw as O;
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null);
  switch (o.op) {
    case "give": if (str("from") && str("card")) out.push([str("from")!, str("card")!]); break;
    case "handToDiscard": if (str("seat") && str("card")) out.push([str("seat")!, str("card")!]); break;
    case "spendEvent": if (str("seat") && str("name")) out.push([str("seat")!, `event:${str("name")}`]); break;
    case "cure": if (str("seat") && Array.isArray(o.cards)) for (const k of o.cards) if (typeof k === "string") out.push([str("seat")!, k]); break;
    case "move": {
      const payer = str("payer"), pawn = str("pawn"), to = str("to");
      if (payer && o.kind === "direct" && to) out.push([payer, `city:${to}`]);
      if (payer && o.kind === "charter" && pawn && s.pl[pawn]) out.push([payer, `city:${s.pl[pawn]!.city}`]);
      break;
    }
    case "consent": for (const x of (o.ops as Json[] | undefined) ?? []) committedBy(s, x, out); break;
    case "ask": for (const c of (o.choices as O[] | undefined) ?? []) for (const x of (c.ops as Json[] | undefined) ?? []) committedBy(s, x, out); break;
  }
}

/** Each seat's hand cards that a pending question commits, no more of a card than the hand holds. */
export function pinnedCards(s: State): { [seat: string]: string[] } {
  const want: [SeatId, string][] = [];
  for (const q of s.run?.questions ?? []) {
    const a = (q.args ?? null) as O | null;
    if (!a || typeof a !== "object" || Array.isArray(a)) continue;
    if (q.kind === "consent") for (const x of (a.ops as Json[] | undefined) ?? []) committedBy(s, x, want);
    if (q.kind === "choose") for (const c of (a.choices as O[] | undefined) ?? []) for (const x of (c.ops as Json[] | undefined) ?? []) committedBy(s, x, want);
  }
  const out: { [seat: string]: string[] } = {};
  for (const [x, k] of want) {
    const hand = s.pl[x]?.hand.items;
    if (!hand) continue;
    const have = hand.filter((c) => c === k).length;
    const got = (out[x] ??= []);
    if (got.filter((c) => c === k).length < have) got.push(k);
  }
  return out;
}

export function resampleBase(s: State, seat: SeatId, rng: Rng): State {
  // Player cards: hands this seat can't see and the deck's non-epidemic slots, pooled, less the cards pending
  // questions commit (they stay in their hands, at a fresh place).
  const hidden = s.players.filter((x) => !canSee(s.pl[x]!.hand, seat));
  const deck = s.playerDeck.items.slice();
  const pins = pinnedCards(s);
  const pinned = (x: SeatId) => pins[x] ?? [];
  const pool = shuffle(rng, [...hidden.flatMap((x) => less(s.pl[x]!.hand.items, pinned(x))), ...deck.filter((k) => !isEpidemic(k))]);
  const pl = { ...s.pl };
  for (const x of hidden) {
    const keep = pinned(x);
    const drawn = pool.splice(0, pl[x]!.hand.items.length - keep.length);
    pl[x] = { ...pl[x]!, hand: withItems(pl[x]!.hand, keep.length ? shuffle(rng, [...keep, ...drawn]) : drawn) };
  }

  // Epidemics: each stays in its pile (piles were made at setup, top first), at a fresh place in it, redrawn
  // from the pool's cards not yet seen.
  const seen = [...s.removed, ...s.playerDiscard].filter(isEpidemic);
  const unseen = shuffle(rng, less(s.epiPool, seen));
  const total = s.piles.reduce((a, b) => a + b, 0);
  const consumed = total - deck.length;
  const next: string[] = [];
  let start = 0;
  for (const size of s.piles.length ? s.piles : [total]) {
    const from = Math.max(start, consumed) - consumed, to = start + size - consumed;
    start += size;
    if (to <= 0) continue;
    const seg = deck.slice(from, to);
    const n = seg.filter(isEpidemic).length;
    const slots = shuffle(rng, seg.map((_, i) => i)).slice(0, n);
    for (let i = 0; i < seg.length; i++) next.push(slots.includes(i) ? unseen.shift()! : pool.shift()!);
  }

  // Infection deck: the top cards this seat knows stay; the rest is shuffled within each known segment, or as a
  // whole with the held cards this seat can't see when there are any.
  const inf = s.infDeck.items.slice();
  const known = Math.min(s.infKnown[seat] ?? 0, inf.length);
  const heldBy = Object.keys(s.held).filter((x) => s.held[x]!.items.length && !canSee(s.held[x]!, seat));
  const held = { ...s.held };
  let infNext: string[];
  if (heldBy.length) {
    const mix = shuffle(rng, [...inf.slice(known), ...heldBy.flatMap((x) => s.held[x]!.items)]);
    infNext = [...inf.slice(0, known), ...mix.splice(0, inf.length - known)];
    for (const x of heldBy) held[x] = withItems(s.held[x]!, mix.splice(0, s.held[x]!.items.length));
  } else {
    infNext = inf.slice(0, known);
    let at = 0;
    for (const g of s.infSegs) {
      const a = Math.max(at, known), b = Math.min(at + g, inf.length);
      if (b > a) infNext.push(...shuffle(rng, inf.slice(a, b)));
      at += g;
    }
    if (at < inf.length) infNext.push(...shuffle(rng, inf.slice(Math.max(at, known))));
  }
  const forecast = s.forecast && !canSee(s.forecast, seat) ? withItems(s.forecast, infNext.slice(0, s.forecast.items.length)) : s.forecast;

  return { ...s, pl, playerDeck: withItems(s.playerDeck, next), infDeck: withItems(s.infDeck, infNext), held, forecast };
}
