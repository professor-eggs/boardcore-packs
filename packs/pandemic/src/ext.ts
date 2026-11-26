// The expansions' own state, typed. Each expansion keeps its state in one slot of `State.ext`, which
// holds only the slots of the expansions switched on; the expansion's code is the only reader and writer.
import type { SeatId } from "@boardcore/pack-sdk";
import type { Color } from "./data";

/** On the Brink: virus samples, peeks and the turn-long event effects. */
export type OnTheBrinkExt = {
  samples: { [seat: string]: { [c: string]: number } };
  peek: { [seat: string]: string[] };
  /** Commercial Travel Ban: in front of this player until his next turn begins. */
  ctb: SeatId | null;
  /** Mobile Hospital is on for this turn. */
  mobile: boolean;
  /** Special Orders: the current player may move this pawn this turn. */
  orders: SeatId | null;
  justCured: { color: string; ply: number } | null;
};

/** Virulent Strain: the strain, the continuing effects in play and the epidemics seen. */
export type VirulentStrainExt = {
  color: Color | null;
  active: string[];
  seen: string[];
};

/** The Bio-Terrorist: his seat, hidden location, hand, budget and location sheet. */
export type BioterroristExt = {
  seat: SeatId;
  city: string | null;
  hand: string[];
  captured: boolean;
  out: boolean;
  left: number;
  freeDrive: number;
  used: { [k: string]: number };
  /** Over the hand limit after a draw: one card must go before anything else. */
  over: boolean;
  /** The last public sighting. */
  sighting: string | null;
  /** His location sheet: every action, by turn, for his eyes only. */
  sheet: string[];
  turn: number;
};

export type Exts = {
  /** The seat chosen at setup to play the Bio-Terrorist, read by his setup. */
  btSeat?: SeatId;
  onTheBrink?: OnTheBrinkExt;
  virulentStrain?: VirulentStrainExt;
  bioterrorist?: BioterroristExt;
};
