// クリエット・コードバトル 画面の動き（DOMは textContent / createElement だけで組み立てる：XSS対策）
import * as E from "./engine.js";
import * as S from "./audio.js";

const SAVE_KEY = "creatte-code-battle-v2";
const PCOL = ["--p0", "--p1", "--p2", "--p3", "--p4", "--p5"];
const pcol = (i) => `var(${PCOL[i % 6]})`;
const $ = (s) => document.querySelector(s);
const REDUCED = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, REDUCED ? Math.min(ms, 150) : ms));

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const img = (key, alt = "") => h("img", { src: `assets/${key}.webp`, alt, decoding: "async", draggable: "false" });

// ---------- 保存（同じブラウザだけ。読みこみ時は中身を検証） ----------
function save() { try { if (game) localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* 保存できなくても遊べる */ } }
function loadSaved() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); return s && E.isValidState(s) && s.phase === "program" ? s : null; }
  catch { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* なし */ } }

// ---------- 状態 ----------
let game = null, prog = [], busy = false, showDanger = true;
let runLine = -1, runErr = false, runText = "", newCards = new Set();
const draft = { count: 3, players: [], boss: "clock", rounds: 6 };
const DEFAULT_CHARS = ["hero", "wizard", "robo", "fox", "beaver", "owl"];
for (let i = 0; i < 6; i++) draft.players.push({ name: "", char: DEFAULT_CHARS[i] });

function show(id) {
  for (const s of ["setup", "game", "result"]) $("#" + s).hidden = s !== id;
  $("#btnMenu").hidden = id === "setup";
  window.scrollTo({ top: 0 });
}

// ---------- 設定画面 ----------
function renderSetup() {
  const seg = $("#segCount"); seg.replaceChildren();
  for (let n = 2; n <= 6; n++) seg.append(h("button", { type: "button", role: "radio", "aria-checked": String(draft.count === n), onclick: () => { draft.count = n; renderSetup(); } }, `${n}人`));
  const rows = $("#playerRows"); rows.replaceChildren();
  const used = new Set(draft.players.slice(0, draft.count).map((p) => p.char));
  for (let i = 0; i < draft.count; i++) {
    const p = draft.players[i];
    const input = h("input", { type: "text", maxlength: String(E.MAX_NAME), placeholder: `プレイヤー${i + 1}`, value: p.name, "aria-label": `${i + 1}人目のなまえ`, autocomplete: "off" });
    input.addEventListener("input", () => { p.name = input.value.slice(0, E.MAX_NAME); });
    const chars = h("div", { class: "chars", role: "radiogroup", "aria-label": `${i + 1}人目のキャラクター` });
    for (const [k, c] of Object.entries(E.CHARS)) {
      chars.append(h("button", { type: "button", class: "pick", role: "radio", "aria-checked": String(p.char === k), disabled: p.char !== k && used.has(k), title: `${c.name}：${c.text}`,
        onclick: () => { p.char = k; renderSetup(); } }, img(c.img), h("span", { text: c.name })));
    }
    const cc = E.CHARS[p.char];
    rows.append(h("div", { class: "prow" }, h("div", { class: "pnum", style: { background: pcol(i) }, text: String(i + 1) }), input, chars,
      h("div", { class: "skillnote", text: cc ? `とくいわざ「${cc.skill}」：${cc.text}` : "" })));
  }
  const bp = $("#bossPick"); bp.replaceChildren();
  for (const [k, b] of Object.entries(E.BOSSES)) {
    bp.append(h("button", { type: "button", class: "pick", role: "radio", "aria-checked": String(draft.boss === k), onclick: () => { draft.boss = k; renderSetup(); } },
      img(b.img), h("div", {}, h("b", {}, b.name, " ", h("span", { class: "lv", text: b.level })), h("span", { text: b.text }))));
  }
  const sr = $("#segRounds"); sr.replaceChildren();
  for (const r of [4, 5, 6, 8, 10]) sr.append(h("button", { type: "button", role: "radio", "aria-checked": String(draft.rounds === r), onclick: () => { draft.rounds = r; renderSetup(); } }, `${r}`));
  const min = Math.round(draft.count * draft.rounds * 1.0);
  $("#roundNote").textContent = `1人が ${draft.rounds}回ずつ 動きます（全部で ${draft.count * draft.rounds}ターン・およそ ${min}〜${min * 2}分）。ボスのHP：${E.bossHp(draft.boss, draft.count, draft.rounds)}`;
  $("#btnResume").hidden = !loadSaved();
}

function startGame() {
  const setup = { players: draft.players.slice(0, draft.count).map((p, i) => ({ name: (p.name || "").trim() || `プレイヤー${i + 1}`, char: p.char })), boss: draft.boss, maxRounds: draft.rounds };
  const errs = E.validateSetup(setup);
  $("#setupErr").textContent = errs.join(" ／ ");
  if (errs.length) return;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  game = E.newGame(setup, seed);
  prog = []; newCards = new Set(); save(); show("game"); buildBoard(); renderGame();
  S.unlock(); S.music("battle");
  turnIntro(false, true);
}

// ======================================================================
// 盤面（マス・コマ・エフェクトは それぞれ別の層。コマは動かすだけなので なめらかに移動する）
// ======================================================================
let cells = [], tokP = [], tokBoss = null, tokGhost = null, fxLayer = null, pathLayer = null, bannerEl = null;
const DEG = { N: 0, E: 90, S: 180, W: 270 };

function buildBoard() {
  const board = $("#board"); board.replaceChildren(); cells = [];
  for (let y = 0; y < E.SIZE; y++) for (let x = 0; x < E.SIZE; x++) {
    const c = h("div", { class: "cell" + ((x + y) % 2 ? " alt" : ""), role: "gridcell", "data-x": x, "data-y": y, "aria-label": `${x + 1}列 ${y + 1}行` });
    cells.push(c); board.append(c);
  }
  pathLayer = h("div", { class: "layer path" });
  const tl = h("div", { class: "layer toks" });
  tokGhost = makeTok("ghost", "hero", ""); tokGhost.el.hidden = true; tl.append(tokGhost.el);
  tokP = game.players.map((p, i) => { const t = makeTok("player", E.CHARS[p.char].img, p.name, pcol(i)); tl.append(t.el); return t; });
  tokBoss = makeTok("boss", E.BOSSES[game.boss.key].img, ""); tl.append(tokBoss.el);
  fxLayer = h("div", { class: "layer fx" });
  bannerEl = h("div", { class: "banner", "aria-live": "polite" });
  board.append(pathLayer, tl, fxLayer, bannerEl);
}
function makeTok(kind, imgKey, name, color) {
  const dirw = h("div", { class: "dirw" }, h("span", { class: "arrow", text: "▲" }));
  const body = h("div", { class: "body" }, img(imgKey, name));
  const hpb = kind === "player" ? h("span", { class: "tokhp" }, h("i")) : null;
  const el = h("div", { class: "tok " + kind, style: color ? { "--pc": color } : null }, body, dirw, hpb, name ? h("span", { class: "tag", text: name }) : null);
  return { el, body, dirw, hpb, deg: 0, dir: "N", x: -1, y: -1, imgKey };
}
function placeTok(t, x, y, dir) {
  t.el.style.setProperty("--x", x); t.el.style.setProperty("--y", y);
  if (dir && dir !== t.dir) {
    let d = DEG[dir] - (t.deg % 360 + 360) % 360; if (d > 180) d -= 360; if (d < -180) d += 360;
    t.deg += d; t.dir = dir;
  }
  t.dirw.style.setProperty("--rot", t.deg + "deg");
  t.x = x; t.y = y;
}
const cellAt = (x, y) => cells[y * E.SIZE + x];
function center(x, y) { // 小数（マスとマスの間）にも対応
  const c0 = cells[0], w = c0.offsetWidth, step = cells[1].offsetLeft - c0.offsetLeft;
  return { x: c0.offsetLeft + w / 2 + x * step, y: c0.offsetTop + w / 2 + y * step, w };
}

function previewState() {
  if (!game || game.phase !== "program" || !prog.length) return null;
  try { return E.runProgram(game, prog); } catch { return null; }
}

function drawBoard(view, pv) {
  if (!cells.length) buildBoard();
  const st = game;
  const players = view?.players || st.players;
  const boss = view?.boss || st.boss;
  const me = E.currentIndex(st);
  let danger = [];
  if (view?.cells) danger = view.cells;
  else if (showDanger && st.phase !== "end") { try { danger = E.dangerCells(pv?.state && pv.state.phase !== "end" ? pv.state : st); } catch { danger = []; } }
  const dk = new Set(danger.map((c) => c.x + "," + c.y));
  cells.forEach((c, k) => c.classList.toggle("danger", dk.has((k % E.SIZE) + "," + Math.floor(k / E.SIZE))));
  const hpSrc = view?.hpFrom || st.players;
  players.forEach((q, i) => {
    placeTok(tokP[i], q.x, q.y, q.dir); tokP[i].el.classList.toggle("me", i === me && st.phase !== "end");
    const P = hpSrc[i]; tokP[i].hpb.firstChild.style.setProperty("width", Math.round((P.hp / P.maxHp) * 100) + "%");
    tokP[i].hpb.classList.toggle("low", P.hp <= 2);
  });
  placeTok(tokBoss, boss.x, boss.y, boss.dir);
  tokBoss.el.classList.toggle("rage", !!st.boss.rage);
  // よそう（動いた後の位置と通り道）
  pathLayer.replaceChildren();
  if (pv && !view) {
    const g = pv.state.players[me], cur = st.players[me];
    const seen = new Set();
    for (const f of pv.trace) { const q = f.players[me]; const k = q.x + "," + q.y; if (seen.has(k) || (q.x === g.x && q.y === g.y)) continue; seen.add(k); pathLayer.append(h("i", { class: "pathdot", style: { "--x": q.x, "--y": q.y } })); }
    const same = g.x === cur.x && g.y === cur.y && g.dir === cur.dir;
    tokGhost.el.hidden = same;
    if (!same) {
      if (tokGhost.imgKey !== E.CHARS[cur.char].img) { tokGhost.body.replaceChildren(img(E.CHARS[cur.char].img)); tokGhost.imgKey = E.CHARS[cur.char].img; }
      tokGhost.el.style.setProperty("--pc", pcol(me)); placeTok(tokGhost, g.x, g.y, g.dir);
    }
  } else tokGhost.el.hidden = true;
}

// ---------- エフェクト ----------
function fx(cls, x, y, extra = {}, life = 900) {
  const c = center(x, y);
  const el = h("div", { class: "fxi " + cls, style: { left: c.x + "px", top: c.y + "px", "--w": c.w + "px", ...extra.style } }, ...(extra.kids || []));
  if (extra.text) el.textContent = extra.text;
  fxLayer.append(el); setTimeout(() => el.remove(), REDUCED ? 300 : life);
  return el;
}
function sparks(x, y, color = "#ffd84a", n = 10, spread = 1) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, r = (40 + Math.random() * 40) * spread;
    fx("spark", x, y, { style: { "--dx": Math.cos(a) * r + "px", "--dy": Math.sin(a) * r + "px", "--c": color } }, 700);
  }
}
function pop(x, y, text, cls = "") { fx("pop " + cls, x, y, { text }, 1200); }
function bump(el, cls, ms = 450) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }
function banner(text, cls = "") { bannerEl.textContent = text; bannerEl.className = "banner show " + cls; clearTimeout(bannerEl._t); bannerEl._t = setTimeout(() => { bannerEl.className = "banner"; }, 1300); }
function beamFx(from, to, cls = "") {
  const a = center(from.x, from.y), b = center(to.x, to.y);
  const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
  const el = h("div", { class: "beam " + cls, style: { left: a.x + "px", top: a.y + "px", width: len + "px", transform: `rotate(${ang}rad)` } });
  fxLayer.append(el); setTimeout(() => el.remove(), REDUCED ? 300 : 700);
}

// プログラム実行の1コマに合わせたエフェクト
const FX_SOUND = { move: "move", bump: "bump", turn: "turn", whiff: "whiff", beam: "beam", loop: "loop", if: "if", func: "func", flee: "flee", debug: "debug", bug: "bug", rage: "rage" };
function playFrame(f, prev) {
  const me = f.pi, p = f.players[me], t = tokP[me];
  if (f.fx === "slash") { S.sfx("slash", 0.12); S.sfx("hit", 0.3); }
  else if (FX_SOUND[f.fx]) S.sfx(FX_SOUND[f.fx]);
  if (f.fx === "beam" && !f.miss) S.sfx("hit", 0.35);
  if (f.fx === "debug" && f.heal) S.sfx("heal", 0.3);
  if (f.fx === "rage") S.music("rage");
  switch (f.fx) {
    case "move": bump(t.el, "hop", 350); break;
    case "bump": bump(t.el, "shake"); fx("bonk", p.x, p.y, { text: "ゴツン" }, 700); break;
    case "turn": fx("turnfx", p.x, p.y, {}, 500); break;
    case "slash": {
      bump(t.el, "lunge-" + p.dir, 420);
      setTimeout(() => {
        fx("slash", f.boss.x, f.boss.y, {}, 600); fx("slash s2", f.boss.x, f.boss.y, {}, 600);
        sparks(f.boss.x, f.boss.y, f.back ? "#ff7ad9" : "#ffd84a", 12);
        bump(tokBoss.el, "hurt", 500); bump($("#board"), "quake", 400);
        pop(f.boss.x, f.boss.y, "-" + f.amount, "dmg");
        if (f.back) fx("label", f.boss.x, f.boss.y, { text: "せなか！" }, 900);
        if (f.bonus) fx("label gold", p.x, p.y, { text: "ひらめき！" }, 900);
        bumpHp();
      }, 160);
      break;
    }
    case "whiff": bump(t.el, "lunge-" + p.dir, 420); fx("whiff", p.x + E.DIRS[p.dir][0] * 0.6, p.y + E.DIRS[p.dir][1] * 0.6, { text: "スカッ" }, 700); break;
    case "beam":
      fx("charge", p.x, p.y, {}, 500);
      setTimeout(() => {
        beamFx(p, f.to, f.miss ? "miss" : "");
        if (!f.miss) { sparks(f.to.x, f.to.y, "#7fe8ff", 12); bump(tokBoss.el, "hurt", 500); pop(f.to.x, f.to.y, "-" + f.amount, "dmg"); bumpHp(); }
      }, 220);
      break;
    case "loop": fx("badge loop", p.x, p.y, { text: `🔁 ${f.n}/${f.of}` }, 700); break;
    case "if": fx("badge if", p.x, p.y, { text: f.ok ? "? → はい！" : "? → いいえ" }, 800); break;
    case "func": fx("ringfx func", p.x, p.y, {}, 700); fx("badge func", p.x, p.y, { text: "ƒ よびだし" }, 800); break;
    case "flee": fx("badge if", p.x, p.y, { text: "にげろ！" }, 700); if (prev) fx("dust", prev.players[me].x, prev.players[me].y, {}, 600); break;
    case "debug": fx("ringfx debug", p.x, p.y, {}, 800); fx("badge debug", p.x, p.y, { text: f.n ? `🔧 バグ−${f.n}` : "🔧 OK" }, 900); sparks(p.x, p.y, "#5ef0e0", 10); break;
    case "bug": bump(t.el, "glitch", 900); fx("error", p.x, p.y, { text: "ERROR!" }, 1100); bump($("#board"), "errflash", 600); break;
    case "rage": banner("いかりモード！ 新しい技が ふえた", "rage"); bump($("#board"), "ragepulse", 1200); break;
    default: break;
  }
}
function bumpHp() { const b = $("#bossPanel .hpbar"); if (b) bump(b, "shake"); }

// ボスの攻撃エフェクト（範囲の形ごとに ちがう）
async function bossFx(lb, after) {
  const area = lb.card.area, b = lb.to;
  bump(tokBoss.el, "charge", 600); fx("ringfx boss", b.x, b.y, {}, 700); S.sfx("charge");
  await wait(450);
  S.sfx(area === "far" ? "fire" : ["line", "cross2", "cross3", "x3"].includes(area) ? "zap" : area === "none" ? "nohit" : "boom");
  if (area === "ring1" || area === "ring2") fx("shock " + area, b.x, b.y, {}, 900);
  else if (area === "line" || area === "cross2" || area === "cross3") {
    const r = area === "line" ? 6 : area === "cross2" ? 2 : 3;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = Math.max(0, Math.min(6, b.x + dx * r)), ty = Math.max(0, Math.min(6, b.y + dy * r));
      if (tx !== b.x || ty !== b.y) beamFx(b, { x: tx, y: ty }, "boss");
    }
  } else if (area === "x3") {
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      let k = 3; while (k > 0 && (b.x + dx * k < 0 || b.x + dx * k > 6 || b.y + dy * k < 0 || b.y + dy * k > 6)) k--;
      if (k > 0) beamFx(b, { x: b.x + dx * k, y: b.y + dy * k }, "boss claw");
    }
  } else if (area === "front") {
    const [fx_, fy] = E.DIRS[lb.to.dir || after.boss.dir];
    fx("wave", b.x + fx_ * 2, b.y + fy * 2, { style: { "--rot": `${DEG[after.boss.dir]}deg` } }, 900);
  }
  lb.cells.forEach((c, i) => {
    const d = Math.max(Math.abs(c.x - b.x), Math.abs(c.y - b.y));
    setTimeout(() => { const el = cellAt(c.x, c.y); bump(el, "zap", 600); if (area === "far") fx("meteor", c.x, c.y, {}, 800); }, (REDUCED ? 0 : 60) * (area === "far" ? i % 7 : d));
  });
  if (lb.cells.length) bump($("#board"), "quake", 500);
}

// ======================================================================
// 画面の各パネル
// ======================================================================
function renderGame(view) {
  const st = view?.state || game;
  const pv = view ? null : previewState();
  const pi = E.currentIndex(game);
  document.documentElement.style.setProperty("--pc", pcol(pi));
  renderTop();
  drawBoard(view ? { players: view.frame?.players || game.players, boss: view.frame?.boss || game.boss, cells: view.cells, hpFrom: view.state?.players } : null, pv);
  renderBoss(st); renderTurn(); renderSteps(); renderProg(pv); renderHand(); renderPlayers(st); renderLog();
}

function renderTop() {
  const p = E.currentPlayer(game);
  $("#topinfo").textContent = game.phase === "end" ? "ゲーム終了" : `ラウンド ${Math.min(game.round, game.maxRounds)} / ${game.maxRounds}　・　${p.name} の ばん`;
}

function bossCardEl(c, now) {
  return h("div", { class: "bcard" + (now ? " now" : "") }, h("b", { text: (now ? "つぎ：" : "") + c.name }), h("small", { text: "うごき：" + E.MOVE_LABEL[c.move] + (c.steps > 1 ? ` ${c.steps}マス` : "") }), h("small", { text: "こうげき：" + E.AREA_LABEL[c.area] }), c.area === "none" ? null : h("small", { class: "pw", text: `❤−${c.power || 1}${c.bug ? "・🐛バグ" : ""}` }));
}
function renderBoss(st) {
  const b = E.BOSSES[st.boss.key]; const box = $("#bossPanel"); box.replaceChildren();
  const pct = Math.max(0, Math.round((st.boss.hp / st.boss.maxHp) * 100));
  const q = st.phase === "end" ? [] : E.bossQueue(st, 3);
  box.append(img(b.img, b.name), h("div", {},
    h("b", {}, b.name, st.boss.rage ? h("span", { class: "rage", text: "いかりモード" }) : null),
    h("div", { class: "hpbar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(st.boss.maxHp), "aria-valuenow": String(st.boss.hp), "aria-label": "ボスのHP" }, h("i", { style: { width: pct + "%" } }), h("span", { text: `HP ${st.boss.hp} / ${st.boss.maxHp}` })),
    h("div", { class: "hint", text: "ボスカード（みんなに見えている予告）：赤いマスが つぎの攻撃範囲" }),
    h("div", { class: "bq" }, q.map((c, i) => bossCardEl(c, i === 0)))));
}

function renderTurn() {
  const box = $("#turnPanel"); box.replaceChildren();
  if (game.phase === "end") return;
  const pi = E.currentIndex(game), p = game.players[pi], c = E.CHARS[p.char];
  const order = E.roundOrder(game);
  const ord = h("div", { class: "order" }, h("small", { text: `ラウンド${game.round}：` }),
    order.map((idx, k) => h("span", { class: k === game.turnIdx ? "now" : k < game.turnIdx ? "done" : "", style: k === game.turnIdx ? { "--pc": pcol(idx) } : null, text: game.players[idx].name })),
    h("small", { text: game.round < game.maxRounds ? "→ つぎは ぎゃく順" : "（さいご）" }));
  box.style.setProperty("--pc", pcol(pi));
  box.append(img(c.img, c.name), h("div", {}, h("b", { text: p.name + " の ばん" }), hearts(p), h("div", { class: "skill", text: `${c.name}｜とくいわざ「${c.skill}」${c.text}` }), ord));
}

function renderSteps() {
  const bar = $("#stepbar"); bar.replaceChildren();
  if (game.phase === "end") return;
  const step = busy ? (game.phase === "boss" ? 3 : 2) : game.phase === "program" ? 1 : 3;
  const items = [["カードを えらぶ", "手札を タップ"], ["実行 ▶", "キャラが動く"], ["ボスのばん", "じどうで動く"]];
  items.forEach(([t, s], i) => bar.append(h("li", { class: i + 1 === step ? "now" : i + 1 < step ? "done" : "" }, h("b", { text: `${"①②③"[i]} ${t}` }), h("small", { text: s }))));
  const msg = runText || (game.phase === "program" ? (prog.length ? "これで よければ「実行▶」！ 入れかえたい時は 枠のカードを タップ" : "手札の カードを タップして、プログラム枠に ならべよう") : "");
  bar.append(h("li", { class: "say", "aria-live": "polite", text: msg }));
}

function cardEl(c, opts = {}) {
  const d = E.CARDS[c.type];
  return h(opts.tag || "button", { type: "button", class: "card" + (c.type === "bug" ? " bug" : "") + (opts.cls ? " " + opts.cls : ""), style: { "--cc": `var(--c-${d.concept})`, ...(opts.style || {}) },
    disabled: opts.disabled, onclick: opts.onclick, title: d.text, "aria-label": `${d.name}：${d.text}` },
    h("span", { class: "ic", text: d.icon }), h("span", {}, h("b", { text: d.name }), opts.mini ? null : h("small", { text: d.text })),
    opts.mini ? null : h("span", { class: "cpt", text: d.concept }));
}

function renderProg(pv) {
  const box = $("#progPanel"); box.replaceChildren();
  if (game.phase === "end") return;
  const p = E.currentPlayer(game), n = E.slotCount(p);
  const byId = new Map(p.hand.map((c) => [c.id, c]));
  const code = h("div", { class: "code" });
  for (let i = 0; i < n; i++) {
    const c = byId.get(prog[i]) || progCache.get(prog[i]);
    code.append(h("div", { class: "slot" + (runLine === i ? (runErr ? " err" : " run") : "") }, h("span", { class: "ln", text: String(i + 1) }),
      c ? cardEl(c, { disabled: busy || game.phase !== "program", onclick: () => { prog.splice(i, 1); S.sfx("unselect"); renderGame(); } }) : h("div", { class: "empty", text: i === prog.length ? "↓ 手札から えらんでね" : "" })));
  }
  box.append(h("h2", { text: `プログラム（${n}まいまで）` }), code);
  if (pv) {
    const me = E.currentIndex(game);
    const d = pv.state.players[me].dmg - game.players[me].dmg;
    const danger = pv.state.phase !== "end" && E.dangerCells(pv.state).some((c) => c.x === pv.state.players[me].x && c.y === pv.state.players[me].y);
    box.append(h("div", { class: "predict" + (d > 0 ? " good" : "") }, h("b", { text: d > 0 ? `⚔ ${d}ダメージ よそう！` : "ダメージは 0 のよそう" }), h("span", { text: danger ? "　⚠ 動いた後、ボスの攻撃範囲に 入るよ" : "　✓ 動いた後は 安全" })));
  }
  box.append(h("div", { class: "row", style: { "margin-top": "10px" } },
    h("button", { type: "button", class: "btn primary big" + (prog.length && !busy ? " pulse" : ""), disabled: busy || game.phase !== "program", onclick: onRun, text: prog.length ? "② 実行 ▶" : "なにもしないで おわる ▶" }),
    h("button", { type: "button", class: "btn", disabled: busy || !prog.length || game.phase !== "program", onclick: () => { prog = []; renderGame(); }, text: "やりなおす" })));
}
const progCache = new Map();

function renderHand() {
  const box = $("#handPanel"); box.replaceChildren();
  if (game.phase === "end") return;
  const p = E.currentPlayer(game), n = E.slotCount(p);
  const list = h("div", { class: "cards" });
  let k = 0;
  for (const c of p.hand) {
    const used = prog.includes(c.id);
    const isNew = newCards.has(c.id);
    list.append(cardEl(c, {
      disabled: busy || used || prog.length >= n || game.phase !== "program",
      onclick: () => { progCache.set(c.id, c); prog.push(c.id); S.sfx("select"); renderGame(); },
      cls: (used ? "sel" : "") + (isNew ? " drawn" : ""), style: isNew ? { "--d": (k++ * 120) + "ms" } : null,
    }));
  }
  const bugs = p.hand.filter((c) => c.type === "bug").length;
  box.append(h("h2", { text: `${p.name} の手札（${p.hand.length}まい）` }),
    h("p", { class: "hint", text: bugs ? `🐛 バグが ${bugs}まい。デバッグで けすか、プログラムの さいごに 入れよう（バグのあとは 動かない）` : "使ったカードの分だけ、山札から ランダムに 新しいカードが 来ます" }), list);
}

function renderPlayers(st) {
  const box = $("#playersPanel"); box.replaceChildren();
  const me = E.currentIndex(game);
  st.players.forEach((p, i) => {
    const c = E.CHARS[p.char];
    box.append(h("div", { class: "pl" + (i === me && game.phase !== "end" ? " now" : ""), style: { "--pc": pcol(i) } },
      h("div", { class: "ph" }, img(c.img, c.name), h("div", {}, h("b", { text: p.name }), h("div", { class: "hint", text: `${c.skill}：${c.text}` })),
        h("div", { class: "score" }, String(p.dmg), h("small", { text: "ダメージ" }))),
      hearts(p),
      h("div", { class: "hint", text: `ダウン ${p.downs}回・うけたバグ ${p.bugsTaken}${p.char === "turtle" ? (p.shieldUsed ? "・盾：使用ずみ" : "・盾：OK") : ""}` }),
      h("div", { class: "mh" }, p.hand.map((x) => cardEl(x, { tag: "div", mini: true })))));
  });
}

function hearts(p) {
  return h("div", { class: "hearts", "aria-label": `HP ${p.hp} / ${p.maxHp}` }, Array.from({ length: p.maxHp }, (_, k) => h("i", { class: k < p.hp ? "on" : "", text: "❤" })), h("small", { text: ` HP ${p.hp}/${p.maxHp}` }));
}

function renderLog() {
  const ol = $("#log"); ol.replaceChildren();
  for (const l of game.log.slice(-60).reverse()) ol.append(h("li", { text: `R${l.r}：${l.t}` }));
}

// ======================================================================
// ターンの流れ：① えらぶ → ② 実行（アニメ）→ カードを引く → ③ ボス（自動）
// ======================================================================
async function onRun() {
  if (busy || game.phase !== "program") return;
  let res;
  try { res = E.runProgram(game, prog); } catch (e) { runText = e.message; renderGame(); return; }
  busy = true; S.sfx("run");
  const me = E.currentIndex(game);
  const progCards = prog.map((id) => game.players[me].hand.find((c) => c.id === id));
  progCards.forEach((c) => progCache.set(c.id, c));
  let prev = null;
  for (const f of res.trace) {
    runLine = f.line; runErr = !!f.error; runText = f.text;
    const vstate = { ...game, boss: f.boss, players: game.players.map((p, i) => ({ ...p, dmg: f.dmg[i] })) };
    renderGame({ frame: f, state: vstate });
    playFrame(f, prev);
    prev = f;
    await wait(f.line === -1 ? 300 : f.fx === "slash" || f.fx === "beam" ? 820 : f.fx === "bug" ? 900 : f.fx === "rage" ? 1100 : 520);
  }
  game = res.state; prog = []; runLine = -1; runErr = false;
  if (game.phase === "end") { busy = false; save(); await wait(400); return endGame(); }
  // 新しいカードが ランダムに 手札へ
  newCards = new Set(res.drawn);
  res.drawn.forEach((_, k) => S.sfx("draw", k * 0.12));
  runText = res.drawn.length ? `🎴 カードを ${res.drawn.length}まい 引いた！` : "";
  renderGame();
  await wait(400 + res.drawn.length * 140);
  newCards = new Set();
  await bossTurn();
}

async function bossTurn() {
  const before = game;
  const next = E.bossAct(game);
  const lb = next.lastBoss;
  runText = `③ ボスのばん：「${lb.card.name}」！`;
  renderGame({ cells: lb.cells });
  banner(`${E.BOSSES[before.boss.key].name}の「${lb.card.name}」！`); S.sfx("announce");
  await wait(800);
  // ボスが動く
  game = { ...before, boss: { ...before.boss, x: lb.to.x, y: lb.to.y, dir: next.boss.dir } };
  renderGame({ cells: lb.cells });
  await wait(450);
  await bossFx(lb, next);
  // HPが へったところを 先に見せる（ダウンした人は まだ その場に）
  renderGame({ cells: lb.cells, frame: { players: before.players, boss: game.boss }, state: { ...before, players: before.players.map((p, i) => ({ ...p, hp: next.players[i].downs > p.downs ? 0 : next.players[i].hp })) } });
  await wait(350);
  for (const x of lb.hits) {
    const p = before.players[x.i];
    if (x.shield) { fx("shield", p.x, p.y, {}, 1000); pop(p.x, p.y, "ふせいだ！", "blue"); S.sfx("shield"); }
    else {
      bump(tokP[x.i].el, "hurt", 500); S.sfx(x.down ? "down" : "hurt");
      pop(p.x, p.y, `❤−${x.power}${x.bugs ? `  🐛+${x.bugs}` : ""}`, "bad");
      if (x.bugs) fx("bugfly", p.x, p.y, { text: "🐛" }, 900);
      if (x.down) { fx("down", p.x, p.y, { text: "ダウン！" }, 1300); setTimeout(() => pop(p.x, p.y, `−${x.lost}点`, "bad"), 500); }
    }
  }
  if (!lb.hits.length) { pop(lb.to.x, lb.to.y, "だれにも 当たらない！", ""); S.sfx("nohit"); }
  await wait(700);
  game = next; runText = ""; busy = false; save();     // ふきとばしを ここで反映（コマが すべって動く）
  if (game.phase === "end") { renderGame(); await wait(600); return endGame(); }
  renderGame(); await wait(500);
  turnIntro(before.round !== game.round);
}

function overlay(nodes, pc) {
  const ov = $("#overlay"); const body = $("#ovBody"); body.replaceChildren(...nodes);
  ov.querySelector(".ovbox").style.setProperty("--pc", pc || "var(--line)");
  ov.hidden = false; const b = body.querySelector("button"); if (b) b.focus();
}
const closeOverlay = () => { $("#overlay").hidden = true; };

function turnIntro(newRound = false, first = false) {
  const pi = E.currentIndex(game), p = game.players[pi], c = E.CHARS[p.char];
  const nodes = [];
  if (newRound) nodes.push(h("p", { class: "lv big", text: `ラウンド ${game.round}：じゅんばんが ぎゃくに！` }));
  nodes.push(h("img", { class: "big bob", src: `assets/${c.img}.webp`, alt: "" }), h("h2", { id: "ovTitle", text: `${p.name} の ばん！` }),
    h("p", { text: `${c.name}｜とくいわざ「${c.skill}」${c.text}` }));
  if (first || game.round === 1) {
    nodes.push(h("ol", { class: "mini3" }, h("li", {}, h("b", { text: "① えらぶ" }), h("span", { text: "手札のカードを タップして ならべる" })),
      h("li", {}, h("b", { text: "② 実行▶" }), h("span", { text: "キャラが動いて、ボスが前なら こうげき" })),
      h("li", {}, h("b", { text: "③ ボス" }), h("span", { text: "赤いマスを こうげき。よけよう！" }))));
  }
  const bugs = p.hand.filter((x) => x.type === "bug").length;
  if (bugs) nodes.push(h("p", { class: "err", text: `手札に バグが ${bugs}まい。デバッグで けすか、プログラムの さいごに 入れよう。` }));
  nodes.push(h("button", { type: "button", class: "btn primary big", onclick: () => { closeOverlay(); S.sfx("select"); }, text: "はじめる" }));
  overlay(nodes, pcol(pi));
  S.sfx(newRound ? "round" : "turnStart");
}

// ---------- 結果 ----------
function endGame() {
  clearSave(); show("result"); renderTop();
  S.music(null); S.sfx(game.boss.hp <= 0 ? "win" : "lose"); if (game.boss.hp > 0) S.sfx("win", 1.3);
  const box = $("#resultPanel"); box.replaceChildren();
  const rk = E.ranking(game); const w = game.players[rk[0].i];
  const B = E.BOSSES[game.boss.key];
  box.append(h("div", { class: "confetti", "aria-hidden": "true" }, Array.from({ length: 24 }, (_, i) => h("i", { style: { "--i": i, "--c": pcol(i) } }))),
    h("h1", { text: game.boss.hp <= 0 ? `${B.name}を たおした！` : `${B.name}は にげていった…` }),
    h("p", { class: "note", style: { "text-align": "center" }, text: `勝ったのは ${w.name}！ いちばん ダメージを あたえました。` }));
  const pod = h("div", { class: "podium" });
  rk.forEach((r, k) => {
    const p = game.players[r.i];
    pod.append(h("div", { class: "rk" + (k === 0 ? " first" : ""), style: { "--pc": pcol(r.i), "--d": k * 150 + "ms" } }, h("div", { class: "no", text: k === 0 ? "👑" : String(k + 1) }), img(E.CHARS[p.char].img),
      h("div", {}, h("b", { text: p.name }), h("div", { class: "hint", text: `${E.CHARS[p.char].name}${p.finisher ? "・とどめの一撃！" : ""}・ダウン ${p.downs}回・のこりHP ${p.hp}・うけたバグ ${p.bugsTaken}` })), h("div", { class: "pt", text: `${p.dmg}` })));
  });
  box.append(pod);
  const concepts = ["順次", "くり返し", "条件分岐", "関数", "デバッグ"];
  const tbl = h("table", { class: "learn" }, h("thead", {}, h("tr", {}, h("th", { text: "プログラミングの考え方" }), game.players.map((p) => h("th", { text: p.name })))),
    h("tbody", {}, concepts.map((k) => h("tr", {}, h("td", {}, h("span", { class: "chip c-" + k, text: k })), game.players.map((p) => h("td", { text: String(p.stats[k] || 0) }))))));
  const tops = concepts.map((k) => { const m = Math.max(...game.players.map((p) => p.stats[k] || 0)); if (!m) return null; return `${k}名人：${game.players.filter((p) => (p.stats[k] || 0) === m).map((p) => p.name).join("・")}`; }).filter(Boolean);
  box.append(h("h2", { text: "学びの ふりかえり（つかった回数）" }), tbl, h("p", { class: "note", text: tops.join("　") }),
    h("p", { class: "note", text: "くり返しで 手数をへらす・もし〜なら で 場面に合わせる・関数で 同じ動きを 使い回す・デバッグで まちがいを なおす。どれも 本物のプログラミングで 使う考え方です。" }),
    h("div", { class: "actions" }, h("button", { type: "button", class: "btn primary big", onclick: () => { show("setup"); renderSetup(); S.music("title"); }, text: "もういちど あそぶ" })));
}

// ---------- あそびかた ----------
function renderHow() {
  const box = $("#howCards"); box.replaceChildren();
  for (const k of Object.keys(E.CARDS)) box.append(cardEl({ id: 0, type: k }, { tag: "div" }));
}

// ---------- はじめに ----------
$("#btnStart").addEventListener("click", startGame);
$("#btnResume").addEventListener("click", () => { const s = loadSaved(); if (!s) return; game = s; prog = []; show("game"); buildBoard(); renderGame(); S.unlock(); S.music(game.boss.rage ? "rage" : "battle"); turnIntro(); });
$("#btnHow").addEventListener("click", () => { renderHow(); $("#howto").showModal(); });
$("#howClose").addEventListener("click", () => $("#howto").close());
$("#btnMenu").addEventListener("click", () => { if (game && game.phase !== "end" && !confirmLeave()) return; show("setup"); renderSetup(); S.music("title"); });
$("#chkDanger").addEventListener("change", (e) => { showDanger = e.target.checked; if (game && !busy) renderGame(); });
let leaveArmed = 0;
function confirmLeave() {
  const now = Date.now(); if (now - leaveArmed < 2500) return true;
  leaveArmed = now; const b = $("#btnMenu"); b.textContent = "もう一度おすと もどる"; setTimeout(() => { b.textContent = "はじめから"; }, 2500); return false;
}
// ---------- 音（最初のタップで鳴らせるようになる） ----------
const SOUND_LABEL = { all: ["🔊", "BGM＋効果音"], sfx: ["🔉", "効果音だけ"], off: ["🔇", "音なし"] };
function renderSound() {
  const b = $("#btnSound"), [ic, tx] = SOUND_LABEL[S.getMode()];
  b.replaceChildren(h("span", { text: ic }), h("span", { class: "stxt", text: tx }));
  b.setAttribute("aria-label", "音の設定：" + tx + "（おすと切りかわる）"); b.title = "おすと切りかわる：BGM＋効果音 → 効果音だけ → 音なし";
}
$("#btnSound").addEventListener("click", () => {
  const next = { all: "sfx", sfx: "off", off: "all" }[S.getMode()];
  S.setMode(next); S.unlock(); renderSound();
  S.music(screenSong());
  S.sfx("select");
});
const screenSong = () => (!$("#setup").hidden ? "title" : !$("#game").hidden ? (game?.boss.rage ? "rage" : "battle") : null);
let started = false;
window.addEventListener("pointerdown", () => {
  if (started) return; started = true; S.unlock();
  S.music(screenSong());
}, { passive: true });
renderSound();
renderSetup();
