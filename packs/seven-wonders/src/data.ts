// Game data: card names, ages, costs, player counts, chains and effects, as mechanics only.
// Resources: W wood, S stone, C clay, O ore (raw, brown); G glass, L loom, P papyrus (manufactured, grey).
// A cost string is resource letters with an optional coin prefix: "$2SC" = 2 coins, a stone and a clay.
// Sources (see ../RULES-AUDIT.md): the player aid and concise sheet, plus Xavier's later references
// (leaders lists, the Cities card-and-parts list, the 10-page card/wonder tables, the Cities+Leaders
// cheatsheet, and photos of the Wonder Pack boards). Player-count copy lists are still UNVERIFIED.
// Wonder stage costs stay UNVERIFIED except where a photo or table shows them.

export type Color = "brown" | "grey" | "blue" | "yellow" | "red" | "green" | "purple" | "black";
export type Sci = "c" | "g" | "t"; // compass, gear, tablet
export type Who = "self" | "nbr" | "all";

/** One effect. Cards, wonder stages and leaders all carry a list of these; the base engine interprets the
 *  base kinds and each add-on interprets its own kinds through its hooks. */
export type Eff =
  | { k: "prod"; any: string; trade: boolean } // one unit of one of the letters, each turn
  | { k: "vp"; n: number }
  | { k: "coins"; n: number }
  | { k: "shields"; n: number }
  | { k: "sci"; s: Sci | "*" }
  | { k: "trade"; side: "L" | "R" | "LR"; kind: "raw" | "man" }
  | { k: "perCoins"; n: number; who: Who; colors?: Color[]; stages?: true; victories?: true }
  | { k: "perVP"; n: number; who: Who; colors?: Color[]; stages?: true; defeats?: true; victories?: true }
  | { k: "freeBuild" } // Olympia A: once per age, build a card for free
  | { k: "lastCard" } // Babylon B: play the 7th card of each age
  | { k: "discardBuild" } // Halicarnassus, Solomon, Great Wall A: build a discarded card for free
  | { k: "copyGuild" } // Olympia B: copy one neighbour's guild at the end
  // Leaders add-on kinds
  | { k: "leaderVP"; what: "victoryTokens" | "sciSets" | "plato" | "justinian" | "coins3" | "louis" }
  | { k: "esteban" } | { k: "stevie" }
  | { k: "discount"; color: Color | "wonder" }
  | { k: "bilkis" } | { k: "freeLeaders" } | { k: "freeGuilds" } | { k: "tomyris" } | { k: "hatshepsut" }
  | { k: "nero" } | { k: "xenophon" } | { k: "vitruvius" } | { k: "courtesan" }
  | { k: "leaderCost"; self: number; nbr: number } // Rome: recruit discount
  | { k: "drawLeaders"; n: number } | { k: "extraLeader" } | { k: "entomb" }
  | { k: "perLeaderNbrVP"; n: number } | { k: "nbrGuildsVP"; n: number }
  // Cities add-on kinds
  | { k: "loss"; n: number } // every other city loses n coins (pay or take debt)
  | { k: "lossPer"; n: number; what: "victories" | "stages" }
  | { k: "nbrCoins"; n: number } // each neighbour takes n coins from the bank
  | { k: "diplomacy" } | { k: "mask" } | { k: "dock"; side: "L" | "R" }
  | { k: "warehouse" } | { k: "blackMarket" } | { k: "noWonderRes" }
  | { k: "nbrVictoryVP"; n: number } | { k: "berenice" } | { k: "caligula" } | { k: "semiramis" } | { k: "diocletian" }
  // Wonder Pack kinds
  | { k: "wallShields"; n: number } | { k: "wallSkip" } | { k: "stoneVP"; n: number } | { k: "stoneCoins"; n: number }
  | { k: "revealColor" } | { k: "copyStage"; side: "L" | "R"; stage: number };

export interface CardDef {
  name: string;
  age: 1 | 2 | 3;
  color: Color;
  cost: string;
  /** One copy is added at each of these player counts and up (base cards). Guilds and black cards: []. */
  counts: number[];
  /** Cards that let this one be built for free (the chain). */
  from: string[];
  eff: Eff[];
  set: "base" | "leaders" | "cities";
}

const P = (any: string): Eff => ({ k: "prod", any, trade: true });
const PP = (any: string): Eff[] => [P(any), P(any)];
const N = (any: string): Eff => ({ k: "prod", any, trade: false });
const vp = (n: number): Eff => ({ k: "vp", n });
const sh = (n: number): Eff => ({ k: "shields", n });
const sci = (s: Sci | "*"): Eff => ({ k: "sci", s });
const card = (name: string, age: 1 | 2 | 3, color: Color, cost: string, counts: number[], eff: Eff[], from: string[] = [], set: CardDef["set"] = "base"): CardDef =>
  ({ name, age, color, cost, counts, from, eff, set });

export const CARDS: readonly CardDef[] = [
  // Age I
  card("Lumber Yard", 1, "brown", "", [3, 4], [P("W")]),
  card("Stone Pit", 1, "brown", "", [3, 5], [P("S")]),
  card("Clay Pool", 1, "brown", "", [3, 5], [P("C")]),
  card("Ore Vein", 1, "brown", "", [3, 4], [P("O")]),
  card("Tree Farm", 1, "brown", "$1", [6], [P("WC")]),
  card("Excavation", 1, "brown", "$1", [4], [P("SC")]),
  card("Clay Pit", 1, "brown", "$1", [3], [P("CO")]),
  card("Timber Yard", 1, "brown", "$1", [3], [P("SW")]),
  card("Forest Cave", 1, "brown", "$1", [5], [P("WO")]),
  card("Mine", 1, "brown", "$1", [6], [P("SO")]),
  card("Loom", 1, "grey", "", [3, 6], [P("L")]),
  card("Glassworks", 1, "grey", "", [3, 6], [P("G")]),
  card("Press", 1, "grey", "", [3, 6], [P("P")]),
  card("Pawnshop", 1, "blue", "", [4, 7], [vp(3)]),
  card("Baths", 1, "blue", "S", [3, 7], [vp(3)]),
  card("Altar", 1, "blue", "", [3, 5], [vp(2)]),
  card("Theater", 1, "blue", "", [3, 6], [vp(2)]),
  card("Tavern", 1, "yellow", "", [4, 5, 7], [{ k: "coins", n: 5 }]),
  card("East Trading Post", 1, "yellow", "", [3, 7], [{ k: "trade", side: "R", kind: "raw" }]),
  card("West Trading Post", 1, "yellow", "", [3, 7], [{ k: "trade", side: "L", kind: "raw" }]),
  card("Marketplace", 1, "yellow", "", [3, 6], [{ k: "trade", side: "LR", kind: "man" }]),
  card("Stockade", 1, "red", "W", [3, 7], [sh(1)]),
  card("Barracks", 1, "red", "O", [3, 5], [sh(1)]),
  card("Guard Tower", 1, "red", "C", [3, 4], [sh(1)]),
  card("Apothecary", 1, "green", "L", [3, 5], [sci("c")]),
  card("Workshop", 1, "green", "G", [3, 7], [sci("g")]),
  card("Scriptorium", 1, "green", "P", [3, 4], [sci("t")]),
  // Age II
  card("Sawmill", 2, "brown", "$1", [3, 4], PP("W")),
  card("Quarry", 2, "brown", "$1", [3, 4], PP("S")),
  card("Brickyard", 2, "brown", "$1", [3, 4], PP("C")),
  card("Foundry", 2, "brown", "$1", [3, 4], PP("O")),
  card("Loom", 2, "grey", "", [3, 5], [P("L")]),
  card("Glassworks", 2, "grey", "", [3, 5], [P("G")]),
  card("Press", 2, "grey", "", [3, 5], [P("P")]),
  card("Aqueduct", 2, "blue", "SSS", [3, 7], [vp(5)], ["Baths"]),
  card("Temple", 2, "blue", "WCG", [3, 6], [vp(3)], ["Altar"]),
  card("Statue", 2, "blue", "OOW", [3, 7], [vp(4)], ["Theater"]),
  card("Courthouse", 2, "blue", "CCL", [3, 5], [vp(4)], ["Scriptorium"]),
  card("Forum", 2, "yellow", "CC", [3, 6, 7], [N("GLP")], ["East Trading Post", "West Trading Post"]),
  card("Caravansery", 2, "yellow", "WW", [3, 5, 6], [N("WSOC")], ["Marketplace"]),
  card("Vineyard", 2, "yellow", "", [3, 6], [{ k: "perCoins", n: 1, who: "all", colors: ["brown"] }]),
  card("Bazar", 2, "yellow", "", [4, 7], [{ k: "perCoins", n: 2, who: "all", colors: ["grey"] }]),
  card("Walls", 2, "red", "SSS", [3, 7], [sh(2)]),
  card("Training Ground", 2, "red", "OOW", [4, 6, 7], [sh(2)]),
  card("Stables", 2, "red", "COW", [3, 5], [sh(2)], ["Apothecary"]),
  card("Archery Range", 2, "red", "WWO", [3, 6], [sh(2)], ["Workshop"]),
  card("Dispensary", 2, "green", "OOG", [3, 4], [sci("c")], ["Apothecary"]),
  card("Laboratory", 2, "green", "CCP", [3, 5], [sci("g")], ["Workshop"]),
  card("Library", 2, "green", "SSL", [3, 6], [sci("t")], ["Scriptorium"]),
  card("School", 2, "green", "WP", [3, 7], [sci("t")]),
  // Age III
  card("Pantheon", 3, "blue", "CCOGPL", [3, 6], [vp(7)], ["Temple"]),
  card("Gardens", 3, "blue", "CCW", [3, 4], [vp(5)], ["Statue"]),
  card("Town Hall", 3, "blue", "SSOG", [3, 5, 6], [vp(6)]),
  card("Palace", 3, "blue", "WSCOGPL", [3, 7], [vp(8)]),
  card("Senate", 3, "blue", "WWSO", [3, 5], [vp(6)], ["Library"]),
  card("Haven", 3, "yellow", "WOL", [3, 4], [{ k: "perCoins", n: 1, who: "self", colors: ["brown"] }, { k: "perVP", n: 1, who: "self", colors: ["brown"] }], ["Forum"]),
  card("Lighthouse", 3, "yellow", "SG", [3, 6], [{ k: "perCoins", n: 1, who: "self", colors: ["yellow"] }, { k: "perVP", n: 1, who: "self", colors: ["yellow"] }], ["Caravansery"]),
  card("Chamber of Commerce", 3, "yellow", "CCP", [4, 6], [{ k: "perCoins", n: 2, who: "self", colors: ["grey"] }, { k: "perVP", n: 2, who: "self", colors: ["grey"] }]),
  card("Arena", 3, "yellow", "SSO", [3, 5, 7], [{ k: "perCoins", n: 3, who: "self", stages: true }, { k: "perVP", n: 1, who: "self", stages: true }], ["Dispensary"]),
  card("Fortifications", 3, "red", "OOOS", [3, 7], [sh(3)], ["Walls"]),
  card("Circus", 3, "red", "SSSO", [4, 5, 6], [sh(3)], ["Training Ground"]),
  card("Arsenal", 3, "red", "WWOL", [3, 4, 7], [sh(3)]),
  card("Siege Workshop", 3, "red", "CCCW", [3, 5], [sh(3)], ["Laboratory"]),
  card("Lodge", 3, "green", "CCLP", [3, 6], [sci("c")], ["Dispensary"]),
  card("Observatory", 3, "green", "OOGL", [3, 7], [sci("g")], ["Laboratory"]),
  card("University", 3, "green", "WWGP", [3, 4], [sci("t")], ["Library"]),
  card("Academy", 3, "green", "SSSG", [3, 7], [sci("c")], ["School"]),
  card("Study", 3, "green", "WPL", [3, 5], [sci("g")], ["School"]),
  // Guilds (Age III, players + 2 at random)
  card("Workers Guild", 3, "purple", "OOCSW", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["brown"] }]),
  card("Craftsmens Guild", 3, "purple", "OOSS", [], [{ k: "perVP", n: 2, who: "nbr", colors: ["grey"] }]),
  card("Traders Guild", 3, "purple", "LPG", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["yellow"] }]),
  card("Philosophers Guild", 3, "purple", "CCCLP", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["green"] }]),
  card("Spies Guild", 3, "purple", "SSSG", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["red"] }]),
  card("Strategists Guild", 3, "purple", "OOSL", [], [{ k: "perVP", n: 1, who: "nbr", defeats: true }]),
  card("Shipowners Guild", 3, "purple", "WWWGP", [], [{ k: "perVP", n: 1, who: "self", colors: ["brown", "grey", "purple"] }]),
  card("Scientists Guild", 3, "purple", "WWOOP", [], [sci("*")]),
  card("Magistrates Guild", 3, "purple", "WWWSL", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["blue"] }]),
  card("Builders Guild", 3, "purple", "SSCCG", [], [{ k: "perVP", n: 1, who: "all", stages: true }]),
  // Leaders guilds (names from the Cities parts list and 7w-5 tables; costs from 7w-5 p8-9).
  card("Courtesans Guild", 3, "purple", "SCGL", [], [{ k: "courtesan" }], [], "leaders"),
  card("Diplomats Guild", 3, "purple", "SWGL", [], [{ k: "perLeaderNbrVP", n: 1 }], [], "leaders"),
  card("Gamers Guild", 3, "purple", "SCOG", [], [{ k: "leaderVP", what: "coins3" }], [], "leaders"),
  card("Architects Guild", 3, "purple", "OOOCPL", [], [{ k: "nbrGuildsVP", n: 3 }], [], "leaders"),
  // Cities guilds (names from the Cities parts list; costs from 7w-5 p8-10 except Mourners, whose cost
  // is not printed on 7w-5 p9 — SSCG is UNVERIFIED).
  card("Counterfeiters Guild", 3, "purple", "OOOLG", [], [vp(5), { k: "loss", n: 3 }], [], "cities"),
  card("Guild of Shadows", 3, "purple", "SSWP", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["black"] }], [], "cities"),
  card("Mourners Guild", 3, "purple", "SSCG", [], [{ k: "nbrVictoryVP", n: 1 }], [], "cities"), // cost UNVERIFIED
  // Cities black cards, 9 per age. Names and ages from the Cities parts list; costs, VP and effects
  // from 7w-5 p4-10 (and aid p1 for the symbols). There is no Age I Black Market, no Age II Secret
  // Warehouse, and no Age III Gambling House: those slots are Gates of the City, Tabularium and Capitol.
  card("Pigeon Loft", 1, "black", "$1O", [], [{ k: "mask" }], [], "cities"),
  card("Militia", 1, "black", "$3", [], [sh(2)], [], "cities"),
  card("Hideout", 1, "black", "", [], [vp(1), { k: "loss", n: 1 }], [], "cities"),
  card("Residence", 1, "black", "C", [], [vp(1), { k: "diplomacy" }], [], "cities"),
  card("Gambling Den", 1, "black", "", [], [{ k: "coins", n: 6 }, { k: "nbrCoins", n: 1 }], [], "cities"),
  card("Secret Warehouse", 1, "black", "$2", [], [{ k: "warehouse" }], [], "cities"),
  card("Clandestine Dock West", 1, "black", "$1", [], [{ k: "dock", side: "L" }], [], "cities"),
  card("Clandestine Dock East", 1, "black", "$1", [], [{ k: "dock", side: "R" }], [], "cities"),
  card("Gates of the City", 1, "black", "$1W", [], [vp(4)], [], "cities"),
  card("Spy Ring", 2, "black", "$2SC", [], [{ k: "mask" }], [], "cities"),
  card("Mercenaries", 2, "black", "$4P", [], [sh(3)], [], "cities"),
  card("Lair", 2, "black", "WG", [], [vp(3), { k: "loss", n: 2 }], [], "cities"),
  card("Consulate", 2, "black", "CP", [], [vp(2), { k: "diplomacy" }], [], "cities"),
  card("Gambling House", 2, "black", "$1", [], [{ k: "coins", n: 9 }, { k: "nbrCoins", n: 2 }], [], "cities"),
  card("Sepulcher", 2, "black", "SGL", [], [vp(4), { k: "lossPer", n: 1, what: "victories" }], [], "cities"),
  card("Architect Cabinet", 2, "black", "$1P", [], [vp(2), { k: "noWonderRes" }], [], "cities"),
  card("Black Market", 2, "black", "OL", [], [{ k: "blackMarket" }], [], "cities"),
  card("Tabularium", 2, "black", "$2OWL", [], [vp(6)], [], "cities"),
  card("Torture Chamber", 3, "black", "$3OOG", [], [{ k: "mask" }], [], "cities"),
  card("Contingent", 3, "black", "$5L", [], [sh(5)], [], "cities"),
  card("Brotherhood", 3, "black", "WWWOL", [], [vp(4), { k: "loss", n: 3 }], [], "cities"),
  card("Embassy", 3, "black", "SLP", [], [vp(3), { k: "diplomacy" }], [], "cities"),
  card("Cenotaph", 3, "black", "CCSLG", [], [vp(5), { k: "lossPer", n: 1, what: "victories" }], [], "cities"),
  card("Builders Union", 3, "black", "CWPG", [], [vp(4), { k: "lossPer", n: 1, what: "stages" }], [], "cities"),
  card("Capitol", 3, "black", "$2CCSSGP", [], [vp(8)], [], "cities"),
  card("Slave Market", 3, "black", "OOWW", [], [{ k: "perCoins", n: 1, who: "self", victories: true }, { k: "perVP", n: 1, who: "self", victories: true }], [], "cities"),
  card("Secret Society", 3, "black", "SP", [], [{ k: "perCoins", n: 1, who: "self", colors: ["black"] }, { k: "perVP", n: 1, who: "self", colors: ["black"] }], [], "cities"),
];

export interface StageDef { cost: string; eff: Eff[] }
export interface WonderDef {
  name: string;
  /** The board's starting resource ("" for none). */
  base: string;
  set: "base" | "leaders" | "cities" | "wonderPack";
  /** Extra starting coins (Manneken Pis). */
  coins?: number;
  /** Stages may be built in any order (the Great Wall). */
  anyOrder?: true;
  /** Needs another add-on (Abu Simbel needs Leaders). */
  needs?: string;
  /** Effects of the board itself, per side (Rome's recruiting discounts). */
  board?: { A: Eff[]; B: Eff[] };
  A: StageDef[];
  B: StageDef[];
}

const st = (cost: string, ...eff: Eff[]): StageDef => ({ cost, eff });
const disc: Eff = { k: "discardBuild" };

export const WONDERS: readonly WonderDef[] = [
  { name: "Rhodes", base: "O", set: "base",
    A: [st("WW", vp(3)), st("CCC", sh(2)), st("OOOO", vp(7))],
    B: [st("SSS", sh(1), vp(3), { k: "coins", n: 3 }), st("OOOO", sh(1), vp(4), { k: "coins", n: 4 })] },
  { name: "Alexandria", base: "G", set: "base",
    A: [st("SS", vp(3)), st("OO", N("WSCO")), st("GG", vp(7))],
    B: [st("CC", N("WSCO")), st("WW", N("GLP")), st("SSS", vp(7))] },
  { name: "Ephesus", base: "P", set: "base",
    A: [st("SS", vp(3)), st("WW", { k: "coins", n: 9 }), st("PP", vp(7))],
    B: [st("SS", vp(2), { k: "coins", n: 4 }), st("WW", vp(3), { k: "coins", n: 4 }), st("PLG", vp(5), { k: "coins", n: 4 })] },
  { name: "Babylon", base: "C", set: "base",
    A: [st("CC", vp(3)), st("WWW", sci("*")), st("CCCC", vp(7))],
    B: [st("CL", vp(3)), st("WWG", { k: "lastCard" }), st("CCCP", sci("*"))] },
  { name: "Olympia", base: "W", set: "base",
    A: [st("WW", vp(3)), st("SS", { k: "freeBuild" }), st("OO", vp(7))],
    B: [st("WW", { k: "trade", side: "LR", kind: "raw" }), st("SS", vp(5)), st("LO", { k: "copyGuild" })] },
  { name: "Halicarnassus", base: "L", set: "base",
    A: [st("CC", vp(3)), st("OOO", disc), st("LL", vp(7))],
    B: [st("OO", vp(2), disc), st("CCC", vp(1), disc), st("GPL", disc)] },
  { name: "Giza", base: "S", set: "base",
    A: [st("SS", vp(3)), st("WWW", vp(5)), st("SSSS", vp(7))],
    B: [st("WW", vp(3)), st("SSS", vp(5)), st("CCC", vp(5)), st("SSSSP", vp(7))] },
  // Leaders: Rome. Side A recruits leaders for free (7w-5 p3); side B is -2 own / -1 neighbours (aid p2,
  // 7w-5 p3). Stage costs are still UNVERIFIED. self:99 is a discount large enough to make any leader free.
  { name: "Roma", base: "", set: "leaders",
    board: { A: [{ k: "leaderCost", self: 99, nbr: 0 }], B: [{ k: "leaderCost", self: 2, nbr: 1 }] },
    A: [st("WWO", vp(4)), st("SSSO", vp(6))],
    B: [st("WO", { k: "coins", n: 5 }, { k: "drawLeaders", n: 4 }), st("SSC", vp(3), { k: "extraLeader" }), st("GPLW", vp(3), { k: "extraLeader" })] },
  // Cities: Petra and Byzantium. Effects from aid / 7w-5 (others pay N, diplomacy, 7 and 14 VP stages).
  // Starting resources: Petra clay both sides, Byzantium stone both sides (7w-5 p4-6 lists Byzantium B as
  // papyrus, which cannot be the other side of a stone board; kept as stone). Stage costs UNVERIFIED.
  { name: "Petra", base: "C", set: "cities",
    A: [st("SW", vp(3)), st("$7", vp(7)), st("SSWW", vp(7))],
    B: [st("WO", vp(3), { k: "loss", n: 2 }), st("$14", vp(14))] },
  { name: "Byzantium", base: "S", set: "cities",
    A: [st("WW", vp(3)), st("SSS", vp(2), { k: "diplomacy" }), st("WWWG", vp(7))],
    B: [st("CLP", vp(3), { k: "diplomacy" }), st("WWG", vp(4), { k: "diplomacy" })] },
  // Wonder Pack. Effects from aid p2 and the board photos / 7w-5: Abu Simbel entombs a leader for 2x its
  // cost; Stonehenge 2 VP per stone on brown cards, and a stage worth 1 coin + 1 VP per stone; the flipped
  // stage card scoring 1 VP per card of its colour next door; Manneken Pis copies stage 1 left, stage 2
  // right, stage 3 left, +4 starting coins, no board resource. The Great Wall starts with clay (photos),
  // stages in any order (7w-5 p2, photos). Some stage costs on the photos are still too small to read
  // and stay UNVERIFIED (SSO, GLP on the Wall; Abu Simbel; Manneken Pis).
  { name: "Great Wall", base: "C", set: "wonderPack", anyOrder: true,
    A: [st("SSO", { k: "coins", n: 8 }), st("CGP", sci("*")), st("SSS", { k: "wallShields", n: 2 }), st("GLP", disc)],
    B: [st("SSO", { k: "coins", n: 8 }, { k: "nbrCoins", n: 2 }), st("CCW", { k: "mask" }), st("OOS", { k: "wallSkip" }), st("GLP", { k: "blackMarket" })] },
  { name: "Stonehenge", base: "S", set: "wonderPack",
    A: [st("SC", vp(3)), st("CCC", vp(5)), st("SSSS", { k: "stoneVP", n: 2 })],
    B: [st("SSS", { k: "stoneCoins", n: 1 }, { k: "stoneVP", n: 1 }), st("CCCC", { k: "revealColor" })] },
  { name: "Abu Simbel", base: "P", set: "wonderPack", needs: "leaders",
    A: [st("SS", vp(3)), st("PPL", vp(5)), st("SSSS", { k: "entomb" })],
    B: [st("SSSL", { k: "entomb" }), st("PPPPG", { k: "entomb" })] },
  { name: "Manneken Pis", base: "", set: "wonderPack", coins: 4,
    A: [st("WW", { k: "copyStage", side: "L", stage: 0 }), st("SSS", { k: "copyStage", side: "R", stage: 1 }), st("OOOO", { k: "copyStage", side: "L", stage: 2 })],
    B: [st("WWSSCCOO", { k: "coins", n: 7 }, sh(1), vp(7))] },
];

export interface LeaderDef { name: string; cost: number; eff: Eff[]; set: "leaders" | "cities" | "promo" }
const L = (name: string, cost: number, ...eff: Eff[]): LeaderDef => ({ name, cost, eff, set: "leaders" });
const LC = (name: string, cost: number, ...eff: Eff[]): LeaderDef => ({ name, cost, eff, set: "cities" });
const per = (n: number, colors: Color[]): Eff => ({ k: "perVP", n, who: "self", colors });

/** Leaders. Effects match aid p1/p2, 7w-1, 7w-3 and 7w-5. Coin costs come from 7w-2, 7w-3 (2015 table)
 *  and 7w-5; where 7w-5 disagrees with the dedicated lists (Nero 3 vs 1), the lists win. */
export const LEADERS: readonly LeaderDef[] = [
  L("Alexander", 3, { k: "leaderVP", what: "victoryTokens" }),
  L("Amytis", 4, { k: "perVP", n: 2, who: "self", stages: true }),
  L("Archimedes", 4, { k: "discount", color: "green" }),
  L("Aristotle", 3, { k: "leaderVP", what: "sciSets" }),
  L("Bilkis", 4, { k: "bilkis" }),
  L("Caesar", 5, sh(2)),
  L("Cleopatra", 4, vp(5)),
  L("Croesus", 1, { k: "coins", n: 6 }),
  L("Euclid", 5, sci("c")),
  L("Hammurabi", 2, { k: "discount", color: "blue" }),
  L("Hannibal", 2, sh(1)),
  L("Hatshepsut", 2, { k: "hatshepsut" }),
  L("Hiram", 3, per(2, ["purple"])),
  L("Hypatia", 4, per(1, ["green"])),
  L("Imhotep", 3, { k: "discount", color: "wonder" }),
  L("Justinian", 3, { k: "leaderVP", what: "justinian" }),
  L("Leonidas", 2, { k: "discount", color: "red" }),
  L("Maecenas", 1, { k: "freeLeaders" }),
  L("Midas", 3, { k: "leaderVP", what: "coins3" }),
  L("Nebuchadnezzar", 4, per(1, ["blue"])),
  L("Nefertiti", 3, vp(4)),
  L("Nero", 1, { k: "nero" }),
  L("Pericles", 6, per(2, ["red"])),
  L("Phidias", 3, per(1, ["brown"])),
  L("Plato", 4, { k: "leaderVP", what: "plato" }),
  L("Praxiteles", 3, per(2, ["grey"])),
  L("Ptolemy", 5, sci("t")),
  L("Pythagoras", 5, sci("g")),
  L("Ramses", 5, { k: "freeGuilds" }),
  L("Sappho", 1, vp(2)),
  L("Solomon", 3, disc),
  L("Tomyris", 4, { k: "tomyris" }),
  L("Varro", 3, per(1, ["yellow"])),
  L("Vitruvius", 1, { k: "vitruvius" }),
  L("Xenophon", 2, { k: "xenophon" }),
  L("Zenobia", 2, vp(3)),
  // Cities leaders (aid p1/p2; costs from 7w-3 and 7w-5).
  LC("Berenice", 2, { k: "berenice" }),
  LC("Darius", 4, per(1, ["black"])),
  LC("Aspasia", 3, vp(2), { k: "diplomacy" }),
  LC("Caligula", 3, { k: "caligula" }),
  LC("Semiramis", 2, { k: "semiramis" }),
  LC("Diocletian", 2, { k: "diocletian" }),
  // Leaders goodies (aid p2, 7w-1, 7w-3): Louis 4, Stevie X (paid as 1 coin per resource when used),
  // Esteban 5. Option leaderPromos.
  { name: "Louis", cost: 4, eff: [{ k: "leaderVP", what: "louis" }], set: "promo" },
  { name: "Stevie", cost: 0, eff: [{ k: "stevie" }], set: "promo" },
  { name: "Esteban", cost: 5, eff: [{ k: "esteban" }], set: "promo" },
];

export const cardDef = (name: string, age: number): CardDef => {
  const c = CARDS.find((x) => x.name === name && x.age === age) ?? CARDS.find((x) => x.name === name);
  if (!c) throw new Error(`no card ${name}`);
  return c;
};
export const wonderDef = (name: string): WonderDef => {
  const w = WONDERS.find((x) => x.name === name);
  if (!w) throw new Error(`no wonder ${name}`);
  return w;
};
export const leaderDef = (name: string): LeaderDef => {
  const l = LEADERS.find((x) => x.name === name);
  if (!l) throw new Error(`no leader ${name}`);
  return l;
};

/** Parses "$2SC" into coins and resource letters. */
export function parseCost(cost: string): { coins: number; res: string } {
  const m = /^\$(\d+)(.*)$/.exec(cost);
  return m ? { coins: Number(m[1]), res: m[2] ?? "" } : { coins: 0, res: cost };
}
