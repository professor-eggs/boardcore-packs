// The expansions' own state, typed. Each expansion keeps its state in one slot of `State.ext`, which
// holds only the slots of the expansions that wrote one; the expansion's code is the only reader and writer.
import type { SeatId } from "@boardcore/pack-sdk";

/** Cities: seats absent through diplomacy, Caligula and Berenice uses, team partners. */
export type CitiesExt = {
  absent: SeatId[];
  caligula: { [seat: string]: number };
  berenicePly: number;
  partner: { [seat: string]: SeatId };
  diploSpent: SeatId[];
};

/** Leaders: the Courtesan's copies, the hat's ply, Esteban's freeze. */
export type LeadersExt = {
  courtesan: { [seat: string]: string };
  hatPly: number;
  estebanUsed?: string[];
  frozen?: boolean;
};

/** The wonder pack: skipped turns and absent seats. */
export type WonderPackExt = {
  skip: { [seat: string]: number };
  absent: SeatId[];
};

export type Exts = {
  cities?: CitiesExt;
  leaders?: LeadersExt;
  wonderPack?: WonderPackExt;
};
