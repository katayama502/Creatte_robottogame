// クリエット・コードバトル ゲームエンジン（画面に依存しない純粋なルール）
// 状態はすべて公開情報。乱数はシード付きなので、同じシードなら同じ展開になります。

export const SIZE = 7;
export const VERSION = 1;
const DIR_ORDER = ["N", "E", "S", "W"];
export const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
export const DIR_LABEL = { N: "上", E: "右", S: "下", W: "左" };
export const turnRight = (d) => DIR_ORDER[(DIR_ORDER.indexOf(d) + 1) % 4];
export const turnLeft = (d) => DIR_ORDER[(DIR_ORDER.indexOf(d) + 3) % 4];
export const turnBack = (d) => DIR_ORDER[(DIR_ORDER.indexOf(d) + 2) % 4];

// ---------- カード ----------
export const CARDS = {
  fwd1:  { name: "まえへ 1", concept: "順次", icon: "↑", text: "むいている方へ 1マス すすむ" },
  fwd2:  { name: "まえへ 2", concept: "順次", icon: "⇈", text: "むいている方へ 2マス すすむ" },
  right: { name: "みぎを むく", concept: "順次", icon: "↻", text: "右に 90度 まわる" },
  left:  { name: "ひだりを むく", concept: "順次", icon: "↺", text: "左に 90度 まわる" },
  back:  { name: "うしろを むく", concept: "順次", icon: "⟲", text: "反対を むく" },
  atk:   { name: "こうげき", concept: "順次", icon: "⚔", text: "目の前のボスに 3ダメージ。ボスの せなか からなら +1" },
  beam:  { name: "ビーム", concept: "順次", icon: "≫", text: "まっすぐ先に ボスがいれば 2ダメージ（遠くてもOK・なかまがいると止まる）" },
  loop:  { name: "くりかえす 2", concept: "くり返し", icon: "🔁", text: "つぎのカードを 2回 うごかす" },
  ifatk: { name: "もし ボスが前 なら こうげき", concept: "条件分岐", icon: "?", text: "目の前に ボスがいれば こうげき。いなければ まえへ 1" },
  ifrun: { name: "もし あぶない なら にげる", concept: "条件分岐", icon: "?", text: "ボスのつぎの攻撃範囲に いたら、ボスから 1マス はなれる" },
  func:  { name: "関数 もういちど", concept: "関数", icon: "ƒ", text: "1番目と2番目のカードを もういちど うごかす" },
  debug: { name: "デバッグ", concept: "デバッグ", icon: "🔧", text: "手札の バグを ぜんぶ けして、HPも 1 回復" },
  bug:   { name: "バグ", concept: "バグ", icon: "🐛", text: "プログラムに入れると そこで止まる。手札でも じゃまになる" },
};
export const DECK_COUNTS = { fwd1: 12, fwd2: 6, right: 8, left: 8, back: 4, atk: 10, beam: 6, loop: 6, ifatk: 6, ifrun: 4, func: 4, debug: 4 };
export const STARTER = ["fwd1", "fwd1", "right", "left", "atk"];
export const HAND_MAX = 5;
export const MAX_NAME = 10;
export const BUG_MAX = 2; // 手札に入るバグは 2まいまで
export const PLAYER_HP = 5; // プレイヤーのHP
export const DOWN_PENALTY = 2; // HPが0になると、あたえたダメージ（点数）が 2 へる

// ---------- キャラクター（とくいわざ） ----------
export const CHARS = {
  hero:   { name: "クリエット君", img: "hero", skill: "ひらめき", text: "1ターンに1回、こうげきのダメージ +1" },
  wizard: { name: "まほうつかい クリエット君", img: "wizard", skill: "まほうの手", text: "こうげき が 2マス先まで とどく" },
  robo:   { name: "ロボット クリエット君", img: "robo", skill: "高性能CPU", text: "プログラム枠が 4つ（ふつうは3つ）" },
  fox:    { name: "きつねのコン", img: "fox", skill: "すばしっこい", text: "まえへ カードで 1マス 多く すすむ" },
  beaver: { name: "発明家ビーバー", img: "beaver", skill: "発明のくふう", text: "くりかえす が 3回 になる" },
  owl:    { name: "ふくろう賢者", img: "owl", skill: "ちえの書", text: "手札を 6まい まで 持てる（ふつうは5まい）" },
  rabbit: { name: "うさぎ治癒師", img: "rabbit", skill: "いやしの光", text: "ターンのはじめに HPが 1 回復して、バグも 1まい けす" },
  turtle: { name: "かめ守護騎士", img: "turtle", skill: "まもりの盾", text: "1ラウンドに1回、ボスの攻撃を ふせぐ" },
};

// ---------- ボス ----------
// move: leader=いちばんダメージを与えた人へ / nearest=いちばん近い人へ / N,E,S,W / cw=右に向いて1歩 / center=中央へ / stay
// area: ring1 ring2 cross2 cross3 x3 far front line none
export const BOSSES = {
  slime: {
    name: "バグスライム", img: "slime", level: "かんたん", hpBase: 20, hpPer: 2, shuffle: true,
    text: "ぴょんぴょん はねる。まわり1マスに 気をつけよう",
    cards: [
      { name: "ぷるぷる 上へ", move: "N", steps: 1, area: "ring1" },
      { name: "ぷるぷる 右へ", move: "E", steps: 1, area: "ring1" },
      { name: "ぷるぷる 下へ", move: "S", steps: 1, area: "ring1" },
      { name: "ぷるぷる 左へ", move: "W", steps: 1, area: "ring1" },
      { name: "べちゃっ", move: "stay", steps: 0, area: "cross2", bug: 1 },
      { name: "べちゃっ", move: "stay", steps: 0, area: "cross2", bug: 1 },
      { name: "ぴょーん", move: "leader", steps: 2, area: "ring1" },
      { name: "ひとやすみ", move: "stay", steps: 0, area: "none" },
    ],
    rage: [
      { name: "バグ ばらまき", move: "stay", steps: 0, area: "ring2", bug: 1 },
      { name: "大ジャンプ", move: "leader", steps: 3, area: "ring1", power: 2 },
    ],
  },
  clock: {
    name: "時計ドラゴン", img: "clock", level: "ふつう", hpBase: 22, hpPer: 1, shuffle: false,
    text: "いつも同じ じゅんばんで動く。くり返しを 読みとれば よけられる！",
    cards: [
      { name: "チク", move: "cw", steps: 1, area: "front" },
      { name: "タク", move: "cw", steps: 0, area: "front" },
      { name: "チク", move: "cw", steps: 1, area: "front" },
      { name: "ゴーン", move: "stay", steps: 0, area: "ring2", bug: 1 },
    ],
    rage: [{ name: "12時の ベル", move: "center", steps: 2, area: "line", power: 2 }],
  },
  maou: {
    name: "まおうドラゴン", img: "maou", level: "むずかしい", hpBase: 26, hpPer: 2, shuffle: true,
    text: "いちばん ダメージを与えた人を ねらってくる。リードしすぎに 注意！",
    cards: [
      { name: "おいかける", move: "leader", steps: 1, area: "cross3" },
      { name: "にらみつける", move: "leader", steps: 1, area: "front" },
      { name: "ななめのツメ", move: "nearest", steps: 1, area: "x3" },
      { name: "つばさで ひとふり", move: "stay", steps: 0, area: "ring1", bug: 1 },
      { name: "とおくまで ほのお", move: "stay", steps: 0, area: "far" },
      { name: "ドラゴンダッシュ", move: "leader", steps: 2, area: "ring1", power: 2 },
    ],
    rage: [
      { name: "いかりの 十字ビーム", move: "center", steps: 3, area: "line", power: 2 },
      { name: "クリスタル ばくはつ", move: "leader", steps: 1, area: "ring2", power: 2, bug: 1 },
    ],
  },
};
export const AREA_LABEL = {
  ring1: "まわり 1マス", ring2: "まわり 2マス", cross2: "たて・よこ 2マス", cross3: "たて・よこ 3マス",
  x3: "ななめ 3マス", far: "3マス以上 はなれた所 ぜんぶ", front: "前の 3×3", line: "たて・よこ 1列ぜんぶ", none: "こうげき なし",
};
export const MOVE_LABEL = {
  leader: "トップの人へ", nearest: "いちばん近い人へ", N: "上へ", E: "右へ", S: "下へ", W: "左へ", cw: "右にまわって前へ", center: "中央へ", stay: "うごかない",
};

// ---------- 乱数（シード付き） ----------
function rngNext(state) {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(state, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rngNext(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const inBoard = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const manh = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// ---------- 開始 ----------
export function validateSetup(setup) {
  const errs = [];
  if (!setup || !Array.isArray(setup.players)) return ["プレイヤーの情報がありません"];
  const n = setup.players.length;
  if (n < 2 || n > 6) errs.push("プレイヤーは 2〜6人 です");
  const seen = new Set();
  setup.players.forEach((p, i) => {
    const name = typeof p.name === "string" ? p.name.trim() : "";
    if (!name) errs.push(`${i + 1}人目の なまえを 入れてください`);
    else if ([...name].length > MAX_NAME) errs.push(`${i + 1}人目の なまえは ${MAX_NAME}文字まで です`);
    if (!CHARS[p.char]) errs.push(`${i + 1}人目の キャラクターを えらんでください`);
    else if (seen.has(p.char)) errs.push("同じキャラクターは 1人だけ えらべます");
    seen.add(p.char);
  });
  if (!BOSSES[setup.boss]) errs.push("ボスを えらんでください");
  const r = setup.maxRounds;
  if (!Number.isInteger(r) || r < 3 || r > 12) errs.push("ラウンド数は 3〜12 です");
  return errs;
}

// 外周に、なるべく等間隔で並べる（中央を向く）
function startCells(n) {
  const ring = [];
  for (let x = 0; x < SIZE; x++) ring.push({ x, y: 0 });
  for (let y = 1; y < SIZE; y++) ring.push({ x: SIZE - 1, y });
  for (let x = SIZE - 2; x >= 0; x--) ring.push({ x, y: SIZE - 1 });
  for (let y = SIZE - 2; y >= 1; y--) ring.push({ x: 0, y });
  const out = [];
  for (let i = 0; i < n; i++) out.push(ring[(Math.round((i * ring.length) / n) + 3) % ring.length]);
  return out.map((c) => {
    const dx = 3 - c.x, dy = 3 - c.y;
    const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
    return { ...c, dir };
  });
}

// ボスのHP：みんなで力を合わせた合計ダメージに合わせる（ラウンド数に比例）
export const bossHp = (key, n, rounds) => Math.max(8, Math.round((BOSSES[key].hpBase + BOSSES[key].hpPer * n) * rounds / 6));

export function newGame(setup, seed = (Date.now() >>> 0)) {
  const errs = validateSetup(setup);
  if (errs.length) throw new Error(errs.join(" / "));
  const n = setup.players.length;
  const st = { v: VERSION, seed: seed >>> 0, rng: seed >>> 0, nextId: 1 };
  const card = (type) => ({ id: st.nextId++, type });
  const cells = startCells(n);
  st.players = setup.players.map((p, i) => ({
    name: p.name.trim(), char: p.char, ...cells[i], home: { ...cells[i] },
    hand: [], dmg: 0, bugsTaken: 0, shieldUsed: false, hp: PLAYER_HP, maxHp: PLAYER_HP, downs: 0,
    stats: { 順次: 0, くり返し: 0, 条件分岐: 0, 関数: 0, デバッグ: 0 },
  }));
  st.deck = [];
  for (const [t, c] of Object.entries(DECK_COUNTS)) for (let i = 0; i < c; i++) st.deck.push(card(t));
  shuffle(st, st.deck);
  // 最初の手札：山札からランダムに5まい（こうげき か もし〜こうげき が かならず1まい入る）
  for (const p of st.players) {
    const ai = st.deck.findIndex((c) => c.type === "atk" || c.type === "ifatk");
    p.hand.push(st.deck.splice(ai, 1)[0]);
    while (p.hand.length < handLimit(p)) p.hand.push(st.deck.shift());
  }
  st.discard = [];
  const B = BOSSES[setup.boss];
  const hp = bossHp(setup.boss, n, setup.maxRounds);
  st.boss = { key: setup.boss, x: 3, y: 3, dir: "S", hp, maxHp: hp, rage: false };
  st.bossDeck = clone(B.cards).map((c, i) => ({ ...c, id: "b" + i }));
  if (B.shuffle) shuffle(st, st.bossDeck);
  st.bossDiscard = [];
  st.round = 1; st.maxRounds = setup.maxRounds; st.turnIdx = 0;
  st.phase = "program"; st.turnDmg = 0; st.heroBonusUsed = false;
  st.log = [{ r: 1, t: `ボス「${B.name}」があらわれた！ HP ${hp}` }];
  st.winner = null; st.lastBoss = null;
  startTurn(st);
  return st;
}

// ---------- じゅんばん（行ったり来たり） ----------
export function roundOrder(st, round = st.round) {
  const idx = st.players.map((_, i) => i);
  return round % 2 === 1 ? idx : idx.reverse();
}
export const currentIndex = (st) => roundOrder(st)[st.turnIdx];
export const currentPlayer = (st) => st.players[currentIndex(st)];
export const slotCount = (p) => (p.char === "robo" ? 4 : 3);

function log(st, t) { st.log.push({ r: st.round, t }); if (st.log.length > 200) st.log.shift(); }

function startTurn(st) {
  st.phase = "program"; st.turnDmg = 0; st.heroBonusUsed = false;
  const p = currentPlayer(st);
  if (p.char === "rabbit") {
    const i = p.hand.findIndex((c) => c.type === "bug");
    if (i >= 0) p.hand.splice(i, 1);
    const healed = p.hp < p.maxHp; if (healed) p.hp++;
    if (i >= 0 || healed) log(st, `${p.name}：いやしの光${healed ? "で HP+1" : ""}${i >= 0 ? "・バグを 1まい けした" : ""}`);
  }
}

// ---------- ボスの予告 ----------
const occupied = (st, x, y, exceptP = -1) =>
  (st.boss.x === x && st.boss.y === y) || st.players.some((p, i) => i !== exceptP && p.x === x && p.y === y);

function targetPlayer(st, kind) {
  let best = null;
  st.players.forEach((p, i) => {
    const d = manh(p, st.boss);
    const key = kind === "leader" ? [-p.dmg, d, i] : [d, -p.dmg, i];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2]))))
      best = { i, key };
  });
  return best ? st.players[best.i] : null;
}

function stepToward(st, b, tgt, stopAdjacent) {
  const dx = tgt.x - b.x, dy = tgt.y - b.y;
  if (stopAdjacent && Math.abs(dx) + Math.abs(dy) <= 1) return null;
  if (dx === 0 && dy === 0) return null;
  const opts = [];
  const hx = dx > 0 ? "E" : "W", hy = dy > 0 ? "S" : "N";
  if (Math.abs(dx) >= Math.abs(dy)) { if (dx) opts.push(hx); if (dy) opts.push(hy); }
  else { if (dy) opts.push(hy); if (dx) opts.push(hx); }
  for (const d of opts) {
    const [vx, vy] = DIRS[d]; const nx = b.x + vx, ny = b.y + vy;
    if (inBoard(nx, ny) && !st.players.some((p) => p.x === nx && p.y === ny)) return d;
  }
  return null;
}

// ボスが card をつかったら、どこへ動き、どこを攻撃するか（状態は変えない）
export function planBoss(st, card) {
  const b = { x: st.boss.x, y: st.boss.y, dir: st.boss.dir };
  const tryMove = (d) => {
    const [vx, vy] = DIRS[d]; const nx = b.x + vx, ny = b.y + vy;
    if (inBoard(nx, ny) && !st.players.some((p) => p.x === nx && p.y === ny)) { b.x = nx; b.y = ny; b.dir = d; return true; }
    b.dir = d; return false;
  };
  const m = card.move;
  if (m === "leader" || m === "nearest") {
    const t = targetPlayer(st, m);
    for (let s = 0; s < card.steps && t; s++) { const d = stepToward(st, b, t, true); if (!d) break; tryMove(d); }
    if (t) { const dx = t.x - b.x, dy = t.y - b.y; b.dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "E" : "W") : dy > 0 ? "S" : "N"; }
  } else if (m === "center") {
    for (let s = 0; s < card.steps; s++) { const d = stepToward(st, b, { x: 3, y: 3 }, false); if (!d) break; tryMove(d); }
  } else if (m === "cw") {
    b.dir = turnRight(b.dir); for (let s = 0; s < card.steps; s++) if (!tryMove(b.dir)) break;
  } else if (DIRS[m]) {
    for (let s = 0; s < card.steps; s++) if (!tryMove(m)) break;
  }
  return { card, boss: b, cells: areaCells(b, card.area) };
}

export function areaCells(b, area) {
  const out = [];
  const [fx, fy] = DIRS[b.dir];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (x === b.x && y === b.y) continue;
    const dx = x - b.x, dy = y - b.y, c = Math.max(Math.abs(dx), Math.abs(dy));
    let hit = false;
    switch (area) {
      case "ring1": hit = c <= 1; break;
      case "ring2": hit = c <= 2; break;
      case "cross2": hit = (dx === 0 || dy === 0) && c <= 2; break;
      case "cross3": hit = (dx === 0 || dy === 0) && c <= 3; break;
      case "x3": hit = Math.abs(dx) === Math.abs(dy) && c <= 3; break;
      case "far": hit = c >= 3; break;
      case "line": hit = dx === 0 || dy === 0; break;
      case "front": { const fwd = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx); hit = fwd >= 1 && fwd <= 3 && side <= 1; break; }
      default: hit = false;
    }
    if (hit) out.push({ x, y });
  }
  return out;
}

export function nextBossCard(st) {
  if (!st.bossDeck.length) refillBossDeck(st);
  return st.bossDeck[0];
}
export function bossQueue(st, k = 3) {
  const q = st.bossDeck.slice(0, k);
  if (q.length < k && BOSSES[st.boss.key].shuffle === false) {
    const cyc = [...st.bossDeck, ...st.bossDiscard];
    while (q.length < k && cyc.length) q.push(cyc[(q.length) % cyc.length]);
  }
  return q;
}
function refillBossDeck(st) {
  st.bossDeck = st.bossDiscard; st.bossDiscard = [];
  if (BOSSES[st.boss.key].shuffle) shuffle(st, st.bossDeck);
}
export function predictBoss(st) { return planBoss(st, nextBossCard(st)); }
export const dangerCells = (st) => predictBoss(st).cells;

// ---------- プレイヤーのプログラム ----------
function snap(st, pi, line, text, extra = {}) {
  return { line, text, pi, players: st.players.map((p) => ({ x: p.x, y: p.y, dir: p.dir })), boss: { ...st.boss }, dmg: st.players.map((p) => p.dmg), ...extra };
}

function damageBoss(st, pi, amount, trace, line, why, fx = {}) {
  const p = st.players[pi];
  const d = Math.min(amount, st.boss.hp);
  if (d <= 0) return;
  p.dmg += d; st.boss.hp -= d; st.turnDmg += d;
  log(st, `${p.name}：${why} ボスに ${d}ダメージ！（ボスHP ${st.boss.hp}）`);
  trace.push(snap(st, pi, line, `${why} ${d}ダメージ！`, { hit: true, amount: d, fx: fx.type || "slash", ...fx }));
  if (!st.boss.rage && st.boss.hp > 0 && st.boss.hp <= st.boss.maxHp / 2) {
    enrage(st);
    trace.push(snap(st, pi, line, `${BOSSES[st.boss.key].name}が いかりモードに！`, { fx: "rage" }));
  }
}
function enrage(st) {
  st.boss.rage = true;
  const B = BOSSES[st.boss.key];
  const extra = clone(B.rage).map((c, i) => ({ ...c, id: "r" + i }));
  if (B.shuffle) { st.bossDeck.push(...extra); shuffle(st, st.bossDeck); }
  else st.bossDeck.push(...extra);
  log(st, `${B.name}が いかりモードに なった！ 新しい技が ふえた`);
}

function frontCells(st, p, range) {
  const [vx, vy] = DIRS[p.dir]; const out = [];
  for (let k = 1; k <= range; k++) { const x = p.x + vx * k, y = p.y + vy * k; if (!inBoard(x, y)) break; out.push({ x, y }); }
  return out;
}
const bossIn = (st, cells) => cells.some((c) => c.x === st.boss.x && c.y === st.boss.y);
function isBehindBoss(st, p) {
  const [fx, fy] = DIRS[st.boss.dir];
  const dx = p.x - st.boss.x, dy = p.y - st.boss.y;
  return dx * fx + dy * fy < 0 && dx * fy - dy * fx === 0; // ボスの向きの反対側・同じ列
}

function doAttack(st, pi, trace, line) {
  const p = st.players[pi];
  const range = p.char === "wizard" ? 2 : 1;
  if (bossIn(st, frontCells(st, p, range))) {
    let dmg = 3, why = "こうげき！"; const fx = { type: "slash", back: false, bonus: false };
    if (isBehindBoss(st, p)) { dmg += 1; why = "せなかに こうげき！"; fx.back = true; }
    if (p.char === "hero" && !st.heroBonusUsed) { dmg += 1; st.heroBonusUsed = true; why += "（ひらめき+1）"; fx.bonus = true; }
    damageBoss(st, pi, dmg, trace, line, why, fx);
    return true;
  }
  trace.push(snap(st, pi, line, "こうげき…でも 前に ボスがいない", { fx: "whiff" }));
  return false;
}

function moveForward(st, pi, n, trace, line) {
  const p = st.players[pi];
  const [vx, vy] = DIRS[p.dir];
  let moved = 0;
  for (let k = 0; k < n; k++) {
    const nx = p.x + vx, ny = p.y + vy;
    if (!inBoard(nx, ny)) { trace.push(snap(st, pi, line, "かべに ぶつかった！", { fx: "bump" })); return moved; }
    if (occupied(st, nx, ny, pi)) { trace.push(snap(st, pi, line, "ぶつかって 止まった！", { fx: "bump" })); return moved; }
    p.x = nx; p.y = ny; moved++;
    trace.push(snap(st, pi, line, `${moved}マス すすんだ`, { fx: "move" }));
  }
  return moved;
}

function flee(st, pi, trace, line) {
  const p = st.players[pi];
  const cells = dangerCells(st);
  if (!cells.some((c) => c.x === p.x && c.y === p.y)) { trace.push(snap(st, pi, line, "もし：あぶなくない → なにもしない", { fx: "if", ok: false })); return; }
  let best = null;
  for (const d of DIR_ORDER) {
    const [vx, vy] = DIRS[d]; const nx = p.x + vx, ny = p.y + vy;
    if (!inBoard(nx, ny) || occupied(st, nx, ny, pi)) continue;
    const safe = !cells.some((c) => c.x === nx && c.y === ny);
    const score = (safe ? 100 : 0) + cheb({ x: nx, y: ny }, st.boss) * 10 + manh({ x: nx, y: ny }, st.boss);
    if (!best || score > best.score) best = { d, nx, ny, score };
  }
  if (!best) { trace.push(snap(st, pi, line, "あぶない！…でも にげ道が ない", { fx: "if", ok: true })); return; }
  p.x = best.nx; p.y = best.ny;
  trace.push(snap(st, pi, line, "もし：あぶない！ → にげた", { fx: "flee" }));
}

function runOne(st, pi, card, line, trace, ctx) {
  const p = st.players[pi];
  if (ctx.steps++ > 40) return "stop";
  const def = CARDS[card.type];
  if (def && card.type !== "bug") p.stats[def.concept] = (p.stats[def.concept] || 0) + 1;
  const extra = p.char === "fox" ? 1 : 0;
  switch (card.type) {
    case "fwd1": moveForward(st, pi, 1 + extra, trace, line); break;
    case "fwd2": moveForward(st, pi, 2 + extra, trace, line); break;
    case "right": p.dir = turnRight(p.dir); trace.push(snap(st, pi, line, "右を むいた", { fx: "turn" })); break;
    case "left": p.dir = turnLeft(p.dir); trace.push(snap(st, pi, line, "左を むいた", { fx: "turn" })); break;
    case "back": p.dir = turnBack(p.dir); trace.push(snap(st, pi, line, "うしろを むいた", { fx: "turn" })); break;
    case "atk": doAttack(st, pi, trace, line); break;
    case "beam": {
      const cells = []; const [vx, vy] = DIRS[p.dir];
      for (let k = 1; k < SIZE; k++) {
        const x = p.x + vx * k, y = p.y + vy * k;
        if (!inBoard(x, y)) break;
        if (st.players.some((q) => q.x === x && q.y === y)) { trace.push(snap(st, pi, line, "ビーム…なかまに さえぎられた", { fx: "beam", to: { x, y }, miss: true })); return "ok"; }
        cells.push({ x, y });
        if (x === st.boss.x && y === st.boss.y) { damageBoss(st, pi, 2, trace, line, "ビーム！", { type: "beam", to: { x, y } }); return "ok"; }
      }
      const last = cells[cells.length - 1] || { x: p.x, y: p.y };
      trace.push(snap(st, pi, line, "ビーム…ボスに あたらなかった", { fx: "beam", to: last, miss: true }));
      break;
    }
    case "ifatk":
      if (bossIn(st, frontCells(st, p, p.char === "wizard" ? 2 : 1))) { trace.push(snap(st, pi, line, "もし：ボスが前に いる → こうげき", { fx: "if", ok: true })); doAttack(st, pi, trace, line); }
      else { trace.push(snap(st, pi, line, "もし：ボスが いない → まえへ", { fx: "if", ok: false })); moveForward(st, pi, 1 + extra, trace, line); }
      break;
    case "ifrun": flee(st, pi, trace, line); break;
    case "debug": {
      const n = p.hand.filter((c) => c.type === "bug").length;
      p.hand = p.hand.filter((c) => c.type !== "bug");
      const heal = p.hp < p.maxHp ? 1 : 0; p.hp += heal;
      trace.push(snap(st, pi, line, (n ? `デバッグ！ バグを ${n}まい けした` : "デバッグ！（バグは なかった）") + (heal ? "・HP+1" : ""), { fx: "debug", n, heal }));
      break;
    }
    case "bug":
      trace.push(snap(st, pi, line, "バグで プログラムが止まった！", { error: true, fx: "bug" }));
      log(st, `${p.name}：バグで プログラムが とちゅうで止まった`);
      return "stop";
    default: break;
  }
  return st.boss.hp <= 0 ? "stop" : "ok";
}

function runSeq(st, pi, cards, lines, trace, ctx) {
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (c.type === "loop") {
      const p = st.players[pi]; p.stats["くり返し"]++;
      const times = p.char === "beaver" ? 3 : 2;
      const next = cards[i + 1];
      if (!next) { trace.push(snap(st, pi, lines[i], "くりかえす…でも つぎのカードが ない")); continue; }
      if (next.type === "loop" || next.type === "func") { trace.push(snap(st, pi, lines[i], "くりかえすの中に 入れられない カードです")); continue; }
      for (let t = 0; t < times; t++) {
        trace.push(snap(st, pi, lines[i], `くりかえし ${t + 1}回目`, { fx: "loop", n: t + 1, of: times }));
        if (runOne(st, pi, next, lines[i + 1], trace, ctx) === "stop") return "stop";
      }
      i++;
    } else if (c.type === "func") {
      if (ctx.inFunc) { trace.push(snap(st, pi, lines[i], "関数の中では 関数を よべません")); continue; }
      st.players[pi].stats["関数"]++;
      trace.push(snap(st, pi, lines[i], "関数：1・2番目を もういちど", { fx: "func" }));
      const sub = cards.slice(0, Math.min(2, i)).filter((x) => x.type !== "func");
      const r = runSeq(st, pi, sub, lines.slice(0, sub.length), trace, { ...ctx, inFunc: true, steps: ctx.steps });
      if (r === "stop") return "stop";
    } else if (runOne(st, pi, c, lines[i], trace, ctx) === "stop") return "stop";
  }
  return "ok";
}

// ids：手札からえらんだカードの id（順番がプログラムの順番）
export function runProgram(state, ids) {
  const st = clone(state);
  if (st.phase !== "program") throw new Error("いまは プログラムの時間では ありません");
  const pi = currentIndex(st), p = st.players[pi];
  if (!Array.isArray(ids) || ids.length > slotCount(p)) throw new Error("プログラム枠より 多い カードです");
  if (new Set(ids).size !== ids.length) throw new Error("同じカードは 1回だけ 使えます");
  const prog = ids.map((id) => { const c = p.hand.find((h) => h.id === id); if (!c) throw new Error("手札にない カードです"); return c; });
  p.hand = p.hand.filter((h) => !ids.includes(h.id));
  const trace = [snap(st, pi, -1, ids.length ? "プログラム スタート！" : "なにもしない")];
  runSeq(st, pi, prog, prog.map((_, i) => i), trace, { steps: 0, inFunc: false });
  for (const c of prog) if (c.type !== "bug") st.discard.push(c);
  if (st.turnDmg === 0 && ids.length) log(st, `${p.name}：ダメージは 0 だった`);
  let drawn = [];
  if (st.boss.hp <= 0) finish(st, pi);
  else { drawn = drawCards(st, p); st.phase = "boss"; }
  return { state: st, trace, drawn };
}

// ---------- カードを引く（山札からランダム） ----------
export const handLimit = (p) => (p.char === "owl" ? HAND_MAX + 1 : HAND_MAX);
function drawCards(st, p) {
  const drawn = [];
  while (p.hand.length < handLimit(p)) {
    if (!st.deck.length) {
      if (!st.discard.length) break;
      st.deck = shuffle(st, st.discard); st.discard = []; log(st, "山札を まぜなおした");
    }
    const c = st.deck.shift(); p.hand.push(c); drawn.push(c.id);
  }
  if (drawn.length) log(st, `${p.name}：カードを ${drawn.length}まい 引いた`);
  return drawn;
}

// ---------- ボスのばん ----------
export function bossAct(state) {
  const st = clone(state);
  if (st.phase !== "boss") throw new Error("いまは ボスのばんでは ありません");
  const card = nextBossCard(st);
  const plan = planBoss(st, card);
  st.bossDeck.shift(); st.bossDiscard.push(card);
  if (BOSSES[st.boss.key].shuffle === false && !st.bossDeck.length) refillBossDeck(st);
  const before = { x: st.boss.x, y: st.boss.y };
  st.boss.x = plan.boss.x; st.boss.y = plan.boss.y; st.boss.dir = plan.boss.dir;
  const hits = [];
  st.players.forEach((p, i) => {
    if (!plan.cells.some((c) => c.x === p.x && c.y === p.y)) return;
    if (p.char === "turtle" && !p.shieldUsed) { p.shieldUsed = true; hits.push({ i, shield: true }); log(st, `${p.name}：まもりの盾で ふせいだ！`); return; }
    const power = card.power || 1;
    p.hp = Math.max(0, p.hp - power);
    const have = p.hand.filter((c) => c.type === "bug").length;
    const nb = Math.max(0, Math.min(card.bug || 0, BUG_MAX - have));
    for (let k = 0; k < nb; k++) p.hand.push({ id: st.nextId++, type: "bug" });
    p.bugsTaken += nb;
    if (p.hp <= 0) {
      const lost = Math.min(DOWN_PENALTY, p.dmg);
      p.dmg -= lost; p.downs++; p.hp = p.maxHp;
      const home = freeCellNear(st, p.home, i);
      p.x = home.x; p.y = home.y; p.dir = p.home.dir;
      hits.push({ i, power, bugs: nb, down: true, lost });
      log(st, `${p.name}：ボスの「${card.name}」で ダウン！ 点数 −${lost}、スタート地点で HP回復`);
      return;
    }
    // ボスから はなれる方向へ 1マス ふきとぶ
    const dx = Math.sign(p.x - st.boss.x), dy = Math.sign(p.y - st.boss.y);
    const tries = Math.abs(p.x - st.boss.x) >= Math.abs(p.y - st.boss.y) ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
    for (const [vx, vy] of tries) {
      if (!vx && !vy) continue;
      const nx = p.x + vx, ny = p.y + vy;
      if (inBoard(nx, ny) && !occupied(st, nx, ny, i)) { p.x = nx; p.y = ny; break; }
    }
    hits.push({ i, power, bugs: nb });
    log(st, `${p.name}：ボスの「${card.name}」をうけて HP −${power}${nb ? `・バグ +${nb}` : ""}（のこり ${p.hp}）`);
  });
  if (!hits.length) log(st, `ボスの「${card.name}」… だれにも 当たらなかった`);
  st.lastBoss = { card, from: before, to: { x: st.boss.x, y: st.boss.y }, cells: plan.cells, hits };
  advance(st);
  return st;
}

function freeCellNear(st, c, self) {
  let best = null;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (occupied(st, x, y, self)) continue;
    const d = Math.abs(x - c.x) + Math.abs(y - c.y);
    if (!best || d < best.d) best = { x, y, d };
  }
  return best || c;
}

function advance(st) {
  st.turnIdx++;
  if (st.turnIdx >= st.players.length) {
    st.turnIdx = 0; st.round++;
    st.players.forEach((p) => (p.shieldUsed = false));
    if (st.round > st.maxRounds) { finish(st, -1); return; }
    log(st, `ラウンド ${st.round}（じゅんばんが ぎゃくに なる）`);
  }
  startTurn(st);
}

function finish(st, finisher) {
  st.phase = "end";
  if (finisher >= 0) {
    st.players[finisher].dmg += 2; st.players[finisher].finisher = true;
    log(st, `${st.players[finisher].name}：とどめの一撃！ ボーナス +2`);
  } else log(st, "ボスは にげてしまった…（ラウンド おわり）");
  st.winner = ranking(st)[0].i;
}

export function ranking(st) {
  return st.players.map((p, i) => ({ i, dmg: p.dmg, hp: p.hp, downs: p.downs, bugs: p.bugsTaken }))
    .sort((a, b) => b.dmg - a.dmg || a.downs - b.downs || b.hp - a.hp || a.bugs - b.bugs || a.i - b.i);
}

// ---------- 保存データの検証（localStorage からの読み込み時） ----------
export function isValidState(s) {
  try {
    if (!s || s.v !== VERSION || !Array.isArray(s.players) || s.players.length < 2 || s.players.length > 6) return false;
    if (!BOSSES[s.boss?.key] || !Number.isInteger(s.boss.hp)) return false;
    if (!["program", "boss", "end"].includes(s.phase)) return false;
    const okCard = (c) => c && Number.isInteger(c.id) && CARDS[c.type];
    for (const p of s.players) {
      if (typeof p.name !== "string" || [...p.name].length > MAX_NAME || !CHARS[p.char]) return false;
      if (!Number.isInteger(p.hp) || p.hp < 0 || p.hp > 9 || !Number.isInteger(p.downs)) return false;
      if (!inBoard(p.x, p.y) || !DIRS[p.dir] || !Array.isArray(p.hand) || !p.hand.every(okCard) || p.hand.length > 30) return false;
    }
    if (![s.deck, s.discard].every((a) => Array.isArray(a) && a.every(okCard))) return false;
    if (!Array.isArray(s.bossDeck) || !Array.isArray(s.bossDiscard)) return false;
    return Number.isInteger(s.round) && Number.isInteger(s.turnIdx) && s.turnIdx < s.players.length;
  } catch { return false; }
}
