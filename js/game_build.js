/* ============================================================
   game_build.js —— 🧪 方程式拼装台（困难模块）
   一条横着的方程式：系数 + 反应物 + 反应物 ⟶ 系数 + 产物 + 产物
   系数不用打字：卡片放进区里会自动选中，点下方 1–20 常驻数字条
   一次点击即设定；也可以用卡上的 − / + 微调。
   - 不限时；连续拼对 8 条即过关，验证失败连对清零但不结束
   - Lv.1 无干扰 → Lv.2 混干扰卡 → Lv.3/4 加 ❓ 未知试剂
   ============================================================ */
(function () {
  if (typeof window !== 'undefined') window.RX = window.RX || {};

  const ID = 'build', ROOT = 'build-root', SCORE = 'build-score';
  const BANK = RX.BUILD_BANK || [];
  const META = RX.BUILD_META || { gain: 25, passCorrect: 8, coefMax: 20 };
  const GAIN = META.gain, PASS_STREAK = META.passCorrect, COEF_MAX = META.coefMax;

  let nextTimer = null, score = 0, correct = 0, wrong = 0, streak = 0, maxStreak = 0, busy = false;
  let usedByLv = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
  let cur = null, deck = [], cardMap = {}, placed = { L: [], R: [] };
  let coef = {}, target = 'L', editing = null, dragKey = null;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function clamp(n) { return Math.max(1, Math.min(COEF_MAX, n)); }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /* 连对升级：1→1→2→2→3→3→4→4；答错清零，回 Lv.1 */
  function lvNow() { return streak <= 1 ? 1 : streak <= 3 ? 2 : streak <= 5 ? 3 : 4; }

  function pick(lv) {
    const pool = BANK.filter(q => q.lv === lv);
    let avail = pool.filter(q => !usedByLv[lv].has(q.id));
    if (!avail.length) { usedByLv[lv].clear(); avail = pool.slice(); }
    if (!avail.length) avail = BANK.slice();
    const q = avail[Math.floor(Math.random() * avail.length)];
    usedByLv[lv].add(q.id);
    return q;
  }

  function setupQuestion(q) {
    cur = q;
    deck = []; cardMap = {}; placed = { L: [], R: [] };
    coef = {}; target = 'L'; editing = null;
    let n = 0;
    q.L.concat(q.R).forEach(([sp]) => {
      const key = 'c' + (n++);
      const card = { key, sp, trap: false, hidden: false };
      deck.push(card); cardMap[key] = card;
    });
    q.trap.forEach((sp, i) => {
      const key = 't' + i;
      const card = { key, sp, trap: true, hidden: false };
      deck.push(card); cardMap[key] = card;
    });
    /* ❓ 缺项：高阶题藏起一张真实卡，靠守恒判断它该在哪边、系数多少 */
    if (q.lv >= 3) {
      const real = deck.filter(c => !c.trap);
      real[Math.floor(Math.random() * real.length)].hidden = true;
    }
    shuffle(deck);
    deck.forEach(c => { coef[c.key] = 1; });
  }

  function stdMap(side) {
    const m = {};
    cur[side].forEach(([sp, c]) => { m[sp] = c; });
    return m;
  }
  function label(k) { return cardMap[k].hidden ? '❓ 未知试剂' : `«${cardMap[k].sp}»`; }
  function coefOf(k) {
    const sl = stdMap('L'), sr = stdMap('R'), sp = cardMap[k].sp;
    return sl[sp] !== undefined ? sl[sp] : sr[sp];
  }

  /* ---------- 渲染：横向方程式 ---------- */
  function slotHtml(k) {
    const c = cardMap[k];
    return `<div class="bd-slot ${editing === k ? 'editing' : ''}" data-key="${k}">
      <button class="bd-mini" data-step="-1" data-key="${k}" title="系数 -1">−</button>
      <button class="bd-coef" data-coef="${k}" title="选中这张卡，再用下方数字条设系数">${coef[k]}</button>
      <button class="bd-mini" data-step="1" data-key="${k}" title="系数 +1">+</button>
      <span class="bd-sp">${c.hidden ? '❓' : esc(c.sp)}</span>
      <button class="bd-rm" data-rm="${k}" title="退回散卡区">✕</button>
    </div>`;
  }
  function sideHtml(z) {
    const isL = z === 'L';
    const title = isL ? '⚗️ 反应物' : '🧪 产物';
    /* 「+ 号 + 卡片」绑成一组，换行时加号不会孤零零留在上一行末尾 */
    const items = placed[z].map((k, i) =>
      `<span class="bd-term">${i ? '<span class="bd-plus">+</span>' : ''}${slotHtml(k)}</span>`
    ).join('');
    return `<div class="bd-zone side-${z} ${target === z ? 'active' : ''}" data-zone="${z}">
      <div class="bd-zone-title">${title}<span>${target === z ? '· 当前投放区' : '· 点此切换'}</span></div>
      <div class="bd-side-body" data-body="${z}">${items || '<div class="bd-empty">把试剂瓶放这里</div>'}</div>
    </div>`;
  }
  function quickHtml() {
    const name = !editing ? '先点一张已放入的试剂瓶'
      : (cardMap[editing].hidden ? '❓ 未知试剂' : esc(cardMap[editing].sp));
    const nums = Array.from({ length: COEF_MAX }, (_, i) => i + 1)
      .map(n => `<button class="bd-num ${editing && coef[editing] === n ? 'sel' : ''}" data-n="${n}">${n}</button>`).join('');
    return `<div class="bd-quick" id="build-quick">
      <div class="bd-quick-head">系数快捷条 <span class="bd-quick-target">选中：${name}</span>
        <span class="bd-quick-tip">点数字一次即设好 · 也可用卡上 − / + 微调</span></div>
      <div class="bd-quick-nums" id="build-nums">${nums}</div>
    </div>`;
  }

  function render() {
    const root = document.getElementById(ROOT);
    if (!root || !cur) return;
    const allPlaced = placed.L.concat(placed.R);
    const deckHtml = deck.filter(c => !allPlaced.includes(c.key)).map(c =>
      `<button class="bd-card ${c.hidden ? 'unknown' : ''} ${c.trap ? 'trap' : ''}"
        draggable="true" data-key="${c.key}" data-sp="${esc(c.sp)}">
        ${c.hidden ? '❓' : esc(c.sp)}${c.hidden ? '<small>未知试剂</small>' : ''}
      </button>`).join('');
    root.innerHTML = `
      <div class="game-center bd-wrap">
        <div class="bd-head" data-qid="${cur.id}">
          <span class="bd-lv lv${cur.lv}">Lv.${cur.lv}</span>
          <span class="bd-grp">${esc(cur.grpName)}</span>
          <span class="bd-kind">${cur.kind === 'mol' ? '化学方程式卡 · 不拆离子' : '离子方程式卡'}</span>
        </div>
        <p class="bd-hint">把<b>打乱的试剂瓶</b>分进左右两边，拼成一条横着的方程式：<b>放进去就自动选中</b>，点下方数字条一下就设好系数（也可用卡上 − / + 微调），最后点「验证守恒」。
          ${cur.lv >= 2 ? '⚠️ 有<b>干扰试剂</b>不属于这条式子，别放进去。' : ''}
          ${cur.lv >= 3 ? '❓ 有一张<b>未知试剂</b>，靠守恒推它该在哪边、系数是多少。' : ''}</p>

        <div class="bd-equation">
          ${sideHtml('L')}
          <div class="bd-eq-arrow">⟶</div>
          ${sideHtml('R')}
        </div>

        ${quickHtml()}

        <div class="bd-deck-title">🧪 散落试剂瓶 <span>点卡片放进高亮区，也可以直接拖过去；已放入的点 ✕ 退回</span></div>
        <div class="bd-deck" id="build-deck">${deckHtml || '<span class="bd-empty">全部归位了</span>'}</div>

        <div class="bd-actions">
          <button class="btn btn-primary" id="build-check">✅ 验证守恒</button>
          <button class="btn btn-ghost" id="build-reset">↺ 清空重摆</button>
          <button class="btn btn-ghost" id="build-quit">结束本局</button>
        </div>
        <div id="build-fb" class="bd-fb" style="display:none"></div>
        <div class="bd-src">📄 ${esc(cur.src)}</div>
        <div class="chip-row">
          <span class="chip">🔥 连对 <b id="build-streak">${streak}</b> / 目标 ${PASS_STREAK}</span>
          <span class="chip">得分 ${score}</span>
          <span class="chip">累计拼对 ${correct} · 失误 ${wrong}</span>
          <span class="chip">题库 ${BANK.length} 题 · 不限时</span>
        </div>
      </div>`;
    bind();
  }

  function bind() {
    const root = document.getElementById(ROOT);
    root.querySelectorAll('.bd-card').forEach(b => {
      b.onclick = () => { if (!busy) place(b.dataset.key, target); };
      b.ondragstart = e => { dragKey = b.dataset.key; if (e.dataTransfer) e.dataTransfer.setData('text/plain', dragKey); };
    });
    root.querySelectorAll('.bd-zone').forEach(z => {
      z.onclick = e => {
        if (busy || e.target.closest('.bd-slot')) return;
        target = z.dataset.zone; render();
      };
      z.ondragover = e => e.preventDefault();
      z.ondrop = e => {
        e.preventDefault();
        const k = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || dragKey;
        if (k && !busy) { target = z.dataset.zone; place(k, z.dataset.zone); }
        dragKey = null;
      };
    });
    /* 点卡片空白处 = 选中它（系数数字条作用于这张卡） */
    root.querySelectorAll('.bd-slot').forEach(s => s.onclick = e => {
      if (busy || e.target.closest('button')) return;
      editing = s.dataset.key; render();
    });
    root.querySelectorAll('[data-coef]').forEach(b => b.onclick = e => {
      e.stopPropagation(); if (!busy) { editing = b.dataset.coef; render(); }
    });
    root.querySelectorAll('[data-step]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      if (!busy) {
        const k = b.dataset.key;
        coef[k] = clamp(coef[k] + (+b.dataset.step));
        editing = k; render();
      }
    });
    root.querySelectorAll('.bd-num').forEach(b => b.onclick = () => {
      if (busy) return;
      if (!editing) { if (RX.toast) RX.toast('先点一张已放入的试剂瓶'); return; }
      coef[editing] = +b.dataset.n;
      render();
    });
    root.querySelectorAll('[data-rm]').forEach(b => b.onclick = e => {
      e.stopPropagation(); if (!busy) unplace(b.dataset.rm);
    });
    const chk = document.getElementById('build-check');
    if (chk) chk.onclick = verify;
    const rs = document.getElementById('build-reset');
    if (rs) rs.onclick = () => {
      if (busy) return;
      placed = { L: [], R: [] }; editing = null;
      deck.forEach(c => { coef[c.key] = 1; });
      const fb = document.getElementById('build-fb');
      if (fb) { fb.style.display = 'none'; fb.innerHTML = ''; }
      render();
    };
    const qt = document.getElementById('build-quit');
    if (qt) qt.onclick = () => end(false);
  }

  function place(k, z) {
    if (!cardMap[k]) return;
    placed.L = placed.L.filter(x => x !== k);
    placed.R = placed.R.filter(x => x !== k);
    placed[z].push(k);
    editing = k;              /* 放进去就自动选中，直接点数字条即可 */
    render();
  }
  function unplace(k) {
    placed.L = placed.L.filter(x => x !== k);
    placed.R = placed.R.filter(x => x !== k);
    coef[k] = 1;
    if (editing === k) editing = null;
    render();
  }

  /* ---------- 判定 ---------- */
  function fail(msg) {
    streak = 0;
    wrong++;
    const fb = document.getElementById('build-fb');
    if (fb) {
      fb.className = 'bd-fb bad'; fb.style.display = 'block';
      fb.innerHTML = `<b>❌ ${esc(msg)}</b>
        <div class="bd-fb-sub">连对清零，但不扣时间也不结束。先分清楚反应物 / 产物，再逐个元素核对原子数与两边总电荷。</div>`;
    }
    paintStats();
  }

  function verify() {
    if (busy || !cur) return;
    const all = placed.L.concat(placed.R);
    const badTrap = all.filter(k => cardMap[k].trap);
    if (badTrap.length) {
      return fail(`混进了 ${badTrap.length} 张干扰试剂（${badTrap.map(k => cardMap[k].sp).join('、')}），它们不属于这条方程式`);
    }
    const realKeys = deck.filter(c => !c.trap).map(c => c.key);
    const rest = realKeys.filter(k => !all.includes(k));
    if (rest.length) return fail(`还有 ${rest.length} 张试剂瓶没归位`);
    const sl = stdMap('L'), sr = stdMap('R');
    for (const k of placed.L) {
      if (sl[cardMap[k].sp] === undefined) return fail(`${label(k)} 不该在反应物这边`);
    }
    for (const k of placed.R) {
      if (sr[cardMap[k].sp] === undefined) return fail(`${label(k)} 不该在产物这边`);
    }
    for (const k of realKeys) {
      if (coef[k] !== coefOf(k)) return fail(`${label(k)} 的系数不对`);
    }
    success();
  }

  function success() {
    busy = true;
    score += GAIN; correct++; streak++;
    maxStreak = Math.max(maxStreak, streak);
    RX.addXP(GAIN);
    RX.lb.submit(ID, score, streak >= PASS_STREAK);
    const fb = document.getElementById('build-fb');
    if (fb) {
      fb.className = 'bd-fb good'; fb.style.display = 'block';
      fb.innerHTML = `<b>✅ 拼装成功！+${GAIN} 分（连对 ${streak}）${streak >= PASS_STREAK ? ' · 🎉 达标过关！' : ''}</b>
        <div class="bd-eq">${esc(cur.eq)}</div>
        <div class="bd-fb-sub"><b>考点：</b>${esc(cur.note)}　·　<b>来源：</b>${esc(cur.src)}</div>`;
    }
    paintStats();
    if (streak >= PASS_STREAK) { nextTimer = setTimeout(() => win(), 900); return; }
    nextTimer = setTimeout(() => {
      busy = false;
      setupQuestion(pick(lvNow())); render();
    }, 1600);
  }

  function paintStats() {
    const root = document.getElementById(ROOT);
    if (!root) return;
    const s = document.getElementById('build-streak');
    if (s) s.textContent = streak;
    const chips = root.querySelectorAll('.chip');
    if (chips[1]) chips[1].textContent = `得分 ${score}`;
    if (chips[2]) chips[2].textContent = `累计拼对 ${correct} · 失误 ${wrong}`;
    const head = document.getElementById(SCORE);
    if (head) head.textContent = `得分 ${score}`;
  }

  /* ---------- 生命周期 ---------- */
  function intro(root) {
    root.innerHTML = `
      <div class="game-center" style="max-width:860px">
        <div class="intro-card">
          <p>🧪 <b>方程式拼装台</b>：题目把一条方程式的所有反应物和产物<b>打乱成一排试剂瓶</b>，你要把它们摆成一条横着的方程式，并给每张卡标上系数。</p>
          <p class="hint">系数<b>不用打字</b>：卡片放进区里会自动选中，点下方 1–${COEF_MAX} 的数字条一次即设好；也可以用卡上的 − / + 微调。卡片支持点击投放和拖拽。</p>
          <p class="hint"><b>不限时</b>！连续拼对 <b>${PASS_STREAK} 条</b>即过关（每条 +${GAIN} 分，≥${PASS_STREAK * GAIN} 分）；验证失败只把连对清零，不扣时间也不结束。题库 ${BANK.length} 题，全部来自学案 / 练习 / 高考题，按 Lv.1→Lv.4 逐级加难：干扰试剂 · ❓未知试剂 · 陌生物种 · 多还原产物。</p>
          <button class="btn btn-primary" id="build-start">开始拼装</button>
        </div>
      </div>`;
    const b = document.getElementById('build-start');
    if (b) b.onclick = start;
  }

  function start() {
    clearNext();
    score = 0; correct = 0; wrong = 0; streak = 0; maxStreak = 0; busy = false;
    usedByLv = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
    RX.addXP(2);
    setupQuestion(pick(lvNow()));
    render();
  }

  function clearNext() { if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; } }

  function win() {
    clearNext();
    RX.lb.submit(ID, score, true);
    RX.store.finishGame(ID, score, true);
    const root = document.getElementById(ROOT);
    if (root) root.innerHTML = `
      <div class="game-center">
        <div class="panel" style="text-align:center;padding:28px 18px">
          <h2 style="color:#1a7f4e">✅ 已过关</h2>
          <p style="font-size:18px;margin:8px 0">得分 <b>${score}</b> 分 · 连续拼对 <b>${maxStreak}</b> 条</p>
          <p class="hint">原子守恒、电荷守恒、得失电子守恒——三条都对上了！</p>
          <button class="btn btn-primary" onclick="RX.showView('hard');RX.lb.openModal('${ID}')">查看排行榜</button>
          <button class="btn" style="margin-left:8px" onclick="RX.games.${ID}.unmount();RX.games.${ID}.mount()">再玩一次</button>
        </div>
      </div>`;
    RX.celebrate();
  }

  function end(winFlag) {
    clearNext();
    busy = true;
    RX.lb.submit(ID, score, !!winFlag);
    RX.store.finishGame(ID, score, !!winFlag);
    const root = document.getElementById(ROOT);
    if (root) root.innerHTML = `
      <div class="game-center">
        <div class="panel" style="text-align:center;padding:28px 18px">
          <h2 style="color:#5a2fb0">本局结束</h2>
          <p style="font-size:18px;margin:8px 0">得分 <b>${score}</b> 分 · 最长连对 <b>${maxStreak}</b> / ${PASS_STREAK} 条</p>
          <p class="hint">验证失败会清零连对，但不限时也不结束。先分两边，再用「化合价升降相等」反推系数会快很多。</p>
          <button class="btn" onclick="RX.games.${ID}.unmount();RX.games.${ID}.mount()">再来一次</button>
          <button class="btn btn-ghost" style="margin-left:8px" onclick="RX.showView('hard')">返回困难模块</button>
        </div>
      </div>`;
  }

  function mount() {
    const root = document.getElementById(ROOT);
    if (root) intro(root);
  }
  function unmount() { clearNext(); busy = false; }

  /* 测试辅助：只读当前局面，不改变游戏状态 */
  RX.buildCurrent = function () {
    return {
      id: cur ? cur.id : null, lv: cur ? cur.lv : null,
      deck: deck.map(c => ({ key: c.key, sp: c.sp, trap: c.trap, hidden: c.hidden })),
      L: cur ? cur.L.map(x => x.slice()) : [], R: cur ? cur.R.map(x => x.slice()) : [],
      placed: { L: placed.L.slice(), R: placed.R.slice() },
      coef: Object.assign({}, coef), score, correct, wrong, streak, target, editing, busy,
    };
  };

  RX.register(ID, { title: '方程式拼装台', mount, unmount });
})();
