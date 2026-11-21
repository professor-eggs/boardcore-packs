// The owner's demo game (08 S11 "Demo", S11 part 8b): a person plays the draft game against Scientist on 8b's
// defaults, through Rooms on the lab host, the game (with Cities on) and the persona installed as a server installs
// them and searched sandboxed. The person's moves are seeded picks from the room's own prompts. A whole game takes
// minutes, so it runs only with BOARDCORE_DEMO=1; the result is in boardcore's docs/s11-attack.md "Part 8b results".
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Prompt, Step } from "@boardcore/pack-sdk";
import type { Caller, Reply } from "@boardcore/rooms";
import { s3Host } from "@boardcore/testkit/lab3";
import { defaultLoader } from "@boardcore/runtime-quickjs/default-loader";
import { Effect } from "effect";

const sample = (name: string) => {
  const dir = new URL(`../../../boardcore/packs/${name}/dist/`, import.meta.url);
  return { manifest: JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")), bundle: readFileSync(new URL("bundle.mjs", dir), "utf8") };
};
const ours = (name: string) => {
  const dir = new URL(`../../${name}/dist/`, import.meta.url);
  return JSON.stringify({ manifest: JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")), bundle: readFileSync(new URL("bundle.mjs", dir), "utf8") });
};
const val = <A>(r: Reply<A>, what: string): A => {
  if (!r.ok) throw new Error(`${what}: refused ${r.rejection.code}${"reason" in r.rejection ? ` (${(r.rejection as { reason: string }).reason})` : ""}`);
  return r.value;
};
let n = 0;
const key = () => `demo-${++n}`;

describe.runIf(process.env.BOARDCORE_DEMO === "1")("the owner's demo game against Scientist (8b)", () => {
  it("plays a whole game at three seats, two of them Scientist on its defaults, sandboxed", async () => {
    const h = await s3Host({ fourDice: sample("four-dice"), lantern: sample("lantern-bids"), holdFast: sample("hold-fast"), quickjs: defaultLoader });
    const install = async (text: string) => (await h.run(h.library.install(text).pipe(Effect.orDie))).hash;
    const base = await install(ours("seven-wonders"));
    const persona = await install(ours("seven-wonders-scientist"));
    const ann: Caller & { token: string | null } = { deviceKey: "d".repeat(64), token: null };
    const c = val(await h.run(h.rooms.create(ann, key(), { pack: base, addons: [], name: "Ann", material: "ann-material-for-the-demo", seats: 3, options: { cities: true }, settings: { personaThink: 0 } } as never)), "create");
    ann.token = c.token;
    for (const seat of ["blue", "green"]) val(await h.run(h.rooms.addBot(c.room, ann, key(), { seat, kind: "persona", persona })), `add ${seat}`);
    val(await h.run(h.rooms.start(c.room, ann, key())), "start");
    let pick = 7;
    const t0 = Date.now();
    let annMoves = 0;
    for (let guard = 0; guard < 200_000; guard++) {
      const v = val(await h.run(h.rooms.view(c.room, ann)), "view");
      if (v.state === "Finished" || v.state === "Suspended") break;
      const asked = await h.run(h.rooms.choices(c.room, ann, []));
      const first = asked.ok ? (asked.value as Prompt | null) : null;
      if (!asked.ok && asked.rejection.code !== "NotYourTurn") throw new Error(`choices: ${asked.rejection.code}`);
      if (!first) { await new Promise((ok) => setTimeout(ok, 50)); continue; }
      const action: Step[] = [];
      for (let p: Prompt | null = first; p; p = val(await h.run(h.rooms.choices(c.room, ann, action)), "choices") as Prompt | null) {
        const live = p.options.filter((o) => o.disabled === undefined);
        pick = (pick * 1103515245 + 12345) % 2147483648;
        const o = live[pick % live.length]!;
        action.push(p.kind === "pick" ? o.id : (p.kind === "subset" ? live.slice(0, p.min).map((x) => x.id) : p.kind === "order" ? p.options.map((x) => x.id) : { [o.id]: p.total ?? 0 }) as Step);
      }
      const r = await h.run(h.rooms.command(c.room, ann, { kind: "action", action, promptId: v.game?.promptId ?? null, idempotencyKey: key() }));
      if (r.ok) annMoves++;
    }
    const v = val(await h.run(h.rooms.view(c.room, ann)), "view");
    const lines = h.log.filter((l) => /persona|Strong/.test(l));
    console.log(`demo: ${v.state} after ${((Date.now() - t0) / 1000).toFixed(0)} s, Ann played ${annMoves} actions; outcome ${JSON.stringify(v.outcome)}`);
    for (const l of lines) console.log(`demo host line: ${l}`);
    expect(v.state).toBe("Finished");
    expect(v.seats.filter((s) => (s as { bot?: { kind?: string } }).bot?.kind === "persona")).toHaveLength(2);
    h.driver.stopAll();
  }, 3_600_000);
});
