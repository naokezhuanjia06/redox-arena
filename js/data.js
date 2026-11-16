/* ============================================================
   data.js —— 化学数据层
   核心：氧化性/还原性阶梯、金属活动性、反应判定 canReact
   ============================================================ */
window.RX = window.RX || {};

/* ---- 非金属/变价金属 阶梯 ----
   氧化性：MnO₄⁻(H⁺) > Cl₂ > Br₂ > Fe³⁺ > I₂ > S   （ox 越大氧化性越强）
   还原性：Mn²⁺ < Cl⁻ < Br⁻ < Fe²⁺ < I⁻ < S²⁻
   规则：氧化剂 A 能氧化还原剂 B  ⇔  A.ox > B.oxOfRed
        （B.oxOfRed = B 被氧化后产物的氧化性强弱档位） */
RX.SP = {
  // ---- 氧化剂（含条件型） ----
  'MnO₄⁻(H⁺)': { ox: 6,   color: '#b266d9' },
  'Cl₂':       { ox: 5,   color: '#cfe36b' },
  'Br₂':       { ox: 4,   color: '#e8a04c' },
  'Fe³⁺':      { ox: 3,   color: '#e8c34c' },
  'I₂':        { ox: 2,   color: '#a9765a' },
  'S':         { ox: 1,   color: '#e8e05c' },
  'NO₃⁻(H⁺)':  { ox: 3.5, color: '#8fb4e8' },   // 稀硝酸：能氧化 Fe²⁺/I⁻/S²⁻/SO₃²⁻
  'ClO⁻':      { ox: 5,   color: '#9ad9c8' },   // 次氯酸根：不能氧化 Cl⁻
  // ---- 对应还原剂 ----
  'Mn²⁺': { oxOfRed: 6, color: '#f0c8de' },
  'Cl⁻':  { oxOfRed: 5, color: '#eef4d8' },
  'Br⁻':  { oxOfRed: 4, color: '#f4e2cc' },
  'Fe²⁺': { oxOfRed: 3, color: '#d8ecd8' },
  'I⁻':   { oxOfRed: 2, color: '#e2d2c6' },
  'S²⁻':  { oxOfRed: 1, color: '#f2eeba' },
  'SO₃²⁻':{ oxOfRed: 0.5, color: '#e8e8e8' },   // 极易被氧化为 SO₄²⁻
  'C₂O₄²⁻':{ oxOfRed: 4.5, color: '#dfe8d8' },  // 草酸根：被强氧化剂氧化为 CO₂（MnO₄⁻(H⁺)/Cl₂/ClO⁻ 可氧化）
  'H₂C₂O₄':{ oxOfRed: 4.5 },                    // 草酸（分子，判断/拖拽题用），氧化产物同为 CO₂
  'NO₃⁻': {},   // 无 H⁺ 时不表现氧化性（旁观者）
  'MnO₄⁻': {},  // 无 H⁺ 时按中性处理（本站简化）
  // ---- 金属活动性阶梯（act 小 = 活泼 = 还原性强） ----
  'K': { act: 1, metal: true },  'Ca': { act: 2, metal: true },
  'Na': { act: 3, metal: true }, 'Mg': { act: 4, metal: true },
  'Al': { act: 5, metal: true }, 'Zn': { act: 6, metal: true },
  'Fe': { act: 7, metal: true }, 'H': { act: 8, metal: true },
  'Cu': { act: 9, metal: true }, 'Hg': { act: 10, metal: true },
  'Ag': { act: 11, metal: true },
  // ---- 对应阳离子（氧化性：K⁺ < … < Ag⁺） ----
  'K⁺': { act: 1 },  'Ca²⁺': { act: 2 }, 'Na⁺': { act: 3 },
  'Mg²⁺': { act: 4 }, 'Al³⁺': { act: 5 }, 'Zn²⁺': { act: 6 },
  'H⁺': { act: 8 },  'Cu²⁺': { act: 9 }, 'Hg²⁺': { act: 10 },
  'Ag⁺': { act: 11 },
  // ---- 旁观者 ----
  'SO₄²⁻': {}, 'CO₃²⁻': {}, 'Ba²⁺': {}, 'NH₄⁺': {}, 'Na⁺_x': {},
};

/* 强弱顺序阶梯（阶梯夺擂专用）：按教学要求，不收录 ClO⁻ 与 C₂O₄²⁻。
   这两个微粒仍保留在 RX.SP / EQUATIONS / 各题库中，作为"具体反应物"出现，
   只是不再参与"谁强谁弱"的排序比较。 */
RX.OX_LADDER = ['MnO₄⁻(H⁺)', 'Cl₂', 'Br₂', 'Fe³⁺', 'I₂', 'S'];
RX.RED_LADDER = ['Mn²⁺', 'Cl⁻', 'Br⁻', 'Fe²⁺', 'I⁻', 'S²⁻'];
RX.METAL_LADDER = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'H', 'Cu', 'Hg', 'Ag'];
RX.METAL_CATION_LADDER = ['K⁺', 'Ca²⁺', 'Na⁺', 'Mg²⁺', 'Al³⁺', 'Zn²⁺', 'Fe²⁺', 'H⁺', 'Cu²⁺', 'Fe³⁺', 'Hg²⁺', 'Ag⁺'];

/* ---- 反应判定 ----
   返回 { ok, why } —— why 用于讲解 */
RX.canReact = function (a, b) {
  const A = RX.SP[a], B = RX.SP[b];
  if (!A || !B) return { ok: false, why: '未知微粒' };

  // 1) 离子阶梯：氧化剂 vs 还原剂（强制弱）
  if (A.ox != null && B.oxOfRed != null && A.ox > B.oxOfRed)
    return { ok: true, why: `氧化性 ${a} > ${RX.prodLabel(b)}，所以 ${a} 能把 ${b} 氧化` };
  if (B.ox != null && A.oxOfRed != null && B.ox > A.oxOfRed)
    return { ok: true, why: `氧化性 ${b} > ${RX.prodLabel(a)}，所以 ${b} 能把 ${a} 氧化` };

  // 2) 金属置换：活泼金属置换弱金属阳离子 / 与 H⁺ 反应
  if (A.metal && B.act != null && !B.metal && A.act < B.act)
    return { ok: true, why: `活动性 ${a} > ${b.replace(/[⁺²³]/g, '')}，${a} 能把 ${b} 置换出来` };
  if (B.metal && A.act != null && !A.metal && B.act < A.act)
    return { ok: true, why: `活动性 ${b} > ${a.replace(/[⁺²³]/g, '')}，${b} 能把 ${a} 置换出来` };

  // 3) Fe³⁺ 特例：可氧化 Fe、Cu、Ag 等较活泼金属
  if (a === 'Fe³⁺' && B.metal && B.act >= 7)
    return { ok: true, why: 'Fe³⁺ 氧化性较强，能溶解 Fe、Cu、Ag（如 2Fe³⁺+Cu=2Fe²⁺+Cu²⁺）' };
  if (b === 'Fe³⁺' && A.metal && A.act >= 7)
    return { ok: true, why: 'Fe³⁺ 氧化性较强，能溶解 Fe、Cu、Ag' };

  return { ok: false, why: '不满足"强制弱"：较强氧化剂 + 较强还原剂才反应' };
};

/* B 被氧化后对应产物的显示名 */
RX.prodLabel = function (b) {
  const map = { 'Cl⁻': 'Cl₂', 'Br⁻': 'Br₂', 'I⁻': 'I₂', 'S²⁻': 'S', 'Fe²⁺': 'Fe³⁺', 'Mn²⁺': 'MnO₄⁻(H⁺)', 'SO₃²⁻': 'SO₄²⁻', 'C₂O₄²⁻': 'CO₂', 'H₂C₂O₄': 'CO₂' };
  return map[b] || b;
};

/* ---- 常见反应方程式（实验台/讲解用） ---- */
RX.EQUATIONS = {
  'Fe³⁺|I⁻':   '2Fe³⁺ + 2I⁻ = 2Fe²⁺ + I₂',
  'Fe³⁺|S²⁻':  '2Fe³⁺ + S²⁻ = 2Fe²⁺ + S↓',
  'Fe³⁺|SO₃²⁻':'2Fe³⁺ + SO₃²⁻ + H₂O = 2Fe²⁺ + SO₄²⁻ + 2H⁺',
  'Cl₂|Br⁻':   'Cl₂ + 2Br⁻ = 2Cl⁻ + Br₂',
  'Cl₂|I⁻':    'Cl₂ + 2I⁻ = 2Cl⁻ + I₂',
  'Cl₂|Fe²⁺':  'Cl₂ + 2Fe²⁺ = 2Cl⁻ + 2Fe³⁺',
  'Cl₂|S²⁻':   'Cl₂ + S²⁻ = 2Cl⁻ + S↓',
  'Cl₂|SO₃²⁻': 'Cl₂ + SO₃²⁻ + H₂O = 2Cl⁻ + SO₄²⁻ + 2H⁺',
  'Br₂|I⁻':    'Br₂ + 2I⁻ = 2Br⁻ + I₂',
  'Br₂|Fe²⁺':  'Br₂ + 2Fe²⁺ = 2Br⁻ + 2Fe³⁺',
  'Br₂|S²⁻':   'Br₂ + S²⁻ = 2Br⁻ + S↓',
  'Br₂|SO₃²⁻': 'Br₂ + SO₃²⁻ + H₂O = 2Br⁻ + SO₄²⁻ + 2H⁺',
  'I₂|S²⁻':    'I₂ + S²⁻ = 2I⁻ + S↓',
  'I₂|SO₃²⁻':  'I₂ + SO₃²⁻ + H₂O = 2I⁻ + SO₄²⁻ + 2H⁺',
  'MnO₄⁻(H⁺)|Cl⁻':   '2MnO₄⁻ + 10Cl⁻ + 16H⁺ = 2Mn²⁺ + 5Cl₂↑ + 8H₂O',
  'MnO₄⁻(H⁺)|Br⁻':   '2MnO₄⁻ + 10Br⁻ + 16H⁺ = 2Mn²⁺ + 5Br₂ + 8H₂O',
  'MnO₄⁻(H⁺)|I⁻':    '2MnO₄⁻ + 10I⁻ + 16H⁺ = 2Mn²⁺ + 5I₂ + 8H₂O',
  'MnO₄⁻(H⁺)|Fe²⁺':  'MnO₄⁻ + 5Fe²⁺ + 8H⁺ = Mn²⁺ + 5Fe³⁺ + 4H₂O',
  'MnO₄⁻(H⁺)|S²⁻':   '2MnO₄⁻ + 5S²⁻ + 16H⁺ = 2Mn²⁺ + 5S↓ + 8H₂O',
  'MnO₄⁻(H⁺)|SO₃²⁻': '2MnO₄⁻ + 5SO₃²⁻ + 6H⁺ = 2Mn²⁺ + 5SO₄²⁻ + 3H₂O',
  'NO₃⁻(H⁺)|Fe²⁺':  '3Fe²⁺ + NO₃⁻ + 4H⁺ = 3Fe³⁺ + NO↑ + 2H₂O',
  'NO₃⁻(H⁺)|I⁻':    '2NO₃⁻ + 6I⁻ + 8H⁺ = 2NO↑ + 3I₂ + 4H₂O',
  'NO₃⁻(H⁺)|S²⁻':   '2NO₃⁻ + 3S²⁻ + 8H⁺ = 2NO↑ + 3S↓ + 4H₂O',
  'NO₃⁻(H⁺)|SO₃²⁻': '2NO₃⁻ + 3SO₃²⁻ + 2H⁺ = 2NO↑ + 3SO₄²⁻ + H₂O',
  'ClO⁻|I⁻':    'ClO⁻ + 2I⁻ + H₂O = I₂ + Cl⁻ + 2OH⁻',
  'ClO⁻|Br⁻':   'ClO⁻ + 2Br⁻ + H₂O = Br₂ + Cl⁻ + 2OH⁻',
  'ClO⁻|Fe²⁺':  'ClO⁻ + 2Fe²⁺ + 2H⁺ = Cl⁻ + 2Fe³⁺ + H₂O',
  'ClO⁻|S²⁻':   'ClO⁻ + S²⁻ + H₂O = S↓ + Cl⁻ + 2OH⁻',
  'ClO⁻|SO₃²⁻': 'ClO⁻ + SO₃²⁻ = Cl⁻ + SO₄²⁻',
  'MnO₄⁻(H⁺)|C₂O₄²⁻': '2MnO₄⁻ + 5C₂O₄²⁻ + 16H⁺ = 2Mn²⁺ + 10CO₂↑ + 8H₂O',
  'MnO₄⁻(H⁺)|H₂C₂O₄': '2MnO₄⁻ + 5H₂C₂O₄ + 6H⁺ = 2Mn²⁺ + 10CO₂↑ + 8H₂O',
  'Cl₂|C₂O₄²⁻': 'Cl₂ + C₂O₄²⁻ = 2Cl⁻ + 2CO₂↑',
  'ClO⁻|C₂O₄²⁻': 'ClO⁻ + C₂O₄²⁻ + H₂O = Cl⁻ + 2CO₂↑ + 2OH⁻',
  'Fe³⁺|Cu':    '2Fe³⁺ + Cu = 2Fe²⁺ + Cu²⁺',
  'Fe³⁺|Fe':    '2Fe³⁺ + Fe = 3Fe²⁺',
  'H⁺|Zn':      '2H⁺ + Zn = H₂↑ + Zn²⁺',
  'H⁺|Fe':      '2H⁺ + Fe = H₂↑ + Fe²⁺',
  'Cu²⁺|Zn':    'Cu²⁺ + Zn = Cu + Zn²⁺',
  'Cu²⁺|Fe':    'Cu²⁺ + Fe = Cu + Fe²⁺',
};

RX.eqFor = function (a, b) {
  const k1 = a + '|' + b, k2 = b + '|' + a;
  return RX.EQUATIONS[k1] || RX.EQUATIONS[k2] || null;
};

/* ---- 离子池：判断"新加入离子"是否会与池中任何离子反应 ----
   处理 NO₃⁻ + H⁺ → NO₃⁻(H⁺) 的条件激活 */
RX.poolCheck = function (pool, incoming) {
  const eff = pool.slice();
  if (pool.includes('NO₃⁻') && (pool.includes('H⁺') || incoming === 'H⁺')) eff.push('NO₃⁻(H⁺)');
  if (pool.includes('MnO₄⁻') && (pool.includes('H⁺') || incoming === 'H⁺')) eff.push('MnO₄⁻(H⁺)');
  for (const p of eff) {
    if (p === incoming) continue;
    const r = RX.canReact(p, incoming);
    if (r.ok) return { react: true, with: p, why: r.why, eq: RX.eqFor(p, incoming) };
  }
  // 反向：incoming 是氧化剂、池中是还原剂（canReact 已双向，上面已覆盖）
  return { react: false };
};
