// バランス確認：各プレイヤーが「そのターンいちばんダメージが出る並べ方」を選ぶ（同点なら安全な場所）
import * as E from "../js/engine.js";
function perms(arr, k) { const out = [[]]; const rec = (cur, rest) => { if (cur.length) out.push(cur); if (cur.length === k) return; rest.forEach((x, i) => rec([...cur, x], rest.filter((_, j) => j !== i))); }; rec([], arr); return out; }
function best(s) {
  const p = E.currentPlayer(s); const ids = p.hand.map(c => c.id); let b = null;
  for (const pr of perms(ids, E.slotCount(p))) {
    const r = E.runProgram(s, pr).state; const me = r.players[E.currentIndex(s)];
    const danger = r.phase === "boss" && E.dangerCells(r).some(c => c.x === me.x && c.y === me.y);
    const sc = (me.dmg - p.dmg) * 10 - (danger ? 4 : 0) - Math.max(Math.abs(me.x - r.boss.x), Math.abs(me.y - r.boss.y)) * 0.3;
    if (!b || sc > b.sc) b = { pr, sc };
  }
  return b.pr;
}
const PREF = ["atk", "ifatk", "loop", "fwd1", "beam", "debug", "func", "right", "left", "fwd2", "ifrun", "back"];
for (const boss of ["slime", "clock", "maou"]) for (const n of [2, 4, 6]) {
  globalThis.TD=0; let win = 0, rounds = 0, spread = 0, bugs = 0; const G = 12;
  for (let g = 0; g < G; g++) {
    const chars = ["hero", "wizard", "robo", "fox", "beaver", "owl", "rabbit", "turtle"].slice(g % 3, g % 3 + n);
    let s = E.newGame({ players: chars.map((c, i) => ({ name: "P" + i, char: c })), boss, maxRounds: 6 }, 100 + g);
    while (s.phase !== "end") {
      s = E.runProgram(s, best(s)).state; if (s.phase === "end") break;
      if (E.currentPlayer(s).hand.some(c=>c.type!=="bug")===false) {}
      s = E.bossAct(s);
    }
    globalThis.TD=(globalThis.TD||0)+s.players.reduce((a,p)=>a+p.dmg,0)/n; if (s.boss.hp <= 0) win++; rounds += Math.min(s.round, 6);
    const d = s.players.map(p => p.dmg); spread += Math.max(...d) - Math.min(...d); bugs += s.players.reduce((a, p) => a + p.bugsTaken, 0) / n;
  }
  console.log(boss, n + "人", "1人平均ダメ", (globalThis.TD/G).toFixed(1), "HP", E.bossHp(boss,n,6), "撃破率", (win / G * 100).toFixed(0) + "%", "平均ラウンド", (rounds / G).toFixed(1), "1位と最下位の差", (spread / G).toFixed(1), "1人あたりバグ", (bugs / G).toFixed(1));
}
