/* ============================================================
   data_eq.js —— 第一大类题库：氧化还原方程式四身份
   ox=氧化剂 red=还原剂 op=氧化产物 rp=还原产物
   hard(歧化反应)：both=既是氧化剂又是还原剂（仅用于判断题）
   ============================================================ */
window.RX = window.RX || {};

RX.EQ_BANK = [
  { eq: 'CuO + H₂ =Δ= Cu + H₂O', ox: 'CuO', red: 'H₂', op: 'H₂O', rp: 'Cu' },
  { eq: 'MnO₂ + 4HCl(浓) =Δ= MnCl₂ + Cl₂↑ + 2H₂O', ox: 'MnO₂', red: 'HCl', op: 'Cl₂', rp: 'MnCl₂' },
  { eq: 'Fe₂O₃ + 3CO =高温= 2Fe + 3CO₂', ox: 'Fe₂O₃', red: 'CO', op: 'CO₂', rp: 'Fe' },
  { eq: 'C + 2CuO =高温= 2Cu + CO₂↑', ox: 'CuO', red: 'C', op: 'CO₂', rp: 'Cu' },
  { eq: 'Zn + 2HCl = ZnCl₂ + H₂↑', ox: 'HCl', red: 'Zn', op: 'H₂', rp: 'ZnCl₂' },
  { eq: 'Fe + CuSO₄ = FeSO₄ + Cu', ox: 'CuSO₄', red: 'Fe', op: 'FeSO₄', rp: 'Cu' },
  { eq: '2Na + 2H₂O = 2NaOH + H₂↑', ox: 'H₂O', red: 'Na', op: 'H₂', rp: 'NaOH' },
  { eq: 'Cu + 2FeCl₃ = CuCl₂ + 2FeCl₂', ox: 'FeCl₃', red: 'Cu', op: 'CuCl₂', rp: 'FeCl₂' },
  { eq: '3Cu + 8HNO₃(稀) = 3Cu(NO₃)₂ + 2NO↑ + 4H₂O', ox: 'HNO₃', red: 'Cu', op: 'Cu(NO₃)₂', rp: 'NO' },
  { eq: 'Cu + 4HNO₃(浓) = Cu(NO₃)₂ + 2NO₂↑ + 2H₂O', ox: 'HNO₃', red: 'Cu', op: 'Cu(NO₃)₂', rp: 'NO₂' },
  { eq: '2NaBr + Cl₂ = 2NaCl + Br₂', ox: 'Cl₂', red: 'NaBr', op: 'Br₂', rp: 'NaCl' },
  { eq: 'Cl₂ + 2KI = 2KCl + I₂', ox: 'Cl₂', red: 'KI', op: 'I₂', rp: 'KCl' },
  { eq: 'H₂S + Cl₂ = S↓ + 2HCl', ox: 'Cl₂', red: 'H₂S', op: 'S', rp: 'HCl' },
  { eq: 'SiO₂ + 2C =高温= Si + 2CO↑', ox: 'SiO₂', red: 'C', op: 'CO', rp: 'Si' },
  { eq: 'WO₃ + 3H₂ =Δ= W + 3H₂O', ox: 'WO₃', red: 'H₂', op: 'H₂O', rp: 'W' },
  { eq: '3Fe + 4H₂O(g) =Δ= Fe₃O₄ + 4H₂', ox: 'H₂O', red: 'Fe', op: 'Fe₃O₄', rp: 'H₂' },
  { eq: '2Al + Fe₂O₃ =高温= Al₂O₃ + 2Fe', ox: 'Fe₂O₃', red: 'Al', op: 'Al₂O₃', rp: 'Fe' },
  { eq: 'CH₄ + 2O₂ =点燃= CO₂ + 2H₂O', ox: 'O₂', red: 'CH₄', op: 'CO₂', rp: 'H₂O' },
  { eq: '4NH₃ + 5O₂ =催化Δ= 4NO + 6H₂O', ox: 'O₂', red: 'NH₃', op: 'NO', rp: 'H₂O' },
  { eq: 'Br₂ + 2KI = 2KBr + I₂', ox: 'Br₂', red: 'KI', op: 'I₂', rp: 'KBr' },
  { eq: '2H₂S + SO₂ = 3S↓ + 2H₂O', ox: 'SO₂', red: 'H₂S', op: 'S', rp: 'H₂O' },
  { eq: 'Fe + 2AgNO₃ = Fe(NO₃)₂ + 2Ag', ox: 'AgNO₃', red: 'Fe', op: 'Fe(NO₃)₂', rp: 'Ag' },
  // ---- 次氯酸盐 / 草酸（根）----
  { eq: '2KMnO₄ + 5H₂C₂O₄ + 3H₂SO₄ = K₂SO₄ + 2MnSO₄ + 10CO₂↑ + 8H₂O', ox: 'KMnO₄', red: 'H₂C₂O₄', op: 'CO₂', rp: 'MnSO₄' },
  { eq: 'Cl₂ + Na₂C₂O₄ = 2NaCl + 2CO₂↑', ox: 'Cl₂', red: 'Na₂C₂O₄', op: 'CO₂', rp: 'NaCl' },
  { eq: 'NaClO + Na₂C₂O₄ + H₂O = NaCl + 2CO₂↑ + 2NaOH', ox: 'NaClO', red: 'Na₂C₂O₄', op: 'CO₂', rp: 'NaCl' },
  // ---- 歧化反应（hard，仅用于 30 秒判断题） ----
  { eq: 'Cl₂ + 2NaOH = NaCl + NaClO + H₂O', both: 'Cl₂', op: 'NaClO', rp: 'NaCl', hard: true },
  { eq: '2H₂O₂ =MnO₂= 2H₂O + O₂↑', both: 'H₂O₂', op: 'O₂', rp: 'H₂O', hard: true },
  { eq: '2KClO₃ =MnO₂,Δ= 2KCl + 3O₂↑', both: 'KClO₃', op: 'O₂', rp: 'KCl', hard: true },
  { eq: '3NO₂ + H₂O = 2HNO₃ + NO', both: 'NO₂', op: 'HNO₃', rp: 'NO', hard: true },
];

RX.ROLES = [
  { key: 'ox',  name: '氧化剂' },
  { key: 'red', name: '还原剂' },
  { key: 'op',  name: '氧化产物' },
  { key: 'rp',  name: '还原产物' },
];

/* 干扰物质（判断题里冒充错误选项） */
RX.FOREIGN = ['CO₂', 'Fe₃O₄', 'NaCl', 'H₂', 'O₂', 'CuO', 'SO₂', 'HNO₃', 'KClO₃', 'Al₂O₃'];

RX.pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* 生成一条判断语句（30 秒极限判断用） */
RX.makeStmt = function () {
  const eq = RX.pick(RX.EQ_BANK);
  if (eq.hard) {
    const opts = [
      { text: `「${eq.eq}」中，${eq.both} 既是氧化剂又是还原剂`, truth: true,
        explain: '这是歧化反应：同一种物质既升价又降价。' },
      { text: `「${eq.eq}」中，${eq.op} 是氧化产物`, truth: true,
        explain: `${eq.op} 由 ${eq.both} 被氧化而来，是氧化产物。` },
      { text: `「${eq.eq}」中，${eq.rp} 是氧化产物`, truth: false,
        explain: `${eq.rp} 由 ${eq.both} 被还原而来，是还原产物而非氧化产物。` },
      { text: `「${eq.eq}」中，只有氧化剂没有还原剂`, truth: false,
        explain: '歧化反应中自身既是氧化剂又是还原剂。' },
    ];
    return RX.pick(opts);
  }
  const role = RX.pick(RX.ROLES);
  const correct = eq[role.key];
  const truth = Math.random() < 0.5;
  let subject = correct;
  if (!truth) {
    const others = RX.ROLES.filter(r => r.key !== role.key).map(r => eq[r.key]).filter(v => v !== correct);
    subject = others.length ? RX.pick(others) : RX.pick(RX.FOREIGN);
    if (subject === correct) return RX.makeStmt(); // 兜底重出
  }
  return {
    text: `「${eq.eq}」中，${subject} 是${role.name}？`,
    truth,
    explain: `正确答案：${role.name} 是 ${correct}。`,
  };
};
