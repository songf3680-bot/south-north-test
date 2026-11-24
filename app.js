/* ============================================================
 * 交互逻辑：首页 → 逐题作答 → 自动评分 → 结果展示 → 分享图 / 重新测试
 * ============================================================ */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var TOTAL = QUESTIONS.length;
  var KEYS = ['A', 'B', 'C', 'D'];
  var CN = ['', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾'];

  var state = { idx: 0, answers: [], locked: false, result: null };

  /* ---------- 工具 ---------- */
  function cnNum(n) {
    if (n <= 10) return CN[n];
    if (n < 20) return '拾' + CN[n - 10];
    var t = Math.floor(n / 10), o = n % 10;
    return CN[t] + '拾' + (o ? CN[o] : '');
  }
  function show(id) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    $(id).classList.add('active');
    window.scrollTo(0, 0);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 答题 ---------- */
  function startQuiz() {
    state.idx = 0; state.answers = []; state.locked = false; state.result = null;
    show('quiz');
    renderQuestion('enter');
  }

  function renderQuestion(anim) {
    var q = QUESTIONS[state.idx];
    var card = $('qCard');
    $('qIndex').textContent = cnNum(state.idx + 1);
    $('qText').textContent = q.q;
    $('catTag').textContent = q.cat;
    $('qNum').textContent = state.idx + 1;
    $('qTotal').textContent = TOTAL;
    $('progressBar').style.width = (state.idx / TOTAL * 100) + '%';
    $('backBtn').disabled = state.idx === 0;

    var html = '';
    q.options.forEach(function (o, i) {
      var sel = state.answers[state.idx] === i ? ' selected' : '';
      html += '<button class="option' + sel + '" role="listitem" data-i="' + i + '">' +
              '<span class="key">' + KEYS[i] + '</span><span>' + esc(o.t) + '</span></button>';
    });
    $('options').innerHTML = html;

    card.classList.remove('leave', 'leave-back', 'enter', 'enter-back');
    void card.offsetWidth; // 重启动画
    if (anim) card.classList.add(anim);
  }

  function choose(i) {
    if (state.locked) return;
    state.locked = true;
    state.answers[state.idx] = i;
    var btns = $('options').children;
    for (var k = 0; k < btns.length; k++) btns[k].classList.toggle('selected', k === i);
    $('progressBar').style.width = ((state.idx + 1) / TOTAL * 100) + '%';

    setTimeout(function () {
      if (state.idx >= TOTAL - 1) { finish(); return; }
      var card = $('qCard');
      card.classList.remove('enter', 'enter-back');
      card.classList.add('leave');
      setTimeout(function () {
        state.idx++;
        renderQuestion('enter');
        state.locked = false;
      }, 260);
    }, 280);
  }

  function goBack() {
    if (state.locked || state.idx === 0) return;
    state.locked = true;
    var card = $('qCard');
    card.classList.remove('enter', 'enter-back');
    card.classList.add('leave-back');
    setTimeout(function () {
      state.idx--;
      renderQuestion('enter-back');
      state.locked = false;
    }, 260);
  }

  /* ---------- 评分 & 结果 ---------- */
  function finish() {
    // 防御：确保 40 题全部作答
    for (var i = 0; i < TOTAL; i++) {
      if (typeof state.answers[i] !== 'number') { state.idx = i; state.locked = false; renderQuestion('enter'); return; }
    }
    show('loading');
    var texts = ['正在测算你的南北基因……', '正在翻越秦岭、跨过淮河……', '正在为你匹配灵魂城市……'];
    var t = 0;
    $('loadingText').textContent = texts[0];
    var timer = setInterval(function () { t++; if (texts[t]) $('loadingText').textContent = texts[t]; }, 650);
    setTimeout(function () {
      clearInterval(timer);
      state.result = Scoring.evaluate(state.answers);
      renderResult(state.result);
      show('result');
      state.locked = false;
    }, 2000);
  }

  function verdictOf(r) {
    var c = r.city, s = r.south, n = 100 - s;
    if (s >= 45 && s <= 55) return { short: '南北通吃', text: '你的南北浓度几乎五五开，是能吃甜豆花也能嗦咸豆腐脑的<b>南北通吃型人格</b>。' };
    if (c.region === '南' && s > 55) return { short: s >= 65 ? '纯正南方魂' : '地道南方魂', text: '城在南方，心也在南方——南方浓度 <b>' + s + '%</b>，如假包换的<b>南方人格</b>。' };
    if (c.region === '南') return { short: '南城北魂', text: '地理上属于南方，骨子里却有 <b>' + n + '%</b> 的北方豪气——<b>南方的城，北方的魂</b>。' };
    if (s < 45) return { short: n >= 65 ? '纯正北方魂' : '地道北方魂', text: '城在北方，魂也在北方——北方浓度 <b>' + n + '%</b>，一身敞亮劲儿，妥妥的<b>北方人格</b>。' };
    return { short: '北城南心', text: '扎根北方，却藏着 <b>' + s + '%</b> 的南方细腻——<b>北方的城，南方的心</b>。' };
  }

  function personalReason(r) {
    var dims = AXES.map(function (a) {
      var v = r.vec[a.key];
      return { name: v >= 0 ? a.pos : a.neg, pct: Math.round(50 + 50 * Math.abs(v)), abs: Math.abs(v) };
    }).sort(function (a, b) { return b.abs - a.abs; });
    return '在你的 40 个选择里，<b>「' + dims[0].name + '」</b>倾向 ' + dims[0].pct + '%、<b>「' +
      dims[1].name + '」</b>倾向 ' + dims[1].pct + '%，是你最鲜明的两种底色。' + r.city.reason;
  }

  function renderResult(r) {
    var c = r.city, v = verdictOf(r);
    var regionName = c.region === '南' ? '南方' : '北方';
    var dimsHtml = AXES.map(function (a) {
      var val = r.vec[a.key];
      return '<div class="dim"><span class="' + (val < 0 ? 'on' : '') + '">' + a.neg + '</span>' +
        '<div class="dim-track"><i class="dim-dot" data-left="' + (50 + val * 50).toFixed(1) + '"></i></div>' +
        '<span class="' + (val > 0 ? 'on' : '') + '">' + a.pos + '</span></div>';
    }).join('');

    var delay = 0;
    var d = function () { delay += 0.08; return ' style="animation-delay:' + delay.toFixed(2) + 's"'; };

    $('resultCard').style.setProperty('--city', c.color);
    $('resultCard').innerHTML =
      '<div class="wm">' + c.province + '</div>' +
      '<div class="r-top r-anim"' + d() + '>' +
        '<div class="r-label">你骨子里的灵魂城市是</div>' +
        '<div class="r-city-row"><div class="r-city">' + c.name + '</div>' +
        '<div class="r-seal ' + (c.region === '南' ? 's' : 'n') + '">' + regionName.charAt(0) + '方<br/>人格</div></div>' +
        '<div class="r-title">' + c.title + '</div>' +
        '<div class="r-match">灵魂契合度 <b>' + r.match + '%</b> · 地处秦岭—淮河以' + c.region + '</div>' +
      '</div>' +
      '<div class="r-slogan r-anim"' + d() + '>' + c.slogan + '</div>' +
      '<div class="r-gauge r-anim"' + d() + '>' +
        '<div class="r-gauge-label"><span class="n">北方浓度 ' + (100 - r.south) + '%</span><span class="s">南方浓度 ' + r.south + '%</span></div>' +
        '<div class="r-gauge-bar"><div class="r-gauge-fill" data-w="' + r.south + '"></div></div>' +
        '<div class="r-verdict">' + v.text + '</div>' +
      '</div>' +
      '<div class="r-traits r-anim"' + d() + '>' + c.traits.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>' +
      '<div class="r-dims r-anim"' + d() + '>' + dimsHtml + '</div>' +
      '<div class="r-sec r-anim"' + d() + '><h3>性格特点</h3><p>' + c.desc + '</p></div>' +
      '<div class="r-sec r-anim"' + d() + '><h3>匹配理由</h3><p>' + personalReason(r) + '</p></div>' +
      '<div class="r-sec r-anim"' + d() + '><h3>隐藏优势</h3><p>' + c.advantage + '</p></div>' +
      '<div class="r-sec r-egg r-anim"' + d() + '><h3>趣味彩蛋</h3><p>' + c.egg +
        '<br/><b>灵魂美食：</b>' + c.food + '<br/><b>第二故乡：</b>' + r.second.name + '（' + r.second.title + '）</p></div>' +
      '<div class="r-foot"><span class="brand">测测你骨子里是南方还是北方人格</span><span>仅供娱乐</span></div>';

    // 触发进度/刻度动画
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var fill = document.querySelector('.r-gauge-fill');
        if (fill) fill.style.width = fill.getAttribute('data-w') + '%';
        var dots = document.querySelectorAll('.dim-dot');
        for (var i = 0; i < dots.length; i++) dots[i].style.left = dots[i].getAttribute('data-left') + '%';
      });
    });
  }

  /* ---------- 分享图（原生 Canvas，无需第三方库） ---------- */
  function wrapLines(ctx, text, maxW) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = text[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function makePoster() {
    var r = state.result; if (!r) return;
    var c = r.city, v = verdictOf(r);
    var W = 750, H = 1500, S = 2;
    var cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);
    var serif = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif';
    var sans = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';

    // 背景
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F7F2E9'); g.addColorStop(1, '#EDE4D3');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 远山
    ctx.fillStyle = 'rgba(46,74,98,.08)';
    ctx.beginPath(); ctx.moveTo(0, H - 220);
    ctx.quadraticCurveTo(150, H - 320, 300, H - 240); ctx.quadraticCurveTo(450, H - 170, 560, H - 260);
    ctx.quadraticCurveTo(660, H - 330, W, H - 230); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = 'rgba(76,122,107,.10)';
    ctx.beginPath(); ctx.moveTo(0, H - 150);
    ctx.quadraticCurveTo(200, H - 220, 400, H - 160); ctx.quadraticCurveTo(580, H - 110, W, H - 170);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    // 双边框
    ctx.strokeStyle = 'rgba(184,155,94,.6)'; ctx.lineWidth = 2;
    roundRect(ctx, 28, 28, W - 56, H - 56, 22); ctx.stroke();
    ctx.lineWidth = 1; roundRect(ctx, 40, 40, W - 80, H - 80, 16); ctx.stroke();
    // 水印大字
    ctx.save(); ctx.globalAlpha = .06; ctx.fillStyle = c.color;
    ctx.font = '900 360px ' + serif; ctx.textAlign = 'right';
    ctx.fillText(c.province, W - 20, 470); ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#B89B5E'; ctx.font = '500 22px ' + serif;
    ctx.fillText('测 测 你 骨 子 里 是 南 方 还 是 北 方 人 格', W / 2, 110);
    ctx.fillStyle = '#8C867B'; ctx.font = '22px ' + serif;
    ctx.fillText('我 的 灵 魂 城 市 是', W / 2, 185);

    // 城市名
    ctx.fillStyle = c.color; ctx.font = '900 128px ' + serif;
    var nameW = ctx.measureText(c.name).width;
    var cx = W / 2 - 50;
    ctx.fillText(c.name, cx, 330);
    // 印章
    ctx.save();
    ctx.translate(cx + nameW / 2 + 68, 280); ctx.rotate(-0.14);
    ctx.fillStyle = c.region === '南' ? '#B5463A' : '#2E4A62';
    roundRect(ctx, -46, -46, 92, 92, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; roundRect(ctx, -40, -40, 80, 80, 5); ctx.stroke();
    ctx.fillStyle = '#FFF8EE'; ctx.font = '700 28px ' + serif;
    ctx.fillText((c.region === '南' ? '南' : '北') + '方', 0, -4); ctx.fillText('人格', 0, 30);
    ctx.restore();

    ctx.fillStyle = '#2B2B2B'; ctx.font = '600 34px ' + serif;
    ctx.fillText(c.title, W / 2, 400);
    ctx.fillStyle = '#8C867B'; ctx.font = '22px ' + sans;
    ctx.fillText('灵魂契合度 ' + r.match + '%  ·  ' + v.short, W / 2, 445);

    // 专属文案
    var y = 490;
    ctx.font = '600 32px ' + serif;
    var sl = wrapLines(ctx, c.slogan, W - 220);
    var boxH = 60 + sl.length * 48;
    ctx.fillStyle = 'rgba(184,155,94,.13)'; roundRect(ctx, 80, y, W - 160, boxH, 16); ctx.fill();
    ctx.fillStyle = '#B89B5E'; ctx.font = '64px Georgia,serif';
    ctx.textAlign = 'left'; ctx.fillText('“', 96, y + 56);
    ctx.textAlign = 'right'; ctx.fillText('”', W - 96, y + boxH + 18);
    ctx.textAlign = 'center'; ctx.fillStyle = '#2B2B2B'; ctx.font = '600 32px ' + serif;
    sl.forEach(function (l, i) { ctx.fillText(l, W / 2, y + 62 + i * 48); });
    y += boxH + 60;

    // 南北浓度条
    ctx.font = '600 24px ' + serif; ctx.textAlign = 'left'; ctx.fillStyle = '#2E4A62';
    ctx.fillText('北方浓度 ' + (100 - r.south) + '%', 90, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#4C7A6B';
    ctx.fillText('南方浓度 ' + r.south + '%', W - 90, y);
    y += 20;
    ctx.save(); roundRect(ctx, 90, y, W - 180, 18, 9); ctx.clip();
    ctx.fillStyle = '#2E4A62'; ctx.fillRect(90, y, W - 180, 18);
    ctx.fillStyle = '#4C7A6B'; var sw = (W - 180) * r.south / 100; ctx.fillRect(W - 90 - sw, y, sw, 18);
    ctx.restore();
    y += 62;
    ctx.textAlign = 'center'; ctx.fillStyle = '#B5463A'; ctx.font = '700 28px ' + serif;
    ctx.fillText('— ' + v.short + ' —', W / 2, y);
    y += 78;

    // 标签
    ctx.font = '500 26px ' + serif;
    var tw = c.traits.map(function (t) { return ctx.measureText(t).width + 44; });
    var total = tw.reduce(function (a, b) { return a + b; }, 0) + (tw.length - 1) * 16;
    var tx = (W - total) / 2;
    c.traits.forEach(function (t, i) {
      ctx.strokeStyle = c.color; ctx.lineWidth = 1.5;
      roundRect(ctx, tx, y - 32, tw[i], 48, 24); ctx.stroke();
      ctx.fillStyle = c.color; ctx.textAlign = 'center'; ctx.fillText(t, tx + tw[i] / 2, y);
      tx += tw[i] + 16;
    });
    y += 70;

    // 隐藏优势 & 彩蛋
    function block(title, text) {
      ctx.textAlign = 'left';
      ctx.fillStyle = c.color; ctx.fillRect(90, y - 22, 6, 26);
      ctx.fillStyle = '#2B2B2B'; ctx.font = '700 28px ' + serif; ctx.fillText(title, 110, y);
      y += 44;
      ctx.fillStyle = '#5A564F'; ctx.font = '24px ' + sans;
      wrapLines(ctx, text, W - 180).slice(0, 3).forEach(function (l) { ctx.fillText(l, 90, y); y += 38; });
      y += 22;
    }
    block('性格特点', c.desc);
    block('隐藏优势', c.advantage);
    block('趣味彩蛋', c.egg);
    block('灵魂美食', c.food + '　｜　第二故乡：' + r.second.name);

    // 底部
    ctx.textAlign = 'center'; ctx.fillStyle = '#8C867B'; ctx.font = '22px ' + serif;
    ctx.fillText('你是南方魂还是北方魂？快来测测', W / 2, H - 92);
    ctx.font = '18px ' + sans; ctx.fillStyle = '#A9A294';
    ctx.fillText('趣味测试 · 仅供娱乐', W / 2, H - 62);

    // 淡淡的全图水印 songfeng
    ctx.save();
    ctx.fillStyle = 'rgba(43,43,43,0.048)';
    ctx.font = '500 26px Georgia,serif';
    ctx.textAlign = 'center';
    for (var wy = 80; wy < H + 120; wy += 210) {
      for (var wx = 80; wx < W + 120; wx += 260) {
        ctx.save();
        ctx.translate(wx + ((wy / 210) % 2 ? 90 : 0), wy);
        ctx.rotate(-0.38);
        ctx.fillText('songfeng', 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();

    var url = cv.toDataURL('image/png');
    $('posterImg').src = url;
    $('posterDownload').href = url;
    $('posterDownload').setAttribute('download', '我的南北人格-' + c.name + '.png');
    $('posterModal').classList.add('show');
    $('posterModal').setAttribute('aria-hidden', 'false');
  }

  function closePoster() {
    $('posterModal').classList.remove('show');
    $('posterModal').setAttribute('aria-hidden', 'true');
  }

  /* ---------- 事件绑定 ---------- */
  $('startBtn').addEventListener('click', startQuiz);
  $('retryBtn').addEventListener('click', function () { show('home'); });
  $('backBtn').addEventListener('click', goBack);
  $('posterBtn').addEventListener('click', makePoster);
  $('options').addEventListener('click', function (e) {
    var btn = e.target.closest('.option');
    if (btn) choose(+btn.getAttribute('data-i'));
  });
  document.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', closePoster); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePoster();
    if (!$('quiz').classList.contains('active')) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) choose(n - 1);
    if (e.key === 'Backspace' || e.key === 'ArrowLeft') goBack();
  });
})();
