// =================================================================
// recoco.js　recoco.cafe の動き
//   1) スマホの追従メニュー（レコードプレーヤー）：少しスクロールすると右上に出て、スクロールでレコードが回る
//   2) トップの写真：約6秒ごとにふわっと切り替える。ABOUT の2枠は交互に切り替える
//   3) トップの左の帯のレコード：スクロールで回る
//   4) お知らせの絞り込み（カテゴリのボタン）
//   5) 写真の拡大表示（ギャラリー・撮影ページ）と、ギャラリーの店舗での絞り込み・撮影ページの写真送り
//   6) 今いるページのメニューに印を付ける
//   7) 計測用：外部リンクやボタンのクリックを GTM に送る
// 動きを減らす設定（prefers-reduced-motion）のときは、自動の切り替えと回転をしない
// =================================================================
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  // スクロールに合わせて動かすもの（requestAnimationFrame で1フレームに1回だけ計算する。Safari でも動く）
  var onScrollFns = [];
  var ticking = false;
  var runScroll = function () {
    ticking = false;
    var y = window.scrollY || window.pageYOffset || 0;
    for (var i = 0; i < onScrollFns.length; i++) onScrollFns[i](y);
  };
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(runScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () { window.requestAnimationFrame(runScroll); });

  // --- 1) レコードプレーヤーのメニュー ---
  var fab = document.querySelector('[data-fab]');
  if (fab) {
    var btn = fab.querySelector('.fab-btn');
    var sheet = fab.querySelector('.fab-sheet');
    var disc = fab.querySelector('.tt-disc');
    var FROM = 120, TO = 280; // この範囲のスクロールで、ふわっと現れる
    var isOpen = function () { return !sheet.hidden; };
    var setOpen = function (open) {
      sheet.hidden = !open;
      fab.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', btn.getAttribute(open ? 'data-close-label' : 'data-open-label'));
    };
    onScrollFns.push(function (y) {
      var p = Math.max(0, Math.min(1, (y - FROM) / (TO - FROM)));
      fab.style.opacity = String(p);
      fab.style.visibility = p > 0 ? 'visible' : 'hidden';
      fab.style.transform = 'translateY(' + (-14 * (1 - p)).toFixed(1) + 'px)';
      if (p === 0 && isOpen()) setOpen(false);
      if (!reduce && disc) {
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        // 回転の中心は SVG の transform 属性（rotate(角度 26 28)）だけで決める。
        // CSS の transform や transform-origin を .tt-disc に付けると、Safari と Chrome で中心がずれる
        disc.setAttribute('transform', 'rotate(' + ((y / max) * 1440 % 360).toFixed(1) + ' 26 28)');
      }
    });
    btn.addEventListener('click', function () { setOpen(!isOpen()); });
    sheet.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) { setOpen(false); btn.focus(); }
    });
    // 画面が広くなったら閉じる
    window.addEventListener('resize', function () { if (window.innerWidth > 760 && isOpen()) setOpen(false); });
  }

  // --- 2) トップの写真の切り替え ---
  var fadeTo = function (imgs, i) {
    for (var k = 0; k < imgs.length; k++) {
      var on = k === i;
      imgs[k].classList.toggle('is-on', on);
      imgs[k].alt = on ? imgs[k].getAttribute('data-alt') : '';
      if (on) imgs[k].removeAttribute('aria-hidden'); else imgs[k].setAttribute('aria-hidden', 'true');
    }
  };
  var slides = document.querySelector('[data-slides]');
  var frames = Array.prototype.slice.call(document.querySelectorAll('[data-fade]'));
  if (slides) {
    var heroImgs = slides.querySelectorAll(':scope > img');
    var dots = slides.querySelectorAll('.slide-dots button');
    var cur = 0;
    var showHero = function (i) {
      cur = (i + heroImgs.length) % heroImgs.length;
      fadeTo(heroImgs, cur);
      for (var k = 0; k < dots.length; k++) dots[k].setAttribute('aria-pressed', String(k === cur));
    };
    Array.prototype.forEach.call(dots, function (d, i) {
      d.addEventListener('click', function () { showHero(i); tick = 0; });
    });
    // 指で左右にスワイプすると、次・前の写真へ（縦のスクロールはそのまま）
    var sx = null, sy = 0, quickTimer;
    slides.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { sx = null; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    slides.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      sx = null;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      slides.classList.add('is-quick');
      clearTimeout(quickTimer);
      quickTimer = setTimeout(function () { slides.classList.remove('is-quick'); }, 700);
      showHero(cur + (dx < 0 ? 1 : -1));
      tick = 0;
    }, { passive: true });
    // 3秒ごとに1回動かす。トップの写真は2回に1回（約6秒ごと）、ABOUT の2枠は交互に
    var tick = 0;
    var fc = frames.map(function () { return 0; });
    if (!reduce) {
      window.setInterval(function () {
        if (document.hidden) return;
        tick++;
        if (tick % 2 === 0) showHero(cur + 1);
        var f = tick % 2 === 1 ? 0 : 1;
        if (frames[f]) {
          var imgs = frames[f].querySelectorAll('img');
          fc[f] = (fc[f] + 1) % imgs.length;
          fadeTo(imgs, fc[f]);
        }
      }, 3000);
    }
  }

  // --- 3) 左の帯のレコード ---
  var bandDisc = document.querySelector('.band-disc');
  if (bandDisc && !reduce) {
    onScrollFns.push(function (y) { bandDisc.style.transform = 'rotate(' + (Math.round(y * 0.6) % 360) + 'deg)'; });
  }
  runScroll();

  // --- 4) お知らせの絞り込み ---
  var spQuery = window.matchMedia('(max-width: 760px)');
  document.querySelectorAll('.filters[data-target]').forEach(function (group) {
    var list = document.getElementById(group.getAttribute('data-target'));
    if (!list) return;
    var empty = document.querySelector('[data-empty="' + list.id + '"]');
    var limit = Number(list.getAttribute('data-limit')) || 0;
    var spLimit = Number(list.getAttribute('data-sp-limit')) || 0;
    var rows = list.querySelectorAll('li');
    group.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      group.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var g = b.getAttribute('data-genre');
      var shown = 0;
      rows.forEach(function (li) {
        var hit = g === 'all' || li.getAttribute('data-genre') === g;
        var on = hit && (!limit || shown < limit);
        li.hidden = !on;
        // スマホでは先頭の数件だけ（CSS の .sp-off で隠す）
        li.classList.toggle('sp-off', on && spLimit > 0 && shown >= spLimit);
        if (on) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });
  });

  // --- 5) 写真の拡大表示 ---
  var lb = document.querySelector('dialog.lightbox');
  var lbList = [], lbCur = 0, lbOnChange = null;
  var lbShow = function (i) {
    if (!lbList.length) return;
    lbCur = (i + lbList.length) % lbList.length;
    var a = lbList[lbCur];
    var im = lb.querySelector('img');
    im.src = a.getAttribute('href');
    im.alt = a.getAttribute('data-alt') || '';
    lb.querySelector('.lb-cap').textContent = (a.getAttribute('data-alt') || '') + '　' + (lbCur + 1) + ' / ' + lbList.length;
    if (lbOnChange) lbOnChange(lbCur);
  };
  var lbOpen = function (list, i, onChange) {
    if (!lb || typeof lb.showModal !== 'function') return false;
    lbList = list; lbOnChange = onChange || null;
    lbShow(i);
    lb.showModal();
    root.classList.add('lb-open');
    return true;
  };
  if (lb) {
    lb.querySelector('.lb-prev').addEventListener('click', function () { lbShow(lbCur - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { lbShow(lbCur + 1); });
    lb.querySelector('.lb-close').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('close', function () { root.classList.remove('lb-open'); });
    // 写真とボタン以外（暗いところ）を押したら閉じる
    lb.addEventListener('click', function (e) { if (!e.target.closest('img, button')) lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') lbShow(lbCur - 1);
      if (e.key === 'ArrowRight') lbShow(lbCur + 1);
    });
    swipe(lb, function (d) { lbShow(lbCur + d); });
  }
  function swipe(el, fn) {
    var x0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) fn(dx < 0 ? 1 : -1);
      x0 = null;
    });
  }

  // ギャラリー：店舗で絞り込み、写真を押すと拡大（表示中の写真だけを前後に送る）
  var gal = document.querySelector('[data-gallery]');
  if (gal) {
    var items = Array.prototype.slice.call(gal.querySelectorAll('li'));
    var visibleLinks = function () { return items.filter(function (li) { return !li.hidden; }).map(function (li) { return li.querySelector('a'); }); };
    gal.addEventListener('click', function (e) {
      var a = e.target.closest('a.zoom');
      if (!a) return;
      var list = visibleLinks();
      if (lbOpen(list, list.indexOf(a))) e.preventDefault();
    });
    var gf = document.querySelector('[data-gallery-filter]');
    if (gf) gf.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      gf.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var s = b.getAttribute('data-store');
      items.forEach(function (li) { li.hidden = !(s === 'all' || li.getAttribute('data-store') === s); });
    });
  }

  // 撮影ページ：小さい写真を押すと上の写真が替わり、上の写真を押すと拡大
  var viewer = document.querySelector('[data-viewer]');
  if (viewer) {
    var thumbs = Array.prototype.slice.call(viewer.querySelectorAll('.viewer-thumbs a'));
    var stage = viewer.querySelector('.viewer-open img');
    var capT = viewer.querySelector('figcaption .t');
    var capN = viewer.querySelector('figcaption .n');
    var vCur = 0;
    var vShow = function (i) {
      vCur = (i + thumbs.length) % thumbs.length;
      var a = thumbs[vCur];
      stage.srcset = a.getAttribute('data-srcset');
      stage.src = a.getAttribute('href');
      stage.alt = a.getAttribute('data-alt');
      capT.textContent = a.getAttribute('data-alt');
      capN.textContent = (vCur + 1) + ' / ' + thumbs.length;
      thumbs.forEach(function (t, k) { t.setAttribute('aria-current', k === vCur ? 'true' : 'false'); });
    };
    thumbs.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); vShow(i); }); });
    viewer.querySelector('.viewer-prev').addEventListener('click', function () { vShow(vCur - 1); });
    viewer.querySelector('.viewer-next').addEventListener('click', function () { vShow(vCur + 1); });
    viewer.querySelector('.viewer-open').addEventListener('click', function () { lbOpen(thumbs, vCur, vShow); });
    swipe(viewer.querySelector('.viewer-open'), function (d) { vShow(vCur + d); });
  }

  // --- 6) 今いるページのメニューに印 ---
  var here = location.pathname;
  document.querySelectorAll('.gnav a, .fab-nav a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && href.indexOf('#') === -1 && href !== '/' && here.indexOf(href) === 0) a.setAttribute('aria-current', 'page');
  });

  // --- 7) クリックの計測（GTM → GA4）。項目は README の「計測」を参照 ---
  var storeOf = function (el) {
    var s = el.closest('[data-store]');
    return s ? s.getAttribute('data-store') : 'recoco';
  };
  var placeOf = function (el) {
    return el.closest('.fab') ? 'fab' : el.closest('.site-head') ? 'header' : el.closest('.site-foot') ? 'footer' : (el.closest('section[id], div[id], aside') || {}).id || 'main';
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var type = '';
    if (/instagram\.com/.test(href)) type = 'instagram';
    else if (/google\.[^/]+\/maps/.test(href)) type = 'map';
    else if (/^mailto:/.test(href)) type = 'mail';
    else if (/^https?:\/\//.test(href) && a.host !== location.host) type = 'external';
    if (!type) return;
    (window.dataLayer = window.dataLayer || []).push({ event: 'link_click', link_type: type, link_store: storeOf(a), link_place: placeOf(a), link_url: a.href.split('?')[0] });
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta], .gnav a, .fab-nav a, .lang a, .filters button, .chips a');
    if (!el) return;
    var name = el.getAttribute('data-cta') ||
      (el.closest('.gnav') ? 'nav_header' : el.closest('.lang') ? 'lang_switch' : el.closest('.fab-nav') ? 'nav_fab' : el.closest('[data-gallery-filter]') ? 'gallery_filter' : el.closest('.filters') ? 'news_filter' : 'menu_chip');
    var label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (name === 'fab_toggle') label = el.getAttribute('aria-expanded') === 'true' ? 'close' : 'open';
    (window.dataLayer = window.dataLayer || []).push({ event: 'click_cta', cta_name: name, cta_label: label, cta_place: placeOf(el), cta_url: (el.href || '').split('?')[0], cta_store: storeOf(el) });
  });
})();
