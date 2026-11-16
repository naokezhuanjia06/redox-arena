/* ============================================================
   game_slots.js —— 🎰 四槽老虎机（板块一 · 独立排行榜）
   每题一个方程式 + 4 张物质卡：把卡【拖动】到对应身份槽里。
   - 不限时；连续答对 7 道即过关，答错连对清零但不结束
   - 每答对 1 道 +20 分
   - 拖拽用 Pointer Events（鼠标 + 触屏通用），浮层卡直接跟手
   - 也支持"轻点卡片 → 轻点槽位"的两步投放；点已填的槽可取回
   ============================================================ */
(function () {
  const GAIN = 20, PASS_STREAK = 7;
  let qNo = 0, score = 0, streak = 0, maxStreak = 0, wrong = 0, passed = false;
  let cur = null, assign = {}, selV = null;
  let running = false, checking = false;
  const el = id => document.getElementById(id);

  /* 拖拽状态 */
  let drag = null, lastOver = null, suppressClick = false;
  const HAS_POINTER = typeof window !== 'undefined' && !!window.PointerEvent;
  const EV = {
    down: HAS_POINTER ? 'pointerdown' : 'mousedown',
    move: HAS_POINTER ? 'pointermove' : 'mousemove',
    up: HAS_POINTER ? 'pointerup' : 'mouseup',
  };

  /* ---------- 生命周期 ---------- */
  function start() {
    qNo = 0; score = 0; streak = 0; maxStreak = 0; wrong = 0; passed = false; running = true;
    nextQ();
  }

  function stop() { running = false; endDrag(); }

  /* ---------- 出题 ---------- */
  function pickEq() {
    for (let i = 0; i < 40; i++) {
      const eq = RX.pick(RX.EQ_BANK);
      if (eq.hard) continue;                       // 歧化反应四个身份不唯一
      if (new Set([eq.ox, eq.red, eq.op, eq.rp]).size < 4) continue;
      return eq;
    }
    return RX.EQ_BANK.find(e => !e.hard);
  }

  function nextQ() {
    if (!running) return;
    qNo++;
    cur = pickEq();
    assign = {}; selV = null; checking = false;
    render();
  }

  /* ---------- 渲染 ---------- */
  function render() {
    const cards = RX.shuffle(RX.ROLES.map(r => cur[r.key]));
    el('slots-root').innerHTML = `
      <div class="panel card">
        <div class="row" style="justify-content:space-between">
          <span class="chip">第 ${qNo} 题</span>
          <span class="chip">🔥 连对 <b>${streak}</b> / 目标 ${PASS_STREAK}${passed ? ' · ✅已过关' : ''}</span>
          <span class="chip">得分 <b>${score}</b></span>
          <span class="chip">不限时 · 答错 ${wrong} 次</span>
        </div>
        <div class="progress-track" style="height:8px"><i id="sl-bar" style="width:${streak / PASS_STREAK * 100}%"></i></div>
        <div class="quiz-q" style="text-align:center">${cur.eq}</div>
        <p class="sub" style="text-align:center">把下面的物质卡 <b>拖进</b> 对应的身份槽（也可以先点卡、再点槽）；点已填的槽可取回。<br>
          <b>不限时</b>，连续答对 ${PASS_STREAK} 道即过关；答错连对清零，但可以继续练（每道 +${GAIN} 分）。</p>
        <div class="slot-row" id="slot-row">
          ${RX.ROLES.map(r => `
            <div class="slot-box" data-slot="${r.key}">
              <div class="slot-title">${r.name}</div>
              <div class="slot-hold" data-hold="${r.key}"></div>
            </div>`).join('')}
        </div>
        <div class="mat-row" id="mat-row">
          ${cards.map(c => `<div class="mat-chip" data-v="${c}">${c}</div>`).join('')}
        </div>
        <div class="feedback" id="sl-fb">开始分配身份吧！</div>
      </div>`;

    el('mat-row').querySelectorAll('.mat-chip').forEach(chip => {
      chip.addEventListener(EV.down, startDrag);
    });
    el('slot-row').querySelectorAll('.slot-hold').forEach(h => {
      h.addEventListener('click', () => {
        if (suppressClick) return;
        const key = h.dataset.hold;
        if (assign[key]) return retrieve(key);
        if (!selV) { RX.toast('先拖动或轻点一张物质卡'); return; }
        place(key, selV);
      });
    });
    paint();
  }

  /* 只刷新状态，不重建 DOM（避免拖拽被打断） */
  function paint() {
    RX.ROLES.forEach(r => {
      const box = document.querySelector(`.slot-box[data-slot="${r.key}"]`);
      if (!box) return;
      const hold = box.querySelector('.slot-hold');
      const v = assign[r.key];
      hold.classList.toggle('filled', !!v);
      hold.innerHTML = v ? v : '<span class="hold-tip">拖入</span>';
    });
    const usedVals = Object.values(assign).filter(Boolean);
    document.querySelectorAll('.mat-chip').forEach(c => {
      const used = usedVals.includes(c.dataset.v);
      c.classList.toggle('used', used);
      c.classList.toggle('sel', !used && c.dataset.v === selV);
    });
  }

  /* ---------- 拖拽 ---------- */
  function startDrag(e) {
    if (checking || !running) return;
    if (e.button != null && e.button !== 0) return;
    const chip = e.currentTarget;
    if (chip.classList.contains('used')) return;

    const rect = chip.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = chip.dataset.v;
    if (rect.width) { ghost.style.width = rect.width + 'px'; ghost.style.height = rect.height + 'px'; }
    document.body.appendChild(ghost);

    const cx = e.clientX || 0, cy = e.clientY || 0;
    drag = {
      chip, ghost, v: chip.dataset.v,
      dx: cx - rect.left, dy: cy - rect.top,
      sx: cx, sy: cy, moved: false,
    };
    chip.classList.add('dragging');
    moveGhost(cx, cy);

    window.addEventListener(EV.move, onMove, { passive: false });
    window.addEventListener(EV.up, onUp);
    window.addEventListener('pointercancel', onUp);
    if (e.cancelable) e.preventDefault();
  }

  function moveGhost(x, y) {
    if (!drag) return;
    drag.ghost.style.transform = `translate3d(${x - drag.dx}px, ${y - drag.dy}px, 0)`;
  }

  function hitSlot(x, y) {
    if (!x && !y) return null;
    try {
      const u = document.elementFromPoint(x, y);
      if (!u || !u.closest) return null;
      const box = u.closest('.slot-box');
      return box && box.isConnected ? box : null;
    } catch (err) { return null; }
  }

  function highlight(box) {
    if (box === lastOver) return;
    if (lastOver) lastOver.classList.remove('over');
    lastOver = box;
    if (lastOver) lastOver.classList.add('over');
  }

  function onMove(e) {
    if (!drag) return;
    const x = e.clientX, y = e.clientY;
    if (Math.abs(x - drag.sx) + Math.abs(y - drag.sy) > 6) drag.moved = true;
    moveGhost(x, y);
    highlight(hitSlot(x, y));
    if (e.cancelable) e.preventDefault();
  }

  function onUp(e) {
    if (!drag) return;
    const d = drag;
    const x = e.clientX != null ? e.clientX : d.sx;
    const y = e.clientY != null ? e.clientY : d.sy;
    const box = hitSlot(x, y);
    const dropped = box && box.dataset.slot;
    endDrag();
    if (dropped) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      place(dropped, d.v);
    } else if (!d.moved) {
      selV = d.v; paint();
    }
  }

  function endDrag() {
    if (!drag) return;
    drag.ghost.remove();
    drag.chip.classList.remove('dragging');
    highlight(null);
    drag = null;
    window.removeEventListener(EV.move, onMove);
    window.removeEventListener(EV.up, onUp);
    window.removeEventListener('pointercancel', onUp);
  }

  /* ---------- 投放 / 取回 ---------- */
  function place(key, v) {
    if (checking) return;
    RX.ROLES.forEach(r => {
      if (r.key !== key && assign[r.key] === v) assign[r.key] = null;
    });
    assign[key] = v;
    selV = null;
    paint();
    if (RX.ROLES.every(r => assign[r.key])) {
      setTimeout(() => { if (running && !checking) judge(); }, 280);
    }
  }

  function retrieve(key) {
    if (checking || !assign[key]) return;
    assign[key] = null;
    paint();
  }

  /* ---------- 判分：答错连对清零但不结束；连对达标立即过关 ---------- */
  function judge() {
    if (checking) return;
    checking = true;
    endDrag();

    const fb = el('sl-fb');
    let allRight = true;
    const marks = RX.ROLES.map(r => ({ key: r.key, name: r.name, ok: assign[r.key] === cur[r.key] }));
    marks.forEach(m => {
      if (!m.ok) allRight = false;
      const hold = document.querySelector(`[data-hold="${m.key}"]`);
      if (hold) hold.classList.add(m.ok ? 'right' : 'wrong');
    });

    if (allRight) {
      score += GAIN;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
      RX.addXP(GAIN);
      if (streak >= PASS_STREAK) passed = true;
      RX.lb.submit('slots', score, passed);   /* 达标即刻标记过关，不等结算动画 */
      fb.className = 'feedback good';
      fb.textContent = `🎉 全部正确 +${GAIN}（连对 ${streak} 道）${streak >= PASS_STREAK ? ' · 达标过关！' : ''}　氧化剂 ${cur.ox} · 还原剂 ${cur.red} · 氧化产物 ${cur.op} · 还原产物 ${cur.rp}`;
      refreshChips();
      if (streak >= PASS_STREAK) {
        setTimeout(() => { if (running) end(true); }, 900);
        return;
      }
      setTimeout(() => { if (running) nextQ(); }, 900);
    } else {
      wrong++;
      streak = 0;
      fb.className = 'feedback bad';
      fb.textContent = `❌ ${marks.filter(m => !m.ok).map(m => m.name).join('、')}不对，连对清零（还能继续练）。正确答案——氧化剂 ${cur.ox} · 还原剂 ${cur.red} · 氧化产物 ${cur.op} · 还原产物 ${cur.rp}`;
      refreshChips();
      setTimeout(() => { if (running) nextQ(); }, 1800);
    }
  }

  function refreshChips() {
    const chips = document.querySelectorAll('#slots-root .chip');
    if (chips[1]) chips[1].innerHTML = `🔥 连对 <b>${streak}</b> / 目标 ${PASS_STREAK}`;
    if (chips[2]) chips[2].innerHTML = `得分 <b>${score}</b>`;
    if (chips[3]) chips[3].innerHTML = `不限时 · 答错 ${wrong} 次`;
    const bar = el('sl-bar');
    if (bar) bar.style.width = (streak / PASS_STREAK * 100) + '%';
  }

  /* ---------- 结算 ---------- */
  function end(win) {
    stop();
    const res = RX.lb.submit('slots', score, !!win);
    RX.store.finishGame('slots', score, !!win);
    el('slots-root').innerHTML = `
      <div class="panel card result-banner">
        <div class="big-emoji">${win ? '🏅' : '🎰'}</div>
        <h3>${win ? '🎉 过关！' : '本局结束'}　总得分 ${score}</h3>
        <p class="sub">最长连对 <b>${maxStreak}</b> 道 / 目标 ${PASS_STREAK} 道 · 答错 ${wrong} 次。${win
          ? '连续答对达标，过关标准已达成！'
          : '答错会清零连对，但不限时，可以一直练。'}</p>
        <p class="sub">${!res.ok
          ? '教师模式 · 成绩不计入排行榜'
          : (res.improved ? `刷新个人最高分！${res.rank ? '当前排名第 ' + res.rank + ' 名' : ''}` : `你的历史最高分仍是 ${res.best} 分`)}</p>
        <div class="mt" style="text-align:left">
          <h3 style="text-align:center">🏆 四槽老虎机 · 排行榜</h3>
          ${RX.lb.render('slots', 10)}
        </div>
        <div class="mt row" style="justify-content:center">
          <button class="btn btn-primary" id="sl-again">再玩一次</button>
          <button class="btn btn-ghost" onclick="RX.showView('home')">返回首页</button>
        </div>
      </div>`;
    el('sl-again').onclick = start;
    if (win) RX.celebrate();
  }

  RX.register('slots', {
    title: '四槽老虎机',
    mount() { stop(); start(); },
    unmount() { stop(); },
  });
})();
