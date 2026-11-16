/* ============================================================
   game_mine.js —— 💣 雷区通行（板块三 · 离子共存 · 独立排行榜）
   你背着 2 种离子站在 5×5 雷区左上角，只能向右 / 向下走，
   走到右下角 🏁 即过一关。经过格子的离子必须和背包里两种
   都能共存——踩雷就爆炸回起点！
   - 不限时；连续 3 关不踩雷即过关，踩雷连对清零但不结束
   - 每过一关 +50 分；踩雷：显示与谁反应 + 方程式，回起点重走
   - 每关换一副背包、换一张雷区，保证至少一条安全路线
   ============================================================ */
(function () {
  const GAIN = 50, PASS_STREAK = 3, SIZE = 5;

  const CAND = ['MnO₄⁻(H⁺)', 'NO₃⁻(H⁺)', 'ClO⁻', 'Cl₂', 'Br₂', 'Fe³⁺', 'I₂',
    'Cl⁻', 'Br⁻', 'Fe²⁺', 'I⁻', 'S²⁻', 'SO₃²⁻', 'C₂O₄²⁻', 'K⁺', 'Na⁺', 'SO₄²⁻', 'Ba²⁺', 'Mn²⁺'];
  /* 背包：两种离子本身必须能共存 */
  const PACKS = [
    ['Fe³⁺', 'K⁺'], ['S²⁻', 'Na⁺'], ['MnO₄⁻(H⁺)', 'K⁺'],
    ['Cl₂', 'SO₄²⁻'], ['NO₃⁻', 'H⁺'], ['Fe²⁺', 'Ba²⁺'], ['I₂', 'Na⁺'], ['ClO⁻', 'K⁺'],
  ];

  let score = 0, level = 0, booms = 0, streak = 0, maxStreak = 0;
  let running = false, busy = false;
  let pack = [], cells = [], player = [0, 0];
  const el = id => document.getElementById(id);
  const key = (r, c) => r + ',' + c;

  /* ---------- 生成一关：先铺一条安全路，再随机埋雷 ---------- */
  function genLevel() {
    pack = PACKS[level % PACKS.length].slice();
    player = [0, 0];
    /* 随机单调路径：4 步右 + 4 步下 */
    const moves = RX.shuffle([...Array(SIZE - 1).fill('R'), ...Array(SIZE - 1).fill('D')]);
    let r = 0, c = 0;
    const pathSet = new Set(['0,0']);
    moves.forEach(m => { m === 'R' ? c++ : r++; pathSet.add(key(r, c)); });
    const safes = CAND.filter(x => !pack.includes(x) && !RX.poolCheck(pack, x).react);
    const bads = CAND.filter(x => !pack.includes(x) && RX.poolCheck(pack, x).react);
    cells = [];
    for (let i = 0; i < SIZE; i++) {
      cells[i] = [];
      for (let j = 0; j < SIZE; j++) {
        const onPath = pathSet.has(key(i, j));
        const useBad = !onPath && bads.length && Math.random() < 0.62;
        cells[i][j] = useBad ? RX.pick(bads) : RX.pick(safes);
      }
    }
  }

  /* ---------- 生命周期 ---------- */
  function mount() {
    score = 0; level = 0; booms = 0; streak = 0; maxStreak = 0;
    busy = false; running = true;
    startScreen();
  }
  function unmount() { running = false; }

  function startScreen() {
    const best = RX.lb.myBest('mine');
    el('mine-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">💣</div>
        <h3>雷区通行</h3>
        <p class="sub">你背着 <b>2 种离子</b>站在雷区左上角，只能<b>向右或向下</b>走，走到右下角 🏁 过关。<br>
          经过的每个格子，其离子都必须和你背包里两种离子<b>全部共存</b>——踩雷爆炸回起点！<br>
          每过一关 <b>+${GAIN}</b> 分；<b>不限时</b>，连续 <b>${PASS_STREAK} 关不踩雷</b>即过关；踩雷连对清零，但可以继续走。
          ${best ? `　· 我的最高分 <b>${best}</b>` : ''}</p>
        <div class="mt"><button class="btn btn-primary" id="mine-start">背上背包出发</button></div>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 雷区通行 · 排行榜</h3>
          ${RX.lb.render('mine', 5)}
        </div>
      </div>`;
    el('mine-start').onclick = start;
  }

  function start() {
    score = 0; level = 0; booms = 0; streak = 0; maxStreak = 0;
    busy = false; running = true;
    genLevel();
    render();
  }

  function render(fbHtml, fbCls) {
    if (!running) return;
    busy = false;
    const [pr, pc] = player;
    el('mine-root').innerHTML = `
      <div class="panel card">
        <div class="row" style="justify-content:space-between">
          <span class="chip">🔥 连续通关 <b>${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 <b>${score}</b></span>
          <span class="chip">累计已过 ${level} 关 · 踩雷 ${booms} 次</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="mine-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <div class="cmd-banner">🎒 只能向右 / 向下走，踩到会反应的格子就爆炸！不限时，慢慢规划。</div>
        <div class="mine-pack">背包：${pack.map(p => RX.ionChip(p)).join('')}
          <span class="sub">（经过的格子必须与这两种离子都能共存）</span></div>
        <div class="mine-grid" data-pack="${pack.join('|')}">
          ${cells.map((row, r) => row.map((ion, c) => {
            const isPlayer = r === pr && c === pc;
            const isExit = r === SIZE - 1 && c === SIZE - 1;
            const movable = !busy && ((r === pr && c === pc + 1) || (r === pr + 1 && c === pc));
            const walked = (r < pr || c < pc) && !isPlayer;
            return `<div class="m-cell ${isPlayer ? 'player' : ''} ${isExit ? 'exit' : ''} ${movable ? 'movable' : ''} ${walked ? 'walked' : ''}"
              data-r="${r}" data-c="${c}" data-ion="${ion}">${isPlayer ? '🧑‍🔬' : isExit ? '🏁' : ion}</div>`;
          }).join('')).join('')}
        </div>
        <div class="feedback ${fbCls || ''}" id="mine-fb">${fbHtml || '看清背包里的离子，规划一条不打架的路线！'}</div>
      </div>`;
    el('mine-root').querySelectorAll('.m-cell.movable').forEach(cell => {
      cell.onclick = () => move(cell);
    });
  }

  function move(cell) {
    if (busy || !running) return;
    const r = +cell.dataset.r, c = +cell.dataset.c, ion = cell.dataset.ion;
    const isExit = r === SIZE - 1 && c === SIZE - 1;

    if (!isExit) {
      const chk = RX.poolCheck(pack, ion);
      if (chk.react) {
        /* 💥 踩雷：回起点、连对清零，但不结束 */
        booms++;
        streak = 0;
        busy = true;
        cell.classList.add('boom');
        const eq = chk.eq || RX.eqFor(chk.with, ion);
        player = [0, 0];
        setTimeout(() => {
          if (!running) return;
          render(`💥 踩雷！${ion} 会和背包里的 ${chk.with} 反应。${eq ? '方程式：' + eq : ''}　连对清零，回到起点重走（不限时）！`, 'bad');
        }, 480);
        return;
      }
    }

    player = [r, c];
    if (isExit) {
      /* 🏁 到达终点 */
      level++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      score += GAIN;
      RX.addXP(GAIN);
      RX.lb.submit('mine', score, streak >= PASS_STREAK);
      if (streak >= PASS_STREAK) {
        render('🏁 连续 3 关不踩雷，✅ 已过关！', 'good');
        setTimeout(() => { if (running) end(true); }, 500);
        return;
      }
      RX.toast(`🏁 第 ${level} 关通过！+${GAIN} 分（连续 ${streak} 关），换一副新背包`, 1600);
      genLevel();
      render(`🏁 抵达终点！+${GAIN} 分，连续 ${streak} 关。新背包：${pack.join('、')}，继续出发！`, 'good');
    } else {
      render();
    }
  }

  function end(win) {
    running = false;
    const passed = !!win;
    RX.store.finishGame('mine', score, passed);
    const res = RX.lb.submit('mine', score, passed);
    el('mine-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${passed ? '🏅' : '💣'}</div>
        <h3>${passed ? '🎉 过关！' : '本局结束'}　总分 ${score}</h3>
        <p class="sub">最长连续通关 <b>${maxStreak}</b> 关 / 目标 ${PASS_STREAK} 关 · 累计已过 ${level} 关 · 踩雷 ${booms} 次。${passed
          ? '连续 3 关不踩雷，过关标准达成！'
          : '踩雷会清零连对，但不限时，可以一直练。'}</p>
        <p class="sub">${!res.ok
          ? '教师模式 · 成绩不计入排行榜'
          : (res.improved ? `刷新个人最高分！${res.rank ? '当前排名第 ' + res.rank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 雷区通行 · 排行榜</h3>
          ${RX.lb.render('mine', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="mine-again">再走一次</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回地图</button>
        </div>
      </div>`;
    el('mine-again').onclick = start;
    if (passed) RX.celebrate();
  }

  RX.register('mine', { title: '雷区通行', mount, unmount });
})();
