// The Wonder Pack's boards as data (mechanics only). Effects from the references in the base's RULES-AUDIT.md
// and photos of the boards: Abu Simbel entombs a leader for twice its cost; Stonehenge scores per stone symbol
// on brown cards and turns up the card under its second B stage; Manneken Pis copies its neighbours' stages;
// the Great Wall builds its stages in any order. Some stage costs stay UNVERIFIED (SSO and GLP on the Wall,
// Abu Simbel, Manneken Pis). This add-on's own kinds are `wp:<name>`.
type Eff = SWEff;
const vp = (n: number): Eff => ({ k: "vp", n });
const sh = (n: number): Eff => ({ k: "shields", n });
const st = (cost: string, ...eff: Eff[]): SWStageDef => ({ cost, eff });
const disc: Eff = { k: "discardBuild" };

export const WP_WONDERS: readonly SWWonderDef[] = [
  { id: "Great Wall", base: "C", anyOrder: true,
    A: [st("SSO", { k: "coins", n: 8 }), st("CGP", { k: "sci", s: "*" }), st("SSS", sh(2)), st("GLP", disc)],
    B: [st("SSO", { k: "coins", n: 8 }, { k: "nbrCoins", n: 2 }), st("CCW", { k: "mask" }), st("OOS", { k: "wp:wallSkip" }), st("GLP", { k: "blackMarket" })] },
  { id: "Stonehenge", base: "S",
    A: [st("SC", vp(3)), st("CCC", vp(5)), st("SSSS", { k: "wp:stoneVP", n: 2 })],
    B: [st("SSS", { k: "wp:stoneCoins", n: 1 }, { k: "wp:stoneVP", n: 1 }), st("CCCC", { k: "wp:revealColor" })] },
  { id: "Abu Simbel", base: "P", needs: ["leaders"],
    A: [st("SS", vp(3)), st("PPL", vp(5)), st("SSSS", { k: "wp:entomb" })],
    B: [st("SSSL", { k: "wp:entomb" }), st("PPPPG", { k: "wp:entomb" })] },
  { id: "Manneken Pis", base: "", coins: 4,
    A: [st("WW", { k: "copyStage", side: "L", stage: 0 }), st("SSS", { k: "copyStage", side: "R", stage: 1 }), st("OOOO", { k: "copyStage", side: "L", stage: 2 })],
    B: [st("WWSSCCOO", { k: "coins", n: 7 }, sh(1), vp(7))] },
];
