/* ============================================================
   game_quick.js —— ⚡ 四身份速判（板块一 · 独立排行榜）
   不限时：判断"某物质是不是某身份"，✓/✗ 作答。
   - 连续答对 8 个即过关；答错连对清零，但不结束，可以继续练
   - 每答对 1 题 +20 分；成绩计入本游戏独立排行榜，取该生最高一次
   ============================================================ */
(function () {
  const PASS_STREAK = 8, GAIN = 20;
  let score = 0, streak = 0, maxStreak = 0, correct = 0, wrong = 0;
  let running = false, cur = null, answered = true;
  const el = id => document.getElementById(id);

  function startScreen() {
    const id = RX.identity.get();
    const best = RX.lb.myBest('quick');
    const passed = RX.lb.myPassed('quick');
    el('quick-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">⚡</div>
        <h3>四身份速判</h3>
        <p class="sub">方程式 + 身份判断句接连出现，点 ✓ / ✗。<br>
        <b>不限时</b>！连续答对 <b>${PASS_STREAK} 个</b>即过关；答错连对清零，但不会结束，可以一直练到全对为止。</p>
        <p class="sub" style="margin-top:8px">当前身份：${RX.identity.label()}${id && id.isTeacher ? '（教师模式 · 不计入排行榜）' : ''}
          ${best ? ` · 我的最高分 <b>${best}</b>${passed ? '（已过关）' : ''}` : ''}</p>
        <div class="mt"><button class="btn btn-primary" id="qk-start">开始挑战</button></div>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 四身份速判 · 排行榜</h3>
          ${RX.lb.render('quick', 5)}
        </div>
      </div>`;
    el('qk-start').onclick = start;
  }

  function start() {
    score = 0; streak = 0; maxStreak = 0; correct = 0; wrong = 0;
    running = true;
    next();
  }

  function stop() { running = false; }

  function next() {
    cur = RX.makeStmt();
    answered = false;
    el('quick-root').innerHTML = `
      <div class="panel card">
        <div class="row" style="justify-content:space-between">
          <span class="chip">🔥 连对 <b id="qk-streak">${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 <b>${score}</b></span>
          <span class="chip">累计答对 ${correct} · 答错 ${wrong}</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="qk-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <div class="quiz-q" style="text-align:center;min-height:72px">${cur.text}</div>
        <div class="row" style="justify-content:center;gap:22px">
          <button class="btn qk-btn qk-yes" id="qk-yes">✓ 是</button>
          <button class="btn qk-btn qk-no" id="qk-no">✗ 不是</button>
        </div>
        <div class="feedback" id="qk-fb">看清方程式，再判断这句话说得对不对。</div>
      </div>`;
    el('qk-yes').onclick = () => answer(true);
    el('qk-no').onclick = () => answer(false);
  }

  function answer(said) {
    if (answered || !running) return;
    answered = true;
    const good = said === cur.truth;
    const fb = el('qk-fb');
    if (good) {
      correct++; streak++;
      maxStreak = Math.max(maxStreak, streak);
      score += GAIN;
      RX.addXP(GAIN);
      RX.lb.submit('quick', score, streak >= PASS_STREAK);
      fb.className = 'feedback good';
      fb.textContent = `✓ 正确 +${GAIN}（连对 ${streak}）${streak >= PASS_STREAK ? ' · 🎉 达标过关！' : ''}　${cur.explain}`;
    } else {
      wrong++;
      streak = 0;
      fb.className = 'feedback bad';
      fb.textContent = `✗ 错了，连对清零（还能继续练）。${cur.explain}`;
    }
    paint();
    if (streak >= PASS_STREAK) {
      setTimeout(() => { if (running) end(true); }, 450);
      return;
    }
    setTimeout(() => { if (running) next(); }, good ? 350 : 900);
  }

  function paint() {
    const s = el('qk-streak'); if (s) s.textContent = streak;
    const bar = el('qk-bar'); if (bar) bar.style.width = (streak / PASS_STREAK * 100) + '%';
    const chips = document.querySelectorAll('#quick-root .chip');
    if (chips[1]) chips[1].innerHTML = `得分 <b>${score}</b>`;
    if (chips[2]) chips[2].innerHTML = `累计答对 ${correct} · 答错 ${wrong}`;
  }

  function end(win) {
    stop();
    const passed = !!win;
    RX.store.finishGame('quick', score, passed);
    const res = RX.lb.submit('quick', score, passed);
    const rows = RX.lb.top('quick', 10);
    const id = RX.identity.get();
    const myRank = res.ok && id ? rows.findIndex(r => r.k === [id.grade, id.cls, id.name].join('|')) + 1 : 0;

    el('quick-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${passed ? '🏅' : '🌤'}</div>
        <h3>${passed ? '🎉 过关！' : '本局结束'}　总得分 ${score}</h3>
        <p class="sub">连续答对 <b>${maxStreak}</b> 个（目标 ${PASS_STREAK}） · 累计答对 ${correct} 个 · 答错 ${wrong} 个。${passed
          ? '连续答对达标，过关标准已达成！'
          : `还差 ${PASS_STREAK - streak} 个连对（答错会清零，但不限时）。`}</p>
        <p class="sub">${!res.ok
          ? '教师模式 · 成绩不计入排行榜'
          : (res.improved ? `刷新个人最高分！${myRank ? '当前排名第 ' + myRank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 四身份速判 · 排行榜</h3>
          ${RX.lb.render('quick', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="qk-again">再来一次</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回首页</button>
        </div>
      </div>`;
    el('qk-again').onclick = start;
    if (passed) RX.celebrate();
  }

  RX.register('quick', {
    title: '四身份速判',
    mount() { stop(); startScreen(); },
    unmount() { stop(); },
  });
})();
