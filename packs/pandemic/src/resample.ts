// resampleHidden (11 §2, D52, D82): the same state with everything one seat can't see redrawn. Test kit only.
//
// What a seat can't see: the order of the player deck (city, event and Mutation cards, and where in its pile
// each remaining epidemic lies), which Virulent Strain epidemics are still in it, the other players' hands
// when hands are closed, the infection deck's order, and, for anyone but the Bio-Terrorist, his hand, his
// city while he is unseen, and his location sheet. Public facts stay: every count, each pile's remaining
// epidemic, a Troubleshooter's peeked cards for that seat.
//
// Coarser than a player's real knowledge: the state keeps no history, so the infection deck is redrawn as a
// whole although players know which cards an Intensify put back on top (CONTRACT-GAPS.md).
import { shuffle, type Rng, type SeatId } from "@boardcore/pack-sdk";
import { CITY_NAMES, VS_EPIDEMICS } from "./data";
import { setPl, type State } from "./engine";

const isPileCard = (k: string) => k === "epidemic" || k.startsWith("vs:");

interface Bt { seat: SeatId; city: string | null; hand: string[]; captured: boolean; sheet: string[] }

export function resample(s: State, seat: SeatId, rng: Rng): State {
  const others = s.players.filter((x) => x !== seat);
  const closed = !s.openHands;

  // Player cards: other closed hands and the deck's non-epidemic slots, pooled.
  const deck = s.playerDeck;
  const pool = shuffle(rng, [...(closed ? others.flatMap((x) => s.pl[x]!.hand) : []), ...deck.filter((k) => !isPileCard(k))]);
  if (closed) for (const x of others) { const n = s.pl[x]!.hand.length; s = setPl(s, x, (p) => ({ ...p, hand: pool.splice(0, n) })); }

  // Epidemics: each stays in its own pile (piles were made at setup, top first), at a fresh place in it.
  const total = s.piles.reduce((a, b) => a + b, 0);
  const consumed = total - deck.length;
  const vsLeft = shuffle(rng, VS_EPIDEMICS.filter((n) => !((s.ext.virulentStrain as { seen?: string[] } | undefined)?.seen ?? []).includes(n)));
  const next: string[] = [];
  let start = 0;
  for (const size of s.piles.length ? s.piles : [total]) {
    const from = Math.max(start, consumed) - consumed, to = start + size - consumed;
    start += size;
    if (to <= 0) continue;
    const seg = deck.slice(from, to);
    const epis = seg.filter(isPileCard).map((k) => (k.startsWith("vs:") ? `vs:${vsLeft.shift()!}` : k));
    const slots = shuffle(rng, seg.map((_, i) => i)).slice(0, epis.length);
    for (let i = 0; i < seg.length; i++) next.push(slots.includes(i) ? epis[slots.indexOf(i)]! : pool.shift()!);
  }
  s = { ...s, playerDeck: next };

  // Infection deck (and the Bio-Terrorist's hand, unless this seat is him); a peeked top stays for its seat.
  const bt = s.ext.bioterrorist as unknown as Bt | undefined;
  const btHidden = bt !== undefined && bt.seat !== seat;
  const peek = ((s.ext.onTheBrink as { peek?: { [x: string]: string[] } } | undefined)?.peek ?? {})[seat] ?? [];
  const keep = peek.length && peek.every((k, i) => s.infDeck[i] === k) ? peek.length : 0;
  const inf = shuffle(rng, [...s.infDeck.slice(keep), ...(btHidden ? bt.hand : [])]);
  s = { ...s, infDeck: [...s.infDeck.slice(0, keep), ...inf.splice(0, s.infDeck.length - keep)] };
  if (btHidden) {
    const seen = bt.city !== null && (bt.captured || s.players.some((x) => s.pl[x]!.city === bt.city));
    const free = CITY_NAMES.filter((c) => !s.players.some((x) => s.pl[x]!.city === c));
    const city = seen || bt.city === null ? bt.city : free[rng.int(free.length)]!;
    const nb: Bt = { ...bt, hand: inf, city, sheet: bt.sheet.map(() => "(hidden)") };
    s = { ...s, ext: { ...s.ext, bioterrorist: nb as unknown as State["ext"][string] } };
  }
  return s;
}
