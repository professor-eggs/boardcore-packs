// The Wonder Pack's boards as data (mechanics only). Effects from the references in the base's RULES-AUDIT.md;
// starting resources and stage costs from the photos of both sides (and 7w-5 for the starting resources):
// Abu Simbel entombs a leader for twice its cost; Stonehenge scores per stone symbol on brown cards and turns up
// the card under its second B stage; Manneken Pis copies its neighbours' stages, each A stage costing what the
// copied stage costs ("?", read by the base at setup); the Great Wall builds its stages in any order. This
// add-on's own kinds are `wp:<name>`.
type Eff = SWEff;
const vp = (n: number): Eff => ({ k: "vp", n });
const sh = (n: number): Eff => ({ k: "shields", n });
const st = (cost: string, ...eff: Eff[]): SWStageDef => ({ cost, eff });
const disc: Eff = { k: "discardBuild" };

export const WP_WONDERS: readonly SWWonderDef[] = [
  { id: "Great Wall", base: "L", anyOrder: true,
    A: [st("WW", { k: "coins", n: 8 }), st("CGP", { k: "sci", s: "*" }), st("SSS", sh(2)), st("OOO", disc)],
    B: [st("WP", { k: "coins", n: 8 }, { k: "nbrCoins", n: 2 }), st("CCO", { k: "mask" }), st("WWP", { k: "wp:wallSkip" }), st("SS", { k: "blackMarket" })] },
  { id: "Stonehenge", base: "W",
    A: [st("CO", vp(3)), st("CCP", vp(5)), st("WWWL", { k: "wp:stoneVP", n: 2 })],
    B: [st("OOO", { k: "wp:stoneCoins", n: 1 }, { k: "wp:stoneVP", n: 1 }), st("CCCP", { k: "wp:revealColor" })] },
  { id: "Abu Simbel", base: "P", needs: ["leaders"],
    A: [st("SC", vp(3)), st("WO", vp(5)), st("SSGL", { k: "wp:entomb" })],
    B: [st("CCL", { k: "wp:entomb" }), st("WWG", { k: "wp:entomb" })] },
  { id: "Manneken Pis", base: "", coins: 4,
    // A: the left board's first stage, the right board's second, the left board's last (-1 counts from the end).
    A: [st("?", { k: "copyStage", side: "L", stage: 0 }), st("?", { k: "copyStage", side: "R", stage: 1 }), st("?", { k: "copyStage", side: "L", stage: -1 })],
    B: [st("WSCOGLP", { k: "coins", n: 7 }, sh(1), vp(7))] },
];
