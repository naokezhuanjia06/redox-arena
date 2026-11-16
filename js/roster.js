/* ============================================================
   roster.js —— 入口身份（学生端 / 教师端）+ 名册 + 排行榜 + 教师后台
   v27 变化：
     1. 进站先选「学生端 / 教师端」；学生直接选班级 + 姓名，教师输密码
     2. 每名学生一个独立账号（RX.accounts）：经验值、每局成绩、活动记录都跟人走
     3. 教师后台升级：班级总览 / 学生档案 / 名册管理 / 排行榜 / 数据备份
   ============================================================ */
(function () {
  const RX = window.RX;
  const ID_KEY = 'redox_identity_v1';
  const RO_KEY = 'redox_roster_v1';
  const LB_KEY = 'redox_lb_v2';
  const OLD_LB = 'redox_lb_v1';
  /* 教师端密码（纯前端站点，只防误入，不是真正的安全边界） */
  const TEACHER_PWD = 'yhhy2026';

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
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 沙箱：只留内存 */ }
  }
  /* 存储是否真的可用（预览 iframe 里为 false） */
  const STORAGE_OK = (function () {
    try {
      const k = '__rx_probe__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const el = id => document.getElementById(id);
  const clsNum = c => parseInt(String(c).replace(/[^\d]/g, ''), 10) || 0;
  const pad2 = n => (n < 10 ? '0' : '') + n;
  function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  const PRESET = window.RX.PRESET_ROSTER || null;
  const presetRows = PRESET ? PRESET.rows() : [];
  const rosterInit = (function () {
    const saved = lsGet(RO_KEY, null);
    return Array.isArray(saved) ? saved : presetRows.slice();
  })();

  /* ---------- 名册 ---------- */
  const normGrade = g => {
    const t = String(g == null ? '' : g).trim();
    if (!t) return '未填';
    return t;
  };
  const normCls = c => {
    const t = String(c == null ? '' : c).trim();
    if (!t) return '未填';
    return /^\d+$/.test(t) ? t + '班' : t;   /* Excel 里班级写成 3 → 3班 */
  };
  const HEAD_GRADE = /年级|级部|grade/i;
  const HEAD_CLASS = /班|class/i;
  const HEAD_NAME = /姓名|名字|学生|name/i;

  RX.roster = {
    data: rosterInit,
    save() { lsSet(RO_KEY, this.data); },

    presetActive() { return !!(PRESET && this.data.some(r => r.builtin)); },
    presetInfo() { return PRESET ? { label: PRESET.label, total: PRESET.total, classes: PRESET.classes.length } : null; },
    restorePreset() {
      if (!PRESET) return this.data.length;
      const extra = this.data.filter(r => !r.builtin);
      this.data = presetRows.slice().concat(extra);
      this.save();
      return this.data.length;
    },
    rows(grade, cls) { return this.data.filter(r => r.grade === grade && r.cls === cls); },
    label(r) { return r && r.dup ? r.name + '（名单第 ' + r.dup + ' 位）' : (r ? r.name : ''); },

    import(text, opts) {
      const rows = String(text || '').split(/\r?\n/)
        .map(line => line.split(/[，,、\t\s]+/).map(s => s.trim()));
      return this.importRows(rows, opts);
    },

    importRows(rows, opts) {
      opts = opts || {};
      const flat = (rows || []).map(r => (r || []).map(c => String(c == null ? '' : c).trim()));
      let map = null, start = 0;

      for (let i = 0; i < Math.min(3, flat.length); i++) {
        if (flat[i].some(c => HEAD_NAME.test(c))) {
          const h = flat[i];
          map = {
            grade: h.findIndex(c => HEAD_GRADE.test(c)),
            cls: h.findIndex(c => HEAD_CLASS.test(c)),
            name: h.findIndex(c => HEAD_NAME.test(c)),
          };
          start = i + 1;
          break;
        }
      }

      const forceCls = opts.cls && opts.cls !== 'auto';
      const defGrade = (!opts.grade || opts.grade === 'auto') ? null : opts.grade;
      let ok = 0, bad = 0;
      for (let i = start; i < flat.length; i++) {
        const cells = flat[i].filter(c => c !== '');
        if (!cells.length) continue;
        let grade = '', cls = '', name = '';

        if (forceCls) {
          if (map && map.name >= 0 && flat[i][map.name]) {
            name = flat[i][map.name];
          } else if (cells.length === 1) {
            name = cells[0];
          } else if (cells.length >= 3) {
            name = cells[2];
          } else if (cells.length === 2) {
            name = cells[1];
          }
          grade = defGrade || '未填';
          cls = normCls(opts.cls);
        } else if (map && map.name >= 0 && flat[i][map.name]) {
          grade = map.grade >= 0 ? flat[i][map.grade] : '';
          cls = map.cls >= 0 ? flat[i][map.cls] : '';
          name = flat[i][map.name];
        } else if (cells.length >= 3) {
          grade = cells[0]; cls = cells[1]; name = cells[2];
        } else if (cells.length === 2) {
          cls = cells[0]; name = cells[1];
        } else {
          bad++;
          continue;
        }

        grade = normGrade(grade || defGrade || '');
        cls = normCls(cls);
        name = String(name || '').trim();
        if (!name || HEAD_NAME.test(name) || name.length > 20) { bad++; continue; }

        const dup = this.data.some(r => r.grade === grade && r.cls === cls && r.name === name);
        if (!dup) { this.data.push({ grade, cls, name }); ok++; } else bad++;
      }
      this.save();
      return { ok, bad, total: this.data.length };
    },

    clear() { this.data = []; this.save(); },
    grades() { return [...new Set(this.data.map(r => r.grade))]; },
    classes(grade) {
      const rows = grade ? this.data.filter(r => r.grade === grade) : this.data;
      return [...new Set(rows.map(r => r.cls))].sort((a, b) => clsNum(a) - clsNum(b) || String(a).localeCompare(String(b)));
    },
    classTags() {
      return [...new Set(this.data.map(r => r.grade + '·' + r.cls))].sort((a, b) => {
        const pa = a.split('·'), pb = b.split('·');
        return pa[0].localeCompare(pb[0]) || clsNum(pa[1]) - clsNum(pb[1]);
      });
    },
    names(grade, cls) { return this.rows(grade, cls).map(r => r.name); },
  };

  /* ---------- 排行榜：每个游戏一份，学生取最高分 ---------- */
  const keyOf = o => [o.grade, o.cls, o.name].join('|') + (o.seq ? '#' + o.seq : '');

  RX.lb = {
    data: (function () {
      const d = lsGet(LB_KEY, null);
      if (d && typeof d === 'object' && !Array.isArray(d)) return d;
      const fresh = {};
      const old = lsGet(OLD_LB, null);
      if (Array.isArray(old) && old.length) {
        fresh.quick = old.map(o => ({
          k: keyOf(o), grade: o.grade, cls: o.cls, name: o.name,
          best: o.score, passed: o.score >= 120, plays: 1, ts: o.ts || Date.now(),
        })).sort((a, b) => b.best - a.best);
      }
      return fresh;
    })(),
    save() { lsSet(LB_KEY, this.data); },
    list(gameId) {
      if (!this.data[gameId]) this.data[gameId] = [];
      return this.data[gameId];
    },
    entry(gameId, who) {
      if (!who) return null;
      const k = keyOf(who);
      return this.list(gameId).find(e => e.k === k) || null;
    },
    submit(gameId, score, passed) {
      const id = RX.identity.get();
      if (!id || id.isTeacher || !id.name) return { ok: false, reason: 'teacher' };
      const arr = this.list(gameId);
      const k = keyOf(id);
      let e = arr.find(x => x.k === k);
      const prevBest = e ? e.best : -1;
      if (!e) {
        e = {
          k, grade: id.grade, cls: id.cls, name: id.name,
          seq: id.seq || 0, dup: id.dup || 0, code: id.code || '',
          best: score, passed: !!passed, plays: 1, ts: Date.now(),
        };
        arr.push(e);
      } else {
        e.best = Math.max(e.best, score);
        e.passed = e.passed || !!passed;
        e.plays++;
        e.ts = Date.now();
      }
      arr.sort((a, b) => b.best - a.best || a.ts - b.ts);
      if (arr.length > 300) arr.length = 300;
      this.save();
      /* 同步到该生的个人账号：首页卡片 / 我的档案都用它 */
      if (RX.accounts) RX.accounts.syncBest(gameId, e);
      return {
        ok: true, best: e.best, passed: e.passed,
        improved: score > prevBest,
        rank: arr.findIndex(x => x.k === k) + 1,
      };
    },
    top(gameId, n = 10) { return this.list(gameId).slice(0, n); },
    myBest(gameId) { const e = this.entry(gameId, RX.identity.get()); return e ? e.best : 0; },
    myPassed(gameId) { const e = this.entry(gameId, RX.identity.get()); return !!(e && e.passed); },

    /** 老数据迁移：排行榜里有分、账号里没有 → 补进账号 */
    seedAccount() {
      if (!RX.accounts) return;
      RX.accounts.seedFromLB((gid, acc) => this.entry(gid, acc));
    },

    /**
     * 全站学生记录：名册 ∪ 账号 ∪ 排行榜
     * 每条 = { grade, cls, name, seq, dup, xp, games{id:{best,done,plays,lastTs}}, total, passedCount, lastTs }
     */
    records() {
      const map = new Map();
      const get = p => {
        const k = keyOf(p);
        if (!map.has(k)) {
          map.set(k, {
            key: k, grade: p.grade, cls: p.cls, name: p.name,
            seq: p.seq || 0, dup: p.dup || 0, code: p.code || '',
            xp: 0, games: {}, lastTs: 0, inRoster: false, hasAccount: false, history: [],
          });
        }
        return map.get(k);
      };
      RX.roster.data.forEach(r => { get(r).inRoster = true; });
      RX.accounts.list().forEach(a => {
        const o = get(a);
        o.hasAccount = true;
        o.xp = a.xp || 0;
        o.lastTs = Math.max(o.lastTs, a.lastSeen || 0);
        o.history = a.history || [];
        Object.keys(a.games || {}).forEach(gid => { o.games[gid] = Object.assign({}, a.games[gid]); });
      });
      RX.GAME_LIST.forEach(g => this.list(g.id).forEach(e => {
        const o = get(e);
        const cur = o.games[g.id] || { best: 0, done: false, plays: 0, lastTs: 0 };
        cur.best = Math.max(cur.best || 0, e.best || 0);
        cur.done = !!(cur.done || e.passed);
        cur.plays = Math.max(cur.plays || 0, e.plays || 0);
        cur.lastTs = Math.max(cur.lastTs || 0, e.ts || 0);
        o.games[g.id] = cur;
        o.lastTs = Math.max(o.lastTs, e.ts || 0);
      }));
      const out = [...map.values()];
      out.forEach(o => {
        o.total = RX.GAME_LIST.reduce((s, g) => s + ((o.games[g.id] && o.games[g.id].best) || 0), 0);
        o.passedCount = RX.GAME_LIST.filter(g => o.games[g.id] && o.games[g.id].done).length;
        o.plays = RX.GAME_LIST.reduce((s, g) => s + ((o.games[g.id] && o.games[g.id].plays) || 0), 0);
      });
      return out;
    },

    /** 兼容旧接口 */
    students() {
      return this.records().map(r => ({
        grade: r.grade, cls: r.cls, name: r.name, seq: r.seq, dup: r.dup, code: r.code,
      })).sort((a, b) =>
        a.grade.localeCompare(b.grade) || clsNum(a.cls) - clsNum(b.cls) ||
        (a.seq || 1e6) - (b.seq || 1e6) || String(a.name).localeCompare(String(b.name)));
    },

    render(gameId, n = 10) {
      const rows = this.top(gameId, n);
      if (!rows.length) return '<p class="sub">还没有人上榜——第一个打破记录的人就是你！</p>';
      const medal = ['🥇', '🥈', '🥉'];
      return `<div class="lb-table">${rows.map((r, i) => `
        <div class="lb-row ${i < 3 ? 'top' : ''}">
          <span class="lb-rank">${medal[i] || (i + 1)}</span>
          <span class="lb-name">${esc(r.grade)}${esc(r.cls)} · ${esc(r.name)}${r.dup ? '（第' + r.dup + '位）' : ''}</span>
          <span class="lb-pass">${r.passed ? '✅ 已过关' : '—'}</span>
          <span class="lb-score">${r.best} 分</span>
        </div>`).join('')}</div>`;
    },
    tabsHtml(activeId) {
      return RX.GAME_LIST.map(g =>
        `<button class="lb-tab ${g.id === activeId ? 'active' : ''}" data-lbtab="${g.id}">${g.icon} ${g.short}</button>`).join('');
    },
    bindTabs(root, onPick) {
      if (!root) return;
      root.querySelectorAll('[data-lbtab]').forEach(btn => {
        btn.onclick = () => {
          root.querySelectorAll('[data-lbtab]').forEach(b => b.classList.toggle('active', b === btn));
          onPick(btn.dataset.lbtab);
        };
      });
    },
    openModal(gameId) {
      const gid = gameId || (RX.GAME_LIST[0] && RX.GAME_LIST[0].id);
      const modal = el('lb-modal');
      if (!modal) return;
      el('lb-body').innerHTML = `
        <p class="sub">每个游戏独立计分，取每人最高一次成绩；过关与积分分开记录。</p>
        <div class="lb-tabs" id="lb-tabs">${this.tabsHtml(gid)}</div>
        <p class="lb-rule" id="lb-rule">过关标准：${RX.gameMeta(gid).rule}</p>
        <div id="lb-list">${this.render(gid, 10)}</div>`;
      this.bindTabs(el('lb-tabs'), g => {
        el('lb-list').innerHTML = this.render(g, 10);
        el('lb-rule').textContent = '过关标准：' + RX.gameMeta(g).rule;
      });
      modal.classList.remove('hidden');
    },
  };

  /* ---------- 身份 ---------- */
  RX.identity = {
    get() { return lsGet(ID_KEY, null); },
    ok() { return !!this.get(); },
    isTeacher() { const id = this.get(); return !!(id && id.isTeacher); },
    set(obj) {
      if (obj && obj.isTeacher) {
        lsSet(ID_KEY, { isTeacher: true, ts: Date.now() });
        RX.accounts.loginTeacher();
      } else {
        const acc = RX.accounts.login(obj);
        lsSet(ID_KEY, {
          grade: acc.grade, cls: acc.cls, name: acc.name,
          seq: acc.seq || 0, dup: acc.dup || 0, code: acc.code || '',
          isTeacher: false, ts: Date.now(),
        });
        RX.lb.seedAccount();
      }
      this.refreshBadge();
      if (RX.refreshXP) RX.refreshXP();
    },
    clear() {
      lsSet(ID_KEY, null);
      RX.accounts.logout();
      this.refreshBadge();
      if (RX.refreshXP) RX.refreshXP();
    },
    label() {
      const id = this.get();
      if (!id) return '';
      return id.isTeacher ? '👩‍🏫 教师端'
        : `${id.grade}·${id.cls}·${id.name}${id.dup ? '（第' + id.dup + '位）' : ''}`;
    },
    refreshBadge() {
      const b = el('id-badge');
      if (!b) return;
      const id = this.get();
      b.textContent = id ? this.label() : '🪪 未登录';
      b.classList.toggle('teacher', !!(id && id.isTeacher));
    },
    ask(cb) { openLogin({ onStudent: cb, onTeacher: cb }); },
  };

  /* ---------- 恢复上次登录（在页面渲染前完成，首页进度才是本人的） ---------- */
  (function restore() {
    const id = lsGet(ID_KEY, null);
    if (!id) return;
    if (id.isTeacher) { RX.accounts.loginTeacher(); return; }
    RX.accounts.login(id);
    RX.lb.seedAccount();
  })();

  /* ---------- 入口门：学生端 / 教师端 ---------- */
  let pending = { onStudent: null, onTeacher: null };
  let useFree = false;
  let nameRows = [];
  let loginCb = null;

  function gradeVal() {
    const g = el('sel-grade');
    return (g && g.value) || (PRESET ? PRESET.grade : '');
  }
  function classLabel(cls) {
    const r = RX.roster.data.find(x => x.grade === gradeVal() && x.cls === cls && x.code);
    return r ? cls + ' · ' + r.code : cls;
  }

  function paintLoginAreas() {
    const hasRoster = RX.roster.grades().length > 0;
    const free = !hasRoster || useFree;
    el('id-roster-tip').classList.toggle('hidden', hasRoster);
    el('id-pick-area').classList.toggle('hidden', free);
    el('id-free-area').classList.toggle('hidden', !free);
    const btn = el('id-use-free');
    if (btn) {
      btn.classList.toggle('hidden', !hasRoster);
      btn.textContent = useFree ? '← 回到名单里选' : '名单里找不到我？手动填写';
    }
  }

  function fillClass() {
    const g = gradeVal();
    const selC = el('sel-class');
    if (!selC) return;
    selC.innerHTML = RX.roster.classes(g)
      .map(c => `<option value="${esc(c)}">${esc(classLabel(c))}</option>`).join('');
    fillName();
  }

  function fillName() {
    const selC = el('sel-class');
    const g = gradeVal();
    const c = selC ? selC.value : '';
    nameRows = c ? RX.roster.rows(g, c) : [];
    const selN = el('sel-name');
    if (!selN) return;
    selN.innerHTML = nameRows.length
      ? nameRows.map((r, i) => `<option value="${i}">${esc(RX.roster.label(r))}</option>`).join('')
      : '<option value="">（这个班还没有名单）</option>';
    const hint = el('id-name-hint');
    if (hint) hint.textContent = nameRows.length
      ? `本班共 ${nameRows.length} 人 · 找到自己的名字后点「进入学生端」`
      : '这个班还没有名单，请点下方「手动填写」或联系老师导入';
  }

  function setPwdError(on) {
    const err = el('login-err');
    if (err) err.classList.toggle('hidden', !on);
    const inp = el('login-pwd');
    if (inp) {
      inp.classList.toggle('bad', on);
      if (on) { inp.value = ''; inp.focus(); }
    }
  }

  function openLogin(opts) {
    opts = opts || {};
    pending = { onStudent: opts.onStudent || null, onTeacher: opts.onTeacher || null };
    const modal = el('login-modal');
    modal.classList.remove('hidden');

    /* 预览 iframe 等环境禁用 localStorage 时给出提示 */
    const warn = el('login-storage-note');
    if (warn) warn.classList.toggle('hidden', STORAGE_OK);

    const grades = RX.roster.grades();
    const selG = el('sel-grade');
    selG.innerHTML = grades.map(g => `<option>${esc(g)}</option>`).join('');
    el('lab-grade').classList.toggle('hidden', grades.length <= 1);

    const info = RX.roster.presetInfo();
    const on = RX.roster.presetActive() && info;
    const note = el('id-preset-note');
    note.classList.toggle('hidden', !on);
    if (on) note.textContent = `📋 已内置 ${info.label}年级名单：${info.classes} 个班 · ${info.total} 人`;

    useFree = grades.length === 0;
    paintLoginAreas();
    if (grades.length) fillClass();
    setPwdError(false);

    /* 有存档 → 先显示「欢迎回来」 */
    const id = RX.identity.get();
    el('login-back').classList.toggle('hidden', !id);
    el('login-cols').classList.toggle('hidden', !!id);
    if (id) {
      el('login-back-name').textContent = RX.identity.label();
      const me = id.isTeacher ? null : myRecord();
      const sub = id.isTeacher ? '教师端不计成绩、不上排行榜'
        : (me && me.plays ? `已玩 ${me.plays} 局 · 最高总分 ${me.total} 分 · 过关 ${me.passedCount}/${RX.GAME_LIST.length}` :
          '这是你第一次来，进去挑个游戏试试吧');
      el('login-back-sub').textContent = sub;
    }
  }

  function closeLogin() { el('login-modal').classList.add('hidden'); }

  function studentLogin() {
    let id;
    if (!useFree && RX.roster.grades().length) {
      const v = el('sel-name').value;
      const row = v === '' ? null : nameRows[Number(v)];
      if (!row || !row.name) {
        RX.toast('这个班还没有你的名字：点「名单里找不到我」手动填写，或让老师补名单');
        return;
      }
      id = {
        grade: row.grade, cls: row.cls, name: row.name,
        seq: row.seq || 0, dup: row.dup || 0, code: row.code || '',
      };
    } else {
      id = {
        grade: el('free-grade').value.trim() || '未填',
        cls: el('free-class').value.trim() || '未填',
        name: el('free-name').value.trim(),
      };
      if (!id.name) { RX.toast('请填写姓名'); return; }
    }
    RX.identity.set(Object.assign(id, { isTeacher: false }));
    closeLogin();
    RX.toast(`已登录：${RX.identity.label()}`);
    if (RX.refreshHome) RX.refreshHome();
    if (pending.onStudent) { const cb = pending.onStudent; pending = { onStudent: null, onTeacher: null }; cb(); }
    else { pending = { onStudent: null, onTeacher: null }; }
  }

  function teacherLogin() {
    const inp = el('login-pwd');
    const v = inp ? inp.value.trim() : '';
    if (v !== TEACHER_PWD) { setPwdError(true); return; }
    RX.identity.set({ isTeacher: true });
    closeLogin();
    if (inp) inp.value = '';
    RX.toast('教师端已登录 · 不计成绩');
    if (RX.refreshHome) RX.refreshHome();
    if (pending.onTeacher) { const cb = pending.onTeacher; pending = { onStudent: null, onTeacher: null }; cb(); }
    else { pending = { onStudent: null, onTeacher: null }; }
  }

  RX.login = {
    open: openLogin,
    close: closeLogin,
    storageOK: STORAGE_OK,
    /* 每次打开站点都停在入口门：有存档就先显示「欢迎回来」，没有就让学生选班级姓名 */
    boot() { openLogin({}); },
  };

  /* ---------- 我的档案 ---------- */
  function myRecord() {
    const id = RX.identity.get();
    if (!id || id.isTeacher) return null;
    const k = keyOf(id);
    return RX.lb.records().find(r => r.key === k) || null;
  }

  function profileHtml(rec) {
    if (!rec) return '<p class="sub">还没有数据。</p>';
    const games = RX.GAME_LIST.map(g => {
      const s = rec.games[g.id];
      const best = s ? s.best : 0;
      const done = !!(s && s.done);
      const plays = s ? s.plays : 0;
      return `<div class="pf-game ${done ? 'done' : (plays ? 'tried' : '')}">
        <span class="pf-ico">${g.icon}</span>
        <span class="pf-name">${g.name}</span>
        <span class="pf-val">${plays ? best + ' 分' : '未玩'}</span>
        <span class="pf-tag">${done ? '✅ 已过关' : (plays ? '未过关' : '—')}</span>
        <span class="pf-plays">${plays ? plays + ' 局' : ''}</span>
      </div>`;
    }).join('');
    const hist = (rec.history || []).slice(0, 12).map(h => {
      const g = RX.gameMeta(h.game);
      return `<li>
        <span class="h-time">${fmtTime(h.ts)}</span>
        <span class="h-game">${g.icon} ${g.name}</span>
        <span class="h-score">${h.score} 分</span>
        <span class="h-pass ${h.passed ? 'ok' : ''}">${h.passed ? '✅ 过关' : '未过关'}</span>
      </li>`;
    }).join('');
    return `
      <div class="pf-top">
        <div class="pf-avatar">${esc(String(rec.name || '?').slice(0, 1))}</div>
        <div>
          <p class="pf-who">${esc(rec.grade)}${esc(rec.cls)} · <b>${esc(rec.name)}</b>${rec.dup ? `（名单第 ${rec.dup} 位）` : ''}</p>
          <p class="sub">最近活跃：${rec.lastTs ? fmtTime(rec.lastTs) : '还没玩过'}</p>
        </div>
      </div>
      <div class="pf-stats">
        <div><b>${rec.xp || 0}</b><span>经验值</span></div>
        <div><b>${rec.total || 0}</b><span>最高分合计</span></div>
        <div><b>${rec.passedCount || 0}/${RX.GAME_LIST.length}</b><span>已过关</span></div>
        <div><b>${rec.plays || 0}</b><span>总局数</span></div>
      </div>
      <h4 class="pf-h">🎮 各游戏成绩</h4>
      <div class="pf-games">${games}</div>
      <h4 class="pf-h">🕘 最近活动</h4>
      ${hist ? `<ul class="hist">${hist}</ul>` : '<p class="sub">还没有活动记录，玩一局就会出现在这里。</p>'}`;
  }

  function openMe() {
    const id = RX.identity.get();
    if (!id) { openLogin({}); return; }
    if (id.isTeacher) { openTeacher(); return; }
    el('me-body').innerHTML = profileHtml(myRecord());
    el('me-modal').classList.remove('hidden');
  }

  /* ============================================================
     教师后台
     ============================================================ */
  let tcTab = 'overview';
  let tcLbGame = RX.GAME_LIST[0].id;
  let tcClass = '';
  let tcSort = 'points';
  let tcSearch = '';

  function openTeacher() {
    if (!RX.identity.isTeacher()) {
      openLogin({ onTeacher: openTeacher });
      RX.toast('教师后台需要教师密码');
      return;
    }
    el('tc-modal').classList.remove('hidden');
    refreshTc();
  }
  RX.teacher = { open: openTeacher };

  function switchTcTab(tab) {
    tcTab = tab;
    el('tc-tabs').querySelectorAll('[data-tctab]').forEach(b =>
      b.classList.toggle('active', b.dataset.tctab === tab));
    ['overview', 'students', 'roster', 'rank', 'data'].forEach(t => {
      el('tc-pane-' + t).classList.toggle('hidden', t !== tab);
    });
    refreshTc();
  }

  function refreshTc() {
    const recs = RX.lb.records();
    const active = recs.filter(r => r.plays > 0 || r.total > 0).length;
    const clsN = new Set(recs.map(r => r.grade + '·' + r.cls)).size;
    el('tc-stat').innerHTML =
      `名册 <b>${RX.roster.data.length}</b> 人 · <b>${clsN}</b> 个班级 · ` +
      `已参与 <b>${active}</b> 人 · 共 <b>${recs.reduce((s, r) => s + (r.plays || 0), 0)}</b> 局` +
      (STORAGE_OK ? '' : ' · <b style="color:#b45309">本次打开的数据，刷新即消失</b>');

    if (tcTab === 'overview') renderOverview(recs);
    else if (tcTab === 'students') renderStudents(recs);
    else if (tcTab === 'roster') renderRosterPane();
    else if (tcTab === 'rank') renderRank();
    else if (tcTab === 'data') renderData();
  }

  /* ----- 班级总览 ----- */
  function classStats(recs) {
    const map = new Map();
    RX.roster.classTags().forEach(t => {
      const [g, c] = t.split('·');
      map.set(t, { tag: t, grade: g, cls: c, count: 0, active: 0, passed: 0, total: 0, xp: 0, top: null });
    });
    recs.forEach(r => {
      const t = r.grade + '·' + r.cls;
      if (!map.has(t)) map.set(t, { tag: t, grade: r.grade, cls: r.cls, count: 0, active: 0, passed: 0, total: 0, xp: 0, top: null });
      const c = map.get(t);
      c.count++;
      if (r.plays > 0 || r.total > 0) c.active++;
      c.passed += r.passedCount;
      c.total += r.total;
      c.xp += r.xp;
      if (!c.top || r.total > c.top.total) c.top = r;
    });
    return [...map.values()].sort((a, b) => clsNum(a.cls) - clsNum(b.cls));
  }

  function renderOverview(recs) {
    const stats = classStats(recs);
    const sum = stats.reduce((a, c) => ({
      count: a.count + c.count, active: a.active + c.active,
      passed: a.passed + c.passed, total: a.total + c.total, xp: a.xp + c.xp,
    }), { count: 0, active: 0, passed: 0, total: 0, xp: 0 });

    const rows = stats.map(c => `<tr data-cls="${esc(c.tag)}">
      <td class="stu"><b>${esc(c.tag.replace('·', ' '))}</b></td>
      <td>${c.count}</td>
      <td>${c.active}</td>
      <td>${c.passed}</td>
      <td><b>${c.total}</b></td>
      <td>${c.active ? Math.round(c.total / c.active) : 0}</td>
      <td>${c.xp}</td>
      <td class="stu">${c.top && c.top.total ? esc(c.top.name) + ' · ' + c.top.total : '—'}</td>
    </tr>`).join('');

    const top = recs.filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total || b.passedCount - a.passedCount)
      .slice(0, 10);
    const medal = ['🥇', '🥈', '🥉'];
    const topHtml = top.length ? top.map((r, i) => `<div class="lb-row ${i < 3 ? 'top' : ''}">
        <span class="lb-rank">${medal[i] || (i + 1)}</span>
        <span class="lb-name">${esc(r.grade)}${esc(r.cls)} · ${esc(r.name)}</span>
        <span class="lb-pass">过关 ${r.passedCount}/${RX.GAME_LIST.length}</span>
        <span class="lb-score">${r.total} 分</span>
      </div>`).join('') : '<p class="sub">还没有学生玩过，成绩会实时出现在这里。</p>';

    el('tc-pane-overview').innerHTML = `
      <div class="tc-kpis">
        <div class="tc-kpi"><b>${sum.count}</b><span>名册人数</span></div>
        <div class="tc-kpi"><b>${sum.active}</b><span>已参与</span></div>
        <div class="tc-kpi"><b>${sum.passed}</b><span>过关总次数</span></div>
        <div class="tc-kpi"><b>${sum.total}</b><span>最高分合计</span></div>
        <div class="tc-kpi"><b>${sum.xp}</b><span>经验值合计</span></div>
      </div>
      <h3 class="tc-h">🏫 各班情况 <span class="sub">（点某一行查看该班学生）</span></h3>
      <div class="tc-scroll">
        <table class="tc-table">
          <thead><tr>
            <th class="stu">班级</th><th>人数</th><th>参与</th><th>过关数</th>
            <th>总积分</th><th>人均</th><th>经验值</th><th class="stu">本班最高</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <h3 class="tc-h">🏆 年级积分榜 TOP 10</h3>
      <div class="lb-table">${topHtml}</div>`;

    el('tc-pane-overview').querySelectorAll('tr[data-cls]').forEach(tr => {
      tr.onclick = () => {
        tcClass = tr.dataset.cls;
        switchTcTab('students');
      };
    });
  }

  /* ----- 学生档案 ----- */
  function renderStudents(recs) {
    const sel = el('tc-class-filter');
    const tags = RX.roster.classTags();
    sel.innerHTML = `<option value="">全部班级</option>` +
      tags.map(t => `<option value="${esc(t)}" ${t === tcClass ? 'selected' : ''}>${esc(t.replace('·', ' '))}</option>`).join('');
    el('tc-sort').value = tcSort;
    el('tc-search').value = tcSearch;

    let list = recs.filter(r => !tcClass || (r.grade + '·' + r.cls) === tcClass);
    if (tcSearch) list = list.filter(r => r.name.includes(tcSearch));

    if (tcSort === 'points') list.sort((a, b) => b.total - a.total || b.xp - a.xp);
    else if (tcSort === 'passed') list.sort((a, b) => b.passedCount - a.passedCount || b.total - a.total);
    else if (tcSort === 'recent') list.sort((a, b) => b.lastTs - a.lastTs);
    else list.sort((a, b) =>
      a.grade.localeCompare(b.grade) || clsNum(a.cls) - clsNum(b.cls) ||
      (a.seq || 1e6) - (b.seq || 1e6) || a.name.localeCompare(b.name));

    el('tc-count').textContent = `共 ${list.length} 人`;

    if (!list.length) {
      el('tc-table').innerHTML = '<p class="sub">没有符合条件的学生。</p>';
      return;
    }

    const body = list.map((r, i) => `<tr data-key="${esc(r.key)}">
      <td class="tc-idx">${i + 1}</td>
      <td class="stu">${esc(r.grade)}${esc(r.cls)} · <b>${esc(r.name)}</b>${r.dup ? `（第${r.dup}位）` : ''}</td>
      <td><b>${r.total}</b></td>
      <td>${r.passedCount}/${RX.GAME_LIST.length}</td>
      <td>${r.xp}</td>
      <td>${r.plays}</td>
      <td>${r.lastTs ? fmtTime(r.lastTs) : '—'}</td>
      <td><button class="mini-btn" data-detail="${esc(r.key)}">详情</button></td>
    </tr>`).join('');

    el('tc-table').innerHTML = `
      <div class="tc-scroll">
        <table class="tc-table">
          <thead><tr>
            <th>#</th><th class="stu">学生</th><th>总积分</th><th>过关</th>
            <th>经验值</th><th>局数</th><th>最近活跃</th><th></th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <p class="sub" style="margin-top:10px">总积分 = 各游戏最高分相加；点「详情」看每个游戏的成绩和最近玩过的记录。</p>`;

    el('tc-table').querySelectorAll('[data-detail]').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        const rec = list.find(r => r.key === btn.dataset.detail);
        openStudent(rec);
      };
    });
  }

  function openStudent(rec) {
    if (!rec) return;
    el('stu-title').textContent = `👤 ${rec.grade}${rec.cls} · ${rec.name}`;
    el('stu-body').innerHTML = profileHtml(rec);
    el('stu-modal').classList.remove('hidden');
  }

  /* ----- 名册管理 ----- */
  function renderRosterPane() {
    const builtin = RX.roster.data.filter(x => x.builtin).length;
    const note = el('tc-preset-note');
    if (note) note.classList.toggle('hidden', !builtin);
    const g = el('tc-grade'), c = el('tc-class');
    if (g && !g.options.length) {
      const autoG = document.createElement('option');
      autoG.value = ''; autoG.textContent = '不指定（按 Excel 里的年级列识别）';
      g.appendChild(autoG);
      ['高一', '高二', '高三'].forEach(x => {
        const o = document.createElement('option'); o.value = x; o.textContent = x; g.appendChild(o);
      });
      const autoC = document.createElement('option');
      autoC.value = ''; autoC.textContent = '不指定（按 Excel 里的班级列识别）';
      c.appendChild(autoC);
      for (let i = 1; i <= 13; i++) {
        const o = document.createElement('option'); o.value = i + '班'; o.textContent = i + '班'; c.appendChild(o);
      }
    }
  }

  /* ----- 排行榜 ----- */
  function renderRank() {
    el('tc-lb-tabs').innerHTML = RX.lb.tabsHtml(tcLbGame);
    RX.lb.bindTabs(el('tc-lb-tabs'), gid => {
      tcLbGame = gid;
      el('tc-lb').innerHTML = RX.lb.render(gid, 10);
      el('tc-lb-rule').textContent = '过关标准：' + RX.gameMeta(gid).rule;
    });
    el('tc-lb').innerHTML = RX.lb.render(tcLbGame, 10);
    el('tc-lb-rule').textContent = '过关标准：' + RX.gameMeta(tcLbGame).rule;
  }

  /* ----- 数据备份 ----- */
  function renderData() {
    const recs = RX.lb.records();
    const accN = RX.accounts.list().length;
    const storeNote = STORAGE_OK
      ? `💡 <b>数据存在这台电脑的浏览器里</b>（名册 / 账号 / 成绩都在本机 localStorage）。
         换电脑、换浏览器看不到这边的数据；清浏览器缓存会丢。要长期保存或换机，请用下面的「导出备份」，
         在新电脑上「导入备份」即可恢复。`
      : `⚠️ <b>当前环境禁用了浏览器本地存储</b>：本次打开期间数据一切正常，但<b>刷新或关闭页面就会丢失</b>。
         请用 Chrome / Edge 直接打开网页文件，或发布成链接后再使用；也可以先用下面的「导出备份」把当前数据存下来。`;
    el('tc-pane-data').innerHTML = `
      <div class="id-note">${storeNote}</div>
      <div class="tc-data-grid">
        <div class="tc-data-card">
          <h4>💾 备份与恢复</h4>
          <p class="sub">JSON 备份含：全部学生账号（经验值 / 各游戏成绩 / 活动记录）+ 名册 + 排行榜。</p>
          <div class="row">
            <button class="btn btn-primary" id="tc-export-json">导出备份 JSON</button>
            <button class="btn btn-ghost" id="tc-import-json">导入备份 JSON</button>
            <input type="file" id="tc-json-file" accept=".json" class="tc-file hidden">
          </div>
        </div>
        <div class="tc-data-card">
          <h4>📊 成绩表</h4>
          <p class="sub">导出 CSV（Excel 可直接打开）：班级、姓名、总积分、过关数、各游戏最高分。</p>
          <button class="btn btn-primary" id="tc-export-csv">导出成绩 CSV</button>
        </div>
        <div class="tc-data-card">
          <h4>🧹 清理</h4>
          <p class="sub">「清空成绩」只删分数与活动记录，名册和学生姓名保留。</p>
          <div class="row">
            <button class="btn btn-red" id="tc-reset-scores">清空全部成绩</button>
            <button class="btn btn-red" id="tc-reset-accounts">删除全部学生账号</button>
          </div>
        </div>
      </div>
      <p class="sub" style="margin-top:14px">
        当前：${RX.roster.data.length} 名册学生 · ${accN} 个学生账号 · ${recs.filter(r => r.plays > 0 || r.total > 0).length} 人已有记录。
      </p>`;

    el('tc-export-json').onclick = () => download(
      `氧化还原竞技场-备份-${dateTag()}.json`, RX.accounts.exportJSON(), 'application/json');
    el('tc-export-csv').onclick = () => download(
      `氧化还原竞技场-成绩-${dateTag()}.csv`, '\uFEFF' + csvText(), 'text/csv');
    el('tc-import-json').onclick = () => el('tc-json-file').click();
    el('tc-json-file').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      const txt = await f.text();
      const r = RX.accounts.importJSON(txt);
      e.target.value = '';
      if (r.ok) { RX.toast(`备份已导入，合并 ${r.count} 条记录`); refreshTc(); }
      else RX.toast('导入失败：' + r.reason);
    };
    el('tc-reset-scores').onclick = () => {
      if (!window.confirm('确定清空全部成绩？名册和学生姓名会保留，但分数、过关、活动记录都会删除。')) return;
      RX.accounts.resetScores();
      RX.lb.data = {};
      RX.lb.save();
      try { localStorage.removeItem('redox_progress_v1'); } catch (err) { /* ignore */ }
      refreshTc();
      RX.toast('成绩已清空');
    };
    el('tc-reset-accounts').onclick = () => {
      if (!window.confirm('确定删除全部学生账号？学生的经验值、成绩、活动记录都会消失（名册保留）。')) return;
      RX.accounts.reset();
      RX.identity.clear();
      refreshTc();
      RX.toast('学生账号已删除');
    };
  }

  function dateTag() {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }
  function csvText() {
    const recs = RX.lb.records().sort((a, b) =>
      a.grade.localeCompare(b.grade) || clsNum(a.cls) - clsNum(b.cls) ||
      (a.seq || 1e6) - (b.seq || 1e6));
    const head = ['年级', '班级', '姓名', '总积分', '过关数', '经验值', '局数', '最近活跃']
      .concat(RX.GAME_LIST.map(g => g.name + '(最高分)'))
      .concat(RX.GAME_LIST.map(g => g.name + '(过关)'));
    const q = v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [head.map(q).join(',')];
    recs.forEach(r => {
      const row = [r.grade, r.cls, r.name, r.total, r.passedCount, r.xp, r.plays,
        r.lastTs ? fmtTime(r.lastTs) : ''];
      RX.GAME_LIST.forEach(g => row.push(r.games[g.id] ? r.games[g.id].best : ''));
      RX.GAME_LIST.forEach(g => row.push(r.games[g.id] && r.games[g.id].done ? '是' : '否'));
      lines.push(row.map(q).join(','));
    });
    return lines.join('\r\n');
  }

  /* ============================================================
     绑定
     ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    RX.identity.refreshBadge();
    if (RX.refreshXP) RX.refreshXP();

    /* 预览环境禁用本地存储时，顶栏和教师后台都挂出显眼提示 */
    if (!STORAGE_OK) {
      const pill = el('storage-warn');
      if (pill) pill.classList.remove('hidden');
      const tnote = el('tc-storage-warn');
      if (tnote) tnote.classList.remove('hidden');
    }

    /* 入口门 */
    el('login-student').onclick = studentLogin;
    el('login-teacher').onclick = teacherLogin;
    el('login-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') teacherLogin(); });
    el('login-pwd').addEventListener('input', () => setPwdError(false));
    el('sel-grade').onchange = fillClass;
    el('sel-class').onchange = fillName;
    el('id-use-free').onclick = () => {
      useFree = !useFree;
      if (useFree) {
        el('free-grade').value = gradeVal();
        el('free-class').value = el('sel-class').value || '';
      }
      paintLoginAreas();
    };
    el('login-continue').onclick = () => {
      closeLogin();
      RX.toast(`欢迎回来，${RX.identity.label()}`);
      if (RX.identity.isTeacher()) openTeacher();
      if (RX.refreshHome) RX.refreshHome();
    };
    el('login-other').onclick = () => {
      el('login-back').classList.add('hidden');
      el('login-cols').classList.remove('hidden');
    };

    /* 我的档案 / 切换账号 */
    el('id-badge').onclick = openMe;
    el('me-close').onclick = () => el('me-modal').classList.add('hidden');
    el('me-modal').addEventListener('click', e => {
      if (e.target.id === 'me-modal') e.target.classList.add('hidden');
    });
    el('me-switch').onclick = () => {
      el('me-modal').classList.add('hidden');
      RX.identity.clear();
      openLogin({});
    };

    /* 教师后台 */
    el('btn-teacher').onclick = openTeacher;
    el('tc-close').onclick = () => el('tc-modal').classList.add('hidden');
    el('tc-modal').addEventListener('click', e => {
      if (e.target.id === 'tc-modal') e.target.classList.add('hidden');
    });
    el('tc-tabs').querySelectorAll('[data-tctab]').forEach(b => {
      b.onclick = () => switchTcTab(b.dataset.tctab);
    });
    el('tc-class-filter').onchange = e => { tcClass = e.target.value; refreshTc(); };
    el('tc-sort').onchange = e => { tcSort = e.target.value; refreshTc(); };
    el('tc-search').oninput = e => { tcSearch = e.target.value.trim(); refreshTc(); };

    el('stu-close').onclick = () => el('stu-modal').classList.add('hidden');
    el('stu-modal').addEventListener('click', e => {
      if (e.target.id === 'stu-modal') e.target.classList.add('hidden');
    });

    /* 名册导入 */
    const tcTarget = () => ({ grade: el('tc-grade').value, cls: el('tc-class').value });
    el('tc-import').onclick = () => {
      const tgt = tcTarget();
      const r = RX.roster.import(el('tc-paste').value, tgt);
      el('tc-paste').value = '';
      const where = tgt.cls ? ` → ${tgt.grade || '未填'}·${tgt.cls}` : '';
      RX.toast(`导入完成：新增 ${r.ok} 人${where}（重复/格式问题 ${r.bad} 条）`);
      refreshTc();
      RX.identity.refreshBadge();
    };
    el('tc-restore').onclick = () => {
      const n = RX.roster.restorePreset();
      refreshTc();
      RX.toast(`内置年级名单已恢复：当前共 ${n} 人`);
    };
    el('tc-clear').onclick = () => {
      if (window.confirm('确定清空全部名册？清空后可用「恢复内置年级名单」找回 667 人。')) {
        RX.roster.clear(); refreshTc(); RX.toast('名册已清空');
      }
    };
    el('tc-file').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      const name = file.name.toLowerCase();
      const paste = el('tc-paste');
      try {
        if (/\.(xlsx|xlsm)$/.test(name)) {
          const rows = await RX.readXlsx(await file.arrayBuffer());
          paste.value = rows.map(r => r.filter(c => c !== '').join('\t')).filter(t => t.trim()).join('\n');
          RX.toast(`已从 Excel 读取 ${rows.length} 行，核对后点「导入名册」`, 3200);
        } else if (/\.xls$/.test(name)) {
          RX.toast('旧版 .xls 读不了，请在 Excel 里另存为 .xlsx 或 .csv', 3600);
        } else {
          const buf = await file.arrayBuffer();
          let text = new TextDecoder('utf-8').decode(buf);
          if (/\uFFFD/.test(text)) {
            try { text = new TextDecoder('gbk').decode(buf); } catch (err) { /* 保留 utf-8 */ }
          }
          paste.value = text;
          RX.toast('文件已读取，核对后点「导入名册」');
        }
      } catch (err) {
        RX.toast('读取失败：' + (err && err.message === 'NO_INFLATE'
          ? '当前浏览器不支持直接解析 Excel，请另存为 CSV'
          : (err && err.message) || '格式不支持'), 4000);
      }
      e.target.value = '';
    };

    /* 启动：有存档就直接进站，没有就停在入口门 */
    RX.login.boot();
  });

  window.RX = RX;
})();
