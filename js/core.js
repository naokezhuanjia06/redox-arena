/* ============================================================
   core.js —— 共用工具：进度存储、挂绳卡牌渲染、Toast、经验值
   ============================================================ */
window.RX = window.RX || {};

/* ---------- 游戏清单（首页 / 排行榜 / 教师后台共用） ---------- */
RX.GAME_LIST = [
  { id: 'quick', name: '四身份速判', icon: '⚡', short: '四身份速判', cat: '方程式四身份速判',
    rule: '不限时 · 连续答对 8 个（每个 +20 分，≥160 分）' },
  { id: 'slots', name: '四槽老虎机', icon: '🎰', short: '四槽老虎机', cat: '方程式四身份速判',
    rule: '不限时 · 连续答对 7 道（每道 +20 分，≥140 分）' },
  { id: 'grid', name: '净化战场', icon: '💥', short: '净化战场', cat: '氧化还原强弱顺序速记',
    rule: '不限时 · 连续消对 12 对（每对 +20 分，≥240 分）' },
  { id: 'ladder', name: '阶梯夺擂', icon: '🪜', short: '阶梯夺擂', cat: '氧化还原强弱顺序速记',
    rule: '不限时 · 连续答对 8 组（每组 +25 分，≥200 分）' },
  { id: 'mine', name: '雷区通行', icon: '💣', short: '雷区通行', cat: '氧化还原型离子共存',
    rule: '不限时 · 连续 3 关不踩雷（每关 +50 分，≥150 分）' },
  { id: 'gate', name: '离子海关', icon: '🛂', short: '离子海关', cat: '氧化还原型离子共存',
    rule: '不限时 · 连续判断正确 10 个离子（每个 +10 分，100 分过关）' },
  { id: 'valence', name: '价态地图', icon: '🗺️', short: '价态地图', cat: '困难模块',
    rule: '不限时 · 连续走通 8 条转化箭头（每步 +25 分，200 分过关）' },
  { id: 'build', name: '方程式拼装台', icon: '🧪', short: '方程式拼装台', cat: '困难模块',
    rule: '不限时 · 连续拼对 8 条方程式（每条 +25 分，200 分过关）' },
];
RX.gameMeta = function (id) {
  return RX.GAME_LIST.find(g => g.id === id) || { id, name: id, icon: '🎮', short: id };
};

/* ---------- 进度存储（v27：改为「跟着账号走」） ----------
   以前是一个全局 redox_progress_v1，同一台电脑上换个学生还是上一个人的进度。
   现在数据挂在 RX.accounts 当前账号上：换人登录就换一份档案。 */
RX.store = {
  key: 'redox_progress_v1',   /* 旧键，仅用于迁移提示 */
  mem: null,
  get data() {
    if (RX.accounts) return RX.accounts.currentData();
    if (!this.mem) this.mem = { games: {}, xp: 0 };
    return this.mem;
  },
  save() { if (RX.accounts) RX.accounts.save(); },
  game(id) {
    const d = this.data;
    if (!d.games) d.games = {};
    if (!d.games[id]) d.games[id] = { best: 0, done: false, plays: 0 };
    return d.games[id];
  },
  finishGame(id, score, passed) {
    const g = this.game(id);
    g.plays++;
    g.best = Math.max(g.best, score);
    if (passed !== false) g.done = true;   /* 未过关的场次不标记通关 */
    g.lastTs = Date.now();
    this.save();
    /* 「做过什么」：每局结束记一条活动，学生档案 / 教师后台都能看到 */
    if (RX.accounts) RX.accounts.log({ game: id, score, passed: passed !== false });
  },
  addXP(n) {
    const d = this.data;
    d.xp = (d.xp || 0) + n;
    this.save();
    RX.refreshXP();
  },
};
RX.refreshXP = function () {
  const el = document.getElementById('xp-total');
  if (el) el.textContent = (RX.store.data && RX.store.data.xp) || 0;
};
/* 全局经验值入口（游戏模块统一调用 RX.addXP） */
RX.addXP = function (n) { RX.store.addXP(n); };

/* ---------- Toast ---------- */
RX.toastTimer = null;
RX.toast = function (msg, ms = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(RX.toastTimer);
  RX.toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
};

/* ---------- 挂绳卡牌 HTML ----------
   用法：RX.hangCard({front:`...`, back:`...`, cls:'', big:false})
   结构：.hang(摆动) > .flip-wrap > .flip(hover翻转) > .face.front / .face.back */
RX.hangCard = function (opt) {
  return `
  <div class="hang ${opt.big ? 'big' : ''}">
    <span class="pin"></span>
    <div class="flip-wrap">
      <div class="flip ${opt.big ? 'big' : ''} ${opt.cls || ''}" ${opt.attrs || ''}>
        <div class="face front">${opt.front}</div>
        <div class="face back">${opt.back}</div>
      </div>
    </div>
  </div>`;
};

/* ---------- 挂绳弧线 SVG ---------- */
RX.ropeSvg = function (n, width) {
  // 生成一条经过各卡牌挂点的柔和弧线
  const w = width || 1000, h = 70;
  let pts = [];
  for (let i = 0; i < 4; i++) {
    const x = (w / 3.2) * (i * 0.5 + 0.4);
    pts.push([x, 18 + Math.sin(i * 1.7) * 7]);
  }
  return `<svg class="rope-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="ropeG" x1="0" x2="1">
      <stop offset="0" stop-color="#b9bfd0"/><stop offset="1" stop-color="#cdd2df"/>
    </linearGradient></defs>
    <path d="M 0 8 Q ${w * 0.25} ${34} ${w * 0.5} 18 T ${w} 12"
      fill="none" stroke="url(#ropeG)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
};

/* ---------- 离子小色块 ---------- */
RX.ionChip = function (label, extraCls = '') {
  const sp = RX.SP[label] || {};
  const type = sp.ox != null ? 'ox' : (sp.oxOfRed != null ? 'red' : 'neutral');
  return `<span class="chip ${type} ${extraCls}">${label}</span>`;
};

/* ---------- 简易庆祝（emoji 粒子） ---------- */
RX.celebrate = function (emojis = ['🎉', '✨', '⭐', '🎊']) {
  for (let i = 0; i < 18; i++) {
    const e = document.createElement('div');
    e.textContent = emojis[i % emojis.length];
    e.style.cssText = `position:fixed;z-index:98;left:${Math.random() * 100}vw;top:-30px;
      font-size:${16 + Math.random() * 18}px;pointer-events:none;
      transition:transform ${1.6 + Math.random()}s ease-in, opacity 1.8s;`;
    document.body.appendChild(e);
    requestAnimationFrame(() => {
      e.style.transform = `translateY(${window.innerHeight + 60}px) rotate(${Math.random() * 360}deg)`;
      e.style.opacity = '0';
    });
    setTimeout(() => e.remove(), 2600);
  }
};

/* ---------- 洗牌 ---------- */
RX.shuffle = function (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- 游戏注册表 ---------- */
RX.games = {};
RX.register = function (id, mod) { RX.games[id] = mod; };

/* ---------- 知识卡片内容 ---------- */
RX.renderKB = function () {
  const ladder = (arr) => arr.map((x, i) =>
    `<span class="chip ${i === 0 ? 'ox' : ''}">${x}</span>${i < arr.length - 1 ? '<span class="arrow">&gt;</span>' : ''}`).join('');
  return `
  <div class="kb-block">
    <h3>🔥 氧化性强弱（强者优先得电子）</h3>
    <div class="kb-line">${ladder(RX.OX_LADDER)}</div>
    <p class="kb-note">口诀：高锰酸根酸性显，氯溴碘铁硫往后站。条件型氧化剂 NO₃⁻(H⁺)、ClO⁻ 也不能忘。</p>
  </div>
  <div class="kb-block">
    <h3>💧 还原性强弱（对应产物反向排）</h3>
    <div class="kb-line">${ladder(RX.RED_LADDER.slice().reverse())}</div>
    <p class="kb-note">还原性：S²⁻ &gt; I⁻ &gt; Fe²⁺ &gt; Br⁻ &gt; Cl⁻ &gt; Mn²⁺（与氧化性阶梯一一对应、方向相反）。</p>
  </div>
  <div class="kb-block">
    <h3>🤸 金属活动性（还原性强弱）</h3>
    <div class="kb-line">${ladder(RX.METAL_LADDER)}</div>
    <p class="kb-note">对应阳离子氧化性正好反过来：Ag⁺ &gt; Hg²⁺ &gt; Fe³⁺ &gt; Cu²⁺ &gt; H⁺ &gt; … &gt; K⁺。</p>
  </div>
  <div class="kb-block">
    <h3>🚫 氧化还原型离子共存（本站核心规则）</h3>
    <p class="kb-note">
      · 强氧化性离子：<b>MnO₄⁻(H⁺)、ClO⁻、NO₃⁻(H⁺)、Fe³⁺、Cl₂/Br₂/I₂</b><br>
      · 强还原性离子：<b>S²⁻、SO₃²⁻、I⁻、Fe²⁺、C₂O₄²⁻（草酸根）</b>，草酸 H₂C₂O₄ 也是常见还原剂（两拨人见面就"打架"，不能共存）<br>
      · 注意条件：<b>NO₃⁻</b> 单独存在不表现氧化性，遇到 <b>H⁺</b> 才变身强氧化剂！<br>
      · 典型不能共存组合：Fe³⁺+I⁻、MnO₄⁻(H⁺)+Cl⁻、NO₃⁻(H⁺)+Fe²⁺、I₂+S²⁻、ClO⁻+Fe²⁺、MnO₄⁻(H⁺)+C₂O₄²⁻、ClO⁻+C₂O₄²⁻（草酸根被氧化为 CO₂）。
    </p>
  </div>`;
};
