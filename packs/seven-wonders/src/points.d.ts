// boardcore/seven-wonders 2.x (the 2nd edition): the published point declarations (11 §10 "Typed declarations"). A global
// script with no import of its own: an add-on's build includes this file and `defineAddon<"boardcore/seven-wonders">`
// checks every contribution against it. A changed signature is a new major version of the base.
type SWJson = import("@boardcore/pack-sdk").Json;
type SWZone<T extends SWJson> = import("@boardcore/pack-sdk").Zone<T>;

type SWColor = "brown" | "grey" | "blue" | "yellow" | "red" | "green" | "purple" | "black";
type SWSci = "c" | "g" | "t";
type SWWho = "self" | "nbr" | "all";

/**
 * One effect of a card, a wonder stage or board, or a granted extra (a leader). The base interprets these
 * kinds; an add-on's own kinds are named `<prefix>:<name>` and only add-ons read them (through the
 * arguments of `onBuild` and `score`, or a seat's `extras`).
 */
type SWEff =
  | { [k: string]: SWJson; k: "prod"; any: string; trade: boolean }
  | { [k: string]: SWJson; k: "vp"; n: number }
  | { [k: string]: SWJson; k: "coins"; n: number }
  | { [k: string]: SWJson; k: "shields"; n: number }
  | { [k: string]: SWJson; k: "sci"; s: SWSci | "*" }
  | { [k: string]: SWJson; k: "trade"; side: "L" | "R" | "LR"; kind: "raw" | "man" }
  | { [k: string]: SWJson; k: "perCoins"; n: number; who: SWWho; colors?: SWColor[]; stages?: true; victories?: true }
  | { [k: string]: SWJson; k: "perVP"; n: number; who: SWWho; colors?: SWColor[]; stages?: true; defeats?: true; victories?: true }
  /** Build free a card of a colour the city has none of (2nd edition Olympia A). */
  | { [k: string]: SWJson; k: "freeFirstColor" }
  /** Build free the card played on each age's first turn (2nd edition Olympia B). */
  | { [k: string]: SWJson; k: "freeFirstCard" }
  /** Build free the card played on each age's last turn, from a hand of two (2nd edition Olympia B). */
  | { [k: string]: SWJson; k: "freeLastCard" }
  /** Cards of a colour are free (always, or once an age). */
  | { [k: string]: SWJson; k: "freeColor"; color: SWColor; perAge?: true }
  /** Play the last card of each age. */
  | { [k: string]: SWJson; k: "lastCard" }
  /** Build a card from the discard pile for free (asked once the turn is played). */
  | { [k: string]: SWJson; k: "discardBuild" }
  /** n VP at the end if every stage of the seat's wonder is built (the Decorators Guild). */
  | { [k: string]: SWJson; k: "wonderDoneVP"; n: number }
  /** Cards of a colour (or wonder stages) cost one resource less. */
  | { [k: string]: SWJson; k: "discount"; color: SWColor | "wonder" }
  /** Buy one resource a turn from the bank for 1 coin. */
  | { [k: string]: SWJson; k: "bank" }
  /** More points per science set. */
  | { [k: string]: SWJson; k: "sciSetBonus"; n: number }
  /** A copy of one science symbol of a green card next door. */
  | { [k: string]: SWJson; k: "mask" }
  /** The first unit bought from that side each turn costs a coin less. */
  | { [k: string]: SWJson; k: "dock"; side: "L" | "R" }
  /** One more unit of a resource the city makes; one of a resource it doesn't. */
  | { [k: string]: SWJson; k: "warehouse" }
  | { [k: string]: SWJson; k: "blackMarket" }
  /** Wonder stages need no resources. */
  | { [k: string]: SWJson; k: "noWonderRes" }
  /** Each neighbour takes n coins from the bank. */
  | { [k: string]: SWJson; k: "nbrCoins"; n: number }
  /** The effects of a neighbour's wonder stage. */
  | { [k: string]: SWJson; k: "copyStage"; side: "L" | "R"; stage: number }
  | SWAddonEff;
/** An add-on's own effect kind, `<prefix>:<name>`: the base keeps it and never reads it. */
interface SWAddonEff { [k: string]: SWJson; k: `${string}:${string}` }

interface SWCardDef {
  [k: string]: SWJson;
  /** `<name>@<age>`, the card's key in hands and cities. */
  id: string;
  name: string;
  age: number;
  color: SWColor;
  /** Resource letters (WSCO raw, GLP manufactured), with an optional coin prefix: "$2SC". */
  cost: string;
  /** Base cards: one copy at each of these seat counts and up. Cards added by `decks`: []. */
  counts: number[];
  /** Cards that make this one free (the chain). */
  from: string[];
  eff: SWEff[];
}
interface SWStageDef { [k: string]: SWJson; cost: string; eff: SWEff[] }
interface SWWonderDef {
  [k: string]: SWJson;
  id: string;
  /** The board's starting resource letter ("" for none). */
  base: string;
  /** Only dealt when every set named here is in the room (the `sets` registry). */
  needs?: string[];
  /** Extra starting coins. */
  coins?: number;
  /** Stages may be built in any order. */
  anyOrder?: true;
  /** Effects of the board itself, per side. */
  board?: { A: SWEff[]; B: SWEff[] };
  A: SWStageDef[];
  B: SWStageDef[];
}
/** A set of content in the room ("base", "leaders", ...): wonders and add-ons read the list. */
interface SWSet { [k: string]: SWJson; id: string }

/** Effects granted to a seat by an add-on (a leader in play): public, part of the seat's effects unless `off`. */
interface SWExtra { [k: string]: SWJson; from: string; name: string; cost: number; eff: SWEff[]; off: string | null }

interface SWPlayer {
  [k: string]: SWJson;
  wonder: string;
  side: "A" | "B";
  /** Stage indices built, in build order. */
  built: number[];
  /** Each stage's cost on this board's side (public). */
  stageCosts: string[];
  /** Card keys in the city, in build order. */
  cards: string[];
  /** Cards in the city by colour (public). */
  colors: { [color: string]: number };
  coins: number;
  victories: number[];
  defeats: number;
  hand: SWZone<string>;
  /** The cards under the built stages, in build order ("leader" for a leader used instead). */
  markers: SWZone<string>;
  extras: SWExtra[];
  /** Once-an-age free builds (a colour free once an age): the age each was last used in. */
  freeUsed: { [k: string]: number };
}

interface SWState {
  [k: string]: SWJson;
  seats: string[];
  /** The `sets` registry's ids. */
  sets: string[];
  age: number;
  /** The turn last played in this age (0 before the first). */
  turn: number;
  players: { [seat: string]: SWPlayer };
  /** The age decks, face down. */
  decks: SWZone<string>[];
  discard: SWZone<string>;
  /** The base's own questions waiting to be asked (a discard-pile build raised by an add-on's operation). */
  pending: { [k: string]: SWJson; seat: string; kind: string }[];
  /** Coins each seat must lose (settled by the `lossRule` slot). */
  losses: { [seat: string]: number };
  /** Coins taken from the bank this turn, and who bought from which side ("seat>L"). */
  gained: { [seat: string]: number };
  bought: string[];
  /** Team play: each seat's partner. */
  partner: { [seat: string]: string };
  /** What the last action showed everyone. */
  log: string[];
  run: import("@boardcore/pack-sdk").Run;
}

interface SWWay { [k: string]: SWJson; id: string; label: string; disabled: string | null; plans: SWPlan[]; coins: number }
interface SWPlan { [k: string]: SWJson; L: number; R: number; B: number }
interface SWPublicPlayer {
  [k: string]: SWJson;
  wonder: string; side: string; base: string; stages: number[]; stageCount: number; stageCosts: string[]; cards: string[]; colors: { [c: string]: number };
  coins: number; victories: number[]; defeats: number; extras: SWExtra[]; handSize: number; waiting: boolean;
}
interface SWLine { [k: string]: SWJson; cat: string; vp: number }
interface SWView {
  [k: string]: SWJson;
  viewer: string;
  seats: string[];
  age: number;
  turn: number;
  run: import("@boardcore/pack-sdk").RunView;
  players: { [seat: string]: SWPublicPlayer };
  partner: { [seat: string]: string };
  discardSize: number;
  actors: string[];
  log: string[];
  /** The viewer's hand (card names), its pending pick, and the discard pile while it builds from it. */
  hand: string[];
  pick: SWJson;
  discard: string[];
  /** The viewer's ways to build a wonder stage now (an add-on offers them with its own card). */
  stageWays: SWWay[];
  scores: { [seat: string]: SWLine[] } | null;
}

/** What was just built. */
interface SWItem { [k: string]: SWJson; type: "card" | "stage" | "leader"; name: string; age: number; color: string; free: string | null }
interface SWCityCard { [k: string]: SWJson; key: string; color: string; eff: SWEff[] }
interface SWBuild { [k: string]: SWJson; seat: string; item: SWItem; effs: SWEff[]; city: SWCityCard[] }
interface SWConflict {
  [k: string]: SWJson;
  a: string; b: string; winner: string | null; value: number; tokens: number;
  /** Who takes the loser's defeat tokens. */
  defeatTo: string | null;
  /** Coins from the bank, per seat. */
  bonus: { [seat: string]: number };
}
interface SWScoreArgs {
  [k: string]: SWJson;
  /** Each seat's effects (cards, board, stages, extras in play), its city and the colours of its stage cards. */
  effects: { [seat: string]: SWEff[] };
  city: { [seat: string]: SWCityCard[] };
  markers: { [seat: string]: string[] };
}

/** The operations an add-on's effect may ask the base for (phases, events). */
type SWOp =
  /** Coins from (n > 0, counted as taken from the bank) or to the bank. */
  | { [k: string]: SWJson; op: "coins"; seat: string; n: number }
  /** A payment: coins to the bank, and L, R, B to the left neighbour, the right one and the bank. */
  | { [k: string]: SWJson; op: "pay"; seat: string; coins: number; L: number; R: number; B: number }
  | { [k: string]: SWJson; op: "loss"; seat: string; n: number }
  | { [k: string]: SWJson; op: "clearLoss"; seat: string }
  /** Puts effects in play for a seat (a leader recruited): its immediate effects run, then `onBuild`. */
  | { [k: string]: SWJson; op: "grant"; seat: string; extra: SWExtra }
  /** Turns a granted extra's effects off (`why` is kept, as "entomb"). */
  | { [k: string]: SWJson; op: "off"; seat: string; name: string; why: string }
  /** Builds a wonder stage (paid by a "pay" first), with `marker` under it; its effects run, then `onBuild`. */
  | { [k: string]: SWJson; op: "stage"; seat: string; stage: number; marker: string }
  | { [k: string]: SWJson; op: "log"; text: string };

interface BoardcorePoints {
  "boardcore/seven-wonders": {
    state: SWState;
    view: SWView;
    options: { sideB: boolean; randomSides: boolean; teamPlay: boolean; startCoins: number };
    points: {
      /** Every card that can be in a deck (the base's and the add-ons'). */
      cards: { shape: "registry"; entry: SWCardDef };
      /** Every wonder board. */
      wonders: { shape: "registry"; entry: SWWonderDef };
      /** The sets of content in the room. */
      sets: { shape: "registry"; entry: SWSet };
      /** Each age (a round): deal, ready, turn1/end1 ... turn7/end7, last, war; questions through the queue. */
      phases: { shape: "phases"; op: SWOp };
      /** Setup and resampling: the card ids of each age deck before the guilds are chosen and the decks shuffled. */
      decks: { shape: "modifier"; value: string[][]; args: { seats: number } };
      /** The most seats this room can seat. */
      maxSeats: { shape: "modifier"; value: number };
      /** After anything is built (a card, a stage, a leader), before the next build. */
      onBuild: { shape: "event"; args: SWBuild; op: SWOp };
      /** At the end of a turn, after its questions, before the hands pass. */
      endTurn: { shape: "event"; args: { turn: number }; op: SWOp };
      /** At the end of an age, before its conflicts. */
      ageEnd: { shape: "event"; args: { age: number }; op: SWOp };
      /** Who takes part in this age's conflicts. */
      conflictSeats: { shape: "modifier"; value: string[] };
      /** Each seat's shields in this age's conflicts. */
      shields: { shape: "modifier"; value: { [seat: string]: number } };
      /** This age's conflicts, before their tokens are handed out (`tokens` 0: no fight). */
      conflicts: { shape: "modifier"; value: SWConflict[] };
      /** Whether the hands pass at the end of this turn. */
      passes: { shape: "modifier"; value: boolean; args: { turn: number } };
      /** How coin losses are settled: "pay" (the base: pay what you can) or "keep" (an add-on settles them). */
      lossRule: { shape: "slot"; result: string };
      /** Extra scoring lines per seat. */
      score: { shape: "scoring"; result: { [seat: string]: SWLine[] }; args: SWScoreArgs };
    };
  };
}
