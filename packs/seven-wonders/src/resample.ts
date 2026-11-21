// resampleHidden for the base rules (11 §2, D52, D82): the same state with everything one seat can't see redrawn.
// Test kit only. What a seat can't see: the other seats' hands, the discard pile (unless it is looking through
// it), the cards under the other seats' stages, and the decks of the ages not dealt yet. The redraw keeps every
// public fact: hand, pile and marker counts and each slot's age. The phase runner then redraws the other seats'
// pending picks (after each expansion has redrawn its own hidden state), so no world keeps another seat's real pick.
//
// It is coarser than a player's knowledge: the state keeps no history, so the cards a seat passed on (and so
// knows are in its neighbour's hand) are redrawn like any other (CONTRACT-GAPS.md, O3).
import { canSee, shuffle, withItems, type Rng, type SeatId } from "@boardcore/pack-sdk";
import { keyAge, setP, type Lib, type State } from "./engine";

/** Refills slots from a shuffled pool of their own contents, grouped by a key (the card's age). */
function redraw(slots: string[][], group: (card: string) => string, rng: Rng): string[][] {
  const pools = new Map<string, string[]>();
  for (const xs of slots) for (const k of xs) pools.set(group(k), [...(pools.get(group(k)) ?? []), k]);
  const keys = [...pools.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const shuffled = new Map<string, string[]>();
  for (const g of keys) shuffled.set(g, shuffle(rng, pools.get(g)!));
  return slots.map((xs) => xs.map((k) => shuffled.get(group(k))!.shift()!));
}

export function resampleBase(lib: Lib, s: State, seat: SeatId, rng: Rng, decks: (lib: Lib, n: number, rng: Rng) => string[][]): State {
  const others = s.seats.filter((x) => x !== seat && !canSee(s.players[x]!.hand, seat));
  const seesDiscard = canSee(s.discard, seat);
  const markers = (x: SeatId) => s.players[x]!.markers.items.filter((k) => k !== "leader");
  const slots = [...others.map((x) => s.players[x]!.hand.items), seesDiscard ? [] : s.discard.items, ...others.map(markers)];
  const drawn = redraw(slots, (k) => String(keyAge(k)), rng);
  others.forEach((x, i) => { s = setP(s, x, (p) => ({ ...p, hand: withItems(p.hand, drawn[i]!) })); });
  if (!seesDiscard) s = { ...s, discard: withItems(s.discard, drawn[others.length]!) };
  others.forEach((x, i) => {
    const fresh = drawn[others.length + 1 + i]!.slice();
    s = setP(s, x, (p) => ({ ...p, markers: withItems(p.markers, p.markers.items.map((k) => (k === "leader" ? k : fresh.shift()!))) }));
  });
  // The decks of the ages still to come, built again as setup builds them.
  const fresh = decks(lib, s.seats.length, rng);
  return { ...s, decks: s.decks.map((d, i) => (i >= s.age && !canSee(d, seat) ? withItems(d, fresh[i]!) : d)) };
}
