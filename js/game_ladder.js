/* ============================================================
   game_ladder.js —— 🪜 阶梯夺擂（板块二 · 强弱顺序速记 · 独立排行榜）
   两张卡比强弱，但难度会"升级"：连对越多，两卡档位差越小——
   Lv.1 相差 4 档以上 → Lv.2 相差 3 档 → Lv.3 相差 2 档 → Lv.4 只差 1 档
   答错难度立刻回落到 Lv.1。只有真正背熟整条阶梯才能拿分。
   - 不限时；连续答对 8 组即过关，答错连对清零但不结束
   - 每组 +25 分；覆盖四条阶梯：氧化性 / 还原性 / 金属活动性 / 金属阳离子氧化性
   ============================================================ */
(function () {
  const GAIN = 25, PASS_STREAK = 8, MAX_LV = 4;

  /* 阶梯：strongFirst=true 表示数组头部最强 */
  const LADDERS = [
    { ask: '谁的氧化性更强？', label: '氧化性', items: RX.OX_LADDER, strongFirst: true },
    { ask: '谁的还原性更强？', label: '还原性', items: RX.RED_LADDER, strongFirst: false },
    { ask: '哪种金属更活泼？', label: '金属活动性', items: RX.METAL_LADDER, strongFirst: true },
    { ask: '哪种离子的氧化性更强？', label: '氧化性（阳离子）', items: RX.METAL_CATION_LADDER, strongFirst: false },
  ];
  const LV_NAME = { 1: '热身 · 相差 4 档以上', 2: '升温 · 相差 3 档', 3: '胶着 · 相差 2 档', 4: '夺擂 · 只差 1 档' };

  let score = 0, correct = 0, wrong = 0, streak = 0, maxStreak = 0;
  let running = false, busy = false;
  let q = null, display = ['', ''];   // display[0]=左卡 display[1]=右卡
  const el = id => document.getElementById(id);

  const lvNow = () => Math.min(MAX_LV, 1 + streak);
  const rankOf = (L, v) => {
    const i = L.items.indexOf(v);
    return L.strongFirst ? i : (L.items.length - 1 - i);
  };

  /* ---------- 出题：两卡档位差由当前难度决定 ---------- */
  function makeQ() {
    const L = RX.pick(LADDERS);
    const items = L.items;
    const maxGap = items.length - 1;
    const lv = lvNow();
    /* Lv.1 起码差 4 档；Lv.2/3/4 精确差 3/2/1 档 */
    const gap = lv === 1 ? 4 + Math.floor(Math.random() * (maxGap - 4 + 1)) : lv;
    const pairs = [];
    for (let i = 0; i + gap < items.length; i++) pairs.push([i, i + gap]);
    const [i, j] = RX.pick(pairs);
    const strong = L.strongFirst ? items[i] : items[j];
    const weak = L.strongFirst ? items[j] : items[i];
    const leftFirst = Math.random() < 0.5;
    display = leftFirst ? [strong, weak] : [weak, strong];
    q = { L, strong, weak, ask: L.ask, lv };
  }

  /* ---------- 生命周期 ---------- */
  function mount() {
    score = 0; correct = 0; wrong = 0; streak = 0; maxStreak = 0;
    busy = false; running = true;
    startScreen();
  }

  function unmount() { running = false; }

  function startScreen() {
    const best = RX.lb.myBest('ladder');
    el('ladder-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">🪜</div>
        <h3>阶梯夺擂</h3>
        <p class="sub">两张卡比强弱——<b>连对越多，两卡差距越小</b>：<br>
          Lv.1 相差 4 档以上 → Lv.2 相差 3 档 → Lv.3 相差 2 档 → <b>Lv.4 只差 1 档</b>。<br>
          答错立刻打回 Lv.1！<b>不限时</b>，连续答对 <b>${PASS_STREAK} 组</b>即过关；答错连对清零，但可以继续练（每组 +${GAIN} 分）。</p>
        <p class="sub" style="margin-top:8px">
          出题范围：氧化性阶梯 · 还原性阶梯 · 金属活动性 · 金属阳离子氧化性
          ${best ? `　· 我的最高分 <b>${best}</b>` : ''}
        </p>
        <div class="mt"><button class="btn btn-primary" id="ladder-start">开始夺擂</button></div>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 阶梯夺擂 · 排行榜</h3>
          ${RX.lb.render('ladder', 5)}
        </div>
      </div>`;
    el('ladder-start').onclick = start;
  }

  function start() {
    score = 0; correct = 0; wrong = 0; streak = 0; maxStreak = 0;
    busy = false; running = true;
    nextQ();
  }

  function nextQ() {
    if (!running) return;
    makeQ();
    busy = false;
    el('ladder-root').innerHTML = `
      <div class="panel card">
        <div class="row" style="justify-content:space-between">
          <span class="chip">🔥 连对 <b>${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 <b>${score}</b></span>
          <span class="chip">累计答对 ${correct} · 答错 ${wrong}</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="ladder-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <div class="cmd-banner">${q.ask}</div>
        <div class="row" style="justify-content:center;margin:8px 0 0">
          <span class="chip lv-chip">🔥 难度 Lv.${q.lv} · ${LV_NAME[q.lv]}（连对 ${streak}）</span>
        </div>
        <div class="duel-arena">
          <div class="duel-card" data-side="0">${display[0]}</div>
          <div class="duel-vs">VS</div>
          <div class="duel-card" data-side="1">${display[1]}</div>
        </div>
        <div class="feedback" id="ladder-fb">点更强的那一张！答对升级、答错打回 Lv.1。</div>
      </div>`;
    el('ladder-root').querySelectorAll('.duel-card').forEach(card => {
      card.onclick = () => answer(+card.dataset.side, card);
    });
  }

  function answer(side, card) {
    if (busy || !running) return;
    busy = true;
    const picked = display[side];
    const right = picked === q.strong;
    const fb = el('ladder-fb');
    const L = q.L;

    el('ladder-root').querySelectorAll('.duel-card').forEach(c => {
      c.classList.add(c.textContent.trim() === q.strong ? 'win' : 'lose');
    });

    if (right) {
      correct++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      score += GAIN;
      RX.addXP(GAIN);
      RX.lb.submit('ladder', score, streak >= PASS_STREAK);
      fb.className = 'feedback good';
      fb.innerHTML = `✅ 正确！${L.label}：<b>${q.strong} ＞ ${q.weak}</b>　+${GAIN}（连对 ${streak}）` +
        (streak >= PASS_STREAK ? '　🎉 达标过关！' : (lvNow() > q.lv ? `　🔥 升级到 Lv.${lvNow()}！` : ''));
    } else {
      wrong++;
      streak = 0;
      fb.className = 'feedback bad';
      fb.innerHTML = `❌ 错了。<b>${q.strong}</b> 的${L.label}更强（${q.strong} ＞ ${picked}）。难度打回 Lv.1，连对清零，不限时继续练！`;
    }

    const chips = el('ladder-root').querySelectorAll('.chip');
    if (chips[0]) chips[0].innerHTML = `🔥 连对 <b>${streak}</b> / 目标 ${PASS_STREAK}${streak >= PASS_STREAK ? ' · ✅已过关' : ''}`;
    if (chips[1]) chips[1].innerHTML = `得分 <b>${score}</b>`;
    if (chips[2]) chips[2].innerHTML = `累计答对 ${correct} · 答错 ${wrong}`;
    if (chips[3]) chips[3].innerHTML = `🔥 难度 Lv.${lvNow()} · ${LV_NAME[lvNow()]}（连对 ${streak}）`;
    const bar = el('ladder-bar');
    if (bar) bar.style.width = (streak / PASS_STREAK * 100) + '%';

    if (streak >= PASS_STREAK) {
      setTimeout(() => { if (running) end(true); }, 450);
      return;
    }
    setTimeout(() => { if (running) nextQ(); }, right ? 320 : 900);
  }

  function end(win) {
    running = false;
    const passed = !!win;
    RX.store.finishGame('ladder', score, passed);
    const res = RX.lb.submit('ladder', score, passed);
    el('ladder-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${passed ? '🏅' : '🪜'}</div>
        <h3>${passed ? '🎉 过关！' : '本局结束'}　总分 ${score}</h3>
        <p class="sub">最长连对 <b>${maxStreak}</b> 组 / 目标 ${PASS_STREAK} 组 · 累计答对 ${correct} 组 · 答错 ${wrong} 组。${passed
          ? '连续答对达标，过关标准已达成！'
          : '答错会清零连对，但不限时，可以一直练。'}</p>
        <p class="sub">${!res.ok
          ? '教师模式 · 成绩不计入排行榜'
          : (res.improved ? `刷新个人最高分！${res.rank ? '当前排名第 ' + res.rank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 阶梯夺擂 · 排行榜</h3>
          ${RX.lb.render('ladder', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="ladder-again">再战一次</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回首页</button>
        </div>
      </div>`;
    el('ladder-again').onclick = start;
    if (passed) RX.celebrate();
  }

  RX.register('ladder', { title: '阶梯夺擂', mount, unmount });
})();
