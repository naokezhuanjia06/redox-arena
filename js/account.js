/* ============================================================
   account.js —— 学生个人账号（本地存档）
   一个账号 = 「年级 + 班级 + 姓名 + 名单序号」，同班同名也能分开。
   每个账号独立保存：
     xp            经验值（答对就加）
     games[id]     { best, done, plays, lastTs } 每个游戏的最高分 / 是否过关 / 次数
     history[]     { ts, game, score, passed } 最近 200 条活动（做过什么）
   localStorage 键：redox_accounts_v1
   说明：纯静态站点，数据存在本机浏览器；教师后台可导出 JSON/CSV 备份。
   ============================================================ */
(function () {
  const RX = window.RX = window.RX || {};
  const KEY = 'redox_accounts_v1';

  /* localStorage 在预览 iframe / 隐私模式下可能被禁用（访问即抛 SecurityError）。
     这里用 MEM 做内存兜底：本次会话内一切照常，只是刷新后不保留。 */
  const MEM = {};
  function lsGet(k, d) {
    let raw = null;
    try { raw = localStorage.getItem(k); } catch (e) { raw = null; }
    if (raw == null) return Object.prototype.hasOwnProperty.call(MEM, k) ? MEM[k] : d;
    try { const v = JSON.parse(raw); return v == null ? d : v; }
    catch (e) { return d; }
  }
  function lsSet(k, v) {
    MEM[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  const str = v => String(v == null ? '' : v).trim();
  const keyOf = p => [p.grade, p.cls, p.name].join('|') + (p.seq ? '#' + p.seq : '');

  function blankAccount(p) {
    return {
      key: keyOf(p),
      grade: str(p.grade), cls: str(p.cls), name: str(p.name),
      seq: p.seq || 0, dup: p.dup || 0, code: p.code || '',
      xp: 0,
      games: {},
      history: [],
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };
  }

  const A = {
    KEY,
    data: null,
    _guest: null,

    load() {
      const d = lsGet(KEY, null);
      this.data = (d && typeof d === 'object') ? d : {};
      if (!this.data.accounts || typeof this.data.accounts !== 'object') this.data.accounts = {};
      if (!this.data.teacher) this.data.teacher = blankAccount({ grade: '教师', cls: '教师端', name: '教师' });
      this.data.teacher.isTeacher = true;
      if (typeof this.data.current !== 'string') this.data.current = '';
      return this.data;
    },
    save() { return lsSet(KEY, this.data); },
    keyOf,

    /* ---------- 账号 ---------- */
    ensure(profile) {
      const k = keyOf(profile);
      let acc = this.data.accounts[k];
      if (!acc) {
        acc = blankAccount(profile);
        this.data.accounts[k] = acc;
      } else {
        /* 名单改名 / 重新导入后同步展示字段，成绩保留 */
        acc.grade = str(profile.grade) || acc.grade;
        acc.cls = str(profile.cls) || acc.cls;
        acc.name = str(profile.name) || acc.name;
        acc.seq = profile.seq || acc.seq || 0;
        acc.dup = profile.dup || acc.dup || 0;
        acc.code = profile.code || acc.code || '';
        if (!Array.isArray(acc.history)) acc.history = [];
        if (!acc.games) acc.games = {};
        if (typeof acc.xp !== 'number') acc.xp = 0;
      }
      acc.lastSeen = Date.now();
      this.save();
      return acc;
    },

    login(profile) {
      const acc = this.ensure(profile);
      this.data.current = acc.key;
      this.save();
      return acc;
    },

    loginTeacher() {
      this.data.current = '#teacher';
      this.save();
      return this.data.teacher;
    },

    logout() { this.data.current = ''; this.save(); },

    currentKey() { return this.data.current || ''; },

    current() {
      const k = this.data.current;
      if (!k) return null;
      if (k === '#teacher') return this.data.teacher;
      return this.data.accounts[k] || null;
    },

    isTeacher() { return this.data.current === '#teacher'; },

    /** RX.store 读取用：未登录时给一个临时桶，避免各处判空 */
    currentData() {
      const acc = this.current();
      if (acc) return acc;
      if (!this._guest) this._guest = blankAccount({ grade: '访客', cls: '访客', name: '访客' });
      return this._guest;
    },

    /* ---------- 活动记录 ---------- */
    log(ev) {
      const acc = this.current();
      if (!acc || acc.isTeacher) return;
      if (!Array.isArray(acc.history)) acc.history = [];
      acc.history.unshift({
        ts: Date.now(),
        game: ev.game,
        score: ev.score || 0,
        passed: !!ev.passed,
      });
      if (acc.history.length > 200) acc.history.length = 200;
      acc.lastSeen = Date.now();
      this.save();
    },

    /** 排行榜最高分同步进账号（只同步 best / done，不覆盖 plays） */
    syncBest(gameId, entry) {
      const acc = this.current();
      if (!acc || acc.isTeacher || !entry) return;
      if (!acc.games) acc.games = {};
      const g = acc.games[gameId] || (acc.games[gameId] = { best: 0, done: false, plays: 0, lastTs: 0 });
      g.best = Math.max(g.best || 0, entry.best || 0);
      g.done = !!(g.done || entry.passed);
      g.lastTs = Math.max(g.lastTs || 0, entry.ts || Date.now());
      this.save();
    },

    /** 老用户迁移：旧排行榜里有成绩、账号里没有 → 灌进账号 */
    seedFromLB(entryOf) {
      const acc = this.current();
      if (!acc || acc.isTeacher || typeof entryOf !== 'function') return;
      let changed = false;
      (RX.GAME_LIST || []).forEach(item => {
        const gid = item.id;
        const e = entryOf(gid, acc);
        if (!e) return;
        if (!acc.games) acc.games = {};
        const slot = acc.games[gid];
        if (!slot) {
          acc.games[gid] = { best: e.best, done: !!e.passed, plays: e.plays || 1, lastTs: e.ts || 0 };
          changed = true;
        }
      });
      if (changed) this.save();
    },

    list() { return Object.keys(this.data.accounts).map(k => this.data.accounts[k]); },

    /* ---------- 教师侧管理 ---------- */
    reset(key) {
      if (key) delete this.data.accounts[key];
      else {
        this.data.accounts = {};
        if (this.data.current !== '#teacher') this.data.current = '';
      }
      this.save();
    },

    resetScores() {
      this.list().forEach(a => { a.games = {}; a.history = []; a.xp = 0; });
      this.save();
    },

    exportJSON() {
      return JSON.stringify({ v: 1, exportedAt: new Date().toISOString(), accounts: this.data.accounts }, null, 2);
    },

    importJSON(text) {
      let d;
      try { d = JSON.parse(text); } catch (e) { return { ok: false, reason: 'JSON 解析失败' }; }
      const accs = d && d.accounts;
      if (!accs || typeof accs !== 'object') return { ok: false, reason: '文件里没有 accounts' };
      let n = 0;
      Object.keys(accs).forEach(k => {
        const a = accs[k];
        if (!a || !a.name) return;
        const cur = this.data.accounts[k];
        if (!cur) { this.data.accounts[k] = a; n++; return; }
        /* 合并：积分取大、过关取或、历史并集 */
        cur.xp = Math.max(cur.xp || 0, a.xp || 0);
        Object.keys(a.games || {}).forEach(gid => {
          const g0 = cur.games[gid];
          const g1 = a.games[gid];
          if (!g0) { cur.games[gid] = g1; return; }
          g0.best = Math.max(g0.best || 0, g1.best || 0);
          g0.done = !!(g0.done || g1.done);
          g0.plays = Math.max(g0.plays || 0, g1.plays || 0);
          g0.lastTs = Math.max(g0.lastTs || 0, g1.lastTs || 0);
        });
        const seen = new Set((cur.history || []).map(h => h.ts + '|' + h.game));
        (a.history || []).forEach(h => {
          if (!seen.has(h.ts + '|' + h.game)) { cur.history.push(h); n++; }
        });
        cur.history.sort((x, y) => y.ts - x.ts);
        if (cur.history.length > 200) cur.history.length = 200;
      });
      this.save();
      return { ok: true, count: n };
    },
  };

  A.load();
  RX.accounts = A;
})();
