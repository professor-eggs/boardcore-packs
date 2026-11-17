// boardcore/pandemic 2.x: the published point declarations (11 §10 "Typed declarations"). A global script with
// no import of its own: an add-on's build includes this file and `defineAddon<"boardcore/pandemic">` checks
// every contribution against it. A changed signature is a new major version of the base.
type PDJson = import("@boardcore/pack-sdk").Json;
type PDZone = import("@boardcore/pack-sdk").Zone<string>;
type PDPrompt = import("@boardcore/pack-sdk").Prompt;
type PDStep = import("@boardcore/pack-sdk").Step;

/** One pawn: its role, city, closed (or open) hand, a stored event (Contingency Planner) and cubes on its role card. */
interface PDPl {
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
interface PDDisease { [k: string]: PDJson; id: string; cubes: number; cure: "color" | "any"; follows?: boolean; flare?: number; standard?: boolean }

/** An outcome the base or an add-on gives: `winners` empty is a shared loss (or win for none). */
interface PDOutcome { [k: string]: PDJson; winners: string[]; text: string }

interface PDState {
  [k: string]: PDJson;
  seats: string[];
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
  run: import("@boardcore/pack-sdk").Run;
}

/** Operations an add-on's handler may return; the base applies them in order. */
type PDOp =
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

/** A turn action an add-on offers the current player (`disabled` a reason, or absent). */
interface PDActionOpt { [k: string]: PDJson; id: string; label: string; cost: number; disabled?: string }

interface PDView {
  [k: string]: PDJson;
  viewer: string;
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
  run: import("@boardcore/pack-sdk").RunView;
  log: string[];
  outcome: PDOutcome | null;
}

interface BoardcorePoints {
  "boardcore/pandemic": {
    state: PDState;
    view: PDView;
    options: { epidemics: number; openHands: boolean };
    points: {
      roles: { shape: "registry"; entry: { [k: string]: PDJson; id: string } };
      events: { shape: "registry"; entry: { [k: string]: PDJson; id: string; inEpidemic?: boolean } };
      diseases: { shape: "registry"; entry: PDDisease };
      phases: { shape: "phases"; op: PDOp };
      /** The current player's add-on actions. */
      actions: { shape: "scoring"; result: PDActionOpt[]; args: { seat: string } };
      /** The prompt (a Prompt) after an add-on action's or event's id and `rest` (`{ prompt: null }`: complete), or null when not its own. */
      steps: { shape: "scoring"; first: true; result: { [k: string]: PDJson; prompt: PDJson }; args: { id: string; seat: string; rest: PDStep[] } };
      /** An add-on action's or event's effect. */
      act: { shape: "event"; op: PDOp; args: { id: string; seat: string; rest: PDStep[] } };
      /** Whether a seat may play an add-on event now: `why` null, a reason, or "hide"; null when not its own. */
      eventCheck: { shape: "scoring"; first: true; result: { [k: string]: PDJson; why: string | null }; args: { id: string; seat: string } };
      actionLimit: { shape: "modifier"; value: number; args: { seat: string } };
      handLimit: { shape: "modifier"; value: number; args: { seat: string } };
      cureCost: { shape: "modifier"; value: number; args: { seat: string; color: string } };
      /** Samples on the seat's role card that may stand in for cards in a cure: `samples` of the colour for `cards` cards (0: none). */
      cureSwap: { shape: "modifier"; value: { [k: string]: PDJson; cards: number; samples: number }; args: { seat: string; color: string } };
      infectionRate: { shape: "modifier"; value: number };
      infectCubes: { shape: "modifier"; value: number; args: { city: string; color: string } };
      infectBonus: { shape: "modifier"; value: number; args: { drawn: string[] } };
      outbreakSteps: { shape: "modifier"; value: number; args: { color: string } };
      /** A reason the pawn may not leave the city, or null. */
      blockLeave: { shape: "modifier"; value: string | null; args: { seat: string; from: string } };
      /** Whether a flight's city card is discarded (false: shown and kept). */
      payCard: { shape: "modifier"; value: boolean; args: { payer: string; card: string; kind: string } };
      cureGoal: { shape: "modifier"; value: boolean };
      /** Setup: the epidemic cards are `n` drawn from `pool`. */
      epidemics: { shape: "modifier"; value: { [k: string]: PDJson; pool: string[]; n: number } };
      /** Setup: the player cards shuffled into the piles after the hands are dealt. */
      playerCards: { shape: "modifier"; value: string[] };
      /** Setup: cards put in the infection discards before play. */
      startDiscard: { shape: "modifier"; value: string[] };
      eventCount: { shape: "modifier"; value: number; args: { seats: number } };
      maxPlayers: { shape: "modifier"; value: number };
      maxEpidemics: { shape: "modifier"; value: number };
      /** Setup (draws): the seats that get a pawn. */
      pawnSeats: { shape: "modifier"; value: string[] };
      turnStart: { shape: "event"; op: PDOp; args: { seat: string } };
      onEnter: { shape: "event"; op: PDOp; args: { seat: string; city: string; how: string } };
      onCure: { shape: "event"; op: PDOp; args: { seat: string; color: string } };
      /** An epidemic card, after its Infect step ("infected") and after Intensify ("intensified"); draws. */
      epidemic: { shape: "event"; op: PDOp; args: { step: string; card: string } };
      /** A drawn player card that is neither city, event nor epidemic. */
      drawCard: { shape: "event"; op: PDOp; args: { card: string } };
      /** An infection card that is no city (any operation: handled). */
      infectCard: { shape: "event"; op: PDOp; args: { card: string } };
      /** The end (first answer wins): may replace the base's outcome, a lone winner included. */
      outcome: { shape: "scoring"; first: true; result: PDOutcome; args: { result: PDOutcome } };
    };
  };
}
