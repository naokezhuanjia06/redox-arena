/* ============================================================
   game_valence.js —— 🗺️ 价态地图（困难模块 · 独立排行榜）
   Fe 家族（0 / +2 / +3）× Cl 家族（-1 / 0）的二维地图：
   每走一条转化箭头，就要选对能实现它的试剂（含条件）。
   - 不限时；连续走通 8 条箭头即过关，选错连对清零但不结束
   - 每条 +25 分；选错会讲解原因，可以立即重选
   - 覆盖 Fe↔Fe²⁺↔Fe³⁺ 与 Cl⁻↔Cl₂ 全部转化
   ============================================================ */
(function () {
  const GAIN = 25;

  /* 地图箭头：from→to，选对试剂才能走通 */
  const EDGES = [
    {
      from: 'Fe', to: 'Fe²⁺', family: 'Fe',
      opts: ['稀盐酸', 'Cl₂（点燃）', '浓硝酸（常温）'], answer: '稀盐酸',
      eq: 'Fe + 2H⁺ = Fe²⁺ + H₂↑',
      why: 'H⁺ 氧化性弱，只能把 Fe 氧化到 +2；Cl₂ 强氧化直接到 +3；常温浓硝酸使 Fe 钝化。',
    },
    {
      from: 'Fe²⁺', to: 'Fe³⁺', family: 'Fe',
      opts: ['通入 Cl₂', '滴加 I₂ 水', '加稀硫酸'], answer: '通入 Cl₂',
      eq: '2Fe²⁺ + Cl₂ = 2Fe³⁺ + 2Cl⁻',
      why: '氧化性 Cl₂ > Fe³⁺，强制弱成立；I₂ 氧化性比 Fe³⁺ 还弱，稀硫酸根本氧化不了 Fe²⁺。',
    },
    {
      from: 'Fe³⁺', to: 'Fe²⁺', family: 'Fe',
      opts: ['加入 Fe 粉', '通入 Cl₂', '加入 NaBr'], answer: '加入 Fe 粉',
      eq: '2Fe³⁺ + Fe = 3Fe²⁺',
      why: '需要还原剂：Fe/Cu/I⁻ 都可以；Br⁻ 还原性比 Fe²⁺ 弱不反应，Cl₂ 方向相反。',
    },
    {
      from: 'Fe³⁺', to: 'Fe', family: 'Fe',
      opts: ['加入过量 Zn', '加入 Fe 粉', '加入 Cu 粉'], answer: '加入过量 Zn',
      eq: '3Zn + 2Fe³⁺ = 3Zn²⁺ + 2Fe',
      why: '活泼金属足量才能把铁一路置换到单质；Fe 粉、Cu 粉只能把 Fe³⁺ 还原到 Fe²⁺。',
    },
    {
      from: 'Fe²⁺', to: 'Fe', family: 'Fe',
      opts: ['加入 Zn 粒', '加入 Cu 粉', '加稀盐酸'], answer: '加入 Zn 粒',
      eq: 'Zn + Fe²⁺ = Zn²⁺ + Fe',
      why: '金属活动性 Zn > Fe > Cu，只有前面的金属能把后面的置换出来；稀盐酸与 Fe²⁺ 不反应。',
    },
    {
      from: 'Fe', to: 'Fe³⁺', family: 'Fe',
      opts: ['Cl₂（点燃）', '稀盐酸', 'I₂（加热）'], answer: 'Cl₂（点燃）',
      eq: '2Fe + 3Cl₂ =点燃= 2FeCl₃',
      why: '强氧化剂 Cl₂ 一步把 Fe 氧化到 +3；稀盐酸、I₂ 等弱氧化剂只能到 +2。',
    },
    {
      from: 'Cl⁻', to: 'Cl₂', family: 'Cl',
      opts: ['MnO₂ + 浓盐酸（加热）', 'Br₂ 水', '浓硫酸'], answer: 'MnO₂ + 浓盐酸（加热）',
      eq: 'MnO₂ + 4HCl(浓) =Δ= MnCl₂ + Cl₂↑ + 2H₂O',
      why: 'Cl⁻→Cl₂ 需要更强氧化剂或特殊条件：MnO₂ 必须配浓盐酸并加热；Br₂ 氧化性不足，浓硫酸也氧化不了 Cl⁻。',
    },
    {
      from: 'Cl₂', to: 'Cl⁻', family: 'Cl',
      opts: ['通入 FeCl₂ 溶液', '加入 MnO₂', '酸性 KMnO₄'], answer: '通入 FeCl₂ 溶液',
      eq: 'Cl₂ + 2Fe²⁺ = 2Cl⁻ + 2Fe³⁺',
      why: 'Cl₂ 要变 Cl⁻ 是得电子被还原，必须加还原剂；MnO₂、KMnO₄ 都是氧化剂，方向相反。',
    },
  ];
  RX.VALENCE_EDGES = EDGES;   /* 供测试/讲解复用 */
  const TOTAL = EDGES.length, PASS_STREAK = TOTAL;

  let score = 0, step = 0, streak = 0, correct = 0, wrong = 0, maxStreak = 0;
  let running = false, busy = false;
  const el = id => document.getElementById(id);

  function mount() {
    score = 0; step = 0; streak = 0; correct = 0; wrong = 0; maxStreak = 0;
    busy = false; running = true;
    startScreen();
  }
  function unmount() { running = false; }

  function startScreen() {
    const best = RX.lb.myBest('valence');
    el('valence-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">🗺️</div>
        <h3>价态地图</h3>
        <p class="sub">一张 <b>Fe 家族（0 / +2 / +3）× Cl 家族（-1 / 0）</b>的二维地图。<br>
          每走一条转化箭头，都要选对能实现它的<b>试剂（含条件）</b>：<br>
          Fe→Fe²⁺ 用稀盐酸还是 Cl₂？Cl⁻→Cl₂ 为什么要浓盐酸 + 加热？<br>
          共 <b>${TOTAL} 条箭头</b>，每条 <b>+${GAIN}</b> 分；<b>不限时</b>，连续走通 <b>${PASS_STREAK} 条</b>即过关；选错连对清零并讲解，可立即重选。
          ${best ? `　· 我的最高分 <b>${best}</b>` : ''}</p>
        <div class="mt"><button class="btn btn-primary" id="valence-start">进入地图</button></div>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 价态地图 · 排行榜</h3>
          ${RX.lb.render('valence', 5)}
        </div>
      </div>`;
    el('valence-start').onclick = start;
  }

  function start() {
    score = 0; step = 0; streak = 0; correct = 0; wrong = 0; maxStreak = 0;
    busy = false; running = true;
    render();
  }

  function render(fbHtml, fbCls) {
    if (!running) return;
    busy = false;
    const e = EDGES[step];
    el('valence-root').innerHTML = `
      <div class="panel card" data-step="${step}">
        <div class="row" style="justify-content:space-between">
          <span class="chip">🔥 连对 <b>${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 <b>${score}</b></span>
          <span class="chip">已走通 ${step} / ${TOTAL} 条箭头 · 选错 ${wrong} 次</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="valence-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <div class="valence-map">
          <div class="vm-row"><span class="vm-fam">🧲 Fe 家族</span>
            <span class="vm-node ${step === 0 || step === 5 ? 'cur' : ''}">Fe<span>0</span></span>
            <span class="vm-node ${step === 1 || step === 4 ? 'cur' : ''}">Fe²⁺<span>+2</span></span>
            <span class="vm-node ${step === 2 || step === 3 ? 'cur' : ''}">Fe³⁺<span>+3</span></span>
          </div>
          <div class="vm-row"><span class="vm-fam">🌊 Cl 家族</span>
            <span class="vm-node ${step === 6 ? 'cur' : ''}">Cl⁻<span>-1</span></span>
            <span class="vm-node ${step === 7 ? 'cur' : ''}">Cl₂<span>0</span></span>
          </div>
        </div>
        <div class="vm-arrows">
          ${EDGES.map((ed, i) => `<span class="vm-arrow ${i < step ? 'done' : i === step ? 'cur' : ''}">${ed.from}→${ed.to}${i < step ? ' ✅' : ''}</span>`).join('')}
        </div>
        <div class="cmd-banner">第 ${step + 1} / ${TOTAL} 步：${e.from} → ${e.to}，选能实现这一步的试剂！</div>
        <div class="oxi-grid">
          ${RX.shuffle(e.opts).map(o => `<div class="oxi-opt" data-v="${o}">${o}</div>`).join('')}
        </div>
        <div class="feedback ${fbCls || ''}" id="valence-fb">${fbHtml || '想一想：这一步是得电子还是失电子？需要氧化剂还是还原剂？条件够不够？'}</div>
      </div>`;
    el('valence-root').querySelectorAll('.oxi-opt').forEach(opt => {
      opt.onclick = () => answer(opt);
    });
  }

  function answer(opt) {
    if (busy || !running) return;
    busy = true;
    const e = EDGES[step];
    const right = opt.dataset.v === e.answer;
    const fb = el('valence-fb');
    const chips = el('valence-root').querySelectorAll('.chip');

    if (right) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      correct++;
      step = (step + 1) % TOTAL;
      score += GAIN;
      RX.addXP(GAIN);
      RX.lb.submit('valence', score, streak >= PASS_STREAK);
      fb.className = 'feedback good';
      fb.innerHTML = `✅ 正确！${e.eq}。${e.why}　+${GAIN}（连对 ${streak}）${streak >= PASS_STREAK ? '　🎉 达标过关！' : ''}`;
      if (streak >= PASS_STREAK) {
        end(true);
        return;
      }
      setTimeout(() => { if (running) render(`✅ 走通 ${e.from}→${e.to}！继续下一条箭头（连对 ${streak}）。`, 'good'); }, 60);
    } else {
      wrong++;
      streak = 0;
      opt.classList.add('lose');
      fb.className = 'feedback bad';
      fb.innerHTML = `❌ 这瓶走不通。${e.why}　连对清零，不限时，再选一次！`;
      setTimeout(() => { if (running) { busy = false; } }, 700);
    }
    if (chips[0]) chips[0].innerHTML = `🔥 连对 <b>${streak}</b> / 目标 ${PASS_STREAK}`;
    if (chips[1]) chips[1].innerHTML = `得分 <b>${score}</b>`;
    if (chips[2]) chips[2].innerHTML = `已走通 ${step} / ${TOTAL} 条箭头 · 选错 ${wrong} 次`;
    const bar = el('valence-bar');
    if (bar) bar.style.width = (streak / PASS_STREAK * 100) + '%';
  }

  function end(win) {
    running = false;
    const passed = !!win;
    RX.store.finishGame('valence', score, passed);
    const res = RX.lb.submit('valence', score, passed);
    el('valence-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${passed ? '🏅' : '🗺️'}</div>
        <h3>${passed ? '🎉 全图走通，过关！' : '本局结束'}　总分 ${score}</h3>
        <p class="sub">最长连对 <b>${maxStreak}</b> 条 / 目标 ${PASS_STREAK} 条 · 累计走通 ${correct} 条 · 选错 ${wrong} 次。${passed
          ? 'Fe 与 Cl 两个家族的全部转化你都拿下了！'
          : '选错会清零连对，但不限时，记住：先看升降价，再选氧化剂/还原剂，最后查条件。'}</p>
        <p class="sub">${!res.ok
          ? '教师模式 · 成绩不计入排行榜'
          : (res.improved ? `刷新个人最高分！${res.rank ? '当前排名第 ' + res.rank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 价态地图 · 排行榜</h3>
          ${RX.lb.render('valence', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="valence-again">再走一遍</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回地图</button>
        </div>
      </div>`;
    el('valence-again').onclick = start;
    if (passed) RX.celebrate();
  }

  RX.register('valence', { title: '价态地图', mount, unmount });
})();
