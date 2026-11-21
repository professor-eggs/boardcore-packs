// boardcore/pandemic 3.x: the pack's own types, shared by the base (engine, actions, index), the kernel and the
// On the Brink modules under ./expansions. Plain in-pack types: they were the published point declarations
// (points.d.ts) while the modules were add-on packs. Mechanics only.
import type { Json, Run, RunView, Zone } from "@boardcore/pack-sdk";

type PDJson = Json;
type PDZone = Zone<string>;

/** One pawn: its role, city, closed (or open) hand, a stored event (Contingency Planner) and cubes on its role card. */
export interface PDPl {
  [k: string]: PDJson;
  role: string;
  city: string;
  hand: PDZone;
  stored: string | null;
  /** This turn's once-a-turn flags, and `treated:<city>:<colour>` for each cube the pawn treated this turn. */
  used: string[];
  /** Cubes kept on the role card (samples), by colour. */
  samples: { [color: string]: number };
}

/**
 * A disease. `cure: "color"` needs city cards of its colour; `"any"` city cards of any colour, at least one of a
 * city with this disease on it. `follows`: a city drawn in the infection step that already has this disease gets
 * one more of it. `flare`: an outbreak of it first takes this many cubes back from the outbreaking city.
 * `standard`: one of the four the base goal counts.
 */
export interface PDDisease { [k: string]: PDJson; id: string; cubes: number; cure: "color" | "any"; follows?: boolean; flare?: number; standard?: boolean }

/** An outcome the base or a module gives: `winners` empty is a shared loss (or win for none). */
export interface PDOutcome { [k: string]: PDJson; winners: string[]; text: string }

export interface PDState {
  [k: string]: PDJson;
  seats: string[];
  /** The modules switched on (the options), in the kernel's order: see ./kernel.ts. */
  mods: string[];
  /** Each module's own slice of state, by module id (null: none). The Bio-Terrorist's holds his secret city. */
  slices: { [mod: string]: PDJson };
  /** The seats with a pawn (the cure side), in turn order. */
  players: string[];
  pl: { [seat: string]: PDPl };
  diseases: PDDisease[];
  cubes: { [city: string]: { [color: string]: number } };
  supply: { [color: string]: number };
  stations: string[];
  cured: string[];
  eradicated: string[];
  outbreaks: number;
  rateIdx: number;
  playerDeck: PDZone;
  /** Pile sizes at setup, top first, one epidemic each (for resampleHidden only). */
  piles: number[];
  /** The epidemic cards were drawn from this pool (public). */
  epiPool: string[];
  playerDiscard: string[];
  infDeck: PDZone;
  /** The infection deck as segments, top first, each a set the table knows (the shuffled discards on top). */
  infSegs: number[];
  /** How many of the infection deck's top cards each seat knows in order (a peek, a forecast). */
  infKnown: { [seat: string]: number };
  infDiscard: string[];
  /** Infection cards a seat holds (the one-against-all seat's hand). */
  held: { [seat: string]: PDZone };
  /** The cards a forecast is ordering, seen by its player only. */
  forecast: PDZone | null;
  removed: string[];
  unusedRoles: string[];
  /** Event cards in the game (public). */
  nEvents: number;
  current: number;
  /** Turns begun so far (1 on the first). */
  turn: number;
  actionsLeft: number;
  /** Where the turn is: "actions", "window", "draw", "epidemic", "infect", "other". */
  step: string;
  drawn: string[];
  epidemicCard: string | null;
  inf: { left: number; drawn: string[]; bonus: boolean } | null;
  openHands: boolean;
  quiet: boolean;
  /** The colour cured by the last action, until the next action (a "right after a cure" event). */
  justCured: string | null;
  /** A pawn the current player may move as his own this turn. */
  grant: string | null;
  /** The current player called for events since his last action. */
  called: boolean;
  outcome: PDOutcome | null;
  log: string[];
  run: Run;
}

/** Operations a module's handler may return; the base applies them in order. */
export type PDOp =
  /** The kernel's own: a module's new slice, put first among its handler's operations. */
  | { [k: string]: PDJson; op: "slice"; mod: string; slice: PDJson }
  | { [k: string]: PDJson; op: "log"; text: string }
  | { [k: string]: PDJson; op: "place"; city: string; color: string; n: number }
  | { [k: string]: PDJson; op: "remove"; city: string; color: string; n: number }
  /** Changes a supply by n (never below 0). */
  | { [k: string]: PDJson; op: "supply"; color: string; n: number }
  | { [k: string]: PDJson; op: "uneradicate"; color: string }
  | { [k: string]: PDJson; op: "actions"; n: number }
  | { [k: string]: PDJson; op: "move"; pawn: string; payer: string; kind: string; to: string }
  /** A city card from one hand to another (a share or a take agreed by both). */
  | { [k: string]: PDJson; op: "give"; from: string; to: string; card: string }
  | { [k: string]: PDJson; op: "handToDiscard"; seat: string; card: string }
  | { [k: string]: PDJson; op: "discardToHand"; seat: string; card: string }
  | { [k: string]: PDJson; op: "spendEvent"; seat: string; name: string }
  | { [k: string]: PDJson; op: "role"; seat: string; role: string }
  | { [k: string]: PDJson; op: "sample"; seat: string; city: string; color: string }
  | { [k: string]: PDJson; op: "unsample"; seat: string; color: string; n: number }
  /** A cure with these cards from the seat's hand and these samples from its role card. */
  | { [k: string]: PDJson; op: "cure"; seat: string; color: string; cards: string[]; samples: number }
  | { [k: string]: PDJson; op: "unstation"; city: string }
  /** The top n infection cards go to the seat's held cards. */
  | { [k: string]: PDJson; op: "hold"; seat: string; n: number }
  /** Held cards go to the infection discards (all of them when `cards` is null). */
  | { [k: string]: PDJson; op: "unhold"; seat: string; cards: string[] | null }
  /** The bottom infection card goes to the discards; n cubes of the colour go on it if it is a city. */
  | { [k: string]: PDJson; op: "infectBottom"; color: string; n: number }
  /** The seat looks at as many top infection cards as the current infection rate. */
  | { [k: string]: PDJson; op: "peek"; seat: string }
  | { [k: string]: PDJson; op: "grant"; pawn: string }
  | { [k: string]: PDJson; op: "use"; seat: string; flag: string }
  /** The action depends on hidden information (a reveal). */
  | { [k: string]: PDJson; op: "reveal" }
  /** Checks the seat's hand limit (asks it to discard). */
  | { [k: string]: PDJson; op: "handLimit"; seat: string }
  /** Asks a seat to choose one of these options; the chosen option's operations follow. */
  | { [k: string]: PDJson; op: "ask"; seat: string; label: string; choices: { [k: string]: PDJson; id: string; label: string; ops: PDJson[] }[] }
  /** Asks `from` to give `to` a city card (of `city`, or any when null) from its hand, or refuse; on a give `to` pays `cost` actions and marks `flag`. */
  | { [k: string]: PDJson; op: "askCard"; from: string; to: string; city: string | null; cost: number; flag: string | null }
  /** Asks `seat` to agree; on yes the operations follow and `from` pays `cost` actions. */
  | { [k: string]: PDJson; op: "consent"; seat: string; from: string; text: string; ops: PDJson[]; cost: number };

/**
 * A turn action a module offers the current player (`disabled` a reason, or absent). `anyTime`: no action at
 * all, so its holder is also offered it wherever an event may be played (a response window, a wait, a hand-limit
 * discard); the holder is known from public information.
 */
export interface PDActionOpt { [k: string]: PDJson; id: string; label: string; cost: number; disabled?: string; anyTime?: boolean }

export interface PDView {
  [k: string]: PDJson;
  viewer: string;
  mods: string[];
  /** Each module's view of its slice for this viewer, by module id. */
  modules: { [mod: string]: PDJson };
  players: string[];
  current: string;
  turn: number;
  step: string;
  actionsLeft: number;
  pl: { [seat: string]: { [k: string]: PDJson; role: string; city: string; hand: string[]; handSize: number; stored: string | null; used: string[]; samples: { [c: string]: number }; held: string[]; heldSize: number } };
  cubes: { [city: string]: { [c: string]: number } };
  supply: { [c: string]: number };
  stations: string[];
  cured: string[];
  eradicated: string[];
  outbreaks: number;
  infectionRate: number;
  playerDeck: number;
  playerDiscard: string[];
  infectionDeck: number;
  infectionDiscard: string[];
  /** The infection deck's top cards this viewer knows. */
  known: string[];
  forecast: string[];
  grant: string | null;
  justCured: string | null;
  actors: string[];
  run: RunView;
  log: string[];
  outcome: PDOutcome | null;
}
