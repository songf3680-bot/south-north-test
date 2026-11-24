// 评分逻辑验证脚本（node validate.js）
const { AXES, QUESTIONS, CITIES } = require('./data.js');
const S = require('./scoring.js');
let ok = true;
const err = m => { ok = false; console.log('ERROR:', m); };

// 1. 结构检查
if (QUESTIONS.length !== 40) err('题目数 ' + QUESTIONS.length);
QUESTIONS.forEach((q, i) => {
  if (q.options.length !== 4) err(`第${i + 1}题选项数 ${q.options.length}`);
  q.options.forEach((o, j) => Object.keys(o.s).forEach(k => {
    if (!AXES.find(a => a.key === k)) err(`第${i + 1}题选项${j} 未知维度 ${k}`);
  }));
});
const ids = new Set(CITIES.map(c => c.id));
if (ids.size !== CITIES.length) err('城市 id 重复');
console.log('POS_MAX', S.POS_MAX, '\nNEG_MAX', S.NEG_MAX);

// 2. 每座城市可达性：贪心选择最接近该城市坐标的选项
CITIES.forEach(c => {
  const ans = [];
  QUESTIONS.forEach((q, i) => {
    let best = 0, bd = Infinity;
    q.options.forEach((o, j) => {
      const trial = ans.concat(j);
      const v = S.vectorOf(trial);
      const d = AXES.reduce((s, a) => s + (v[a.key] - c.vec[a.key]) ** 2, 0);
      if (d < bd) { bd = d; best = j; }
    });
    ans.push(best);
  });
  const r = S.evaluate(ans);
  const flag = r.city.id === c.id ? 'OK ' : 'MISS';
  if (r.city.id !== c.id) err(`${c.name} 不可达 -> ${r.city.name}`);
  console.log(flag, c.name.padEnd(5), '->', r.city.name, '匹配', r.match + '%', '南方浓度', r.south + '%');
});

// 3. 人格化随机模拟：随机“人格向量”+ 噪声作答，统计分布
function rand() { return Math.random() * 2 - 1; }
const counts = {}; CITIES.forEach(c => counts[c.name] = 0);
let nSouth = 0; const N = 20000;
for (let t = 0; t < N; t++) {
  const persona = {}; AXES.forEach(a => persona[a.key] = rand());
  const ans = QUESTIONS.map(q => {
    const sc = q.options.map(o => AXES.reduce((s, a) => s + (o.s[a.key] || 0) * persona[a.key], 0) + rand() * 1.5);
    return sc.indexOf(Math.max(...sc));
  });
  const r = S.evaluate(ans);
  counts[r.city.name]++;
  if (r.city.region === '南') nSouth++;
}
console.log('\n人格化模拟分布 (N=' + N + ')');
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(k.padEnd(6), (v / N * 100).toFixed(1) + '%'));
console.log('南方城市占比', (nSouth / N * 100).toFixed(1) + '%');
Object.entries(counts).forEach(([k, v]) => { if (v / N < 0.01) err(`${k} 占比过低`); if (v / N > 0.15) err(`${k} 占比过高`); });

// 4. 极端作答
const allA = S.evaluate(QUESTIONS.map(() => 0)); console.log('\n全选A ->', allA.city.name, allA.south + '%');
const allD = S.evaluate(QUESTIONS.map(() => 3)); console.log('全选D ->', allD.city.name, allD.south + '%');
console.log(ok ? '\n✅ ALL CHECKS PASSED' : '\n❌ CHECKS FAILED');
