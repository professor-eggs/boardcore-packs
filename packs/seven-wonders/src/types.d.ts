// boardcore/seven-wonders 3.x (the 2nd edition, its expansions as options): the shapes the pack's modules share
// (effects, cards, boards, the state and the view). A global script with no import of its own, so the rules, the
// expansion modules and the tests name them without importing.
type SWJson = import("@boardcore/pack-sdk").Json;
type SWZone<T extends SWJson> = import("@boardcore/pack-sdk").Zone<T>;

type SWColor = "brown" | "grey" | "blue" | "yellow" | "red" | "green" | "purple" | "black";
type SWSci = "c" | "g" | "t";
type SWWho = "self" | "nbr" | "all";

/**
 * One effect of a card, a wonder stage or board, or a granted extra (a leader). The base rules interpret these
 * kinds; an expansion's own kinds are named `<prefix>:<name>` (`leaders:`, `cities:`, `wp:`) and only its
 * module reads them (in `onBuild` and `score`, or from a seat's `extras`).
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
  /** The effects of a neighbour's wonder stage (`stage` from 0; a negative one counts from the last, -1 the last). */
  | { [k: string]: SWJson; k: "copyStage"; side: "L" | "R"; stage: number }
  | SWOwnEff;
/** An expansion's own effect kind, `<prefix>:<name>`: the base rules keep it and never read it. */
interface SWOwnEff { [k: string]: SWJson; k: `${string}:${string}` }

interface SWCardDef {
  [k: string]: SWJson;
  /** `<name>@<age>`, the card's key in hands and cities. */
  id: string;
  name: string;
  age: number;
  color: SWColor;
  /** Resource letters (WSCO raw, GLP manufactured), with an optional coin prefix: "$2SC". */
  cost: string;
  /** Base cards: one copy at each of these seat counts and up. Cards an expansion deals (`decks`): []. */
  counts: number[];
  /** Cards that make this one free (the chain). */
  from: string[];
  eff: SWEff[];
}
/** A stage's cost and effects. Cost "?" on a stage that copies a neighbour's stage: that stage's cost, fixed at setup. */
interface SWStageDef { [k: string]: SWJson; cost: string; eff: SWEff[] }
interface SWWonderDef {
  [k: string]: SWJson;
  id: string;
  /** The board's starting resource letter ("" for none). */
  base: string;
  /** Only dealt when every set named here is in the game (`sets`). */
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
/** Effects granted to a seat (a leader in play, or the copy of one): public, part of the seat's effects unless `off`. */
interface SWExtra { [k: string]: SWJson; from: string; name: string; cost: number; eff: SWEff[]; off: string | null }

interface SWPlayer {
  [k: string]: SWJson;
  wonder: string;
  side: "A" | "B";
  /** Stage indices built, in build order. */
  built: number[];
  /** Each stage's cost on this board's side (public); a "?" copy cost is already the copied stage's. */
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
  /** The content in the game: "base", then the expansions switched on ("leaders", "cities", "wonderPack"). */
  sets: string[];
  age: number;
  /** The turn last played in this age (0 before the first). */
  turn: number;
  players: { [seat: string]: SWPlayer };
  /** The age decks, face down. */
  decks: SWZone<string>[];
  discard: SWZone<string>;
  /** Questions a build raised, waiting to be asked (a discard-pile build, a copy, an extra leader, an entombing). */
  pending: { [k: string]: SWJson; seat: string; kind: string }[];
  /** Coins each seat must lose: paid as far as it can, or (Cities) asked as a debt choice. */
  losses: { [seat: string]: number };
  /** Coins taken from the bank this turn, and who bought from which side ("seat>L"). */
  gained: { [seat: string]: number };
  bought: string[];
  /** Team play: each seat's partner. */
  partner: { [seat: string]: string };
  /** What the last action showed everyone. */
  log: string[];
  /** Each expansion's own state, present when its option is on. */
  leaders?: SWLeaders;
  cities?: SWCities;
  wonderPack?: SWWonderPack;
  run: import("@boardcore/pack-sdk").Run;
}

type SWHands = { [seat: string]: string[] };
/** Leaders: hidden but for the counts. */
interface SWLeaders {
  [k: string]: SWJson;
  /** The draft hands (before Age I), the leaders each seat holds, the undealt leaders, and each seat's used ones (face down). */
  draft: SWHands; hands: SWHands; box: string[]; out: SWHands;
  /** Esteban: who used him, and the turn the hands don't pass. */
  used: string[]; frozen: { [k: string]: SWJson; age: number; turn: number } | null;
}
/** Cities: debt and diplomacy tokens (public), and who sits this age's conflicts out. */
interface SWCities { [k: string]: SWJson; debt: { [seat: string]: number }; diplomacy: { [seat: string]: number }; absent: string[]; spent: string[] }
/** The Wonder Pack: the age each Great Wall seat skips, and who sits this age's conflicts out. */
interface SWWonderPack { [k: string]: SWJson; skip: { [seat: string]: number }; absent: string[] }

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
  sets: string[];
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
  scores: { [seat: string]: SWLine[] } | null;
  /** Leaders: the viewer's own leaders and draft hand, and everyone's counts. */
  leaders?: {
    [k: string]: SWJson;
    hand: string[]; draft: string[];
    handSizes: { [seat: string]: number }; draftSizes: { [seat: string]: number }; outSizes: { [seat: string]: number }; box: number;
    esteban: string[]; frozen: SWLeaders["frozen"];
  };
  /** Cities: each seat's debt and diplomacy tokens. */
  cities?: { [k: string]: SWJson; debt: { [seat: string]: number }; diplomacy: { [seat: string]: number } };
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
