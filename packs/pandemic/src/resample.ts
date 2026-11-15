// resampleHidden (11 §2, D52, D82) for the base: the same state with everything one seat can't see redrawn.
// Test kit only.
//
// What a seat can't see: the player deck's order (and where in its pile each remaining epidemic lies, and which
// epidemic cards of the pool are still in it), the other players' closed hands, the infection deck's order
// within each segment the table knows as a set (beyond the top cards this seat has looked at), other seats'
// held infection cards, and a forecast someone else is ordering. Counts, segments and piles stay.
import { canSee, shuffle, withItems, type Rng, type SeatId } from "@boardcore/pack-sdk";
import { isEpidemic, type State } from "./engine";

/** `pool` less one copy of each of `out`. */
function less(pool: readonly string[], out: readonly string[]): string[] {
  const rest = pool.slice();
  for (const k of out) { const i = rest.indexOf(k); if (i >= 0) rest.splice(i, 1); }
  return rest;
}

export function resampleBase(s: State, seat: SeatId, rng: Rng): State {
  // Player cards: hands this seat can't see and the deck's non-epidemic slots, pooled.
  const hidden = s.players.filter((x) => !canSee(s.pl[x]!.hand, seat));
  const deck = s.playerDeck.items.slice();
  const pool = shuffle(rng, [...hidden.flatMap((x) => s.pl[x]!.hand.items), ...deck.filter((k) => !isEpidemic(k))]);
  const pl = { ...s.pl };
  for (const x of hidden) pl[x] = { ...pl[x]!, hand: withItems(pl[x]!.hand, pool.splice(0, pl[x]!.hand.items.length)) };

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
