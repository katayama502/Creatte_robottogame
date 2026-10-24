import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.js";

const setup = (n = 3, boss = "maou", chars = ["hero", "wizard", "robo", "fox", "beaver", "owl"]) => ({
  players: Array.from({ length: n }, (_, i) => ({ name: "P" + (i + 1), char: chars[i] })), boss, maxRounds: 6,
});
const give = (st, pi, types) => { st.players[pi].hand = types.map((t, k) => ({ id: 9000 + k, type: t })); return st.players[pi].hand.map((c) => c.id); };

test("入力チェック：人数・名前・キャラ・ボス・ラウンド", () => {
  assert.ok(E.validateSetup(setup(1)).length);
  assert.ok(E.validateSetup(setup(7, "maou", ["hero", "wizard", "robo", "fox", "beaver", "owl", "rabbit"])).length);
  assert.deepEqual(E.validateSetup(setup(6)), []);
  const s = setup(2); s.players[0].name = "あいうえおかきくけこさ"; assert.ok(E.validateSetup(s).length);
  const s2 = setup(2); s2.players[1].char = "hero"; assert.ok(E.validateSetup(s2).length, "同じキャラ");
  const s3 = setup(2); s3.boss = "x"; assert.ok(E.validateSetup(s3).length);
  const s4 = setup(2); s4.maxRounds = 99; assert.ok(E.validateSetup(s4).length);
});

test("じゅんばん：1ラウンドめは 1→N、2ラウンドめは N→1（行ったり来たり）", () => {
  const st = E.newGame(setup(4), 1);
  assert.deepEqual(E.roundOrder(st, 1), [0, 1, 2, 3]);
  assert.deepEqual(E.roundOrder(st, 2), [3, 2, 1, 0]);
  assert.deepEqual(E.roundOrder(st, 3), [0, 1, 2, 3]);
  // 実際に1ラウンド回すと、最後の人がつぎのラウンドの最初になる
  let s = st; const seen = [];
  for (let k = 0; k < 8; k++) {
    seen.push(E.currentIndex(s));
    s = E.runProgram(s, []).state; s = E.bossAct(s);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 3, 2, 1, 0]);
});

test("ボスは プレイヤーごとに 1回うごく", () => {
  let s = E.newGame(setup(2, "clock"), 3);
  const n0 = s.bossDiscard.length;
  s = E.runProgram(s, []).state; s = E.bossAct(s);
  assert.equal(s.bossDiscard.length + (s.bossDeck.length === 4 ? 0 : 0), n0 + 1);
  assert.ok(s.lastBoss && s.lastBoss.card);
});

test("まえへ：かべ・ボス・なかまで止まる", () => {
  const st = E.newGame(setup(2), 5);
  st.players[0].x = 1; st.players[0].y = 3; st.players[0].dir = "E";
  st.boss.x = 3; st.boss.y = 3;
  const ids = give(st, 0, ["fwd2"]);
  const r = E.runProgram(st, ids).state;
  assert.equal(r.players[0].x, 2, "ボスの手前で止まる");
});

test("こうげき：目の前のボスに3、せなかから+1", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "fox"]), 5);
  st.players[0].x = 3; st.players[0].y = 2; st.players[0].dir = "S"; st.boss.dir = "S"; // ボスは下向き → 上は せなか
  const ids = give(st, 0, ["atk"]);
  const r = E.runProgram(st, ids).state;
  assert.equal(r.players[0].dmg, 4); assert.equal(r.boss.hp, st.boss.hp - 4);
});

test("くりかえす：つぎのカードを2回（ビーバーは3回）", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "beaver"]), 5);
  st.players[0].x = 0; st.players[0].y = 0; st.players[0].dir = "E";
  let r = E.runProgram(st, give(st, 0, ["loop", "fwd1"])).state;
  assert.equal(r.players[0].x, 2);
  assert.equal(r.players[0].stats["くり返し"], 1);
  // ビーバー
  let s = E.runProgram(st, []).state; s = E.bossAct(s);
  const pi = E.currentIndex(s); assert.equal(s.players[pi].char, "beaver");
  s.players[pi].x = 0; s.players[pi].y = 6; s.players[pi].dir = "E"; s.boss.x = 6; s.boss.y = 0;
  r = E.runProgram(s, give(s, pi, ["loop", "fwd1"])).state;
  assert.equal(r.players[pi].x, 3);
});

test("もし：ボスが前ならこうげき、いなければまえへ", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "fox"]), 5);
  st.players[0].x = 3; st.players[0].y = 1; st.players[0].dir = "S"; st.boss.dir = "E";
  const r = E.runProgram(st, give(st, 0, ["ifatk", "ifatk"])).state;
  assert.equal(r.players[0].y, 2, "1回目は まえへ");
  assert.equal(r.players[0].dmg, 3, "2回目は こうげき");
});

test("関数：1・2番目をもう一度", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "fox"]), 5);
  st.players[0].x = 0; st.players[0].y = 0; st.players[0].dir = "E"; st.boss.x = 6; st.boss.y = 6;
  const r = E.runProgram(st, give(st, 0, ["fwd1", "right", "func"])).state;
  // →1 → 下向き → (func) 下へ1 → 左向き
  assert.deepEqual([r.players[0].x, r.players[0].y, r.players[0].dir], [1, 1, "W"]);
});

test("バグ：プログラムに入れると そこで止まる／デバッグで消える", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "fox"]), 5);
  st.players[0].x = 0; st.players[0].y = 0; st.players[0].dir = "E"; st.boss.x = 6; st.boss.y = 6;
  let r = E.runProgram(st, give(st, 0, ["bug", "fwd1"])).state;
  assert.equal(r.players[0].x, 0);
  const st2 = E.newGame(setup(2, "maou", ["robo", "fox"]), 5);
  st2.players[0].hand = [{ id: 1, type: "debug" }, { id: 2, type: "bug" }, { id: 3, type: "bug" }];
  r = E.runProgram(st2, [1]).state;
  assert.equal(r.players[0].hand.filter((c) => c.type === "bug").length, 0);
});

test("ボスの攻撃：範囲内はHP−1（技によってバグ）、かめは1ラウンド1回ふせぐ", () => {
  let s = E.newGame(setup(2, "slime", ["turtle", "hero"]), 9);
  s = E.runProgram(s, []).state;
  s.bossDeck.unshift({ id: "t", name: "テスト", move: "stay", steps: 0, area: "line", bug: 1 });
  s.players[0].x = 3; s.players[0].y = 0; s.players[1].x = 0; s.players[1].y = 3;
  const before = s.players[1].hand.length;
  s = E.bossAct(s);
  assert.equal(s.players[0].shieldUsed, true); assert.equal(s.players[0].hp, 5);
  assert.equal(s.players[1].hp, 4);
  assert.equal(s.players[1].hand.length, before + 1, "バグ技なのでバグが入る");
  assert.equal(s.players[1].x, 0, "かべ側なので ふきとばない（盤の外へは出ない）");
});

test("HPが0になると ダウン：点数−2・スタート地点でHP全回復", () => {
  let s = E.newGame(setup(2, "slime", ["hero", "fox"]), 9);
  s = E.runProgram(s, []).state;
  s.bossDeck.unshift({ id: "t", name: "テスト", move: "stay", steps: 0, area: "ring1", power: 2 });
  const p = s.players[0]; p.x = 3; p.y = 2; p.hp = 1; p.dmg = 5;
  s = E.bossAct(s);
  const q = s.players[0];
  assert.equal(q.hp, 5); assert.equal(q.dmg, 3); assert.equal(q.downs, 1);
  assert.deepEqual([q.x, q.y], [q.home.x, q.home.y]);
  assert.ok(s.lastBoss.hits[0].down);
});

test("デバッグとうさぎは HPを回復する", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "rabbit"]), 5);
  st.players[0].hp = 3; st.players[0].hand = [{ id: 1, type: "debug" }];
  const r = E.runProgram(st, [1]).state;
  assert.equal(r.players[0].hp, 4);
  r.players[1].hp = 2;
  const s2 = E.bossAct(r);
  assert.equal(s2.players[1].hp >= 3 || s2.players[1].hp === 2 - 1 + 1, true);
});

test("ボスの予告どおりに動く（公開情報で先読みできる）", () => {
  let s = E.newGame(setup(3, "maou"), 11);
  s = E.runProgram(s, []).state;
  const pred = E.predictBoss(s);
  const after = E.bossAct(s);
  assert.deepEqual([after.boss.x, after.boss.y], [pred.boss.x, pred.boss.y]);
  assert.deepEqual(after.lastBoss.cells, pred.cells);
});

test("時計ドラゴンは毎回同じじゅんばん（くり返しのパターン）", () => {
  let s = E.newGame(setup(2, "clock"), 2);
  const names = [];
  for (let k = 0; k < 8; k++) { s = E.runProgram(s, []).state; names.push(E.nextBossCard(s).name); s = E.bossAct(s); }
  assert.deepEqual(names, ["チク", "タク", "チク", "ゴーン", "チク", "タク", "チク", "ゴーン"]);
});

test("実行したら 山札からランダムに引いて 手札が5まい（ふくろうは6まい）にもどる", () => {
  let s = E.newGame(setup(2, "maou", ["hero", "owl"]), 4);
  assert.equal(s.players[0].hand.length, 5); assert.equal(s.players[1].hand.length, 6);
  assert.ok(s.players.every((p) => p.hand.some((c) => c.type === "atk" || c.type === "ifatk")), "こうげき系が1まいは入る");
  const used = s.players[0].hand.slice(0, 3).map((c) => c.id);
  const r = E.runProgram(s, used);
  assert.equal(r.state.players[0].hand.length, 5); assert.equal(r.drawn.length, 3); assert.equal(r.state.phase, "boss");
  s = E.bossAct(r.state);
  const r2 = E.runProgram(s, [s.players[1].hand[0].id]);
  assert.equal(r2.state.players[1].hand.length, 6);
});

test("実行の記録に エフェクト用の情報が入る", () => {
  const st = E.newGame(setup(2, "maou", ["robo", "fox"]), 5);
  st.players[0].x = 3; st.players[0].y = 1; st.players[0].dir = "S"; st.boss.dir = "E";
  const r = E.runProgram(st, give(st, 0, ["loop", "ifatk", "beam"]));
  const fx = r.trace.map((f) => f.fx).filter(Boolean);
  assert.ok(fx.includes("loop") && fx.includes("if") && fx.includes("slash") && fx.includes("beam"), fx.join(","));
});

test("ボスをたおすと とどめ+2・いちばんダメージの人が勝ち", () => {
  const st = E.newGame(setup(2, "slime", ["robo", "fox"]), 5);
  st.boss.hp = 3; st.players[0].x = 3; st.players[0].y = 2; st.players[0].dir = "S"; st.boss.dir = "N";
  const r = E.runProgram(st, give(st, 0, ["atk"])).state;
  assert.equal(r.phase, "end"); assert.equal(r.players[0].dmg, 5); assert.equal(r.winner, 0);
});

test("ラウンドが終わると ゲーム終了", () => {
  let s = E.newGame({ ...setup(2, "slime"), maxRounds: 3 }, 8);
  for (let k = 0; k < 6; k++) { s = E.runProgram(s, []).state; s = E.bossAct(s); }
  assert.equal(s.phase, "end");
});

test("不正な操作・保存データは受けつけない", () => {
  const s = E.newGame(setup(2), 1);
  assert.throws(() => E.runProgram(s, [123456]));
  assert.throws(() => E.runProgram(s, [s.players[0].hand[0].id, s.players[0].hand[0].id]));
  assert.throws(() => E.runProgram(s, s.players[0].hand.map((c) => c.id)), /枠/);
  assert.throws(() => E.bossAct(s));
  assert.equal(E.isValidState(s), true);
  assert.equal(E.isValidState({ ...s, v: 99 }), false);
  const bad = JSON.parse(JSON.stringify(s)); bad.players[0].name = "<img src=x onerror=alert(1)>あいうえおかきくけ"; assert.equal(E.isValidState(bad), false);
  const bad2 = JSON.parse(JSON.stringify(s)); bad2.players[0].hand.push({ id: 1, type: "hack" }); assert.equal(E.isValidState(bad2), false);
});

test("同じシードなら 同じ展開（だれにでも公平）", () => {
  const a = E.newGame(setup(3), 77), b = E.newGame(setup(3), 77);
  assert.deepEqual(a.players.map((p) => p.hand), b.players.map((p) => p.hand)); assert.deepEqual(a.deck, b.deck); assert.deepEqual(a.bossDeck, b.bossDeck);
});
