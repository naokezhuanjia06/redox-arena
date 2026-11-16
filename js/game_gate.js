/* ============================================================
   game_gate.js —— 🛂 离子海关（板块三 · 离子共存 · 独立排行榜）
   取消传送带时间压力：离子停在海关窗口等你判断，
   点「拦截」或「放行」决定它能不能进泳池。
   - 拦下会反应的 / 放行能共存的 = 判断正确
   - 不限时；连续判断正确 10 个即过关，答错连对清零但不结束
   - 每个正确 +10 分（100 分过关）；每 3 个离子换一个泳池场景
   ============================================================ */
(function () {
  const WAVES = [
    {
      pool: ['Fe³⁺'], note: '泳池已有 Fe³⁺',
      ions: ['I⁻', 'Cl⁻', 'S²⁻', 'Fe²⁺', 'Br⁻', 'I₂', 'K⁺', 'Cl⁻', 'S²⁻', 'I⁻'],
    },
    {
      pool: ['Fe³⁺', 'H⁺', 'NO₃⁻'], note: '稀硝酸泳池（NO₃⁻ + H⁺ 已变身强氧化剂！）',
      ions: ['Fe²⁺', 'Cl⁻', 'I⁻', 'SO₄²⁻', 'S²⁻', 'K⁺', 'Cl⁻', 'I⁻', 'Fe²⁺', 'S²⁻'],
    },
    {
      pool: ['S²⁻', 'K⁺'], note: '硫化钠泳池',
      ions: ['I₂', 'Cl₂', 'Fe³⁺', 'SO₃²⁻', 'ClO⁻', 'Na⁺', 'I₂', 'Cl₂', 'Fe³⁺', 'ClO⁻'],
    },
    {
      pool: ['Fe³⁺', 'Cl⁻'], note: '氯化铁泳池',
      ions: ['I⁻', 'S²⁻', 'Fe²⁺', 'Na⁺', 'I₂', 'Br⁻', 'K⁺', 'S²⁻', 'I⁻', 'Na⁺'],
    },
    {
      pool: ['MnO₄⁻(H⁺)', 'K⁺'], note: '酸性高锰酸钾泳池（氧化性最强！）',
      ions: ['Cl⁻', 'Br⁻', 'I⁻', 'Fe²⁺', 'S²⁻', 'SO₃²⁻', 'C₂O₄²⁻', 'ClO⁻', 'C₂O₄²⁻', 'I⁻'],
    },
  ];
  const PASS_STREAK = 10, GAIN = 10, IONS_PER_WAVE = 3;

  let waveIdx = 0, withinWave = 0, queue = [], pool = [];
  let streak = 0, maxStreak = 0, correct = 0, wrong = 0, score = 0;
  let running = false, busy = false, current = null, nextTimer = null;
  const el = id => document.getElementById(id);
  const ION_ICON = { 'I⁻': '🟤', 'S²⁻': '🟡', 'Fe²⁺': '🟩', 'Cl⁻': '⚪', 'Br⁻': '🟠', 'MnO₄⁻(H⁺)': '🟣', 'Fe³⁺': '🟨', 'I₂': '🟫', 'Cl₂': '🟢', 'SO₃²⁻': '☁️', 'SO₄²⁻': '⬜', 'K⁺': '🔘', 'Na⁺': '🔘', 'H⁺': '🔺', 'NO₃⁻': '🔵', 'ClO⁻': '🫧', 'C₂O₄²⁻': '🌿' };

  function clearNext() { if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; } }

  function mount() {
    clearNext();
    waveIdx = 0; withinWave = 0;
    streak = 0; maxStreak = 0; correct = 0; wrong = 0; score = 0;
    busy = false; running = true;
    startWave();
  }

  function unmount() { clearNext(); running = false; }

  function startWave() {
    const W = WAVES[waveIdx % WAVES.length];
    pool = W.pool.slice();
    queue = RX.shuffle(W.ions).slice(0, IONS_PER_WAVE);
    withinWave = 0;
    el('gate-root').innerHTML = `
      <div class="panel card">
        <div class="row" style="justify-content:space-between">
          <span class="chip">第 ${waveIdx % WAVES.length + 1} 波 · ${W.note.slice(0, 12)}</span>
          <span class="chip">🔥 连对 <b id="g-streak">${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 <b id="g-score-chip">${score}</b></span>
          <span class="chip">失误 ${wrong} 次 · 不限时</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="g-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <h3 class="mt">🛂 第 ${waveIdx % WAVES.length + 1} 波 · ${W.note}</h3>
        <p class="sub">离子会<b>停在窗口等你判断</b>，没有时间压力：会和泳池反应的点 <b>「拦截」</b>，能共存的点 <b>「放行」</b>。连续判断正确 ${PASS_STREAK} 个即过关，答错连对清零但不会结束。</p>
        <div class="belt-zone" id="belt">
          <div class="pool-side" id="pool-side">
            <div>💧 泳池</div>
            <div class="p-ions" id="pool-ions">${pool.map(p => ION_ICON[p] || p).join('')}</div>
          </div>
          <div id="g-ion-host"></div>
        </div>
        <div class="row" style="justify-content:center;gap:14px">
          <button class="btn btn-primary" id="g-block">🚫 拦截（会反应）</button>
          <button class="btn" id="g-pass">✅ 放行（能共存）</button>
        </div>
        <div class="feedback" id="g-fb">看清泳池里已有的离子，再决定拦还是放。</div>
        <div class="row" style="justify-content:center">
          <button class="btn btn-ghost" id="g-quit">结束本局</button>
        </div>
      </div>`;
    el('g-block').onclick = () => decide(true);
    el('g-pass').onclick = () => decide(false);
    el('g-quit').onclick = () => end(false);
    showIon();
  }

  function showIon() {
    if (!running) return;
    busy = false;
    const label = queue.shift();
    if (!label) { nextWave(); return; }
    current = { label };
    const host = el('g-ion-host');
    if (host) {
      host.innerHTML = `<div class="belt-ion waiting" id="g-ion">${ION_ICON[label] || '❓'} ${label}</div>`;
      const ion = el('g-ion');
      if (ion) ion.onclick = () => decide(true);   /* 直接点离子 = 拦截 */
    }
    const fb = el('g-fb');
    if (fb) { fb.className = 'feedback'; fb.textContent = `轮到 ${label} 了——它会和泳池里的离子反应吗？`; }
  }

  function nextWave() {
    waveIdx++;
    startWave();
  }

  function decide(blocked) {
    if (busy || !running || !current) return;
    busy = true;
    const label = current.label;
    const chk = RX.poolCheck(pool, label);
    const react = chk.react;
    const right = (blocked && react) || (!blocked && !react);
    const fb = el('g-fb');
    const ionEl = el('g-ion');
    let msg = '';

    if (right) {
      correct++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      score += GAIN;
      RX.addXP(GAIN);
      RX.lb.submit('gate', score, streak >= PASS_STREAK);
      const eq = chk.eq || RX.eqFor(chk.with, label);
      if (blocked && react) {
        if (ionEl) ionEl.classList.add('blocked');
        msg = `🚫 拦截正确！${label} 会与池中 ${chk.with} 反应。${eq ? '方程式：' + eq : ''}（+${GAIN} 分，连对 ${streak}）`;
      } else {
        pool.push(label);
        if (ionEl) ionEl.classList.add('missed');
        const p = el('pool-ions');
        if (p) p.textContent = pool.map(x => ION_ICON[x] || x).join('');
        msg = `✅ 放行正确！${label} 与池中离子可以共存，已加入泳池。（+${GAIN} 分，连对 ${streak}）`;
      }
      fb.className = 'feedback good';
    } else {
      wrong++;
      streak = 0;
      if (ionEl) ionEl.classList.add('bad-pick');
      const eq = chk.eq || RX.eqFor(chk.with, label);
      fb.className = 'feedback bad';
      if (blocked && !react) {
        msg = `⚠️ 误拦！${label} 与池中离子不反应，本该放行。连对清零，不限时继续练！`;
      } else {
        msg = `💥 放进去了！${label} 会与池中 ${chk.with} 反应。${eq ? '方程式：' + eq : ''}连对清零，不限时继续练！`;
      }
    }
    fb.innerHTML = msg + (streak >= PASS_STREAK ? '　🎉 达标过关！' : '');
    paint();
    el('gate-score').textContent = '得分 ' + score;

    if (streak >= PASS_STREAK) {
      nextTimer = setTimeout(() => { if (running) win(); }, 600);
      return;
    }
    nextTimer = setTimeout(() => {
      if (!running) return;
      withinWave++;
      if (withinWave >= IONS_PER_WAVE || !queue.length) nextWave();
      else showIon();
    }, 650);
  }

  function paint() {
    const s = el('g-streak'); if (s) s.textContent = streak;
    const sc = el('g-score-chip'); if (sc) sc.textContent = score;
    const bar = el('g-bar'); if (bar) bar.style.width = (streak / PASS_STREAK * 100) + '%';
    const chips = document.querySelectorAll('#gate-root .chip');
    if (chips[3]) chips[3].innerHTML = `失误 ${wrong} 次 · 不限时`;
  }

  function panel(winFlag, title, emoji) {
    clearNext();
    running = false;
    const passed = !!winFlag;
    RX.store.finishGame('gate', score, passed);
    const res = RX.lb.submit('gate', score, passed);
    el('gate-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${emoji}</div>
        <h3>${title}</h3>
        <p class="sub">得分 <b>${score}</b> 分 · 最长连对 <b>${maxStreak}</b> / ${PASS_STREAK} 个 · 累计判断正确 ${correct} 个 · 失误 ${wrong} 次。${passed
          ? '连续判断正确达标，过关标准已达成！'
          : '答错会清零连对，但不限时，可以一直练。'}</p>
        <p class="sub">${!res.ok ? '教师模式 · 成绩不计入排行榜' : (res.improved ? `刷新个人最高分！${res.rank ? '当前排名第 ' + res.rank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 离子海关 · 排行榜</h3>
          ${RX.lb.render('gate', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="g-again">再来一次</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回地图</button>
        </div>
      </div>`;
    el('g-again').onclick = mount;
  }

  function win() { panel(true, '✅ 过关！连续 10 次判断全对', '🛂'); RX.celebrate(); }
  function end(winFlag) { panel(winFlag, '本局结束', '💧'); }

  /* 测试辅助：只读当前局面 */
  RX.gateCurrent = function () {
    return {
      label: current ? current.label : null,
      pool: pool.slice(),
      shouldBlock: current ? RX.poolCheck(pool, current.label).react : null,
      streak, score, correct, wrong, wave: waveIdx % WAVES.length + 1, busy,
    };
  };

  RX.register('gate', { title: '离子海关', mount, unmount });
})();
