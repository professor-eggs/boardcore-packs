// The base game's content as data: card names, ages, costs, seat counts, chains and effects, and the seven
// wonder boards. Mechanics only. Resources: W wood, S stone, C clay, O ore (raw, brown); G glass, L loom,
// P papyrus (manufactured, grey). A cost is resource letters with an optional coin prefix: "$2SC" = 2 coins,
// a stone and a clay. Sources: ../RULES-AUDIT.md. Player-count copies and some stage costs stay UNVERIFIED.
// Add-ons add their cards and boards through the `cards` and `wonders` registries (11 §10).

type Eff = SWEff;
const P = (any: string): Eff => ({ k: "prod", any, trade: true });
const PP = (any: string): Eff[] => [P(any), P(any)];
const N = (any: string): Eff => ({ k: "prod", any, trade: false });
const vp = (n: number): Eff => ({ k: "vp", n });
const sh = (n: number): Eff => ({ k: "shields", n });
const sci = (s: SWSci | "*"): Eff => ({ k: "sci", s });
const card = (name: string, age: 1 | 2 | 3, color: SWColor, cost: string, counts: number[], eff: Eff[], from: string[] = []): SWCardDef =>
  ({ id: `${name}@${age}`, name, age, color, cost, counts, from, eff });

export const BASE_CARDS: readonly SWCardDef[] = [
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
];

const st = (cost: string, ...eff: Eff[]): SWStageDef => ({ cost, eff });
const disc: Eff = { k: "discardBuild" };

export const BASE_WONDERS: readonly SWWonderDef[] = [
  { id: "Rhodes", base: "O",
    A: [st("WW", vp(3)), st("CCC", sh(2)), st("OOOO", vp(7))],
    B: [st("SSS", sh(1), vp(3), { k: "coins", n: 3 }), st("OOOO", sh(1), vp(4), { k: "coins", n: 4 })] },
  { id: "Alexandria", base: "G",
    A: [st("SS", vp(3)), st("OO", N("WSCO")), st("GG", vp(7))],
    B: [st("CC", N("WSCO")), st("WW", N("GLP")), st("SSS", vp(7))] },
  { id: "Ephesus", base: "P",
    A: [st("SS", vp(3)), st("WW", { k: "coins", n: 9 }), st("PP", vp(7))],
    B: [st("SS", vp(2), { k: "coins", n: 4 }), st("WW", vp(3), { k: "coins", n: 4 }), st("PLG", vp(5), { k: "coins", n: 4 })] },
  { id: "Babylon", base: "C",
    A: [st("CC", vp(3)), st("WWW", sci("*")), st("CCCC", vp(7))],
    B: [st("CL", vp(3)), st("WWG", { k: "lastCard" }), st("CCCP", sci("*"))] },
  { id: "Olympia", base: "W",
    A: [st("WW", vp(3)), st("SS", { k: "freeBuild" }), st("OO", vp(7))],
    B: [st("WW", { k: "trade", side: "LR", kind: "raw" }), st("SS", vp(5)), st("LO", { k: "copyGuild" })] },
  { id: "Halicarnassus", base: "L",
    A: [st("CC", vp(3)), st("OOO", disc), st("LL", vp(7))],
    B: [st("OO", vp(2), disc), st("CCC", vp(1), disc), st("GPL", disc)] },
  { id: "Giza", base: "S",
    A: [st("SS", vp(3)), st("WWW", vp(5)), st("SSSS", vp(7))],
    B: [st("WW", vp(3)), st("SSS", vp(5)), st("CCC", vp(5)), st("SSSSP", vp(7))] },
  // Leaders: Rome. Side A recruits leaders for free (7w-5 p3); side B is -2 own / -1 neighbours (aid p2,
];

/** Parses "$2SC" into coins and resource letters. */
export function parseCost(cost: string): { coins: number; res: string } {
  const m = /^\$(\d+)(.*)$/.exec(cost);
  return m ? { coins: Number(m[1]), res: m[2] ?? "" } : { coins: 0, res: cost };
}
