/* ============================================================
 * 评分引擎（纯函数，浏览器和 Node 通用）
 * 1. 累加每个选项在五维上的分数
 * 2. 按该维度“理论最大正/负分”归一化，并适度放大（SCALE），截断到 [-1, 1]
 * 3. 与 20 座城市的目标坐标计算欧氏距离，距离最近者为匹配城市
 * 4. 南方浓度 = 前四维（表达/生活/社交/情绪）均值映射到 0~100%
 * ============================================================ */
(function (root) {
  var data = root.AXES ? root : require('./data.js');
  var AXES = data.AXES, QUESTIONS = data.QUESTIONS, CITIES = data.CITIES;
  var SCALE = 2.2;           // 放大系数：真实作答很少全部同向，放大后结果更有区分度
  var SOUTH_AXES = ['z', 'j', 'b', 'q'];

  // 预计算每个维度的理论最大正分 / 负分
  var POS_MAX = {}, NEG_MAX = {};
  AXES.forEach(function (a) { POS_MAX[a.key] = 0; NEG_MAX[a.key] = 0; });
  QUESTIONS.forEach(function (qu) {
    AXES.forEach(function (a) {
      var hi = 0, lo = 0;
      qu.options.forEach(function (o) {
        var v = o.s[a.key] || 0;
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      });
      POS_MAX[a.key] += hi;
      NEG_MAX[a.key] += -lo;
    });
  });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function rawSums(answers) {
    var sums = {};
    AXES.forEach(function (a) { sums[a.key] = 0; });
    answers.forEach(function (optIdx, i) {
      var opt = QUESTIONS[i] && QUESTIONS[i].options[optIdx];
      if (!opt) return;
      for (var k in opt.s) sums[k] += opt.s[k];
    });
    return sums;
  }

  function vectorOf(answers) {
    var sums = rawSums(answers), vec = {};
    AXES.forEach(function (a) {
      var s = sums[a.key];
      var n = s >= 0 ? (POS_MAX[a.key] ? s / POS_MAX[a.key] : 0)
                     : (NEG_MAX[a.key] ? s / NEG_MAX[a.key] : 0);
      vec[a.key] = clamp(n * SCALE, -1, 1);
    });
    return vec;
  }

  function distance(u, c) {
    var d = 0;
    AXES.forEach(function (a) { var x = u[a.key] - c[a.key]; d += x * x; });
    return Math.sqrt(d);
  }

  function southPercent(vec) {
    var m = 0;
    SOUTH_AXES.forEach(function (k) { m += vec[k]; });
    m /= SOUTH_AXES.length;
    return Math.round(clamp(50 + 50 * m, 3, 97));
  }

  function evaluate(answers) {
    var vec = vectorOf(answers);
    var ranked = CITIES.map(function (c) { return { city: c, d: distance(vec, c.vec) + (c.bias || 0) }; })
      .sort(function (a, b) { return a.d - b.d; });
    var best = ranked[0];
    // 匹配度：距离 0 → 99%，距离 1.6 → 约 60%
    var match = Math.round(clamp(99 - distance(vec, best.city.vec) * 24, 60, 99));
    return {
      vec: vec,
      city: best.city,
      second: ranked[1].city,
      match: match,
      south: southPercent(vec),
      ranked: ranked
    };
  }

  var api = { evaluate: evaluate, vectorOf: vectorOf, southPercent: southPercent,
              POS_MAX: POS_MAX, NEG_MAX: NEG_MAX, SCALE: SCALE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scoring = api;
})(typeof window !== 'undefined' ? window : this);
