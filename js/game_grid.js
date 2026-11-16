/* ============================================================
   game_grid.js —— 💥 净化战场（板块二 · 连对消除 · 独立排行榜）
   不限时，点两张"能发生氧化还原"的离子牌消除：
   - 每消除一对 +20 分；连续消对 12 对即过关
   - 点错连对清零（不扣时间、不结束），可以继续练
   - 牌面由"尚未出现过的反应对"生成：连过的组合不会再刷出来
   - 牌池用尽时重新洗牌（会提示），保证战场永远有牌可点
   ============================================================ */
(function () {
  const PASS_STREAK = 12, GAIN = 20;
  const BOARD_TILES = 20, PAIRS_ON_BOARD = 8;

  /* 参战离子：强氧化剂 / 强还原剂 / 条件型氧化剂，覆盖三条阶梯 */
  const IONS = [
    'MnO₄⁻(H⁺)', 'NO₃⁻(H⁺)', 'ClO⁻', 'Cl₂', 'Br₂', 'Fe³⁺', 'I₂',   // 氧化剂 7
    'Cl⁻', 'Br⁻', 'Fe²⁺', 'I⁻', 'S²⁻', 'SO₃²⁻', 'C₂O₄²⁻',          // 还原剂 7（含草酸根）
  ];
  /* 旁观者：与任何离子都不反应，可共存 */
  const SPECTATORS = ['K⁺', 'Na⁺', 'SO₄²⁻', 'Ba²⁺', 'Mn²⁺'];

  let tiles = [], sel = null, score = 0, matched = 0, wrongs = 0;
  let streak = 0, maxStreak = 0, busy = false, running = false;
  let pool = [], used = new Set(), cycle = 1;
  const el = id => document.getElementById(id);

  /* ---------- 反应对池 ---------- */
  function allPairs() {
    const out = [];
    for (let i = 0; i < IONS.length; i++) {
      for (let j = i + 1; j < IONS.length; j++) {
        const a = IONS[i], b = IONS[j];
        if (!RX.SP[a] || !RX.SP[b]) continue;
        if (RX.canReact(a, b).ok) out.push([a, b]);
      }
    }
    return out;
  }

  function buildPool() {
    pool = RX.shuffle(allPairs().filter(p => !used.has(p[0] + '|' + p[1])));
  }

  /* 取一对"没出现过"的反应对；池子空了就重新洗牌 */
  function takePair() {
    if (!pool.length) {
      used.clear();
      cycle++;
      buildPool();
      if (cycle > 1) RX.toast('全部反应都连过一遍啦，战场重新洗牌！');
    }
    const p = pool.pop() || null;
    if (p) used.add(p[0] + '|' + p[1]);   /* 已出现过的组合不再进入牌池 */
    return p;
  }

  function spectator() { return RX.pick(SPECTATORS); }

  /* ---------- 建场 ---------- */
  function mount() {
    score = 0; matched = 0; wrongs = 0; streak = 0; maxStreak = 0;
    sel = null; busy = false; cycle = 1;
    used = new Set(); buildPool();
    buildBoard();
    render();
    running = true;
  }

  function unmount() { running = false; }

  function buildBoard() {
    tiles = [];
    for (let k = 0; k < PAIRS_ON_BOARD; k++) {
      const p = takePair();
      if (!p) break;
      tiles.push({ v: p[0], alive: true }, { v: p[1], alive: true });
    }
    while (tiles.length < BOARD_TILES) tiles.push({ v: spectator(), alive: true });
    tiles = RX.shuffle(tiles);
  }

  function aliveIdx() {
    const out = [];
    tiles.forEach((t, i) => { if (t.alive) out.push(i); });
    return out;
  }

  function hasValidPair() {
    const idx = aliveIdx();
    for (let i = 0; i < idx.length; i++) {
      for (let j = i + 1; j < idx.length; j++) {
        if (RX.canReact(tiles[idx[i]].v, tiles[idx[j]].v).ok) return true;
      }
    }
    return false;
  }

  function tileClass(v) {
    const sp = RX.SP[v] || {};
    return sp.ox == null && sp.oxOfRed == null && sp.act == null ? 'spect' : '';
  }

  function isLong(v) { return v.length >= 7; }

  function render() {
    el('grid-root').innerHTML = `
      <div class="panel card">
        <div class="row" style="justify-content:space-between">
          <span class="chip">🔥 连对 <b id="grid-streak">${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 <b id="grid-pts">${score}</b></span>
          <span class="chip">已消除 <b id="grid-pairs">${matched}</b> 对 · 点错 ${wrongs} 次</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="grid-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <p class="sub" style="text-align:center;margin-top:10px">
          点两张 <b>能发生氧化还原</b> 的牌消除，每对 <b>+${GAIN} 分</b>；<b>不限时</b>，连续消对 <b>${PASS_STREAK} 对</b>即过关。<br>
          点错只把连对清零，不会扣时间也不会结束。牌面只会出现<b>还没连过的反应组合</b>。
        </p>
        <div class="grid-wrap" id="grid-wrap">
          ${tiles.map((t, i) => `
            <div class="g-tile ${t.alive ? '' : 'hidden'} ${tileClass(t.v)} ${isLong(t.v) ? 'long' : ''}" data-i="${i}">${t.v}</div>`).join('')}
        </div>
        <div class="feedback" id="grid-fb">开始净化！连出越多，分数越高。</div>
        <div class="row" style="justify-content:center">
          <button class="btn btn-ghost" id="grid-quit">结束本局（回地图）</button>
        </div>
      </div>`;
    el('grid-wrap').querySelectorAll('.g-tile').forEach(t => { t.onclick = () => click(t); });
    el('grid-quit').onclick = () => { settle(false); };
    paintStats();
  }

  function paintStats() {
    const pts = el('grid-pts'); if (pts) pts.textContent = score;
    const pairs = el('grid-pairs'); if (pairs) pairs.textContent = matched;
    const s = el('grid-streak'); if (s) s.textContent = streak;
    const bar = el('grid-bar'); if (bar) bar.style.width = (streak / PASS_STREAK * 100) + '%';
    const head = document.getElementById('grid-score');
    if (head) head.textContent = '得分 ' + score;
    const chip = document.querySelector('#grid-root .chip:nth-child(3)');
    if (chip) chip.innerHTML = `已消除 <b id="grid-pairs">${matched}</b> 对 · 点错 ${wrongs} 次`;
  }

  /* ---------- 点击消除 ---------- */
  function click(tileEl) {
    if (busy || !running) return;
    const i = +tileEl.dataset.i;
    if (!tiles[i] || !tiles[i].alive) return;

    if (sel === null) { sel = i; tileEl.classList.add('sel'); return; }
    if (sel === i) { tileEl.classList.remove('sel'); sel = null; return; }

    const first = document.querySelector(`.g-tile[data-i="${sel}"]`);
    const a = tiles[sel].v, b = tiles[i].v;
    const r = RX.canReact(a, b);
    const fb = el('grid-fb');

    if (r.ok) {
      busy = true;
      score += GAIN;
      matched++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      RX.addXP(GAIN);
      first.classList.remove('sel');
      first.classList.add('boom'); tileEl.classList.add('boom');
      RX.lb.submit('grid', score, streak >= PASS_STREAK);   /* 达标即刻入榜 */
      paintStats();

      const eq = RX.eqFor(a, b);
      fb.className = 'feedback good';
      fb.innerHTML = `💥 ${a} + ${b} 消除！${r.why}。${eq ? '方程式：' + eq : ''} <b>+${GAIN}</b>（连对 ${streak}）${streak >= PASS_STREAK ? ' · 🎉 达标过关！' : ''}`;

      const idxA = sel, idxB = i;
      sel = null;
      if (streak >= PASS_STREAK) {
        setTimeout(() => { if (running) settle(true); }, 500);
        return;
      }
      setTimeout(() => {
        tiles[idxA].alive = false; tiles[idxB].alive = false;
        first.classList.add('hidden'); tileEl.classList.add('hidden');
        first.classList.remove('boom', 'sel'); tileEl.classList.remove('boom', 'sel');
        refillTwo(idxA, idxB);
        busy = false;
        paintStats();
      }, 420);
    } else {
      wrongs++;
      streak = 0;
      tileEl.classList.add('deny'); first.classList.add('deny');
      fb.className = 'feedback bad';
      fb.textContent = `❌ ${a} 与 ${b} 不反应（${r.why}）。连对清零，不限时，继续练！`;
      paintStats();
      setTimeout(() => {
        tileEl.classList.remove('deny'); first.classList.remove('deny', 'sel');
        sel = null;
      }, 420);
    }
  }

  /* 用"全新的反应对"补位，保证不重复出现连过的组合 */
  function refillTwo(i, j) {
    const p = takePair();
    if (p) {
      tiles[i] = { v: p[0], alive: true };
      tiles[j] = { v: p[1], alive: true };
    } else {
      tiles[i] = { v: spectator(), alive: true };
      tiles[j] = { v: spectator(), alive: true };
    }
    [i, j].forEach(k => {
      const cell = document.querySelector(`.g-tile[data-i="${k}"]`);
      if (!cell) return;
      cell.textContent = tiles[k].v;
      cell.className = 'g-tile ' + tileClass(tiles[k].v) + (isLong(tiles[k].v) ? ' long' : '');
    });
    /* 兜底：万一场上没有可消除的组合，替换两张为一条新反应对 */
    if (!hasValidPair()) {
      const p2 = takePair();
      if (p2) {
        tiles[i] = { v: p2[0], alive: true };
        tiles[j] = { v: p2[1], alive: true };
        [i, j].forEach(k => {
          const cell = document.querySelector(`.g-tile[data-i="${k}"]`);
          if (cell) {
            cell.textContent = tiles[k].v;
            cell.className = 'g-tile ' + tileClass(tiles[k].v) + (isLong(tiles[k].v) ? ' long' : '');
          }
        });
      }
    }
  }

  /* ---------- 结算 ---------- */
  function settle(win) {
    running = false;
    const passed = !!win;
    RX.store.finishGame('grid', score, passed);
    const res = RX.lb.submit('grid', score, passed);
    el('grid-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${passed ? '🧴' : '💥'}</div>
        <h3>${passed ? '✅ 过关！' : '本局结束'}　总得分 ${score}</h3>
        <p class="sub">最长连对 <b>${maxStreak}</b> 对 / 目标 ${PASS_STREAK} 对 · 共消除 ${matched} 对 · 点错 ${wrongs} 次。${passed
          ? '连续消对达标，过关标准已达成！'
          : '点错会清零连对，但不限时，可以一直练。'}</p>
        <p class="sub">${!res.ok
          ? '教师模式 · 成绩不计入排行榜'
          : (res.improved ? `刷新个人最高分！${res.rank ? '当前排名第 ' + res.rank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 净化战场 · 排行榜</h3>
          ${RX.lb.render('grid', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="grid-again">再玩一次</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回地图</button>
        </div>
      </div>`;
    el('grid-again').onclick = mount;
    if (passed) RX.celebrate();
  }

  /* 诊断用：查看牌池状态（"已出现过的组合数"用于验证不重复） */
  RX._gridStats = () => ({ cycle, used: used.size, remaining: pool.length });

  RX.register('grid', { title: '净化战场', mount, unmount });
})();
