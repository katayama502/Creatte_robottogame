// BGM・効果音（すべてブラウザの Web Audio でその場で合成。音声ファイルは使わない＝著作権の心配なし）
// ブラウザのきまりで、音は「最初にどこかをタップ/クリックした後」から鳴ります。

let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
let mode = "all"; // all（BGM＋効果音） / sfx（効果音だけ） / off（音なし）
const MODE_KEY = "creatte-code-battle-sound";
try { const m = localStorage.getItem(MODE_KEY); if (["all", "sfx", "off"].includes(m)) mode = m; } catch { /* なし */ }

function ensure() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = mode === "all" ? 0.16 : 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = mode === "off" ? 0 : 0.55; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- 音のパーツ ----------
function tone(bus, t, f, dur, { type = "square", vol = 0.3, attack = 0.005, release = 0.08, slide = 0, detune = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(bus, t, dur, { vol = 0.3, hp = 0, lp = 0, bp = 0, q = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  let node = s;
  for (const [type, fr] of [["highpass", hp], ["lowpass", lp], ["bandpass", bp]]) {
    if (!fr) continue; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.Q.value = q; node.connect(f); node = f;
  }
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
}
const kick = (t, v = 0.9) => tone(musicBus, t, 150, 0.18, { type: "sine", vol: v, slide: 0.3, release: 0.1 });
const snare = (t, v = 0.35) => { noise(musicBus, t, 0.14, { vol: v, hp: 1500 }); tone(musicBus, t, 220, 0.08, { type: "triangle", vol: v * 0.6 }); };
const hat = (t, v = 0.12) => noise(musicBus, t, 0.04, { vol: v, hp: 7000 });

// ---------- BGM（小さなシーケンサー） ----------
// 1小節＝16ステップ。lead/bass は MIDI番号（0 は休み）
const SONGS = {
  title: { bpm: 104, swing: 0, bars: [
    { chord: [60, 64, 67], bass: 48, lead: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0] },
    { chord: [57, 60, 64], bass: 45, lead: [72, 0, 74, 0, 76, 0, 72, 0, 69, 0, 0, 0, 71, 0, 72, 0] },
    { chord: [53, 57, 60], bass: 41, lead: [69, 0, 72, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 0] },
    { chord: [55, 59, 62], bass: 43, lead: [71, 0, 74, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0, 0, 0] },
  ], drums: "soft" },
  battle: { bpm: 132, bars: [
    { chord: [57, 60, 64], bass: 45, lead: [69, 0, 72, 76, 0, 76, 74, 0, 72, 0, 74, 0, 76, 0, 0, 0] },
    { chord: [53, 57, 60], bass: 41, lead: [77, 0, 76, 74, 0, 72, 74, 0, 76, 0, 72, 0, 69, 0, 0, 0] },
    { chord: [55, 59, 62], bass: 43, lead: [71, 0, 74, 79, 0, 79, 77, 0, 76, 0, 74, 0, 71, 0, 74, 0] },
    { chord: [52, 56, 59], bass: 40, lead: [76, 0, 0, 75, 76, 0, 80, 0, 83, 0, 80, 0, 76, 0, 0, 0] },
  ], drums: "drive" },
  rage: { bpm: 152, bars: [
    { chord: [57, 60, 63], bass: 45, lead: [81, 0, 80, 81, 0, 84, 0, 81, 80, 0, 77, 0, 75, 0, 77, 0] },
    { chord: [56, 59, 63], bass: 44, lead: [80, 0, 77, 80, 0, 83, 0, 80, 77, 0, 75, 0, 74, 0, 75, 0] },
    { chord: [54, 57, 61], bass: 42, lead: [78, 0, 75, 78, 0, 81, 0, 78, 75, 0, 73, 0, 72, 0, 73, 0] },
    { chord: [52, 56, 59], bass: 40, lead: [76, 0, 80, 83, 0, 88, 0, 83, 80, 0, 76, 0, 80, 0, 83, 0] },
  ], drums: "drive" },
};
let song = null, songKey = null, step = 0, nextTime = 0, timer = null;

function scheduleStep(t) {
  const s = SONGS[songKey]; const bar = s.bars[Math.floor(step / 16) % s.bars.length]; const i = step % 16;
  const sixteenth = 60 / s.bpm / 4;
  // ベース（8分）
  if (i % 2 === 0) tone(musicBus, t, freq(bar.bass + (i % 8 === 6 ? 12 : 0)), sixteenth * 1.8, { type: "triangle", vol: 0.42, release: 0.05 });
  // コード（小節のあたまと まんなか）
  if (i === 0 || i === 8) bar.chord.forEach((m) => tone(musicBus, t, freq(m + 12), sixteenth * 7, { type: "sawtooth", vol: 0.045, attack: 0.03, release: 0.25, detune: 6 }));
  // メロディ
  const n = bar.lead[i]; if (n) tone(musicBus, t, freq(n), sixteenth * 1.7, { type: "square", vol: 0.12, release: 0.06 });
  // ドラム
  if (s.drums === "soft") { if (i === 0 || i === 8) kick(t, 0.5); if (i % 4 === 2) hat(t, 0.07); }
  else { if (i % 4 === 0) kick(t); if (i === 4 || i === 12) snare(t); if (i % 2 === 1) hat(t); if (songKey === "rage" && i === 14) snare(t, 0.25); }
}
function tick() {
  if (!ctx || !songKey) return;
  const sixteenth = 60 / SONGS[songKey].bpm / 4;
  while (nextTime < ctx.currentTime + 0.12) { scheduleStep(nextTime); nextTime += sixteenth; step++; }
}

export function music(key) {
  if (key === songKey) return;
  songKey = key || null; step = 0;
  if (!ensure()) return;
  nextTime = ctx.currentTime + 0.05;
  if (!timer && songKey) timer = setInterval(tick, 25);
  if (!songKey && timer) { clearInterval(timer); timer = null; }
}

// ---------- 効果音 ----------
const SFX = {
  select: (t) => tone(sfxBus, t, 880, 0.06, { vol: 0.25 }) || tone(sfxBus, t + 0.04, 1320, 0.06, { vol: 0.2 }),
  unselect: (t) => tone(sfxBus, t, 660, 0.07, { vol: 0.2, slide: 0.7 }),
  run: (t) => [523, 659, 784].forEach((f, k) => tone(sfxBus, t + k * 0.06, f, 0.1, { vol: 0.25 })),
  move: (t) => tone(sfxBus, t, 330, 0.09, { type: "triangle", vol: 0.35, slide: 1.8 }),
  bump: (t) => { tone(sfxBus, t, 120, 0.15, { type: "square", vol: 0.3, slide: 0.5 }); noise(sfxBus, t, 0.08, { vol: 0.25, lp: 800 }); },
  turn: (t) => tone(sfxBus, t, 500, 0.12, { type: "triangle", vol: 0.25, slide: 1.5 }),
  slash: (t) => { noise(sfxBus, t, 0.18, { vol: 0.55, bp: 3000, q: 0.8 }); tone(sfxBus, t + 0.08, 180, 0.18, { type: "square", vol: 0.35, slide: 0.4 }); kickS(t + 0.1); },
  whiff: (t) => noise(sfxBus, t, 0.2, { vol: 0.3, bp: 1500, q: 2 }),
  beam: (t) => { tone(sfxBus, t, 300, 0.25, { type: "sawtooth", vol: 0.12, slide: 6 }); tone(sfxBus, t + 0.22, 1800, 0.35, { type: "square", vol: 0.12, slide: 0.3 }); noise(sfxBus, t + 0.22, 0.3, { vol: 0.2, hp: 3000 }); },
  hit: (t) => [880, 1175, 1568].forEach((f, k) => tone(sfxBus, t + k * 0.05, f, 0.12, { vol: 0.2 })),
  loop: (t) => [659, 784].forEach((f, k) => tone(sfxBus, t + k * 0.07, f, 0.09, { vol: 0.22 })),
  if: (t) => { tone(sfxBus, t, 740, 0.08, { vol: 0.2 }); tone(sfxBus, t + 0.1, 988, 0.1, { vol: 0.2 }); },
  func: (t) => [523, 784, 1047].forEach((f, k) => tone(sfxBus, t + k * 0.05, f, 0.16, { type: "triangle", vol: 0.28 })),
  flee: (t) => tone(sfxBus, t, 400, 0.18, { type: "triangle", vol: 0.3, slide: 2.5 }),
  debug: (t) => { [1047, 1319, 1568, 2093].forEach((f, k) => tone(sfxBus, t + k * 0.06, f, 0.14, { type: "sine", vol: 0.25 })); },
  heal: (t) => [784, 988, 1175].forEach((f, k) => tone(sfxBus, t + k * 0.08, f, 0.2, { type: "sine", vol: 0.22 })),
  bug: (t) => { for (let k = 0; k < 6; k++) tone(sfxBus, t + k * 0.06, 200 + Math.random() * 600, 0.05, { type: "square", vol: 0.25 }); tone(sfxBus, t + 0.38, 110, 0.35, { type: "sawtooth", vol: 0.3, slide: 0.5 }); },
  rage: (t) => { tone(sfxBus, t, 80, 0.9, { type: "sawtooth", vol: 0.35, slide: 0.6, attack: 0.05 }); noise(sfxBus, t, 0.9, { vol: 0.25, lp: 600 }); [0, 0.25, 0.5].forEach((d) => tone(sfxBus, t + d, 440, 0.18, { type: "square", vol: 0.15 })); },
  draw: (t) => noise(sfxBus, t, 0.08, { vol: 0.3, bp: 2500, q: 1.5 }),
  announce: (t) => { tone(sfxBus, t, 196, 0.25, { type: "sawtooth", vol: 0.25 }); tone(sfxBus, t + 0.2, 147, 0.4, { type: "sawtooth", vol: 0.25 }); },
  charge: (t) => tone(sfxBus, t, 120, 0.45, { type: "sawtooth", vol: 0.18, slide: 4, attack: 0.05 }),
  boom: (t) => { kickS(t, 1); noise(sfxBus, t, 0.6, { vol: 0.5, lp: 900 }); },
  zap: (t) => { tone(sfxBus, t, 1600, 0.3, { type: "sawtooth", vol: 0.15, slide: 0.2 }); noise(sfxBus, t, 0.35, { vol: 0.25, hp: 2500 }); },
  fire: (t) => { for (let k = 0; k < 5; k++) noise(sfxBus, t + k * 0.07, 0.25, { vol: 0.25, lp: 1200 }); },
  hurt: (t) => { tone(sfxBus, t, 400, 0.18, { type: "square", vol: 0.3, slide: 0.5 }); noise(sfxBus, t, 0.1, { vol: 0.2, lp: 2000 }); },
  shield: (t) => { tone(sfxBus, t, 1200, 0.35, { type: "sine", vol: 0.3, slide: 0.8 }); tone(sfxBus, t, 1800, 0.35, { type: "sine", vol: 0.15 }); },
  down: (t) => [392, 349, 311, 262].forEach((f, k) => tone(sfxBus, t + k * 0.13, f, 0.16, { type: "square", vol: 0.25 })),
  nohit: (t) => tone(sfxBus, t, 600, 0.2, { type: "triangle", vol: 0.2, slide: 0.6 }),
  turnStart: (t) => [784, 1047].forEach((f, k) => tone(sfxBus, t + k * 0.1, f, 0.2, { type: "triangle", vol: 0.3 })),
  round: (t) => [523, 659, 784, 1047].forEach((f, k) => tone(sfxBus, t + k * 0.09, f, 0.18, { vol: 0.25 })),
  win: (t) => {
    const n = [[72, 0], [72, 0.12], [72, 0.24], [76, 0.36], [79, 0.6], [76, 0.84], [79, 0.96], [84, 1.2]];
    n.forEach(([m, d]) => { tone(sfxBus, t + d, freq(m), d >= 1.2 ? 0.8 : 0.18, { vol: 0.25 }); tone(sfxBus, t + d, freq(m - 12), d >= 1.2 ? 0.8 : 0.18, { type: "triangle", vol: 0.25 }); });
  },
  lose: (t) => [[67, 0], [66, 0.25], [65, 0.5], [64, 0.75]].forEach(([m, d]) => tone(sfxBus, t + d, freq(m), 0.3, { type: "triangle", vol: 0.3 })),
};
function kickS(t, v = 0.6) { tone(sfxBus, t, 160, 0.2, { type: "sine", vol: v, slide: 0.3 }); }

export function sfx(name, delay = 0) {
  if (mode === "off" || !SFX[name] || !ensure()) return;
  try { SFX[name](ctx.currentTime + 0.01 + delay); } catch (e) { if (globalThis.__audioDebug) throw e; /* 音が出なくても ゲームは続ける */ }
}

// ---------- 音の設定 ----------
export const getMode = () => mode;
export function setMode(m) {
  mode = m; try { localStorage.setItem(MODE_KEY, m); } catch { /* なし */ }
  if (ctx) {
    musicBus.gain.setTargetAtTime(m === "all" ? 0.16 : 0, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(m === "off" ? 0 : 0.55, ctx.currentTime, 0.05);
  }
}
export function unlock() { ensure(); }
