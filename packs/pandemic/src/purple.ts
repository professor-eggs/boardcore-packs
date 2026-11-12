// The purple disease, shared by the Mutation and Bio-Terrorist challenges (never both at once).
import type { SeatId, Step } from "@boardcore/pack-sdk";
import { canPick, pickCards, pickedCards } from "./actions";
import { cityOf, cubesIn, cure, cureCost, isCity, onBoard, type ActionDef, type State } from "./engine";

/** A purple cure takes city cards of any colours, at least one of a city with purple on it. */
export const purpleCity = (s: State) => (k: string) => cubesIn(s, cityOf(k), "purple") > 0;
export const purpleCards = (s: State, seat: SeatId) => s.pl[seat]!.hand.filter(isCity);

/** Picking the cards for a purple cure of `need` cards. */
export const pickPurple = (s: State, seat: SeatId, need: number, chosen: Step[]) =>
  pickCards(purpleCards(s, seat), need, chosen, "Discard which card (any colour, one with purple on it)", purpleCity(s));
export const canPurple = (s: State, seat: SeatId, need: number) => canPick(purpleCards(s, seat), need, purpleCity(s));

export const curePurple: ActionDef = {
  id: "curePurple", cost: 1,
  check: (s, seat, ctx) => (!s.stations.includes(s.pl[seat]!.city) || s.cured.includes("purple") || !canPurple(s, seat, cureCost(s, seat, "purple", ctx)) ? "hide" : null),
  label: () => "Discover a cure for purple",
  steps: (s, seat, rest, ctx) => pickPurple(s, seat, cureCost(s, seat, "purple", ctx), rest),
  apply: (s, seat, rest, ctx) => cure(s, seat, "purple", pickedCards(purpleCards(s, seat), cureCost(s, seat, "purple", ctx), rest), ctx),
};

/** During the infection step a city that already has purple on it gets 1 purple cube as well. */
export const purpleFollows = (s: State, city: string) => (cubesIn(s, city, "purple") > 0 ? ["purple"] : []);

export const purpleGoal = (won: boolean, s: State) => won && (s.cured.includes("purple") || onBoard(s, "purple") === 0);
