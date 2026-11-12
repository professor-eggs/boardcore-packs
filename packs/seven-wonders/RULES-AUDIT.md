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

Statuses:

- **matching**: the code already did what the source says.
- **fixed**: the code disagreed and was corrected.
- **added**: the source defines it and it was missing; now built.
- **blocked**: the source defines it but it can't be built here; the reason is given.
- **not covered**: no supplied source defines it, so it can't be confirmed either way (UNVERIFIED).

**Still not in any source.** Player-count copy lists for base cards (which copies appear at 3, 4, … players). Some wonder stage costs that neither 7w-5 nor the photos show clearly. The Mourners Guild's resource cost (7w-5 p9 leaves the cost cell empty). Archery Range's resource cost (7w-5 p6 only prints the chain). Those stay UNVERIFIED in `src/data.ts`.

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
| Diplomats Guild (leaders) | 3 | purple | SWGL | players+2 guilds | - | perLeaderNbrVP n:1 | aid p1 Guilds | matching |
| Gamers Guild (leaders) | 3 | purple | SCOG | players+2 guilds | - | leaderVP what:coins3 | aid p1 Guilds/General (1 VP per 3 coins) | matching |
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
| Great Wall (wonderPack) | A | C (photos); stages in any order (7w-5 p2, photos) | 1 | SSO (UNVERIFIED) | coins n:8 | photos; 7w-5 p2 | **fixed**: starting resource was wood |
| Great Wall (wonderPack) | A |  | 2 | CGP | sci s:* | photos; 7w-5 p2 | **fixed**: cost was 2 clay + wood; effect confirmed |
| Great Wall (wonderPack) | A |  | 3 | SSS | wallShields n:2 | photos; 7w-5 p2 | **fixed**: cost was 2 ore + stone; effect confirmed |
| Great Wall (wonderPack) | A |  | 4 | GLP (UNVERIFIED) | discardBuild | photos; 7w-5 p2 | matching (effect confirmed; cost still unverified) |
| Great Wall (wonderPack) | B | C (photos); stages in any order | 1 | SSO (UNVERIFIED) | coins n:8; nbrCoins n:2 | photos; 7w-5 p2 | **fixed**: starting resource was wood; effect confirmed |
| Great Wall (wonderPack) | B |  | 2 | CCW (UNVERIFIED: photos show 2 clay plus one other) | mask | photos; 7w-5 p2 | matching (effect confirmed) |
| Great Wall (wonderPack) | B |  | 3 | OOS (UNVERIFIED) | wallSkip (and others pay 2, already in the hook) | photos; 7w-5 p2 | matching (effect confirmed, including the 2-coin loss already implemented) |
| Great Wall (wonderPack) | B |  | 4 | GLP (UNVERIFIED) | blackMarket | photos; 7w-5 p2 | matching (effect confirmed) |
| Stonehenge (wonderPack) | A | S (photos, 7w-5) | 1 | SC | vp n:3 | photos | **fixed**: cost was 2 stone; the photo shows stone + clay |
| Stonehenge (wonderPack) | A |  | 2 | CCC | vp n:5 | photos | matching (cost confirmed) |
| Stonehenge (wonderPack) | A |  | 3 | SSSS | stoneVP n:2 | aid p2; photos | matching (cost confirmed) |
| Stonehenge (wonderPack) | B | S | 1 | SSS | stoneCoins n:1; stoneVP n:1 | aid p2; photos | matching (cost confirmed) |
| Stonehenge (wonderPack) | B |  | 2 | CCCC | revealColor | aid p2; photos | matching (cost confirmed) |
| Abu Simbel (wonderPack) | A | P | 1 | SS | vp n:3 | aid p1 General | matching |
| Abu Simbel (wonderPack) | A |  | 2 | PPL | vp n:5 | aid p1 General | matching |
| Abu Simbel (wonderPack) | A |  | 3 | SSSS | entomb | aid p2 Wonder Pack | matching |
| Abu Simbel (wonderPack) | B | P | 1 | SSSL | entomb | aid p2 Wonder Pack | matching |
| Abu Simbel (wonderPack) | B |  | 2 | PPPPG | entomb | aid p2 Wonder Pack | matching |
| Manneken Pis (wonderPack) | A | none; +4 coins | 1 | WW | copyStage side:L stage:0 | aid p2 Wonder Pack | matching |
| Manneken Pis (wonderPack) | A |  | 2 | SSS | copyStage side:R stage:1 | aid p2 Wonder Pack | matching |
| Manneken Pis (wonderPack) | A |  | 3 | OOOO | copyStage side:L stage:2 | aid p2 Wonder Pack | matching |
| Manneken Pis (wonderPack) | B | none; +4 coins | 1 | WWSSCCOO | coins n:7; shields n:1; vp n:7 | aid p1 General | matching |

Notes:

- The Great Wall's effects and starting resource (clay) are now covered by 7w-5 and the photos. Some of its stage costs are still unverified.
- Rome side A free recruiting is confirmed by 7w-5 p3. The aid's −2 / −1 discount is side B. Stage costs are still unverified.
- 7w-5 p4 lists Olympia B as Ore and p6 lists Byzantium B as Papyrus. Both would disagree with the other face of the same board; those starting resources were left as Wood and Stone.
- Abu Simbel and Manneken Pis stage costs were not read clearly enough from the photos and stay UNVERIFIED; their effects and starting resources/coins match the photos and aid p2.

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

7w-1 also lists later promo leaders (Aganice, Agrippina, Arsinoe, Cornelia, Cynisca, Enheduanna, Eurypyle, Gorgo, Makeda, Nitocris, Octavia, Phryne, Roxana, Telesilla, Theano, Wil, and the Babel-only Nimrod). They are not in the `leaderPromos` pool, which stays the three Leaders goodies named on aid p2 (Louis, Stevie, Esteban). Several of those extra promos need new effect kinds (a cost equal to the current age, and so on).

## Still unverified or blocked

- Player-count copy lists for every base card.
- Archery Range's resource cost (7w-5 only prints the chain).
- Mourners Guild's resource cost (7w-5 p9 leaves the cell empty).
- Wonder stage costs for the base boards, Rome, Petra and Byzantium (7w-5 lists effects, not costs).
- Some Wonder Pack stage costs: Great Wall A stages 1 and 4, Great Wall B all four costs (effects are confirmed), Abu Simbel, Manneken Pis.
- 2-player expert variant: still blocked (concise only says "see rules"; seat minimum is 3).
- Catan goodie board: still blocked (no stage costs).
- Extra 7w-1 promo leaders listed above: not implemented.
