# 7 Wonders rules audit

Checked against the references Xavier supplied. Short names used below:

- **aid p1 / aid p2**: *7 Wonders Player Aid* (symbols and effects for the base game, Leaders, Cities, the Wonder Pack, and the Catan and Leaders goodies).
- **concise**: hecose's *Concise Reference Sheets* v12, the 7 Wonders sheet (base setup, the turn, trading, military, scoring).
- **7w-1**: Leaders summary (effects, including goodies and later promos).
- **7w-2**: leader effects with coin costs (base Leaders).
- **7w-3**: leader table, version 3.0, 20 March 2015 (costs and effects, including Cities leaders and goodies).
- **7w-4**: earlier leader table, version 1.3, 1 August 2011 (base Leaders only; used when it agrees with 7w-2/7w-3).
- **7w-5**: 10-page card and wonder tables (Age I–III costs, chains and effects; wonder effects and starting resources).
- **parts**: *7 Wonders: Cities (1st Edition) Card and Part List* (names of every Cities card, guild and leader, and which age each black card belongs to).
- **sheet**: Cities & Leaders cheatsheet (setup, 8-player variant, leader draft, debt, diplomacy, team play).
- **photos**: Wonder Pack boards, sides A and B (Great Wall, Abu Simbel, Manneken Pis, Stonehenge).
- **2e article**: a third-party web article comparing the 1st and 2nd editions, which Xavier supplied when he
  chose the 2nd edition (2.0.0). Section names below are the article's headings: *Box and Component Updates*,
  *1st Age*, *2nd Age*, *3rd Age* (and its military list), *Building Chains*, and one per wonder.

**Since 2.0.0 the base is the 2nd edition.** The Rules, Cards and Wonders tables below are the 1st-edition audit
(1.0.0); where the 2nd edition changed a row, "2nd edition (2.0.0)" at the end of this file supersedes it.

Statuses:

- **matching**: the code already did what the source says.
- **fixed**: the code disagreed and was corrected.
- **added**: the source defines it and it was missing; now built.
- **blocked**: the source defines it but it can't be built here; the reason is given.
- **not covered**: no supplied source defines it, so it can't be confirmed either way (UNVERIFIED).

**Still not in any source.** The stage costs of Rome, Petra and Byzantium (7w-5 prints effects only; the Wonder Pack costs are from the photos since 2026-11-18). The Mourners Guild's resource cost (7w-5 p9 leaves the cost cell empty). Those stay UNVERIFIED. Since 2.2.0 the base's copy lists, card costs (Archery Range included) and stage costs are checked against 2nd-edition sources: see "2nd-edition sources (2.2.0)".

Cost and chain values that *are* in 7w-5, 7w-2/3 or the photos are treated as confirmed and the UNVERIFIED mark was removed.

## Rules

| Rule | Code | Source | Status |
|---|---|---|---|
| 3 coins to start | `setupState` | concise Start | matching |
| Leaders: +3 coins (6) and a 4-leader draft, passing right | `addons/leaders.ts` setup | sheet (6$; deal 4, pick one, pass right) | **fixed** (was not covered; already implemented, now confirmed) |
| Guilds: players + 2 at random, secret | `setupState` | concise Start; sheet | matching at 3–7. At 8 players the sheet says set up like 7, so **fixed** to 9 guilds (not 10): 10 guilds made Age III 57 cards, which would not deal evenly |
| Remove cards by player count | `baseDecks` (counts per card) | concise Start (counts not printed) | matching (counts not covered) |
| Random wonders and sides (side A while learning) | options `sideB`, `randomSides` | concise Start | matching |
| 3 ages; 7 cards dealt, then 6 turns (8 cards / 7 turns with Cities; 7 cards / 6 turns at 8 players) | `startAge`, `turnPhase`, `addons/cities.ts` decks | concise Structure; sheet | matching (Cities 8-card hands already); **fixed** 8-player Age III guild count so each age has 56 cards (deal 7, play 6) |
| Choose 1 card, everyone acts at once: build it, build a wonder stage, or discard for 3 coins | `turnPhase`, `resolveHands` | concise Turn | matching |
| Building is free if you own its chain predecessor | `cardWays` (`from`) | concise Turn a | matching (chain list not covered) |
| Produce the cost yourself or buy from neighbours at 2 coins a resource. The neighbour can't refuse and loses nothing. A purchase lasts 1 turn. | `plans`, `pay` | concise Turn a | matching |
| You can't spend money earned this turn | payment plans are fixed against the coins held before the turn resolves | concise Turn a | matching |
| No duplicates | `cardWays` ("you already have one") | concise Turn a | matching |
| A wonder stage costs its price; the card is tucked under it; stages aren't tied to ages | `stageWays`, `resolveHands` | concise Turn b, Others | matching |
| Pass hands clockwise (to the left) in ages I and III, anticlockwise in age II | `passHands` | concise Turn 3 | matching |
| The 7th card is discarded | `discardLast` | concise Structure | matching |
| Babylon B: play the last card of each age (build it, use it for a stage, or discard it for 3 coins) | `lastCardPhase` | aid p2 Wonders | matching |
| Halicarnassus (and Solomon): pick any card discarded since the start and build it free | `discardBuild` interrupt | aid p1 General | matching |
| Olympia A: once per age, build a card from your hand free | `freeBuild` / way "olympia" | aid p2 Wonders | matching |
| Olympia B: copy a neighbour's guild at the end | `score` (noCopy guard) | aid p2 Wonders | matching |
| End of age military: −1 if weaker, +1/3/5 if stronger (ages I/II/III), nothing on a tie | `military` | concise End of Age | matching |
| End: 1 VP per 3 coins | `score` | concise End | matching |
| Science: each symbol's count squared, plus 7 per set of 3 different | `sciScore` | concise End | matching |
| Science wild ("choose at the end") | `sciScore` | aid p1 General | matching |
| Ties go to the most coins | `status` | concise End | matching |
| Neighbours can't buy resources from "choose one of several" cards and stages | `N(...)` = `trade: false` | aid p1 General | matching |
| Cities: debt (paying coins you lack; you may take debt even if you could pay; resolved last each turn) | `addons/cities.ts` `settleLoss`, debt interrupt | sheet | matching (the choice and last-in-turn pending queue were already built) |
| Cities: others pay N, per victory token, or per wonder stage | `loss`, `lossPer` | aid p1 General, Age II, Age III | matching |
| Cities: diplomacy. Skip this age's conflicts; your left neighbour fights your right one | `conflictSeats` | aid p1 General | matching |
| Cities: a mask copies one neighbour's green-card symbol | `sciCounts` (pool) | aid p1 General | matching |
| Cities: black market (a resource your brown/grey cards and board don't make) | `payCtx` | aid p1 General | matching |
| Cities: secret warehouse (another of what your city already makes) | `payCtx` | aid p1 | matching |
| Cities: clandestine docks (1 coin off the first purchase from one side each turn) | `rebate` | aid p1 | matching |
| Cities: wonder stages without resource costs | `noWonderRes` | aid p1 Age II | matching |
| Cities: take 6 coins, each neighbour takes 1 | `coins` + `nbrCoins` | aid p1 General | matching |
| Cities team play | option `teamPlay` (needs Cities; 4, 6 or 8 seats) | sheet | **added**: adjacent pairs in seat order; teammates do not fight; each remaining fight awards two tokens of the usual value; diplomacy still fights but both sides take one fewer token. Combined team scores are not used (the sheet says most points wins). Arbitrary seat pairings at room time (C7) are still not available; the option always pairs neighbours |
| 2-player expert variant | none | concise Others: "see rules" | **blocked**: not defined on the sheets |
| Leaders: recruiting each age (recruit, build a stage with the leader, or discard for 3) | `recruit` phase | sheet | matching |
| Leaders goodies: Louis, Stevie, Esteban | option `leaderPromos` | aid p2 | **added** |
| Esteban: once a game, freeze the passing; everyone plays a 2nd card from the same hand | `leaders.ts` turn decorator | aid p2 | **added**. Allowed only while hands hold 3 or more cards; the sheet doesn't say what happens with 2 |
| Courtesans' Guild can't copy Esteban | `copyable` in the Leaders add-on (options and default) | 7w-1, 7w-3 | **fixed (2026-11-18)**: Esteban was offered |
| Stevie: build a wonder stage paying 1 coin per resource; Stevie stays as its marker | `leaderWays` "stevie:i" | aid p2 | **added** |
| Louis: 7 VP minus your victory tokens (count, not value) | `leaderVP` louis | aid p2 | **added** |
| Catan goodie (Island of Catan board, its leader) | none | aid p2 | **blocked**: the sheet gives the board's trade effect but no stage costs or effects, so a playable board can't be built. Not part of the requested expansions |
| Heading during the leader draft | `heading()` in index.ts | n/a | **fixed**: showed "Age 0 turn 0 draft"; now "Leader draft, pick N of 4", "Age I: leader recruitment", "Age I, turn N" |

## Cards

The Effect column is the engine's encoding. **Players** (copy counts) are still not covered by any source (UNVERIFIED). Cost and Free from for base and Cities cards are from 7w-5 (and names/ages from the parts list) unless a note says otherwise. The Status column is for the effect and for any cost fix.

| Card | Age | Colour | Cost | Players | Free from (chain) | Effect | Effect source | Status |
|---|---|---|---|---|---|---|---|---|
| Lumber Yard | 1 | brown | free | 3,4 | - | prod any:W trade:true | aid p1 General | matching |
| Stone Pit | 1 | brown | free | 3,5 | - | prod any:S trade:true | aid p1 General | matching |
| Clay Pool | 1 | brown | free | 3,5 | - | prod any:C trade:true | aid p1 General | matching |
| Ore Vein | 1 | brown | free | 3,4 | - | prod any:O trade:true | aid p1 General | matching |
| Tree Farm | 1 | brown | $1 | 6 | - | prod any:WC trade:true | aid p1 Age I (one of two) / General (one of four, one of three) | matching |
| Excavation | 1 | brown | $1 | 4 | - | prod any:SC trade:true | aid p1 Age I (one of two) / General (one of four, one of three) | matching |
| Clay Pit | 1 | brown | $1 | 3 | - | prod any:CO trade:true | aid p1 Age I (one of two) / General (one of four, one of three) | matching |
| Timber Yard | 1 | brown | $1 | 3 | - | prod any:SW trade:true | aid p1 Age I (one of two) / General (one of four, one of three) | matching |
| Forest Cave | 1 | brown | $1 | 5 | - | prod any:WO trade:true | aid p1 Age I (one of two) / General (one of four, one of three) | matching |
| Mine | 1 | brown | $1 | 6 | - | prod any:SO trade:true | aid p1 Age I (one of two) / General (one of four, one of three) | matching |
| Loom | 1 | grey | free | 3,6 | - | prod any:L trade:true | aid p1 General | matching |
| Glassworks | 1 | grey | free | 3,6 | - | prod any:G trade:true | aid p1 General | matching |
| Press | 1 | grey | free | 3,6 | - | prod any:P trade:true | aid p1 General | matching |
| Pawnshop | 1 | blue | free | 4,7 | - | vp n:3 | aid p1 General | matching |
| Baths | 1 | blue | S | 3,7 | - | vp n:3 | aid p1 General | matching |
| Altar | 1 | blue | free | 3,5 | - | vp n:2 | aid p1 General | matching |
| Theater | 1 | blue | free | 3,6 | - | vp n:2 | aid p1 General | matching |
| Tavern | 1 | yellow | free | 4,5,7 | - | coins n:5 | aid p1 General | matching |
| East Trading Post | 1 | yellow | free | 3,7 | - | trade side:R kind:raw | aid p1 Age I | matching |
| West Trading Post | 1 | yellow | free | 3,7 | - | trade side:L kind:raw | aid p1 Age I | matching |
| Marketplace | 1 | yellow | free | 3,6 | - | trade side:LR kind:man | aid p1 (manufactured goods, 1 coin) | matching |
| Stockade | 1 | red | W | 3,7 | - | shields n:1 | aid p1 General | matching |
| Barracks | 1 | red | O | 3,5 | - | shields n:1 | aid p1 General | matching |
| Guard Tower | 1 | red | C | 3,4 | - | shields n:1 | aid p1 General | matching |
| Apothecary | 1 | green | L | 3,5 | - | sci s:c | aid p1 General | matching |
| Workshop | 1 | green | G | 3,7 | - | sci s:g | aid p1 General | matching |
| Scriptorium | 1 | green | P | 3,4 | - | sci s:t | aid p1 General | matching |
| Sawmill | 2 | brown | $1 | 3,4 | - | prod any:W trade:true; prod any:W trade:true | aid p1 General | matching |
| Quarry | 2 | brown | $1 | 3,4 | - | prod any:S trade:true; prod any:S trade:true | aid p1 General | matching |
| Brickyard | 2 | brown | $1 | 3,4 | - | prod any:C trade:true; prod any:C trade:true | aid p1 General | matching |
| Foundry | 2 | brown | $1 | 3,4 | - | prod any:O trade:true; prod any:O trade:true | aid p1 General | matching |
| Loom | 2 | grey | free | 3,5 | - | prod any:L trade:true | aid p1 General | matching |
| Glassworks | 2 | grey | free | 3,5 | - | prod any:G trade:true | aid p1 General | matching |
| Press | 2 | grey | free | 3,5 | - | prod any:P trade:true | aid p1 General | matching |
| Aqueduct | 2 | blue | SSS | 3,7 | Baths | vp n:5 | aid p1 General | matching |
| Temple | 2 | blue | WCG | 3,6 | Altar | vp n:3 | aid p1 General | matching |
| Statue | 2 | blue | OOW | 3,7 | Theater | vp n:4 | aid p1 General | matching |
| Courthouse | 2 | blue | CCL | 3,5 | Scriptorium | vp n:4 | aid p1 General | matching |
| Forum | 2 | yellow | CC | 3,6,7 | East Trading Post, West Trading Post | prod any:GLP trade:false | aid p1 General (choice resources can't be bought) | matching |
| Caravansery | 2 | yellow | WW | 3,5,6 | Marketplace | prod any:WSOC trade:false | aid p1 General (choice resources can't be bought) | matching |
| Vineyard | 2 | yellow | free | 3,6 | - | perCoins n:1 who:all colors:[brown] | aid p1 Age II | matching |
| Bazar | 2 | yellow | free | 4,7 | - | perCoins n:2 who:all colors:[grey] | aid p1 Age II | matching |
| Walls | 2 | red | SSS | 3,7 | - | shields n:2 | aid p1 General | matching |
| Training Ground | 2 | red | OOW | 4,6,7 | - | shields n:2 | aid p1 General | matching |
| Stables | 2 | red | COW | 3,5 | Apothecary | shields n:2 | aid p1 General | matching |
| Archery Range | 2 | red | WWO (UNVERIFIED: 7w-5 p6 only prints the chain) | 3,6 | Workshop | shields n:2 | aid p1 General; chain on 7w-5 p6 | matching (cost not printed) |
| Dispensary | 2 | green | OOG | 3,4 | Apothecary | sci s:c | aid p1 General | matching |
| Laboratory | 2 | green | CCP | 3,5 | Workshop | sci s:g | aid p1 General | matching |
| Library | 2 | green | SSL | 3,6 | Scriptorium | sci s:t | aid p1 General | matching |
| School | 2 | green | WP | 3,7 | - | sci s:t | aid p1 General | matching |
| Pantheon | 3 | blue | CCOGPL | 3,6 | Temple | vp n:7 | aid p1 General | matching |
| Gardens | 3 | blue | CCW | 3,4 | Statue | vp n:5 | aid p1 General | matching |
| Town Hall | 3 | blue | SSOG | 3,5,6 | - | vp n:6 | aid p1 General | matching |
| Palace | 3 | blue | WSCOGPL | 3,7 | - | vp n:8 | aid p1 General | matching |
| Senate | 3 | blue | WWSO | 3,5 | Library | vp n:6 | aid p1 General | matching |
| Haven | 3 | yellow | WOL | 3,4 | Forum | perCoins n:1 who:self colors:[brown]; perVP n:1 who:self colors:[brown] | aid p1 (coins + VP per card of a colour) | matching |
| Lighthouse | 3 | yellow | SG | 3,6 | Caravansery | perCoins n:1 who:self colors:[yellow]; perVP n:1 who:self colors:[yellow] | aid p1 (coins + VP per card of a colour) | matching |
| Chamber of Commerce | 3 | yellow | CCP | 4,6 | - | perCoins n:2 who:self colors:[grey]; perVP n:2 who:self colors:[grey] | aid p1 (coins + VP per card of a colour) | matching |
| Arena | 3 | yellow | SSO | 3,5,7 | Dispensary | perCoins n:3 who:self stages:true; perVP n:1 who:self stages:true | aid p1 Age III | matching |
| Fortifications | 3 | red | OOOS | 3,7 | Walls | shields n:3 | aid p1 General | matching |
| Circus | 3 | red | SSSO | 4,5,6 | Training Ground | shields n:3 | aid p1 General | matching |
| Arsenal | 3 | red | WWOL | 3,4,7 | - | shields n:3 | aid p1 General | matching |
| Siege Workshop | 3 | red | CCCW | 3,5 | Laboratory | shields n:3 | aid p1 General | matching |
| Lodge | 3 | green | CCLP | 3,6 | Dispensary | sci s:c | aid p1 General | matching |
| Observatory | 3 | green | OOGL | 3,7 | Laboratory | sci s:g | aid p1 General | matching |
| University | 3 | green | WWGP | 3,4 | Library | sci s:t | aid p1 General | matching |
| Academy | 3 | green | SSSG | 3,7 | School | sci s:c | aid p1 General | matching |
| Study | 3 | green | WPL | 3,5 | School | sci s:g | aid p1 General | matching |
| Workers Guild | 3 | purple | OOCSW | players+2 guilds | - | perVP n:1 who:nbr colors:[brown] | aid p1 Guilds | matching |
| Craftsmens Guild | 3 | purple | OOSS | players+2 guilds | - | perVP n:2 who:nbr colors:[grey] | aid p1 Guilds | matching |
| Traders Guild | 3 | purple | LPG | players+2 guilds | - | perVP n:1 who:nbr colors:[yellow] | aid p1 Guilds | matching |
| Philosophers Guild | 3 | purple | CCCLP | players+2 guilds | - | perVP n:1 who:nbr colors:[green] | aid p1 Guilds | matching |
| Spies Guild | 3 | purple | SSSG | players+2 guilds | - | perVP n:1 who:nbr colors:[red] | aid p1 Guilds; cost 7w-5 p10 | **fixed**: cost was 3 clay + glass |
| Strategists Guild | 3 | purple | OOSL | players+2 guilds | - | perVP n:1 who:nbr defeats:true | aid p1 Guilds | matching |
| Shipowners Guild | 3 | purple | WWWGP | players+2 guilds | - | perVP n:1 who:self colors:[brown grey purple] | aid p1 Guilds | matching |
| Scientists Guild | 3 | purple | WWOOP | players+2 guilds | - | sci s:* | aid p1 General (symbol chosen at the end) | matching |
| Magistrates Guild | 3 | purple | WWWSL | players+2 guilds | - | perVP n:1 who:nbr colors:[blue] | aid p1 Guilds | matching |
| Builders Guild | 3 | purple | SSCCG | players+2 guilds | - | perVP n:1 who:all stages:true | aid p1 Guilds | matching |
| Courtesans Guild (leaders) | 3 | purple | SCGL | players+2 guilds | - | courtesan | aid p1 Guilds; cost 7w-5 p8 | **fixed**: cost was 2 clay + loom + glass |
| Diplomats Guild (leaders) | 3 | purple | SWGP | players+2 guilds | - | perLeaderNbrVP n:1 | aid p1 Guilds; cost 7w-5 p9 | **fixed (2026-11-18)**: cost was stone + wood + glass + loom |
| Gamers Guild (leaders) | 3 | purple | SCWO | players+2 guilds | - | leaderVP what:coins3 | aid p1 Guilds/General (1 VP per 3 coins); cost 7w-5 p9 | **fixed (2026-11-18)**: cost was stone + clay + ore + glass |
| Architects Guild (leaders) | 3 | purple | OOOCPL | players+2 guilds | - | nbrGuildsVP n:3 | aid p1 Guilds | matching |
| Counterfeiters Guild (cities) | 3 | purple | OOOLG | players+2 guilds | - | vp n:5; loss n:3 | aid p1; cost 7w-5 p8 | **fixed**: cost was 2 ore + glass + papyrus |
| Guild of Shadows (cities) | 3 | purple | SSWP | players+2 guilds | - | perVP n:1 who:nbr colors:[black] | aid p1 Guilds; cost 7w-5 p9 | **fixed**: cost was 2 wood + clay + loom |
| Mourners Guild (cities) | 3 | purple | SSCG (UNVERIFIED: 7w-5 p9 leaves the cost cell empty) | players+2 guilds | - | nbrVictoryVP n:1 | aid p1 Guilds | matching (cost not printed) |
| Pigeon Loft (cities) | 1 | black | $1O | 1 per player (Cities) | - | mask | aid p1; cost 7w-5 p5 | **fixed**: cost was ore only |
| Militia (cities) | 1 | black | $3 | 1 per player (Cities) | - | shields n:2 | aid p1; cost 7w-5 p5 | **fixed**: cost was 1 coin + wood |
| Hideout (cities) | 1 | black | free | 1 per player (Cities) | - | vp n:1; loss n:1 | aid p1; 7w-5 p4 | **fixed**: cost was 1 coin + stone, and VP was 2 |
| Residence (cities) | 1 | black | C | 1 per player (Cities) | - | vp n:1; diplomacy | aid p1 General | matching |
| Gambling Den (cities) | 1 | black | free | 1 per player (Cities) | - | coins n:6; nbrCoins n:1 | aid p1 General; aid p1 General (take 6, neighbours 1) | matching |
| Secret Warehouse (cities) | 1 | black | $2 | 1 per player (Cities) | - | warehouse | aid p1; 7w-5 p5 | matching (Age I only; the extra Age II copy was removed) |
| Gates of the City (cities) | 1 | black | $1W | 1 per player (Cities) | - | vp n:4 | 7w-5 p4; parts (Age I) | **added** (this slot had been an Age I Black Market, which the parts list does not include) |
| Clandestine Dock West (cities) | 1 | black | $1 | 1 per player (Cities) | - | dock side:L | aid p1 (Cities) | matching |
| Clandestine Dock East (cities) | 1 | black | $1 | 1 per player (Cities) | - | dock side:R | aid p1 (Cities) | matching |
| Spy Ring (cities) | 2 | black | $2SC | 1 per player (Cities) | - | mask | aid p1; cost 7w-5 p7 | **fixed**: cost was stone + clay |
| Mercenaries (cities) | 2 | black | $4P | 1 per player (Cities) | - | shields n:3 | aid p1; cost 7w-5 p7 | **fixed**: cost was 2 coins + clay + wood |
| Lair (cities) | 2 | black | WG | 1 per player (Cities) | - | vp n:3; loss n:2 | aid p1; cost 7w-5 p6 | **fixed**: cost was 2 coins + stone + loom |
| Consulate (cities) | 2 | black | CP | 1 per player (Cities) | - | vp n:2; diplomacy | aid p1; cost 7w-5 p6 | **fixed**: cost was stone + papyrus |
| Gambling House (cities) | 2 | black | $1 | 1 per player (Cities) | - | coins n:9; nbrCoins n:2 | aid p1 General; aid p1 General (take 6, neighbours 1) | matching |
| Sepulcher (cities) | 2 | black | SGL | 1 per player (Cities) | - | vp n:4; lossPer n:1 what:victories | aid p1; cost 7w-5 p7 | **fixed**: cost was 2 clay + glass |
| Architect Cabinet (cities) | 2 | black | $1P | 1 per player (Cities) | - | vp n:2; noWonderRes | aid p1; cost 7w-5 p6 | **fixed**: cost was 1 coin + wood + loom |
| Black Market (cities) | 2 | black | OL | 1 per player (Cities) | - | blackMarket | aid p1; cost 7w-5 p6; parts (Age II only) | **fixed**: cost was 2 coins; the extra Age I copy was removed |
| Tabularium (cities) | 2 | black | $2OWL | 1 per player (Cities) | - | vp n:6 | 7w-5 p7; parts (Age II) | **added** |
| Torture Chamber (cities) | 3 | black | $3OOG | 1 per player (Cities) | - | mask | aid p1; cost 7w-5 p10 | **fixed**: cost was 2 ore + glass |
| Contingent (cities) | 3 | black | $5L | 1 per player (Cities) | - | shields n:5 | aid p1; cost 7w-5 p8 | **fixed**: cost was 3 coins + 2 ore + wood |
| Brotherhood (cities) | 3 | black | WWWOL | 1 per player (Cities) | - | vp n:4; loss n:3 | aid p1; cost 7w-5 p8 | **fixed**: cost was 3 coins + 2 stone + loom |
| Embassy (cities) | 3 | black | SLP | 1 per player (Cities) | - | vp n:3; diplomacy | aid p1; cost 7w-5 p9 | **fixed**: cost was stone + wood + papyrus |
| Cenotaph (cities) | 3 | black | CCSLG | 1 per player (Cities) | - | vp n:5; lossPer n:1 what:victories | aid p1; cost 7w-5 p8 | **fixed**: cost was 2 stone + ore + glass |
| Builders Union (cities) | 3 | black | CWPG | 1 per player (Cities) | - | vp n:4; lossPer n:1 what:stages | aid p1; cost 7w-5 p8 | **fixed**: cost was 2 clay + wood + loom |
| Capitol (cities) | 3 | black | $2CCSSGP | 1 per player (Cities) | - | vp n:8 | 7w-5 p8 ("Capital"); parts name Capitol | **added** (this slot had been a second Gambling House, which the parts list puts only in Age II) |
| Slave Market (cities) | 3 | black | OOWW | 1 per player (Cities) | - | perCoins n:1 who:self victories:true; perVP n:1 who:self victories:true | aid p1 Age III; cost 7w-5 p10; name parts | **fixed**: cost was 1 coin + wood + ore; the name is now confirmed |
| Secret Society (cities) | 3 | black | SP | 1 per player (Cities) | - | perCoins n:1 who:self colors:[black]; perVP n:1 who:self colors:[black] | aid p1; cost 7w-5 p10; name parts | **fixed**: cost was 1 coin + stone + clay; the name is now confirmed |

Notes:

- **fixed (this pass):** Cities names and ages now match the parts list; costs come from 7w-5. Gates of the City, Tabularium and Capitol were added. The misplaced Age I Black Market, Age II Secret Warehouse and Age III Gambling House were removed.
- Base-game costs and chains in the table above that 7w-5 prints (almost every row except Archery Range's resource cost) are now confirmed.
- **Shipowners:** the clarification on aid p1 Guilds (the guild counts itself) matches.
- **Builders guild:** stages in your own city count too, which matches aid p1.

## Wonders

Starting resources and effects are confirmed from 7w-5 and (for the Wonder Pack) the photos. Stage costs are still **not covered** unless a note says a photo or table shows them.

| Wonder | Side | Board | Stage | Cost | Effect | Effect source | Status |
|---|---|---|---|---|---|---|---|
| Rhodes | A | O | 1 | WW | vp n:3 | aid p1 General | matching |
| Rhodes | A |  | 2 | CCC | shields n:2 | aid p1 General | matching |
| Rhodes | A |  | 3 | OOOO | vp n:7 | aid p1 General | matching |
| Rhodes | B | O | 1 | SSS | shields n:1; vp n:3; coins n:3 | aid p1 General | matching |
| Rhodes | B |  | 2 | OOOO | shields n:1; vp n:4; coins n:4 | aid p1 General | matching |
| Alexandria | A | G | 1 | SS | vp n:3 | aid p1 General | matching |
| Alexandria | A |  | 2 | OO | prod any:WSCO trade:false | aid p1 General (choice resources can't be bought) | matching |
| Alexandria | A |  | 3 | GG | vp n:7 | aid p1 General | matching |
| Alexandria | B | G | 1 | CC | prod any:WSCO trade:false | aid p1 General (choice resources can't be bought) | matching |
| Alexandria | B |  | 2 | WW | prod any:GLP trade:false | aid p1 General (choice resources can't be bought) | matching |
| Alexandria | B |  | 3 | SSS | vp n:7 | aid p1 General | matching |
| Ephesus | A | P | 1 | SS | vp n:3 | aid p1 General | matching |
| Ephesus | A |  | 2 | WW | coins n:9 | aid p1 General | matching |
| Ephesus | A |  | 3 | PP | vp n:7 | aid p1 General | matching |
| Ephesus | B | P | 1 | SS | vp n:2; coins n:4 | aid p1 General | matching |
| Ephesus | B |  | 2 | WW | vp n:3; coins n:4 | aid p1 General | matching |
| Ephesus | B |  | 3 | PLG | vp n:5; coins n:4 | aid p1 General | matching |
| Babylon | A | C | 1 | CC | vp n:3 | aid p1 General | matching |
| Babylon | A |  | 2 | WWW | sci s:* | aid p1 General (symbol chosen at the end) | matching |
| Babylon | A |  | 3 | CCCC | vp n:7 | aid p1 General | matching |
| Babylon | B | C | 1 | CL | vp n:3 | aid p1 General | matching |
| Babylon | B |  | 2 | WWG | lastCard | aid p2 Wonders | matching |
| Babylon | B |  | 3 | CCCP | sci s:* | aid p1 General (symbol chosen at the end) | matching |
| Olympia | A | W | 1 | WW | vp n:3 | aid p1 General | matching |
| Olympia | A |  | 2 | SS | freeBuild | aid p2 Wonders | matching |
| Olympia | A |  | 3 | OO | vp n:7 | aid p1 General | matching |
| Olympia | B | W (7w-5 p4 says Ore; kept as Wood, the same face as side A of one board) | 1 | WW | trade side:LR kind:raw | aid p2 Wonders (both sides, 1 coin) | matching |
| Olympia | B |  | 2 | SS | vp n:5 | aid p1 General | matching |
| Olympia | B |  | 3 | LO | copyGuild | aid p2 Wonders | matching |
| Halicarnassus | A | L | 1 | CC | vp n:3 | aid p1 General | matching |
| Halicarnassus | A |  | 2 | OOO | discardBuild | aid p1 General | matching |
| Halicarnassus | A |  | 3 | LL | vp n:7 | aid p1 General | matching |
| Halicarnassus | B | L | 1 | OO | vp n:2; discardBuild | aid p1 General | matching |
| Halicarnassus | B |  | 2 | CCC | vp n:1; discardBuild | aid p1 General | matching |
| Halicarnassus | B |  | 3 | GPL | discardBuild | aid p1 General | matching |
| Giza | A | S | 1 | SS | vp n:3 | aid p1 General | matching |
| Giza | A |  | 2 | WWW | vp n:5 | aid p1 General | matching |
| Giza | A |  | 3 | SSSS | vp n:7 | aid p1 General | matching |
| Giza | B | S | 1 | WW | vp n:3 | aid p1 General | matching |
| Giza | B |  | 2 | SSS | vp n:5 | aid p1 General | matching |
| Giza | B |  | 3 | CCC | vp n:5 | aid p1 General | matching |
| Giza | B |  | 4 | SSSSP | vp n:7 | aid p1 General | matching |
| Roma (leaders) | A | none; leaderCost self:99 nbr:0 (free recruiting, 7w-5 p3) | 1 | WWO | vp n:4 | aid p1 General; board effect 7w-5 p3 | matching (side A free recruiting now confirmed; stage costs still unverified) |
| Roma (leaders) | A |  | 2 | SSSO | vp n:6 | aid p1 General | matching |
| Roma (leaders) | B | none; leaderCost self:2 nbr:1 | 1 | WO | coins n:5; drawLeaders n:4 | aid p1 General; aid p2 Wonders | matching |
| Roma (leaders) | B |  | 2 | SSC | vp n:3; extraLeader | aid p1 General; aid p2 Wonders | matching |
| Roma (leaders) | B |  | 3 | GPLW | vp n:3; extraLeader | aid p1 General; aid p2 Wonders | matching |
| Petra (cities) | A | C | 1 | SW | vp n:3 | aid p1 General | matching |
| Petra (cities) | A |  | 2 | $7 | vp n:7 | aid p1 General | matching |
| Petra (cities) | A |  | 3 | SSWW | vp n:7 | aid p1 General | matching |
| Petra (cities) | B | C | 1 | WO | vp n:3; loss n:2 | aid p1 General; aid p1 General (others pay N) | matching |
| Petra (cities) | B |  | 2 | $14 | vp n:14 | aid p1 General | matching |
| Byzantium (cities) | A | S | 1 | WW | vp n:3 | aid p1 General | matching |
| Byzantium (cities) | A |  | 2 | SSS | vp n:2; diplomacy | aid p1 General | matching |
| Byzantium (cities) | A |  | 3 | WWWG | vp n:7 | aid p1 General | matching |
| Byzantium (cities) | B | S (7w-5 p6 says Papyrus; kept as Stone, the same face as side A of one board) | 1 | CLP | vp n:3; diplomacy | aid p1 General | matching |
| Byzantium (cities) | B |  | 2 | WWG | vp n:4; diplomacy | aid p1 General | matching |
| Great Wall (wonderPack) | A | L (photos, 7w-5 p2); stages in any order (7w-5 p2, photos) | 1 | WW | coins n:8 | photos; 7w-5 p2 | **fixed (2026-11-18)**: starting resource was clay; cost was 2 stone + ore |
| Great Wall (wonderPack) | A |  | 2 | CGP | sci s:* | photos; 7w-5 p2 | matching |
| Great Wall (wonderPack) | A |  | 3 | SSS | wallShields n:2 | photos; 7w-5 p2 | matching |
| Great Wall (wonderPack) | A |  | 4 | OOO | discardBuild | photos; 7w-5 p2 | **fixed (2026-11-18)**: cost was glass + loom + papyrus |
| Great Wall (wonderPack) | B | L (photos, 7w-5 p2); stages in any order | 1 | WP | coins n:8; nbrCoins n:2 | photos; 7w-5 p2 | **fixed (2026-11-18)**: cost was 2 stone + ore |
| Great Wall (wonderPack) | B |  | 2 | CCO | mask | photos; 7w-5 p2 | **fixed (2026-11-18)**: cost was 2 clay + wood |
| Great Wall (wonderPack) | B |  | 3 | WWP | wallSkip (and others pay 2, already in the hook) | photos; 7w-5 p2 | **fixed (2026-11-18)**: cost was 2 ore + stone |
| Great Wall (wonderPack) | B |  | 4 | SS | blackMarket | photos; 7w-5 p2 | **fixed (2026-11-18)**: cost was glass + loom + papyrus |
| Stonehenge (wonderPack) | A | W (photos, 7w-5 p2) | 1 | CO | vp n:3 | photos | **fixed (2026-11-18)**: starting resource was stone; cost was stone + clay |
| Stonehenge (wonderPack) | A |  | 2 | CCP | vp n:5 | photos | **fixed (2026-11-18)**: cost was 3 clay |
| Stonehenge (wonderPack) | A |  | 3 | WWWL | stoneVP n:2 | aid p2; photos | **fixed (2026-11-18)**: cost was 4 stone |
| Stonehenge (wonderPack) | B | W | 1 | OOO | stoneCoins n:1; stoneVP n:1 | aid p2; photos | **fixed (2026-11-18)**: cost was 3 stone |
| Stonehenge (wonderPack) | B |  | 2 | CCCP | revealColor | aid p2; photos | **fixed (2026-11-18)**: cost was 4 clay |
| Abu Simbel (wonderPack) | A | P (photos, 7w-5 p8) | 1 | SC | vp n:3 | aid p1 General; photos | **fixed (2026-11-18)**: cost was 2 stone |
| Abu Simbel (wonderPack) | A |  | 2 | WO | vp n:5 | aid p1 General; photos | **fixed (2026-11-18)**: cost was 2 papyrus + loom |
| Abu Simbel (wonderPack) | A |  | 3 | SSGL | entomb | aid p2 Wonder Pack; photos | **fixed (2026-11-18)**: cost was 4 stone |
| Abu Simbel (wonderPack) | B | P | 1 | CCL | entomb | aid p2 Wonder Pack; photos | **fixed (2026-11-18)**: cost was 3 stone + loom |
| Abu Simbel (wonderPack) | B |  | 2 | WWG | entomb | aid p2 Wonder Pack; photos | **fixed (2026-11-18)**: cost was 4 papyrus + glass |
| Manneken Pis (wonderPack) | A | none; +4 coins | 1 | ? (the copied stage's cost) | copyStage side:L stage:0 | aid p2 Wonder Pack; photos | **fixed (2026-11-18)**: cost was 2 wood; the photo prints "?" |
| Manneken Pis (wonderPack) | A |  | 2 | ? (the copied stage's cost) | copyStage side:R stage:1 | aid p2 Wonder Pack; photos | **fixed (2026-11-18)**: cost was 3 stone |
| Manneken Pis (wonderPack) | A |  | 3 | ? (the copied stage's cost) | copyStage side:L stage:-1 (the left board's last stage) | aid p2 Wonder Pack ("last stage"); photos | **fixed (2026-11-18)**: cost was 4 ore; it copied stage 3, which a 2- or 4-stage board misreads |
| Manneken Pis (wonderPack) | B | none; +4 coins | 1 | WSCOGLP | coins n:7; shields n:1; vp n:7 | aid p1 General; photos | **fixed (2026-11-18)**: cost was 2 each of wood, stone, clay, ore |

Notes:

- The Great Wall's effects are covered by 7w-5 and the photos. Since 2026-11-18 every Wonder Pack starting
  resource and stage cost is from the photos (see "Checked against the owner's reference sheets").
- Rome side A free recruiting is confirmed by 7w-5 p3. The aid's −2 / −1 discount is side B. Stage costs are still unverified.
- 7w-5 p4 lists Olympia B as Ore and p6 lists Byzantium B as Papyrus. Both would disagree with the other face of the same board; those starting resources were left as Wood and Stone.
- Abu Simbel and Manneken Pis stage costs are now read from the photos (2026-11-18); their effects and starting resources/coins match the photos and aid p2.

## Leaders

Coin costs are from 7w-2, 7w-3 and 7w-5. Where 7w-5 disagrees with the dedicated lists, the lists win (Nero is 1, not 3).

| Leader | Set | Cost | Effect | Effect source | Status |
|---|---|---|---|---|---|
| Alexander | leaders | 3 | leaderVP what:victoryTokens | aid p2 Leaders | matching |
| Amytis | leaders | 4 | perVP n:2 who:self stages:true | aid p2 Leaders | matching |
| Archimedes | leaders | 4 | discount color:green | aid p1/p2 Leaders, Cities | matching |
| Aristotle | leaders | 3 | leaderVP what:sciSets | aid p2 Leaders | matching |
| Bilkis | leaders | 4 | bilkis | aid p1/p2; cost 7w-2, 7w-3, 7w-5 | **fixed**: cost was 1 |
| Caesar | leaders | 5 | shields n:2 | aid p1 General | matching |
| Cleopatra | leaders | 4 | vp n:5 | aid p1 General | matching |
| Croesus | leaders | 1 | coins n:6 | aid p1 General | matching |
| Euclid | leaders | 5 | sci s:c | aid p1 General | matching |
| Hammurabi | leaders | 2 | discount color:blue | aid p1/p2 Leaders, Cities | matching |
| Hannibal | leaders | 2 | shields n:1 | aid p1 General | matching |
| Hatshepsut | leaders | 2 | hatshepsut | aid p1/p2 Leaders, Cities | matching |
| Hiram | leaders | 3 | perVP n:2 who:self colors:[purple] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Hypatia | leaders | 4 | perVP n:1 who:self colors:[green] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Imhotep | leaders | 3 | discount color:wonder | aid p1/p2 Leaders, Cities | matching |
| Justinian | leaders | 3 | leaderVP what:justinian | aid p2 Leaders | matching |
| Leonidas | leaders | 2 | discount color:red | aid p1/p2 Leaders, Cities | matching |
| Maecenas | leaders | 1 | freeLeaders | aid p1/p2 Leaders, Cities | matching |
| Midas | leaders | 3 | leaderVP what:coins3 | aid p1 General (1 VP per 3 coins) | matching |
| Nebuchadnezzar | leaders | 4 | perVP n:1 who:self colors:[blue] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Nefertiti | leaders | 3 | vp n:4 | aid p1 General | matching |
| Nero | leaders | 1 | nero | aid p1/p2 Leaders, Cities | matching |
| Pericles | leaders | 6 | perVP n:2 who:self colors:[red] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Phidias | leaders | 3 | perVP n:1 who:self colors:[brown] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Plato | leaders | 4 | leaderVP what:plato | aid p2 Leaders | matching |
| Praxiteles | leaders | 3 | perVP n:2 who:self colors:[grey] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Ptolemy | leaders | 5 | sci s:t | aid p1 General | matching |
| Pythagoras | leaders | 5 | sci s:g | aid p1 General | matching |
| Ramses | leaders | 5 | freeGuilds | aid p1/p2 Leaders, Cities | matching |
| Sappho | leaders | 1 | vp n:2 | aid p1 General | matching |
| Solomon | leaders | 3 | discardBuild | aid p1 General | matching |
| Tomyris | leaders | 4 | tomyris | aid p1/p2; cost 7w-2, 7w-3, 7w-5 | **fixed**: cost was 3 |
| Varro | leaders | 3 | perVP n:1 who:self colors:[yellow] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Vitruvius | leaders | 1 | vitruvius | aid p1/p2 Leaders, Cities | matching |
| Xenophon | leaders | 2 | xenophon | aid p1/p2 Leaders, Cities | matching |
| Zenobia | leaders | 2 | vp n:3 | aid p1 General | matching |
| Berenice | cities | 2 | berenice | aid p1/p2; cost 7w-3, 7w-5 | **fixed**: cost was 3 |
| Darius | cities | 4 | perVP n:1 who:self colors:[black] | aid p2 Leaders (1/2 VP per card of a colour) | matching |
| Aspasia | cities | 3 | vp n:2; diplomacy | aid p1; cost 7w-3, 7w-5 | **fixed**: cost was 2 |
| Caligula | cities | 3 | caligula | aid p1/p2; cost 7w-3, 7w-5 | **fixed**: cost was 5 |
| Semiramis | cities | 2 | semiramis | aid p1/p2; cost 7w-3, 7w-5 | **fixed**: cost was 3 |
| Diocletian | cities | 2 | diocletian | aid p1/p2; cost 7w-3, 7w-5 | **fixed**: cost was 3 |
| Louis | promo | 4 | leaderVP what:louis | aid p2 Leaders | added |
| Stevie | promo | 0 | stevie | aid p1/p2 Leaders, Cities | added |
| Esteban | promo | 5 | esteban | aid p2; cost 7w-3 | **fixed**: cost was 3 |

Each effect was checked against its aid entry:

- Amytis, Alexander, Aristotle, Justinian, Plato (7 VP per set of all 7 colours), Bilkis, Ramses, Tomyris and Hatshepsut (at most 1 coin per neighbour per turn).
- Midas (1 VP per 3 coins, on top of the coin points) and Maecenas (recruiting is free).
- Xenophon and Diocletian (+2 coins per yellow / black card), Nero (+2 coins per victory token) and Vitruvius (+2 coins per free chain build).
- Archimedes, Leonidas, Hammurabi and Imhotep: one resource less (Imhotep on wonder stages).
- The per-colour VP leaders.
- The Cities leaders: +1 coin on bank takes once a turn, one free black card per age, defeat tokens as shields.

Also confirmed (costs unchanged, now sourced from 7w-2 / 7w-3 / 7w-5): Alexander 3, Amytis 4, Archimedes 4, Aristotle 3, Caesar 5, Cleopatra 4, Croesus 1, Euclid 5, Hammurabi 2 (7w-2 says 3; 7w-3, 7w-4 and 7w-5 say 2), Hannibal 2, Hatshepsut 2, Hiram 3, Hypatia 4, Imhotep 3, Justinian 3, Leonidas 2, Maecenas 1, Midas 3, Nebuchadnezzar 4, Nefertiti 3 (7w-4 says 4; 7w-2, 7w-3 and 7w-5 say 3), Nero 1, Pericles 6, Phidias 3, Plato 4, Praxiteles 3, Ptolemy 5, Pythagoras 5, Ramses 5, Sappho 1, Solomon 3, Varro 3, Vitruvius 1, Xenophon 2, Zenobia 2, Darius 4, Louis 4. Stevie's printed cost is X: he is recruited for 0 and paid as 1 coin per resource when used (7w-3, aid p2).

7w-1 also lists later promo leaders (Aganice, Agrippina, Arsinoe, Cornelia, Cynisca, Enheduanna, Eurypyle, Gorgo, Makeda, Nitocris, Octavia, Phryne, Roxana, Telesilla, Theano, Wil, and the Babel-only Nimrod). They are not in the Leaders add-on's `promos` pool, which stays the three Leaders goodies named on aid p2 (Louis, Stevie, Esteban). Several of those extra promos need new effect kinds (a cost equal to the current age, and so on).

## Still unverified or blocked

- ~~Player-count copy lists for every base card~~: resolved for the 2nd edition in 2.2.0 (every count matches).
- ~~Archery Range's resource cost~~: resolved in 2.2.0 (2 wood + ore, as coded). It is a base card in both
  editions, not an expansion card.
- Mourners Guild's resource cost (7w-5 p9 leaves the cell empty): still open; no source found in 2.2.0.
- Wonder stage costs for Rome, Petra and Byzantium (7w-5 lists effects, not costs). ~~The base boards~~: resolved
  in 2.2.0, except Babylon B (see "2nd-edition sources (2.2.0)").
- ~~Some Wonder Pack stage costs~~: resolved from the photos on 2026-11-18.
- 2-player expert variant: still blocked (concise only says "see rules"; seat minimum is 3).
- Catan goodie board: still blocked (no stage costs).
- Extra 7w-1 promo leaders listed above: not implemented.
- **Owner to confirm against the physical cards** (PR #118 review), both overtaken by the 2nd edition.
  **Resolved in 2.2.0** for the 2nd edition (Spies Guild 2 clay + glass; Olympia B stage 3 glass + papyrus + loom),
  see "2nd-edition sources (2.2.0)":
  - Spies Guild's cost: 1.0.0 coded `SSSG` (3 stone + 1 glass); the review read it as 3 clay + 1 glass. The 2e
    article also says the 1st edition's cost had clay ("reduced by 1 clay"). 2.0.0 codes `CCG`: see
    "2nd edition: owner to confirm" below.
  - Olympia B stage 3's cost: 1.0.0 coded `LO`; the review read it as 2 ore + 1 loom, which the 2e article
    confirms for the 1st edition ("a loom and 2 ore"). Moot in 2.0.0: the stage now costs glass, papyrus, loom.

## 1.0.0: what the port changed

The rules above are unchanged; the code references in the tables (`addons/*.ts`, `flow.ts`, the option names)
are 0.1.0's. In 1.0.0 the expansions are add-on packs and the base runs on the phase runner. What a player can
see differently:

- **Choosing the expansions.** Leaders, Cities and the Wonder Pack are add-ons chosen per room, no longer
  options of the base. `leaderPromos` is the Leaders add-on's `promos` option. `teamPlay` stays a base option
  (Q68 is still (d)) and no longer needs Cities. Starting coins are a base option (`startCoins`, 3) that the
  Leaders add-on presets to 6 (0.1.0 added 3 coins in its setup).
- **When questions are asked.** Questions an add-on's effect raises (debt, the Courtesans' Guild, Roma's extra
  leader, Abu Simbel's entomb) are asked from the add-on's own phases before the end of the turn, after the
  base's own discard-pile builds; as in 0.1.0, before the hands pass. A question raised while the end of a turn
  runs (a card built from the discard pile whose effect asks) waits for the next end of turn or the war.
- **Esteban** is a hidden yes/no pick before each turn while he can be used (once a game, 3 or more cards in
  hand), no longer an extra option on his owner's card prompt; the effect is the same.
- **Leaders used for a stage or discarded** stay out of the game, face down. In 0.1.0 they went back to the box
  Roma B draws from.
- **The Courtesans' Guild** puts a copy of the leader into play as the seat's extra ("<name> (copy)"): its
  lasting and scoring effects, never its one-off coins, discard-pile build or diplomacy token, as before.
  Abu Simbel can't entomb a copy.
- **Effects read by the base.** Caligula and Ramses are the base's free-colour effect (black once an age, purple
  always); Bilkis is the base's bank purchase; Aristotle is the base's science-set bonus; the Great Wall B's
  neighbour coins and the Cities cards' are the base's `nbrCoins`.
- **The decks.** Guilds are chosen with `sample` (11 §3) and the Cities black cards are drawn by the Cities
  add-on, so the same seed deals different cards than 0.1.0: old games replay only on 0.1.0 (A87,
  `test/fixtures.test.ts`).

## PR #118 review fixes (2026-11-17)

- **The phantom turn 7.** In an age without the Cities cards nobody holds two cards at turn 7, so the empty pick
  phase resolved anyway, set the turn to 7 and fired every add-on's end of turn once more, for a turn nobody
  played (no coins changed, since the purchases and gains were cleared first). An empty turn now plays nothing;
  with Cities' eighth card turn 7 is played as before.
- **Leaders: recruitment comes before the deal.** At the start of each age the leader is chosen before the age's
  cards are dealt, so a seat no longer sees its new hand when it chooses. The leader left over before Age III
  still goes out of the game.
- **Hatshepsut in a recruitment.** Building a wonder stage with a leader and buying from a neighbour now pays
  Hatshepsut's coin at once (before, the deal and the first turn cleared the purchase before any end of turn
  counted it).
- Spies Guild and Olympia B stage 3: listed under "Still unverified or blocked" for the owner to confirm.

## 2nd edition (2.0.0)

Xavier owns the 2nd edition and asked for it (2026-11-17). 2.0.0 implements it in the base, with no option for
the 1st edition. Source: the 2e article; it lists the changes, not every printed value. Where it gives no number,
the 1st-edition value is kept (or, for a new card, the value of the 1st-edition card whose copies it took) and
the item is listed under "2nd edition: owner to confirm against the cards". Why a major version: card ids
changed (`Pawnshop@1`, `Strategists Guild@3` are gone), the effect kinds in `points.d.ts` changed (11 §10: a
changed signature is a new major), and the same seed deals and plays differently, so a 1.0.0 game replays only
on 1.0.0.

### Rules and components

| Item | 1st ed (1.0.0) | 2nd ed (2.0.0) | Source |
|---|---|---|---|
| Turn, trading, military, end scoring | as in Rules above | unchanged: the article says the flow and rules of play were left intact | 2e article, overview |
| Players | 3 to 7 (2-player variant not built) | 3 to 7; the 2nd edition dropped the 2-player variant and its cards, so nothing to build | Box and Component Updates |
| Defeat tokens, value-1 coins | unlimited in the engine | 2 more defeat tokens and 8 more 1-coins in the box: no effect, the engine's supply is unlimited | Box and Component Updates |
| Wonder cards (random boards) | boards drawn by the engine (`sample`) | the cards were removed; boards are still drawn by the engine, sides by the options | Box and Component Updates |
| Chain marks | names | symbols on the cards: display only, the chains are by card (below) | Building Chains |

### Cards

| Card | 1st ed (1.0.0) | 2nd ed (2.0.0) | Source |
|---|---|---|---|
| Pawnshop (I) | blue, free, 3 VP, 4+ and 7+ | removed; replaced by the **Well** | 1st Age |
| Well (I) | none | blue, free, 3 VP, 4+ and 7+ (the Pawnshop's values: the article calls it a renaming), chains to the Statue | 1st Age |
| Altar (I) | 2 VP; chained to the Temple | 3 VP; chains to the Pantheon | 1st Age |
| Theater (I) | 2 VP; chained to the Statue | 3 VP; chains to the Gardens | 1st Age |
| Temple (II) | 3 VP; from the Altar, to the Pantheon | 4 VP; no chain | 2nd Age |
| Statue (II) | from the Theater, to the Gardens | from the Well; to nothing | 2nd Age |
| Pantheon (III) | from the Temple | from the Altar | 3rd Age |
| Gardens (III) | from the Statue | from the Theater | 3rd Age |
| Town Hall (III) | 3+, 5+, 6+ | 3+, 6+ (the 5+ copy became a Ludus) | 3rd Age |
| Arena (III) | 3+, 5+, 7+ | 3+, 5+ (the 7+ copy became a Ludus) | 3rd Age |
| Ludus (III) | none | yellow, 5+ and 7+; 3 coins per red card in your city when built, and (2.2.0) 1 VP per red card at the end; cost (2.2.0) `SO` (was `SSO`) | 3rd Age; 2.2.0: card list, photo, databases |
| Arsenal (III) | 3+, 4+, 7+ | 3+, 5+ | 3rd Age, military list |
| Fortifications (III) | 3 ore + 1 stone (`OOOS`) | 3 ore + 1 clay (`OOOC`) | 3rd Age, military list |
| Circus (III) | 4+, 5+, 6+ | 4+, 6+ (the 5+ copy removed) | 3rd Age, military list |
| Castrum (III) | none | red, 4+ and 7+; 3 shields; cost (2.2.0) `WCCP` (was `WWOL`) | 3rd Age, military list; 2.2.0: card list, photo, databases |
| Siege Workshop (III) | 3+, 5+ | unchanged (the fifth military card; "80%" of them changed) | 3rd Age, military list |
| Strategists Guild | 1 VP per neighbours' defeat token | removed; replaced by the **Decorators Guild** | 3rd Age |
| Decorators Guild | none | purple; 7 VP if every stage of your wonder is built; cost `OOSL` (both confirmed in 2.2.0) | 3rd Age; 2.2.0: card list, photo, databases |
| Builders Guild | `SSCCG` | `SSSCCG` (+1 stone) | 3rd Age |
| Spies Guild | `SSSG` as coded (see above) | `CCG` (confirmed in 2.2.0) | 3rd Age; 2.2.0: photo, databases |

Each age still deals 7 cards a seat at 3 to 7 seats: the copies replaced balance (`test/second-edition.test.ts`).

### Wonders

Stage effects are unchanged unless the row says so. Boards' starting resources are the same on both sides.

| Wonder | 1st ed (1.0.0) | 2nd ed (2.0.0) | Source |
|---|---|---|---|
| Alexandria A stage 3 | 2 glass | papyrus + loom | The Lighthouse of Alexandria |
| Alexandria B stage 2 | 2 wood | 3 ore | The Lighthouse of Alexandria |
| Alexandria B stage 3 | 3 stone | 4 wood | The Lighthouse of Alexandria |
| Babylon board | clay | wood | The Hanging Gardens of Babylon |
| Babylon A stage 2 | 3 wood | 2 ore + loom | The Hanging Gardens of Babylon |
| Babylon A stage 3 | 4 clay | 4 wood | The Hanging Gardens of Babylon |
| Babylon B | 3 stages: clay + loom (3 VP); 2 wood + glass (last card); 3 clay + papyrus (science) | 2 stages: 2 stone (last card); 3 clay + glass (science); the 3 VP stage removed | The Hanging Gardens of Babylon |
| Ephesus A stage 1 | 2 stone | 2 clay | The Temple of Artemis in Ephesus |
| Ephesus A stage 3 | 2 papyrus | 2 ore + glass | The Temple of Artemis in Ephesus |
| Ephesus B stage 3 | papyrus + loom + glass | 2 ore + loom | The Temple of Artemis in Ephesus |
| Giza A stage 1 | 2 stone | 2 wood | The Pyramids of Giza |
| Giza A stage 2 | 3 wood | 2 clay + loom | The Pyramids of Giza |
| Halicarnassus A stage 1 | 2 clay | 2 ore | The Mausoleum of Halicarnassus |
| Halicarnassus A stage 2 | 3 ore | glass + papyrus | The Mausoleum of Halicarnassus |
| Halicarnassus A stage 3 | 2 loom | 3 stone | The Mausoleum of Halicarnassus |
| Halicarnassus B stage 1 | 2 ore | 2 clay | The Mausoleum of Halicarnassus |
| Halicarnassus B stage 2 | 3 clay | glass + papyrus | The Mausoleum of Halicarnassus |
| Halicarnassus B stage 3 | glass + papyrus + loom | 3 wood | The Mausoleum of Halicarnassus |
| Olympia board | wood | clay | The Statue of Zeus in Olympia |
| Olympia A stage 1 | 2 wood | 2 stone (3 VP) | The Statue of Zeus in Olympia |
| Olympia A stage 2 | 2 stone; once an age, build a card free | 2 wood; a card of a colour your city has none of is free, all game (`freeFirstColor`) | The Statue of Zeus in Olympia |
| Olympia A stage 3 | 2 ore | 3 clay (7 VP) | The Statue of Zeus in Olympia |
| Olympia B stage 1 | 2 wood; raw goods from both neighbours at 1 coin | 2 ore; 2 VP and the card played on each age's first turn is free (`freeFirstCard`) | The Statue of Zeus in Olympia |
| Olympia B stage 2 | 2 stone; 5 VP | 3 clay; 3 VP and the card played on each age's last turn is free (`freeLastCard`) | The Statue of Zeus in Olympia |
| Olympia B stage 3 | loom + ore as coded (2 ore + loom per the article); copy a neighbour's guild | glass + papyrus + loom; 5 VP | The Statue of Zeus in Olympia |
| Rhodes | as in Wonders above | unchanged: the article names no change and shows no Rhodes picture | none |
| Giza B | as in Wonders above | unchanged: the article names no change (it pictures side A only) | none |

How 2.0.0 reads the Olympia effects: "free" means no coins and no resources, through the card's usual build
option. The first-of-a-colour build counts the cards in the city (a card built from the discard pile or a free
chain counts too), over the whole game, as the article says the FAQ rules. The first card of an age is the card
picked on the age's turn 1; the last card is the card picked from a hand of two (turn 6, or turn 7 with the Cities
eighth card). The effect kinds `freeBuild` (1st-edition Olympia A) and `copyGuild` (1st-edition Olympia B) are
gone from `points.d.ts`; no add-on used them.

### 2nd edition: owner to confirm against the cards

**Resolved in 2.2.0** from 2nd-edition sources (see "2nd-edition sources (2.2.0)"): every item below. Two values
were wrong and are fixed (the Ludus's cost and missing VP, the Castrum's cost); the rest were right. The text
below is the 2.0.0 record, kept for history.

The article gives no number for these; the code keeps the value named, and Xavier's cards decide.

**Status after the reference sheets (2026-11-18): all still open.** Every sheet is 1st edition (2011 to 2015),
so none prints a 2nd-edition-only card or the 2nd-edition Olympia. Per item:

- Ludus: not covered (2nd-edition-only card; on no sheet).
- Castrum: not covered (2nd-edition-only card; on no sheet).
- Decorators Guild: not covered (2nd-edition-only card; on no sheet).
- Spies Guild: not covered for the 2nd edition. 7w-5 p10 (1st edition) gives 3 stone + glass, the value 1.0.0
  coded, which contradicts the PR #118 reading of the 1st-edition card (3 clay + glass) and doesn't fit the
  article's "reduced by 1 clay". `CCG` stays.
- Olympia B stage 1: not covered. 7w-5 p4 and aid p2 show only the 1st-edition board (raw goods at 1 coin);
  the 2nd-edition "first card of each Age" reading stays.

- **Ludus cost**: the article says only "inexpensive to build". Coded `SSO` (2 stone + ore), the 1st-edition
  Arena's cost (the 7+ Arena is one of the copies it replaced). Chain: none coded.
- **Ludus victory points**: the article gives the coins (3 per red card, from "12-18 coins" for 4 to 6 military
  cards) and no points. Coded with no VP; if the card also scores per red card, add a `perVP` beside the coins.
- **Castrum cost, shields and chain**: the article only says it was added for 4+ and 7+. Coded as the
  1st-edition Arsenal it took the copies of: `WWOL`, 3 shields (every Age III red card's), no chain.
- **Decorators Guild cost and effect**: the article says it "rewards building your Wonder" and replaces the
  Strategists. Coded cost `OOSL` (the Strategists'); effect 7 VP if every stage of your wonder is built. The 7 is
  not in the article.
- **Spies Guild cost**: the article says "reduced by 1 clay"; 1.0.0 coded `SSSG` from 7w-5, which has no clay to
  remove. The PR #118 review read the 1st-edition card as 3 clay + glass, and the article agrees it had clay, so
  2.0.0 codes `CCG` (2 clay + glass).
- **Well**: coded as the Pawnshop it renames (free, 3 VP, 4+ and 7+); the article says its copies are 4+ and 7+.
- **Olympia B stage 1, "the first card of each Age"**: read as the card picked on turn 1 of each age.
- **Rhodes (both sides) and Giza B**: not mentioned by the article; kept as 1.0.0.
- **Other values the article doesn't touch** (every other cost, chain, effect and copy count, both sides of each
  board's untouched stages): kept as 1.0.0; the "Still unverified" list above still applies to them.

### Expansions with the 2nd-edition base

Leaders, Cities and the Wonder Pack keep their rules as audited above (1st-edition expansions); **which editions
of them Xavier owns is unconfirmed.** Each is now 2.0.0 with range `^2.0.0` (only the range changed) and is
tested composed with the 2nd-edition base (`test/addons.test.ts`, the kit tests, every seat count, the leak
checks in both adapters).

- No add-on names a card the 2nd edition removed or renamed (no Pawnshop, no Strategists Guild): their cards and
  leaders refer to colours, effect kinds and their own cards only. The Leaders and Cities guilds join the Age III
  guild pool with the Decorators Guild in the Strategists' place.
- Indirect effects of the edition on 1st-edition expansion content: Tomyris (defeat tokens go to the
  neighbour) no longer feeds a Strategists Guild; Manneken Pis A's copies of a neighbour's stage now copy the new
  Olympia free builds, and a copy of a stage Babylon B no longer has (stage 3) copies nothing, as with any
  two-stage board; Stevie, Imhotep and the Cities wonder-stage effects read the new stage costs.
- The Scientist persona (`seven-wonders-scientist`) is 2.0.0 with range `^2.0.0`; its science card names are
  unchanged, and its prior no longer looks for the removed Olympia way.

## 2nd-edition sources (2.2.0)

Online research on 2026-11-18, which Xavier allowed, to settle the 2nd-edition owner items. Many sites describe
the 1st edition (2010), so each source's edition is recorded and only sources that are clearly 2nd edition were
trusted: a source counts as 2nd edition when it has the Well, Ludus, Castrum and Decorators Guild, day and night
sides, and the new Olympia. Mechanics only; no text was copied.

| Short name | Source | Edition | What it gave |
|---|---|---|---|
| **rprod FAQ** | Repos Production's official FAQ, <https://www.rprod.com/en/7-wonders/faq> | 2nd (discusses the night-side Olympia free builds and both editions' compatibility) | the Olympia rulings |
| **card list** | the 2nd-edition rulebook's "List of Cards" and "List of Chains" sheets, transcribed at <https://rulespal.com/7-wonders-second-edition/rulebook> (and its setup section) | 2nd (Well, Ludus, Castrum, Decorators Guild; day and night) | every card's effect and player counts; the guild rule. No costs |
| **photos** | BoardGameGeek photos filed under 7 Wonders (Second Edition), item 316377: Age II, Age III and guild cards of the Italian printing, <https://boardgamegeek.com/image/7689938>, <https://boardgamegeek.com/image/7689937>, <https://boardgamegeek.com/image/7689944> | 2nd (new card frames, Ludus, Castrum, Decorators Guild) | printed costs read here: Ludus, Castrum, Spies, Decorators, Craftsmens Guild, Archery Range |
| **BGA data** | Board Game Arena's licensed 2nd-edition card data, as captured in <https://github.com/martenkrohn/seven-wonders-rl> (`bga_cards-v1.json`, ruleset "bga-second-edition") | 2nd (Ludus, Castrum, Decorators Guild; Strategists retired) | every card's cost, copies, chains and effect |
| **haftgane** | the photo-checked 2nd-edition catalog of an open-source implementation, <https://github.com/NightMachinery/ajayeb> (`docs/haftgane/edition-differences.md`, `catalog/testdata/cards.golden.csv`, `catalog.golden.txt`) | 2nd (checked against the publisher's sheets and BGG photos) | every card and every wonder stage; the list of known errors in other sources |
| fan wiki | <https://7-wonders.fandom.com> card list | 2nd, but a fan source with known cost errors | cross-check only; not trusted where it disagrees |
| 2e article (above) | third-party 1st vs 2nd comparison | 2nd changes, few numbers | (2.0.0) |

Rejected: the Esoteric Order of Gamers summary (1st edition, has the Strategists Guild); the Dized card pages
(no edition named); the Asmodee file `7ED_EN02_Rules.pdf` (it is the Edifice expansion's rulebook).

**The owner items, settled:**

| # | Item | Coded before | 2nd edition | Status | Sources |
|---|---|---|---|---|---|
| 1 | Ludus cost | `SSO` | stone + ore (`SO`) | **fixed** | photos (7689937), BGA data, haftgane |
| 1 | Ludus points | none | 1 VP per red card in your city at the end, beside the 3 coins per red card | **fixed** (play change) | card list, photos, BGA data, haftgane |
| 2 | Castrum cost | `WWOL` | wood + 2 clay + papyrus (`WCCP`) | **fixed** | photos (7689937), BGA data, haftgane |
| 2 | Castrum shields | 3 | 3 | matching | card list, photos, BGA data |
| 3 | Decorators Guild | `OOSL`; 7 VP if every stage built | same | matching | card list, photos (7689944), BGA data, haftgane |
| 4 | Spies Guild | `CCG` | 2 clay + glass | matching | photos (7689944), BGA data, haftgane |
| 5 | Olympia B stage 1 | `OO`; 2 VP; card picked on each age's turn 1 free | same; the free card is the first card chosen in the age, lost if it is sold or used for a stage; not usable in the age the stage is built in (it is built after turn 1) | matching | rprod FAQ, haftgane |
| 5 | Olympia B stage 2 | `CCC`; 3 VP; the card played from a hand of two | same: the sixth card played, not the one discarded | matching | rprod FAQ, haftgane |
| 6 | Copies per player count | as in `src/data.ts` | every Age I to III card's counts match | matching | card list, BGA data, haftgane |
| 6 | Guilds | seats + 2 at random | seats + 2 drawn at random from the ten | matching | card list (setup) |
| 7 | Every other base card's cost, chain and effect | as coded | all match | matching | BGA data, haftgane; costs not printed in the card list |
| 7 | Every base wonder stage (both sides) | as coded | all match, Rhodes and Giza B included | matching (Babylon B: see below) | haftgane, BGA data |
| 8 | Archery Range cost | `WWO` | 2 wood + ore | matching | photos (7689938), BGA data, haftgane |
| 8 | Mourners Guild cost (Cities, 1st edition) | `SSCG` | no source found | **still open** | none |

Archery Range is a base card in both editions (Age II, chained from the Workshop), not a Cities or Leaders card.
The 2nd-edition data above settles it for this base.

**Source disagreements, decided:**

- The card list's chain table names Stables → Arena, Archery Range → Siege Workshop and Courthouse → Senate.
  BGA data and haftgane (which read the printed chain symbols on photos) give Dispensary → Arena, Laboratory →
  Siege Workshop and Library → Senate, as coded. Kept as coded: two sources that read the cards outweigh one
  transcription of a diagram.
- The fan wiki gives Town Hall `SSSG`, Arena `CCO`, Circus `CCCO` and the Craftsmens Guild `SSO`. BGA data,
  haftgane and the photos (Craftsmens Guild, 7689944) give `SSOG`, `SSO`, `SSSO` and `SSOO`, as coded. Kept.

**Still open: owner card check** (on his physical 2nd-edition copy):

- Babylon's night side: two stages, 2 stone (play the age's last card) and 3 clay + glass (a science symbol of
  your choice). BGA data and haftgane agree, but no photo of the printed board was found.
- Mourners Guild (Cities, 1st edition): its resource cost, coded 2 stone + clay + glass.

## Checked against the owner's reference sheets (2026-11-18)

Xavier sent 13 files (2026-11-18). They are the references this audit already used, under new file names, plus
one more symbol sheet. Editions: all are 1st edition (dated 2011 to 2015). The base is coded as the 2nd edition,
so where a sheet's base value differs from the code and the 2nd-edition table above explains it, it was noted and
left. The expansions are coded as the 1st edition (Xavier's choice), so their mismatches were fixed, test first
(`test/reference-sheets.test.ts`).

| File | Short name above | Edition | What it covers |
|---|---|---|---|
| concise reference (pdf) | concise | 1st (2011) | base setup, turn, trading, military, scoring |
| player aid (pdf) | aid p1 / p2 | 1st (2015) | symbols of the base, Leaders, Cities, Wonder Pack, goodies |
| wonder boards (pdf) | 7w-5 | 1st (2013) | every board's effects and starting resource; every card's cost, chain and effect; leaders |
| leaders summary (pdf) | 7w-1 | 1st (2019) | leader effects, with later promos |
| leaders effects-costs (pdf) | 7w-2 | 1st (2011) | base leaders, costs and effects |
| leaders table (pdf) | 7w-3 | 1st (2015) | leaders with Cities and promos, costs and effects |
| leaders symbols-effects (pdf) | 7w-4 | 1st (2011) | base leaders, costs and effects |
| Wonder Pack side A and side B (jpg) | photos | 1st (Wonder Pack) | the four boards: starting resource, stage costs and effects |
| Cities + Leaders cheat sheet (jpg) | sheet | 1st | setup, 8 players, leader draft, debt, diplomacy, team play |
| card-and-parts list (rtf) | parts | Cities 1st (2012, 2015 printings) | names of every Cities card, leader, guild and part |
| card-and-parts list (doc) | (new) "symbols" | 1st | not a parts list: the effect symbols in words (trade, free builds, copies, losses, discounts) |

**Fixed** (expansions, 1st edition both sides):

- Wonder Pack, from the photos (starting resources also 7w-5 p2 and p8): the Great Wall makes loom (was clay) and
  Stonehenge wood (was stone); every stage cost of the Great Wall, Stonehenge, Abu Simbel and Manneken Pis B, as in
  the Wonders table. The cost symbols were read by colour and shape against 7w-5's symbol key (p2): grey block
  stone, dark nugget ore, green logs wood, orange bricks clay, octagons for loom (magenta), glass (blue) and
  papyrus (tan). The photos are small; the readings are consistent across all eight boards (for example the
  stage costs that were already confirmed, Great Wall A stages 2 and 3, read the same way).
- Manneken Pis A: each stage prints "?" for its cost. Coded as the copied stage's cost, fixed when the boards are
  dealt (base 2.1.0: a stage cost "?" with a `copyStage` effect). Its third stage copies the left board's **last**
  stage (aid p2), not its third (7w-5 p5 says "Stage 3"; aid p2 is the one that names boards of 2 and 4 stages
  correctly): `copyStage` takes a negative stage counted from the last.
- Leaders guilds (7w-5 p9): the Diplomats' Guild costs stone, wood, glass, papyrus (was loom for papyrus); the
  Gamers' Guild costs stone, clay, wood, ore (was ore + glass for wood + ore).
- Leaders: the Courtesans' Guild can't copy Esteban (7w-1, 7w-3); he was offered.

**Confirmed, nothing to change:**

- Every leader's cost and effect (45 coded: 36 Leaders, 6 Cities, 3 promos) against 7w-1, 7w-2, 7w-3, 7w-4 and
  7w-5 p11-12, with the disagreements already noted in the Leaders section (Hammurabi, Nefertiti, Nero) decided
  the same way. Stevie's price ignores Imhotep (7w-1): it reads the printed stage cost. Esteban and Louis have no
  printed cost on 7w-5; 7w-3 gives 5 and 4, as coded.
- Every Cities black card (27), guild (3) and leader (6): names and ages against the parts list, costs and effects
  against 7w-5 and aid p1, debt and diplomacy rules against the sheet and the symbols sheet (debt only when another
  seat makes you pay, may be taken anyway, settled last; a held diplomacy token is spent at the age's end; masks
  copy different cards). The Leaders guilds' other costs (Courtesans, Architects) match 7w-5.
- Petra, Byzantium and Roma: effects and starting resources as in the Wonders table.
- Wonder Pack effects and starting coins (Manneken Pis +4) against the photos, aid p2 and 7w-5.
- The base boards (7w-5, 1st edition): Rhodes, Ephesus, Halicarnassus, Giza and Alexandria's starting resources and
  effects match. Babylon (clay, 3 stages on B), Olympia (wood on A, ore on B, the 1st-edition free build, trade and
  guild copy) are the 1st edition: expected, left as the 2nd edition. 7w-5 prints no stage costs.
- Base cards (7w-5, 1st edition): every Age I to III cost and chain matches the 1st-edition values the 2nd-edition
  table above starts from; the differences are exactly that table's (Well for Pawn Shop, Altar, Theater, Temple,
  Statue, Pantheon, Gardens, Fortifications, Builders Guild, Spies Guild, the Strategists Guild).

**Not covered by any sheet:**

- Copy counts per player count. The parts list is the Cities list and has none (one black card a seat and age,
  as coded); no other sheet lists them. The base's counts were UNVERIFIED here; 2.2.0 checked them against
  2nd-edition sources ("2nd-edition sources (2.2.0)").
- Archery Range's resource cost (7w-5 prints only the chain) and the Mourners Guild's cost (blank on 7w-5).
- The five 2nd-edition owner items (Ludus, Castrum, Decorators Guild, Spies Guild, Olympia B stage 1): see
  "2nd edition: owner to confirm" above; all resolved in 2.2.0 ("2nd-edition sources (2.2.0)").

**Noted, not changed** (the 2015 Cities printing, parts list): its mask mark says the Counterfeiters Guild, the
Guild of Shadows, Aspasia, Caligula, Darius and Diocletian need Cities, so Berenice, Semiramis and the Mourners
Guild could be played without it. Here all Cities content comes with the Cities add-on.

## Testing record

### 5a. Random-play fuzzing through the server and web client (2026-11-17)

Boardcore `pnpm fuzz` at public commit 2480df1 (PR #121 branch), with `FUZZ_EXTRA_PACKS` pointed at the built
base, Leaders, Cities, Wonder Pack and Scientist, `FUZZ_GAMES="7 Wonders"`, `FUZZ_SEATS=3,5,7`, `FUZZ_STRICT=1`,
3 workers. Add-ons and options (B sides, random sides, team play, starting coins) switched at random on the form.

- Three runs, about 33 minutes: **34 episodes, 5,948 steps, 48 rooms, 17 games played to the end**. The last
  run, on the final harness: 12 episodes, 2,354 steps, 25 rooms, 7 games ended, **no failure**.
- Failures found: 3 signatures, all in the harness's leak check, none a leak (each replayed with `FUZZ_REPLAY`
  and checked against the seat views): a seat's own sold card in its own log ("You choose Lumber Yard (sell)")
  matching another hand's copy; public lines ("Leader draft: pick 1 made.", "Age II begins.") read on one side
  of a commit; a resigned seat's own old hand holding the hand it passed on. Fixed in the public harness;
  the replays run clean.
- Also found: a room with **team play at 3, 5 or 7 seats** is created and filled, then every start is a bare
  `PackFault` (setup throws "Team play needs 4, 6 or 8 players"), so the room never starts (44 refused starts
  in run 2). Contract gap: public `docs/10-questions.md` Q106. The option's description names the counts.
- And: a nameless browser could never make a room (harness fix). Notes left: takebacks refused across a
  secret pick (by design, said in words).

### 5b. Phone play (2026-11-17)

Playwright, iPhone 13 at deviceScaleFactor 1, scripted. A full 3-player base game with three phones (one per
seat), and a full 3-player game with Leaders and Cities, one phone and two Scientist bots.

- Rules: simultaneous picks (the others see "Ana has chosen", never the card); hands passed left in Ages I and
  III and right in Age II, checked every turn; neighbour payments offered and paid; wonder stages built; end
  scoring checked by an independent scorer from the public view (military, treasury, wonder, civic, commerce,
  guilds, science): all three seats matched the pack, and the lines add to the outcome (base 38/37/35, Leaders
  and Cities 59/56/63, debt and leaders lines included).
- Fixed: the board text was 700 to 1,700 px wide in a 330 px box, cut off at the coins column (now a few lines
  a seat within 34 columns, with each seat's score at the end; `base.test.ts` "fits a phone"); the leader cards
  read "Nero (1 coins): nero" (every leader effect now in words, plural fixed; `addons.test.ts`); the Confirm
  row showed option ids ("c:0 → build → Pay 2 to the right"), a web fix in public 2480df1.
- Left: the board names seats by colour (red, blue) while the log and results use player names; "VP" is
  abbreviated; the turn pill covers the room code for two seconds.
