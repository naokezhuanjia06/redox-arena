/* ============================================================
   main.js —— 主控：模式选择（简单/困难）→ 模块页 → 游戏
   首屏只有两个入口：
   🌱 简单模块 = 三大板块（四身份速判 / 强弱速记 / 离子共存，6 游戏）
   🔥 困难模块 = 试剂与转化（价态地图 + 方程式拼装台）
   游戏的"返回"回到所属模块页；模块页的"返回"回到模式选择。
   ============================================================ */
(function () {
  const DESC = {
    quick: { desc: '判断句接连出现，点 ✓ / ✗，连续答对 8 个过关', tag: '🏆 独立排行榜' },
    slots: { desc: '把 4 张物质卡拖进正确的身份槽', tag: '🖐 拖拽 · 连对 7 道' },
    grid: { desc: '不限时消消乐，只点"会反应"的离子对，连续 12 对过关', tag: '💥 越玩越新' },
    ladder: { desc: '两张卡比强弱，连对越多差距越小，Lv.4 只差 1 档', tag: '🪜 难度递进' },
    mine: { desc: '背着 2 种离子穿越雷区，只走能共存的格子', tag: '💣 路线策略' },
    gate: { desc: '离子停在窗口等你判断拦截还是放行，没有时间压力', tag: '🛂 5 种泳池场景' },
    valence: { desc: 'Fe×Cl 二维价态地图，每条箭头选对试剂+条件', tag: '🗺️ 困难模块 · 综合' },
    build: { desc: '打乱试剂瓶分反应物/产物，点数选系数，验证守恒', tag: '🧪 拼装 · 50 题题库' },
  };

  const CATS = [
    {
      no: '板块一', icon: '⚡', title: '方程式四身份速判', color: 'blue',
      sub: '看到氧化还原方程式，一眼认出氧化剂 / 还原剂 / 氧化产物 / 还原产物。',
      ids: ['quick', 'slots'],
    },
    {
      no: '板块二', icon: '🔋', title: '氧化还原强弱顺序速记', color: 'green',
      sub: '背熟氧化性、还原性、金属活动性三条阶梯——谁强谁弱一眼看穿。',
      ids: ['grid', 'ladder'],
    },
    {
      no: '板块三', icon: '🚧', title: '氧化还原型离子共存', color: 'orange',
      sub: '哪些离子见面就"打架"、不能同池共存？这里是专练。',
      ids: ['mine', 'gate'],
    },
  ];
  const HARD_CAT = {
    no: '困难模块', icon: '🧪', title: '氧化还原进阶：试剂选择与价态转化', color: 'purple',
    sub: 'Fe²⁺→Fe³⁺、Cl⁻→Cl₂、Fe³⁺→Fe²⁺ 需要哪些试剂？条件、用量、转化全在这里。',
    ids: ['valence', 'build'],
  };
  const EASY_IDS = CATS.flatMap(c => c.ids);

  const ALL = RX.GAME_LIST;
  const TOTAL = ALL.length;
  const el = id => document.getElementById(id);

  /* ---------- 游戏卡 ---------- */
  function cardHtml(id) {
    const g = RX.gameMeta(id);
    const d = DESC[id] || {};
    const st = RX.store.game(id);
    const best = RX.lb.myBest(id);
    return `<div class="opp-card" data-go="${id}">
      <div class="icon">${g.icon}</div>
      <h4>${g.name}</h4>
      <p>${d.desc || ''}</p>
      <div class="card-foot">
        <span>${d.tag ? `<span class="mini-tag">${d.tag}</span>` : ''}</span>
        <span class="n-state ${st.done ? 'done' : ''}">${st.done ? '✅ 已过关' : (best ? '未过关' : '▶ 未挑战')}</span>
      </div>
      ${best ? `<div class="card-best">我的最高分 <b>${best}</b></div>` : ''}
      <div class="card-rule">过关：${g.rule}</div>
    </div>`;
  }
  function catPanel(c) {
    return `<div class="map-panel card cat-panel cat-${c.color}">
      <div class="cat-head">
        <span class="cat-no">${c.no}</span>
        <h2>${c.icon} ${c.title}</h2>
        <span class="cat-sub">${c.ids.length} 个游戏</span>
      </div>
      <p class="hint sub">${c.sub}</p>
      <div class="game-row">${c.ids.map(cardHtml).join('')}</div>
    </div>`;
  }
  function bindCards(view) {
    view.querySelectorAll('[data-go]').forEach(elm => {
      elm.onclick = (e) => {
        e.stopPropagation();
        RX.showView(elm.dataset.go);
      };
    });
  }

  /* ---------- 首屏：模式选择（简单 / 困难） ---------- */
  function renderHome() {
    const doneCount = ALL.filter(g => RX.store.game(g.id).done).length;
    const easyDone = EASY_IDS.filter(id => RX.store.game(id).done).length;
    const hardDone = HARD_CAT.ids.filter(id => RX.store.game(id).done).length;
    const view = el('view-home');

    view.innerHTML = `
      <div class="stat-row">
        <div class="stat-card g-blue">
          <span class="tag">🎯</span>
          <h3>过关进度</h3>
          <div class="num">${doneCount}/${TOTAL}</div>
          <div class="cap">简单 ${EASY_IDS.length} + 困难 ${HARD_CAT.ids.length} · 共 ${TOTAL} 个游戏</div>
        </div>
        <div class="stat-card g-gold" id="stat-lb" role="button" title="查看排行榜">
          <span class="tag">🏆</span>
          <h3>积分排行榜</h3>
          <div class="num" style="font-size:30px">${TOTAL} 个独立榜单</div>
          <div class="cap">每个游戏分开计分 · 点击查看 →</div>
        </div>
      </div>

      <div class="mode-cards">
        <div class="mode-card easy" data-mode="easy" role="button">
          <div class="mc-icon">🌱</div>
          <h2>简单模块</h2>
          <p class="mc-sub">三大板块 · ${EASY_IDS.length} 个游戏</p>
          <ul class="mc-list">
            <li>⚡ 方程式四身份速判（四身份速判 / 四槽老虎机）</li>
            <li>🔋 氧化还原强弱顺序速记（净化战场 / 阶梯夺擂）</li>
            <li>🚧 氧化还原型离子共存（雷区通行 / 离子海关）</li>
          </ul>
          <div class="mc-foot"><span class="mc-progress">${easyDone}/${EASY_IDS.length} 已过关</span><span class="mc-go">进入 →</span></div>
        </div>
        <div class="mode-card hard" data-mode="hard" role="button">
          <div class="mc-icon">🔥</div>
          <h2>困难模块</h2>
          <p class="mc-sub">试剂与价态转化 · ${HARD_CAT.ids.length} 个游戏</p>
          <ul class="mc-list">
            <li>🗺️ 价态地图：Fe×Cl 家族转化全闯关</li>
            <li class="mc-note">Fe²⁺→Fe³⁺ / Cl⁻→Cl₂ / Fe³⁺→Fe²⁺ 需要哪些试剂？试剂、条件、用量综合考察</li>
          </ul>
          <div class="mc-foot"><span class="mc-progress">${hardDone}/${HARD_CAT.ids.length} 已过关</span><span class="mc-go">进入 →</span></div>
        </div>
      </div>

      <div class="home-card card" style="margin-top:20px">
        <h2>💡 玩法提示</h2>
        <p class="sub" style="line-height:1.9">
          · 每个游戏<b>各自过关、各自排行</b>，积分不会跨游戏合并；排行榜取你<b>最高的一次</b>成绩<br>
          · 先选模块：🌱 简单模块打基础，🔥 困难模块练试剂与转化综合应用<br>
          · 随时点右上角 📖 复习知识卡片与强弱阶梯
        </p>
      </div>`;

    view.querySelectorAll('[data-mode]').forEach(card => {
      card.onclick = () => RX.showView(card.dataset.mode);
    });
    const lbStat = el('stat-lb');
    if (lbStat) lbStat.onclick = () => RX.lb.openModal('quick');
    bindLeaderboard();
  }

  /* ---------- 简单模块页：三大板块 + 强弱阶梯 ---------- */
  function renderEasy() {
    const view = el('view-easy');
    view.innerHTML = `
      <div class="module-back"><button class="back-btn" id="easy-back">← 返回模式选择</button>
        <span class="mode-crumb">🌱 简单模块 · 三大板块</span></div>
      <div class="home-grid">
        <div>${CATS.map(catPanel).join('')}</div>
        <div>
          <div class="home-card card">
            <h2>🔥 强弱阶梯（必背）</h2>
            <p class="hint">氧化性：MnO₄⁻(H⁺) &gt; Cl₂ &gt; ClO⁻ &gt; Br₂ &gt; Fe³⁺ &gt; I₂ &gt; S</p>
            ${RX.OX_LADDER.map((x, i) => `
              <div class="ladder-item">
                <span class="name">${x}</span>
                <span class="bar"><i style="width:${100 - i * 16}%"></i></span>
                <span class="pct">${(6 - i) * 16 + 10}%</span>
              </div>`).join('')}
            <p class="hint" style="margin-top:14px">还原性：S²⁻ &gt; I⁻ &gt; Fe²⁺ &gt; Br⁻ &gt; C₂O₄²⁻ &gt; Cl⁻ &gt; Mn²⁺</p>
            ${RX.RED_LADDER.slice().reverse().map((x, i) => `
              <div class="ladder-item">
                <span class="name">${x}</span>
                <span class="bar"><i style="width:${100 - i * 16}%;background:linear-gradient(90deg,#22b573,#7ed957)"></i></span>
                <span class="pct">${(6 - i) * 16 + 10}%</span>
              </div>`).join('')}
            <p class="hint" style="margin-top:14px">金属活动性：K→Ca→Na→Mg→Al→Zn→Fe→(H)→Cu→Hg→Ag</p>
            ${RX.METAL_LADDER.slice(0, 8).map((x, i) => `
              <div class="ladder-item">
                <span class="name">${x}</span>
                <span class="bar"><i style="width:${100 - i * 12}%;background:linear-gradient(90deg,#ff8a3d,#ffb85c)"></i></span>
                <span class="pct">${(11 - i) * 8 + 8}%</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    el('easy-back').onclick = () => RX.showView('home');
    bindCards(view);
  }

  /* ---------- 困难模块页 ---------- */
  function renderHard() {
    const view = el('view-hard');
    view.innerHTML = `
      <div class="module-back"><button class="back-btn" id="hard-back">← 返回模式选择</button>
        <span class="mode-crumb hard">🔥 困难模块 · 试剂与转化</span></div>
      ${catPanel(HARD_CAT)}`;
    el('hard-back').onclick = () => RX.showView('home');
    bindCards(view);
  }

  /* ---------- 排行榜弹窗 ---------- */
  function bindLeaderboard() {
    const close = document.getElementById('lb-close');
    if (close) close.onclick = () => document.getElementById('lb-modal').classList.add('hidden');
    const modal = document.getElementById('lb-modal');
    if (modal && !modal.dataset.bound) {
      modal.dataset.bound = '1';
      modal.addEventListener('click', e => {
        if (e.target.id === 'lb-modal') e.target.classList.add('hidden');
      });
    }
  }

  /* ---------- 路由（游戏入口需先实名；首页/模块页免实名；老师免实名不计排名） ---------- */
  function go(id) {
    if (RX._current && RX.games[RX._current] && RX.games[RX._current].unmount) {
      RX.games[RX._current].unmount();
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById('view-' + id);
    if (!v) return;
    v.classList.add('active');
    RX._current = id;
    window.scrollTo({ top: 0 });
    if (id === 'home') renderHome();
    else if (id === 'easy') renderEasy();
    else if (id === 'hard') renderHard();
    else if (RX.games[id] && RX.games[id].mount) RX.games[id].mount();
  }

  RX.showView = function (id) {
    const isMenu = id === 'home' || id === 'easy' || id === 'hard';
    if (!isMenu && RX.identity && !RX.identity.ok()) {
      RX.identity.ask(() => go(id));
      return;
    }
    go(id);
  };
  /* 登录 / 切换账号后刷新首页进度（别的页面不动） */
  RX.refreshHome = function () { if (RX._current === 'home') renderHome(); };

  /* ---------- 全局按钮 ---------- */
  document.getElementById('btn-home').onclick = () => RX.showView('home');
  document.getElementById('btn-kb').onclick = () => {
    document.getElementById('kb-body').innerHTML = RX.renderKB();
    document.getElementById('kb-modal').classList.remove('hidden');
  };
  document.getElementById('kb-close').onclick = () => document.getElementById('kb-modal').classList.add('hidden');
  document.getElementById('kb-modal').addEventListener('click', e => {
    if (e.target.id === 'kb-modal') e.target.classList.add('hidden');
  });
  /* 游戏页"返回地图"→ 回到所属模块页 */
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => {
    const cur = RX._current;
    if (cur === 'easy' || cur === 'hard' || cur === 'home') RX.showView('home');
    else if (RX.gameMeta(cur).cat === '困难模块') RX.showView('hard');
    else RX.showView('easy');
  });

  /* ---------- 启动 ---------- */
  RX.CATS = CATS;
  RX.refreshXP();
  RX.showView('home');
})();
