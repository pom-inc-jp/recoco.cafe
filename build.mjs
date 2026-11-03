// =================================================================
// build.mjs　recoco.cafe の書き出し（静的HTMLを dist/ に作る）
//
//   node build.mjs           … 書き出し
//   node build.mjs --serve   … 書き出してから http://localhost:8080 で確認
//
// 追加のライブラリは使っていません（Node.js 18 以上だけで動きます）。
// しくみは casse.cafe・retopo.cafe・pom-inc.co.jp と同じです。
//   src/pages/**.html      … 各ページの本文。先頭の --- { JSON } --- にタイトルなどを書く
//   src/_layouts/*.html    … ページの外枠
//   src/_partials/*.html   … 共通部品。{{> header}} のように読み込む
//   src/_templates/*.html  … お知らせ記事ページのひな形
//   src/_data/*.json       … お店の情報・お知らせ・メニュー
//   src/assets/            … CSS・JS・画像（そのまま dist/assets/ にコピー）
//   src/static/            … ファビコン・robots.txt・.htaccess など（dist/ 直下にコピー）
//
// テンプレートの書き方
//   {{site.name}}      … 値を差し込む（HTMLの記号は自動でエスケープ）
//   {{{home.hero}}}    … HTMLをそのまま差し込む（このファイルで組み立てた部品）
//   {{> header}}       … 共通部品を差し込む
// =================================================================

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { addPhraseBreaks } from './lib/phrase.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const STORE = 'recoco';

// ---------------------------------------------------------------
// 小さな道具
// ---------------------------------------------------------------
const readJSON = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isExternal = (url) => /^https?:\/\//.test(url);
const linkAttrs = (url) => (isExternal(url) ? ' target="_blank" rel="noopener"' : '');
const dateLabel = (d) => d.replace(/-/g, '.');
const yen = (n) => (n == null ? '—' : `¥${Number(n).toLocaleString('en-US')}`);
// 行ごとに <br> でつなぐ。英語は <br> を隠したときに単語がくっつかないよう、前に空白を入れる
const lines = (list, lang = 'ja') => list.map(esc).join(lang === 'en' ? ' <br>' : '<br>');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

async function copyDir(from, to) {
  if (!fss.existsSync(from)) return;
  await fs.cp(from, to, { recursive: true });
}

// ---------------------------------------------------------------
// テンプレート
// ---------------------------------------------------------------
function lookup(ctx, key, where) {
  const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  if (v === undefined) throw new Error(`テンプレートの値が見つかりません: {{${key}}}（${where}）`);
  return v;
}

function render(tpl, ctx, partials, where) {
  let out = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`共通部品が見つかりません: {{> ${name}}}（${where}）`);
    return render(partials[name], ctx, partials, `_partials/${name}.html`);
  });
  out = out.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, k) => String(lookup(ctx, k, where)));
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => esc(lookup(ctx, k, where)));
  return out;
}

function parseFrontMatter(src, file) {
  const m = src.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return { meta: {}, body: src };
  try {
    return { meta: JSON.parse(m[1]), body: src.slice(m[0].length) };
  } catch (e) {
    throw new Error(`${file} の先頭の設定（JSON）が読めません: ${e.message}`);
  }
}

// ---------------------------------------------------------------
// 写真
// ---------------------------------------------------------------
// WebP の幅と高さをファイルの先頭から読む
function webpSize(file) {
  const b = fss.readFileSync(file);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
}

// 写真1枚ぶんの src / srcset。「ファイル名-400.webp」があれば小さく出すときはそちらを使う
function photo(name) {
  const dir = path.join(SRC, 'assets/img/photos');
  const full = path.join(dir, `${name}.webp`);
  if (!fss.existsSync(full)) throw new Error(`写真が見つかりません: assets/img/photos/${name}.webp`);
  const big = webpSize(full);
  const list = [];
  const small = path.join(dir, `${name}-400.webp`);
  if (fss.existsSync(small)) list.push(`/assets/img/photos/${name}-400.webp 400w`);
  list.push(`/assets/img/photos/${name}.webp ${big.w}w`);
  return { src: `/assets/img/photos/${name}.webp`, srcset: list.join(', '), w: big.w, h: big.h };
}

// p は { file, alt }。sizes は表示幅の目安
function img(p, sizes, { lazy = true, cls = '', priority = false, alt, attrs = '' } = {}) {
  const o = photo(p.file);
  const altText = alt ?? p.alt ?? '';
  return `<img${cls ? ` class="${cls}"` : ''} src="${o.src}" srcset="${o.srcset}" sizes="${sizes}" alt="${esc(altText)}" width="${o.w}" height="${o.h}"${lazy ? ' loading="lazy"' : ''}${priority ? ' fetchpriority="high"' : ''} decoding="async"${attrs}>`;
}

// ---------------------------------------------------------------
// アイコン（線だけ。色は文字色に合わせる）
// ---------------------------------------------------------------
const ICONS = {
  right: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  out: '<path d="M7 17L17 7M9 7h8v8"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  prev: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
};
function icon(name, size = 14, sw = 2) {
  if (!ICONS[name]) throw new Error(`アイコンが見つかりません: ${name}`);
  return `<svg class="ico" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}
// 見出しの上の小さなレコード盤と英字
const DISC = '<svg class="disc-s" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle class="f-ink" cx="8" cy="8" r="7.5"/><circle class="f-red" cx="8" cy="8" r="3"/><circle class="f-paper" cx="8" cy="8" r=".9"/></svg>';
const eyebrow = (en) => `<p class="eyebrow" lang="en">${DISC}${esc(en)}</p>`;

// ---------------------------------------------------------------
// お知らせ
// ---------------------------------------------------------------
async function loadNews(site) {
  const items = (await readJSON(path.join(SRC, '_data/news.json'))).items || [];
  const seen = new Set();
  const valid = [];
  for (const n of items) {
    const problems = [];
    if (!/^[a-z0-9-]+$/.test(n.id || '')) problems.push('id は半角英小文字・数字・ハイフンのみ');
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(n.date || '')) problems.push('date は 2026-11-02 の形（日が分からないときは 2026-11）');
    if (!site.genres[n.genre]) problems.push(`genre は ${Object.keys(site.genres).join(' / ')} のどれか`);
    if (n.store !== STORE) problems.push(`store は "${STORE}"（会社サイトに取り込むときに使う）`);
    if (!n.title) problems.push('title がありません');
    if (seen.has(n.id)) problems.push('同じ id の記事がすでにあります');
    if (n.image) photo(n.image);
    if ((n.titleEn || n.bodyEn) && n.genre !== 'announce') problems.push('英語（titleEn・bodyEn）は genre が announce（営業日などのお知らせ）の記事だけに書く');
    if (n.bodyEn && !n.titleEn) problems.push('bodyEn を書くときは titleEn も書く');
    if (n.bodyEn && !Array.isArray(n.bodyEn)) problems.push('bodyEn は body と同じ形（配列）で書く');
    if (problems.length) throw new Error(`お知らせ「${n.title || n.id}」: ${problems.join('、')}`);
    seen.add(n.id);
    valid.push({ ...n, hasPage: Array.isArray(n.body) && n.body.length > 0 });
  }
  return valid.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// 本文中の **太字** と [文字](URL)
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#)[^)\s]*)\)/g, (_, t, u) => `<a href="${u}"${linkAttrs(u)}>${t}</a>`);
}

// 記事本文のブロック（README の「お知らせの書き方」を参照）
function renderBlock(b) {
  if (typeof b === 'string') return `<p>${inline(b)}</p>`;
  switch (b.type) {
    case 'lead':
    case 'p': return `<p>${inline(b.text)}</p>`;
    case 'h2': return `<h2>${esc(b.text)}</h2>`;
    case 'h3': return `<h3>${esc(b.text)}</h3>`;
    case 'ul': return `<ul class="dots">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`;
    case 'ol': return `<ol>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`;
    case 'img': {
      const pic = b.photo ? img({ file: b.photo, alt: b.alt }, '(max-width: 820px) 100vw, 780px') : `<img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy">`;
      return `<figure class="a-img">${pic}${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    }
    case 'photos': return `<div class="a-photos">${b.items.map((x) => img({ file: x.photo, alt: x.alt }, '(max-width: 820px) 33vw, 260px')).join('')}</div>`;
    case 'table': return `<dl class="a-table">${b.rows.map((r) => `<dt>${esc(r[0])}</dt><dd>${inline(r[1])}</dd>`).join('')}</dl>`;
    case 'note': return `<div class="a-note"><p class="t">${esc(b.title || 'ご注意')}</p>${b.items ? `<ul class="dots">${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>` : `<p>${inline(b.text)}</p>`}</div>`;
    case 'credit': return `<p class="a-credit">${inline(b.text)}</p>`;
    case 'hr': return '<hr>';
    case 'buttons': return `<p class="btns">${b.items.map((x) => `<a class="btn ${x.style === 'outline' ? 'btn-line' : 'btn-red'}" href="${esc(x.url)}"${linkAttrs(x.url)}>${esc(x.text)}${icon(isExternal(x.url) ? 'out' : 'right')}</a>`).join('')}</p>`;
    default:
      console.warn(`  ⚠ 記事の本文で、知らない種類のブロックを飛ばしました: ${b.type}`);
      return '';
  }
}

function excerpt(n) {
  if (n.description) return n.description;
  const first = (n.body || []).map((b) => (typeof b === 'string' ? b : ['lead', 'p'].includes(b.type) ? b.text : '')).find(Boolean) || '';
  return first.replace(/\*\*|\[|\]\([^)]*\)/g, '').slice(0, 110);
}

const genreTag = (n, site) => `<span class="cat c-${n.genre}">${esc(site.genres[n.genre])}</span>`;
const newsHref = (n) => (n.hasPage ? `/news/${n.id}/` : '/news/');

// お知らせの絞り込みボタン（実際にある種類だけ）
function newsFilters(news, site) {
  return [['all', 'すべて'], ...Object.entries(site.genres).filter(([k]) => news.some((n) => n.genre === k))]
    .map(([k, v], i) => `<button type="button" data-genre="${k}" aria-pressed="${i === 0}">${esc(v)}</button>`).join('\n        ');
}

// トップのお知らせ。5件より後ろは隠しておく（絞り込みで表示する）。スマホは3件まで（JSとCSS）
function newsLatest(items, site, today) {
  const isNew = (d) => (today - new Date(`${d.length === 7 ? `${d}-01` : d}T00:00:00+09:00`).getTime()) / 864e5 < site.newDays;
  const lis = items.map((n, i) =>
    `<li data-genre="${n.genre}"${i >= 5 ? ' hidden' : ''}${i >= 3 ? ' class="sp-off"' : ''}><a href="${newsHref(n)}" data-cta="news_item">` +
    `<time datetime="${n.date}">${dateLabel(n.date)}</time><span class="tagcell">${genreTag(n, site)}</span>` +
    `<span class="t">${esc(n.title)}${isNew(n.date) ? '<span class="new" lang="en">NEW</span>' : ''}</span></a></li>`).join('\n        ');
  return `<ul class="news" id="news-latest" data-limit="5" data-sp-limit="3">\n        ${lis}\n      </ul>`;
}

// お知らせ一覧（/news/）。写真がない記事は女の子のロゴの枠。記事ページがない行はリンクにしない
function newsAll(items, site) {
  const ph = '<span class="thumb thumb-ph" aria-hidden="true"><img src="/assets/img/common/recoco-girl-red.png" alt="" width="1031" height="1001" loading="lazy"></span>';
  const lis = items.map((n) => {
    const thumb = n.image ? `<span class="thumb">${img({ file: n.image }, '160px', { alt: '' })}</span>` : ph;
    const inner = `${thumb}<span class="body"><span class="meta"><time datetime="${n.date}">${dateLabel(n.date)}</time>${genreTag(n, site)}</span><span class="t">${esc(n.title)}</span></span>`;
    return n.hasPage
      ? `<li data-genre="${n.genre}"><a class="row" href="/news/${n.id}/" data-cta="news_item">${inner}<span class="more" aria-hidden="true"><span class="more-dot">${icon('right', 16)}</span></span></a></li>`
      : `<li data-genre="${n.genre}"><div class="row">${inner}</div></li>`;
  }).join('\n      ');
  return `<ul class="news-list" id="news-all">\n      ${lis}\n    </ul>`;
}

// ---------------------------------------------------------------
// 店舗
// ---------------------------------------------------------------
// 日本語と英語を1つのデータから作る（英語は「項目名En」）。英語が抜けていたら書き出しを止めて知らせる
function pick(x, key, lang, where) {
  if (lang === 'ja') return x[key];
  const v = x[`${key}En`];
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) throw new Error(`${where}「${[].concat(x[key]).join('')}」の英語（${key}En）がありません（src/_data/site.json）`);
  return v;
}
const altOf = (p, lang) => (lang === 'en' ? pick(p, 'alt', 'en', '写真の説明') : p.alt);

const hoursText = (st, lang = 'ja') => (lang === 'en' ? `${st.opens}–${st.closes} (last order ${st.lastOrder})` : `${st.opens}〜${st.closes}（L.O. ${st.lastOrder}）`);
const mapUrl = (st) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.mapQuery)}`;
const mapEmbed = (st) => `https://www.google.com/maps?q=${encodeURIComponent(st.mapQuery)}&output=embed`;

function storeCards(site, lang) {
  return site.stores.map((s) => `<a class="store-card s-${s.color}" href="#${s.id}" data-cta="store_card" data-store="${s.id}">
      <span class="txt"><span class="nm"><span class="dot" aria-hidden="true"></span>${esc(pick(s, 'name', lang, '店名'))}</span><span class="sub">${esc(pick(s, 'accessShort', lang, '店舗カード'))}・<span class="nb">${esc(s.opens)}${lang === 'en' ? '–' : '〜'}${esc(s.closes)}</span></span></span>
      ${icon('right', 20, 1.8)}
    </a>`).join('\n    ');
}

function storeBlocks(site, lang) {
  const ui = site.ui[lang];
  return site.stores.map((s) => {
    const [main, ...rest] = s.photos;
    const name = pick(s, 'name', lang, '店名');
    const rows = [
      [ui.address, lang === 'en' ? pick(s, 'address', lang, '住所') : `〒${s.zip} ${s.address}`],
      [ui.gettingHere, pick(s, 'access', lang, '行き方')],
      [ui.hours, hoursText(s, lang)],
      [ui.holiday, pick(s, 'holiday', lang, '定休日')],
      [ui.seats, pick(s, 'seats', lang, '席')],
      [ui.parking, pick(s, 'parking', lang, '駐車場')],
      [ui.jasrac, `${ui.jasracPrefix}${s.jasrac}${ui.jasracSuffix}`]
    ];
    const room = s.privateRoom ? `<span class="room-badge">${esc(ui.privateRoomBadge)}</span>` : '';
    return `<div class="store s-${s.color}" id="${s.id}">
        <div class="store-head"><h3><svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16"><circle class="f-paper" cx="8" cy="8" r="7.5"/><circle class="f-store" cx="8" cy="8" r="3"/></svg>${esc(name)}</h3>${room}<span class="en" lang="en">${esc(s.en)}</span></div>
        <div class="store-photos">
          ${img(main, '(max-width: 760px) 78vw, 560px', { cls: 'main', alt: altOf(main, lang) })}
          ${rest.map((p) => img(p, '(max-width: 760px) 78vw, 280px', { alt: altOf(p, lang) })).join('\n          ')}
        </div>
        <dl class="kv">
          ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('\n          ')}
        </dl>
        <div class="store-map"><iframe src="${esc(mapEmbed(s))}" title="${esc(name + ui.mapTitle)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
        <p class="btns">
          <a class="btn btn-store" href="${esc(mapUrl(s))}" target="_blank" rel="noopener" data-store="${s.id}">${esc(ui.map)}${icon('out')}</a>
          <a class="btn btn-line" href="${esc(s.instagram)}" target="_blank" rel="noopener" lang="en" data-store="${s.id}">Instagram${icon('out')}</a>
        </p>
      </div>`;
  }).join('\n      ');
}

// 渋谷店の個室の案内（ABOUT の下）。写真（privateRoom.photo）があるときだけ左に写真を出す
function privateRoomBand(site, lang) {
  const s = site.stores.find((x) => x.privateRoom);
  if (!s) return '';
  const r = s.privateRoom;
  const w = '個室の案内';
  const pic = r.photo ? `<div class="room-photo">${img(r.photo, '(max-width: 760px) 100vw, 420px', { alt: altOf(r.photo, lang) })}</div>` : '';
  return `<div class="room${pic ? ' has-photo' : ''}">
    ${pic}<div class="room-text">
      <p class="pill">${esc(pick(r, 'lead', lang, w))}</p>
      <h3>${lines(pick(r, 'title', lang, w), lang)}</h3>
      <p class="room-body">${esc(pick(r, 'body', lang, w))}</p>
      <p class="room-note">${esc(pick(r, 'note', lang, w))}</p>
      <p class="room-btn"><a class="btn btn-paper" href="#${s.id}" data-cta="room_access" data-store="${s.id}">${esc(pick(r, 'button', lang, w))}${icon('down')}</a></p>
    </div>
  </div>`;
}

// 英語ページのお知らせ：announce で titleEn がある記事だけ、新しい順に3件。
// 記事ページがあれば、記事の英語の部分（/news/id/#en）へリンクする。なければ文字だけ
function newsEn(news, site) {
  const items = news.filter((n) => n.genre === 'announce' && n.titleEn).slice(0, 3);
  if (!items.length) return '';
  const row = (n) => {
    const inner = `<time datetime="${n.date}">${dateLabel(n.date)}</time><span class="t">${esc(n.titleEn)}</span>`;
    return n.hasPage ? `<a class="row" href="/news/${n.id}/#en">${inner}${icon('right')}</a>` : `<div class="row">${inner}</div>`;
  };
  return `<section class="sec wrap sec-news" id="news" aria-labelledby="news-h">
  <div class="indent">
    ${eyebrow('NEWS')}<h2 id="news-h" class="mb-s">${esc(site.ui.en.news)}</h2>
    <ul class="news news-en">
      ${items.map((n) => `<li>${row(n)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------
// トップ（/）と英語ページ（/en/）の部品。テンプレートは同じで、言葉だけが変わる
// ---------------------------------------------------------------
function homeParts(site, menu, news, today, lang) {
  const en = lang === 'en';
  const ui = site.ui[lang];
  const h = site.hero;
  // 写真は重ねておき、recoco.js が約6秒ごとにふわっと切り替える（最初の1枚だけ先に読み込む）
  const slides = h.photos.map((p, i) => {
    const alt = altOf(p, lang);
    return img(p, '(max-width: 760px) 100vw, 1180px', { lazy: i > 0, priority: i === 0, cls: i === 0 ? 'is-on' : '', alt: i === 0 ? alt : '', attrs: ` data-alt="${esc(alt)}"${i === 0 ? '' : ' aria-hidden="true"'}` });
  }).join('\n      ');
  const dots = h.photos.map((p, i) => `<button type="button" aria-label="${esc(ui.photoLabel.replace('{n}', i + 1))}" aria-pressed="${i === 0}" data-cta="hero_dot"><span></span></button>`).join('');
  const pool = (list) => list.map((p, i) => {
    const alt = altOf(p, lang);
    return img(p, '(max-width: 760px) 45vw, 272px', { cls: i === 0 ? 'is-on' : '', alt: i === 0 ? alt : '', attrs: ` data-alt="${esc(alt)}"${i === 0 ? '' : ' aria-hidden="true"'}` });
  }).join('');
  const words = site.marquee.flatMap((w) => [`<span lang="en">${esc(w)}</span>`, '<span>●</span>']).join('');
  const more = (href, text, cta) => (text ? `<a class="more-link" href="${href}" data-cta="${cta}">${esc(text)}${icon('right')}</a>` : '');
  const menuName = (name) => (en ? menuItem(menu, name).en.split(' ／ ')[0] : name);
  const voices = en ? '' : `<section class="sec wrap" id="voice" aria-labelledby="voice-h">
  <div class="indent">
    <div class="sec-head">
      <div>${eyebrow('VOICE')}<h2 id="voice-h">お客さまの声</h2></div>
      ${more('/voice/', 'すべて見る', 'voice_more')}
    </div>
    <div class="voice-cards">
      ${site.voices.items.slice(0, 2).map((v, i) => `<a class="voice-card${i ? ' sp-hide' : ''}" href="/voice/#voice-${String(i + 1).padStart(2, '0')}"><p class="q">${lines(v.headline)}</p><p class="who">${esc(v.whoShort || v.who)}</p></a>`).join('\n      ')}
    </div>
  </div>
</section>`;
  return {
    ui,
    heroTitle: lines(pick(h, 'title', lang, 'トップの見出し'), lang),
    heroLead: lines(pick(h, 'lead', lang, 'トップの文章'), lang),
    heroBand: h.band.map(esc).join('<span class="gap"></span>'),
    slides,
    dots,
    storeCards: storeCards(site, lang),
    marquee: words.repeat(4),
    aboutTitle: lines(pick(site.about, 'title', lang, 'ABOUT の見出し'), lang),
    aboutText: pick(site.about, 'text', lang, 'ABOUT の文章'),
    aboutA: pool(site.about.photosA),
    aboutB: pool(site.about.photosB),
    points: site.about.points.map((x, i) => `<li><p class="pt" lang="en">POINT ${String(i + 1).padStart(2, '0')}</p><h3>${esc(pick(x, 'title', lang, 'ABOUT のポイント'))}</h3><p>${esc(pick(x, 'text', lang, 'ABOUT のポイント'))}</p></li>`).join('\n      '),
    room: privateRoomBand(site, lang),
    stepsLead: en ? site.stepsLeadEn : site.stepsLead,
    steps: site.steps.map((x, i) => `<li><span class="num" lang="en">${i + 1}</span><h3>${esc(pick(x, 'title', lang, '楽しみ方'))}</h3><p>${esc(pick(x, 'text', lang, '楽しみ方'))}</p></li>`).join('\n        '),
    girlAlt: en ? 'The RECOCO logo: a girl wearing headphones' : 'RECOCOのロゴ（ヘッドホンをつけた女の子）',
    chargeNote: pick(site.charge, 'note', lang, '料金の説明'),
    chargeTable: chargeTable(site.charge, { lang }),
    chargeFootnote: pick(site.charge, 'footnote', lang, '料金の注記'),
    menuTitle: pick(site.menuPreview, 'title', lang, 'メニューの見出し'),
    menuText: pick(site.menuPreview, 'text', lang, 'メニューの文章'),
    menuImg: img(site.menuPreview.photo, '(max-width: 760px) calc(100vw - 40px), 600px', { cls: 'menu-photo', alt: altOf(site.menuPreview.photo, lang) }),
    menuItems: site.menuPreview.items.map((name) => `<li><span>${esc(menuName(name))}</span><span class="pr" lang="en">${yen(menuItem(menu, name).price)}</span></li>`).join('\n        '),
    info: infoList(site.info.filter((x) => !(en && x.jaOnly)), lang),
    galleryMore: more('/gallery/', ui.galleryMore, 'gallery_more'),
    gallery: site.galleryTop.map((g) => img(g, g.shape === 'wide' ? '(max-width: 760px) 100vw, 600px' : '(max-width: 760px) 50vw, 300px', { cls: `g-${g.shape}`, alt: altOf(g, lang) })).join('\n    '),
    voices,
    accessLead: en ? site.en.accessLead : site.accessLead,
    stores: storeBlocks(site, lang),
    // ここから日本語のトップだけ
    newsFilters: en ? '' : newsFilters(news, site),
    news: en ? '' : newsLatest(news, site, today),
    newsEn: en ? newsEn(news, site) : '',
    collab: en ? '' : site.collabTop.items.map((c) => `<li><a href="${esc(c.href)}" data-cta="collab_item"><figure>${img(c, '(max-width: 760px) 45vw, 280px')}<figcaption><span class="d" lang="en">${esc(c.date)}</span><span class="n">${esc(c.name)}</span></figcaption></figure></a></li>`).join('\n      '),
    // 撮影・取材・コラボへの入口。PCはお知らせの下、スマホはページのいちばん下に出す（同じ中身を2か所に置き、CSSで出し分ける）
    locBandPc: en ? '' : locBand(site, 'pc'),
    locBandSp: en ? '' : locBand(site, 'sp')
  };
}

function locBand(site, where) {
  const b = site.locBand;
  const r = icon('right');
  const id = `loc-band-${where}`;
  return `<section class="wrap loc-band-wrap ${where}-only-band"${where === 'sp' ? ' id="shooting"' : ''} aria-labelledby="${id}">
  <div class="loc-band">
    <div class="txt">
      <p class="eyebrow-plain" lang="en">LOCATION &amp; PRESS</p>
      <h2 id="${id}">${esc(b.title)}</h2>
      <p>${esc(b.text)}</p>
    </div>
    <p class="btns">
      <a class="btn btn-red" href="/shooting/#location" data-cta="shoot_entry">撮影について${r}</a>
      <a class="btn btn-ink" href="/shooting/#press" data-cta="press_entry">取材について${r}</a>
      <a class="btn btn-line" href="/shooting/#collab" data-cta="collab_entry">コラボ・貸切${r}</a>
    </p>
  </div>
</section>`;
}

// 料金の表。lang: 'en' は英語だけ、bi: true は日本語に英語を小さく添える（メニューページ）
function chargeTable(charge, { lang = 'ja', bi = false } = {}) {
  const t = (x, key) => (lang === 'en' ? esc(pick(x, key, 'en', '料金')) : bi ? `${esc(x[key])}<span class="en" lang="en">${esc(pick(x, key, 'en', '料金'))}</span>` : esc(x[key]));
  // 見出しが2行になるときは「・」のあとで折り返す
  const cols = charge.columns.map((c, i) => `<th scope="col">${t({ c, cEn: (charge.columnsEn || [])[i] }, 'c').replace(/・/g, '・<wbr>')}</th>`).join('');
  const rows = charge.rows.map((r) => `<tr><th scope="row">${t(r, 'label')}</th>${r.prices.map((p) => `<td lang="en">${yen(p)}</td>`).join('')}</tr>`).join('\n          ');
  return `<div class="table-wrap"><table class="charge${bi ? ' charge-menu' : ''}">
          <thead><tr><th scope="col"><span class="vh">${lang === 'en' ? 'Type' : '区分'}</span></th>${cols}</tr></thead>
          <tbody>
          ${rows}
          </tbody>
        </table></div>`;
}

// ご利用案内・撮影の設備のアイコン（線だけ。色は CSS で赤にする）。site.json の info[].icon・shooting.features[].icon にここの名前を書く
const INFO_ICONS = {
  system: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M15 7v2M15 11v2M15 15v2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  seat: '<path d="M7 3v9h10V3M5 12h14M7 12v9M17 12v9M7 17h10"/>',
  wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".8"/>',
  paw: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M8 17.5c0-3 1.8-5.5 4-5.5s4 2.5 4 5.5c0 2-2 2.5-4 2.5s-4-.5-4-2.5z"/>',
  'no-record': '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M5.6 5.6l12.8 12.8"/>',
  'no-phone': '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/><path d="M3 3l18 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  // 撮影ページの「設備とご協力できること」（site.json の shooting.features[].icon）
  kitchen: '<path d="M4 4h16v16H4zM4 9h16"/><circle cx="8" cy="6.5" r=".8"/><circle cx="11" cy="6.5" r=".8"/><rect x="7" y="12" width="10" height="5" rx="1"/>',
  layout: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M14 6.5h4a2 2 0 0 1 2 2V11M10 17.5H6a2 2 0 0 1-2-2V13"/><path d="M18 9l2 2 2-2M6 15l-2-2-2 2"/>',
  cup: '<path d="M6 3h12l-1.5 17a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z"/><path d="M6.8 10h10.4"/>',
  parking: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  invoice: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  nofire: '<path d="M3 15h13v3H3zM18 15h1v3h-1zM21 15v3"/><path d="M3 3l18 18"/>'
};
function infoIcon(name) {
  if (!name) return '';
  if (!INFO_ICONS[name]) throw new Error(`ご利用案内のアイコンが見つかりません: ${name}（使えるもの: ${Object.keys(INFO_ICONS).join(' / ')}）`);
  return `<svg class="ico info-ico" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${INFO_ICONS[name]}</svg>`;
}
const infoList = (info, lang = 'ja') => info.map((x) => `<div><dt>${infoIcon(x.icon)}${esc(pick(x, 'label', lang, 'ご利用案内'))}</dt><dd>${esc(pick(x, 'text', lang, 'ご利用案内'))}</dd></div>`).join('\n        ');

function menuItem(menu, name) {
  for (const c of menu.categories) for (const it of c.items) if (it.name === name) return it;
  throw new Error(`トップのメニュー抜粋「${name}」が menu.json に見つかりません（品名を同じ文字で書いてください）`);
}

function menuParts(menu) {
  return {
    photo: img(menu.photo, '(max-width: 760px) calc(100vw - 40px), 320px', { lazy: false, cls: 'menu-hero' }),
    chips: menu.categories.map((c) => `<a href="#${esc(c.id)}">${esc(c.name)}<span lang="en">${esc(c.en)}</span>${icon('down')}</a>`).join('\n    '),
    sections: menu.categories.map((c) => `<section class="menu-cat" id="${esc(c.id)}" aria-labelledby="${esc(c.id)}-h">
    <div class="menu-cat-head">
      <p class="en" lang="en">${esc(c.en)}</p>
      <h2 id="${esc(c.id)}-h">${esc(c.name)}</h2>
      ${c.note ? `<p class="note">${esc(c.note)}${c.noteEn ? `<span class="en" lang="en">${esc(c.noteEn)}</span>` : ''}</p>` : ''}
      ${c.photo ? img(c.photo, '280px', { cls: 'cat-photo' }) : ''}
    </div>
    <ul class="menu-items">
      ${c.items.map((it) => `<li><span class="nm"><b>${esc(it.name)}</b><span class="en" lang="en">${esc(it.en)}</span></span><span class="pr" lang="en">${yen(it.price)}</span></li>`).join('\n      ')}
    </ul>
  </section>`).join('\n\n  ')
  };
}

// ---------------------------------------------------------------
// 撮影・取材・コラボのご依頼（/shooting/）
// ---------------------------------------------------------------
function mailto(email, subject, items) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(items.map((x) => `${x}：\n`).join(''))}`;
}

function shootingParts(site, news) {
  const sh = site.shooting;
  // コラボのカードに news（お知らせの id）を書くと、その記事ページへのリンクになる。記事ページがない id は書き出しを止める
  const articleIds = new Set(news.filter((n) => n.hasPage).map((n) => n.id));
  for (const c of sh.collabs) if (c.news && !articleIds.has(c.news)) throw new Error(`撮影ページのコラボ「${c.name}」の news（${c.news}）に当たる記事ページがありません`);
  const first = sh.gallery[0];
  const viewer = `<div class="viewer" data-viewer>
      <figure>
        <button type="button" class="viewer-open" aria-label="写真を大きく表示" data-cta="gallery_open">${img(first, '(max-width: 760px) 100vw, 1180px')}</button>
        <figcaption><span class="t">${esc(first.alt)}</span><span class="n" lang="en">1 / ${sh.gallery.length}</span></figcaption>
      </figure>
      <div class="viewer-bar">
        <button type="button" class="round viewer-prev" aria-label="前の写真" data-cta="gallery_prev">${icon('prev', 18, 1.8)}</button>
        <ul class="viewer-thumbs" aria-label="写真の一覧">
          ${sh.gallery.map((p, i) => {
            const o = photo(p.file);
            return `<li><a href="${o.src}" data-srcset="${o.srcset}" data-alt="${esc(p.alt)}" aria-label="${i + 1}枚目：${esc(p.alt)}" data-cta="gallery_thumb"${i === 0 ? ' aria-current="true"' : ''}>${img(p, '96px', { alt: '' })}</a></li>`;
          }).join('\n          ')}
        </ul>
        <button type="button" class="round viewer-next" aria-label="次の写真" data-cta="gallery_next">${icon('next', 18, 1.8)}</button>
      </div>
    </div>`;
  const pressGroups = sh.pressKinds.map(([label, en]) => {
    const items = sh.press.filter((p) => p.kind === label).sort((a, b) => (a.date < b.date ? 1 : -1));
    if (!items.length) return '';
    return `<div class="press-group">
        <p class="gh"><span class="l">${esc(label)}</span><span class="e" lang="en">${esc(en)}</span></p>
        <ul>${items.map((p) => `<li><span class="d" lang="en">${esc(p.date)}</span><span class="n">${esc(p.name)}</span></li>`).join('')}</ul>
      </div>`;
  }).filter(Boolean).join('\n      ');
  const unknownKinds = sh.press.filter((p) => !sh.pressKinds.some(([k]) => k === p.kind));
  if (unknownKinds.length) throw new Error(`取材の実績「${unknownKinds[0].name}」の kind は ${sh.pressKinds.map((k) => k[0]).join(' / ')} のどれか`);
  const ph = '<div class="collab-ph"><img src="/assets/img/common/recoco-girl-red.png" alt="" width="1031" height="1001" loading="lazy"></div>';
  const collabs = sh.collabs.map((c) => {
    const inner = `${c.photo ? img(c.photo, '(max-width: 760px) 100vw, 300px') : ph}
        <div class="b">
          <p class="m"><span class="d" lang="en">${esc(c.date)}</span><span class="kind k-${sh.collabKinds[c.kind] || 'other'}">${esc(c.kind)}</span></p>
          <p class="n">${esc(c.name)}</p>
          <p class="x">${esc(c.text)}</p>${c.news ? `
          <p class="more"><span class="more-dot" aria-hidden="true">${icon('right')}</span></p>` : ''}
        </div>`;
    return c.news
      ? `<li class="has-link"><a href="/news/${esc(c.news)}/" data-cta="collab_card">${inner}</a></li>`
      : `<li>${inner}</li>`;
  }).join('\n      ');
  return {
    floors: sh.floors.map((f) => `<figure class="floor">${img(f.photo, '(max-width: 760px) 100vw, 600px')}<figcaption><span class="fl" lang="en">${esc(f.floor)}</span><span class="t">${esc(f.title)}</span><span class="x">${esc(f.text)}</span></figcaption></figure>`).join('\n    '),
    viewer,
    works: sh.works.map((g) => `<div class="works w-${g.color}">
        <p class="gh"><span class="l">${esc(g.label)}</span><span class="e" lang="en">${esc(g.en)}</span></p>
        <ul aria-label="${esc(g.label)}">${g.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`).join('\n      '),
    times: sh.times.map((t) => `<li lang="en">${esc(t)}</li>`).join(''),
    prices: sh.prices.map((x) => `<dt>${esc(x.label)}</dt><dd>${esc(x.unit)} <span class="num" lang="en">${esc(x.value)}</span>円〜</dd>`).join('\n          '),
    priceNotes: sh.priceNotes.map((x) => `<li>${esc(x)}</li>`).join(''),
    flow: sh.flow.map((x, i) => `<li><span class="st" lang="en">STEP ${i + 1}</span><span class="t">${esc(x.title)}</span><span class="x">${esc(x.sub)}</span></li>`).join('\n      '),
    features: sh.features.map((x) => `<div><dt>${infoIcon(x.icon)}${esc(x.label)}</dt><dd>${esc(x.text)}</dd></div>`).join('\n      '),
    mailHref: mailto(site.email, sh.mailSubject, sh.mailItems),
    pressMailHref: mailto(site.email, sh.pressMailSubject, sh.pressMailItems),
    collabMailHref: mailto(site.email, sh.collabMailSubject, sh.collabMailItems),
    pressTopics: sh.pressTopics.map((x) => `<li><span class="t">${esc(x.topic)}</span><span class="m">${esc(x.media)}</span></li>`).join('\n      '),
    pressGroups,
    collabs
  };
}

// ---------------------------------------------------------------
// ギャラリー（/gallery/）・お客さまの声（/voice/）
// ---------------------------------------------------------------
function galleryParts(site) {
  const byId = Object.fromEntries(site.stores.map((s) => [s.id, s]));
  const filters = [['all', 'すべて'], ...site.stores.map((s) => [s.id, s.area])]
    .map(([k, v], i) => `<button type="button" data-store="${k}" aria-pressed="${i === 0}">${esc(v)}</button>`).join('\n      ');
  const items = site.gallery.photos.map((p) => {
    const st = byId[p.store];
    if (!st) throw new Error(`ギャラリーの写真「${p.file}」の store は ${Object.keys(byId).join(' / ')} のどれか`);
    const o = photo(p.file);
    return `<li data-store="${st.id}"><figure>
        <a class="zoom" href="${o.src}" data-srcset="${o.srcset}" data-alt="${esc(p.alt)}" aria-label="${esc(p.alt)}を大きく表示" data-cta="gallery_open">${img(p, '(max-width: 760px) 33vw, 300px')}</a>
        <figcaption class="s-${st.color}">${esc(st.shortName)}</figcaption>
      </figure></li>`;
  }).join('\n    ');
  return { filters, items };
}

function voiceParts(site) {
  return site.voices.items.map((v, i) => {
    const no = String(i + 1).padStart(2, '0');
    return `<article class="voice" id="voice-${no}" aria-labelledby="voice-${no}-h">
    ${img(v.photo, '(max-width: 760px) calc(100vw - 40px), 440px', { cls: 'voice-photo' })}
    <div class="voice-body">
      <p class="no" lang="en">VOICE ${no}</p>
      <h2 id="voice-${no}-h">${v.headline.map(esc).join('')}</h2>
      <p class="who">${esc(v.who)}</p>
      <ul class="note-paper">
        ${v.points.map((x) => `<li>${esc(x)}</li>`).join('\n        ')}
      </ul>
      <div class="reply">
        <span class="face"><img src="/assets/img/common/girl.png" alt="" width="516" height="501" loading="lazy"></span>
        <div><p class="from">RECOCOより</p><p>${esc(v.reply)}</p></div>
      </div>
    </div>
  </article>`;
  }).join('\n\n  ');
}

// ---------------------------------------------------------------
// 構造化データ（検索エンジン向け）。2店舗それぞれ CafeOrCoffeeShop として出す
// ---------------------------------------------------------------
function cafeJsonLd(site) {
  const data = site.stores.map((s) => ({
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    '@id': `${site.url}/#${s.id}`,
    name: `レコードカフェ ${s.shortName}`,
    url: `${site.url}/`,
    image: `${site.url}${photo(s.photos[0].file).src}`,
    description: site.description,
    email: site.email,
    hasMenu: `${site.url}/menu/`,
    address: { '@type': 'PostalAddress', postalCode: s.zip, addressCountry: 'JP', addressRegion: s.region, addressLocality: s.locality, streetAddress: s.street },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: s.opens, closes: s.closes }],
    paymentAccepted: 'クレジットカード, PayPay, 交通系IC, QUICPay, iD',
    sameAs: [s.instagram],
    parentOrganization: { '@type': 'Organization', name: '株式会社ポム', url: 'https://pom-inc.co.jp/' }
  }));
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

function articleImage(n, site) {
  if (n.image) return `${site.url}${photo(n.image).src}`;
  return `${site.url}/assets/img/common/ogp.jpg`;
}

function articleJsonLd(n, site, url) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: n.title,
    datePublished: n.date,
    dateModified: n.updated || n.date,
    mainEntityOfPage: url,
    image: [articleImage(n, site)],
    publisher: { '@type': 'Organization', name: site.fullName }
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

// ---------------------------------------------------------------
// ヘッダー・スマホのメニュー・フッター
// ---------------------------------------------------------------
function chromeParts(site, lang, hasNewsEn = true) {
  const en = lang === 'en';
  // 英語ページのお知らせ（announce で titleEn がある記事）がないときは、メニューから News を外す
  const nav = en ? site.en.nav.filter((n) => hasNewsEn || n.href !== '/en/#news') : site.nav;
  const navHeader = nav.filter((n) => !n.fabOnly).map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('\n      ');
  const navFab = nav.map((n) => `<a href="${esc(n.href)}"><span class="dot" aria-hidden="true"></span><span class="lb"><span class="ja">${esc(n.label)}</span><span class="en" lang="en">${esc(n.en)}</span></span></a>`).join('\n      ');
  const igFab = site.stores.map((s) => `<a class="btn btn-${s.color}" href="${esc(s.instagram)}" target="_blank" rel="noopener" data-store="${s.id}">${esc(pick(s, 'area', lang, '店名'))} <span lang="en">Instagram</span>${icon('out')}</a>`).join('');
  const f = site.footer;
  const a = (url, text) => `<a href="${esc(url)}"${linkAttrs(url)}>${esc(text)}</a>`;
  const mail = `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`;
  // フッターは「見出し：中身」の行にそろえる（JASRAC は店舗・アクセスにだけ出す）
  const row = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  const igLinks = site.stores.map((s) => a(s.instagram, en ? s.areaEn : s.area)).join(en ? ' / ' : '・');
  const foot = en
    ? [
      row(esc(f.en.contact), `${mail}<span class="note">${esc(f.en.noReserve)}</span>`),
      row('<span lang="en">Instagram</span>', igLinks),
      row(esc(f.en.sister), a(f.sister.url, f.en.sisterName))
    ]
    : [
      row(esc(f.ja.contact), `${mail}<span class="note">${esc(f.noReserve)}</span>`),
      row(esc(f.ja.request), a('/shooting/', f.contact)),
      row('<span lang="en">Instagram</span>', igLinks),
      row(esc(f.ja.sister), a(f.sister.url, f.sister.name))
    ];
  return { navHeader, navFab, igFab, foot: `<dl class="foot-list">${foot.join('')}</dl>`, jpCurrent: en ? '' : ' aria-current="true"', enCurrent: en ? ' aria-current="true"' : '', footCatch: en ? f.en.catch : f.catch, tagline: en ? site.en.tagline : site.tagline, home: en ? '/en/' : '/' };
}

// ---------------------------------------------------------------
// 書き出し
// ---------------------------------------------------------------
async function build() {
  const t0 = Date.now();
  const site = await readJSON(path.join(SRC, '_data/site.json'));
  const menu = await readJSON(path.join(SRC, '_data/menu.json'));
  const news = await loadNews(site);

  const partials = {};
  for (const f of await fs.readdir(path.join(SRC, '_partials'))) partials[path.basename(f, '.html')] = await fs.readFile(path.join(SRC, '_partials', f), 'utf8');
  const layouts = {};
  for (const f of await fs.readdir(path.join(SRC, '_layouts'))) layouts[path.basename(f, '.html')] = await fs.readFile(path.join(SRC, '_layouts', f), 'utf8');

  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
  await copyDir(path.join(SRC, 'static'), OUT);

  const gtm = site.gtmId
    ? {
      head: `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(site.gtmId)}');</script>\n<!-- End Google Tag Manager -->`,
      body: `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(site.gtmId)}" height="0" width="0" style="display:none;visibility:hidden" title="Google Tag Manager"></iframe></noscript>`
    }
    : { head: '', body: '' };

  const shared = {
    site,
    gtm,
    eb: Object.fromEntries(['NEWS', 'ABOUT', 'HOW TO ENJOY', 'CHARGE', 'MENU', 'INFORMATION', 'COLLABORATION', 'GALLERY', 'VOICE', 'ACCESS', 'LOCATION & PRESS'].map((k) => [k.replace(/[^A-Z]/g, ''), eyebrow(k)])),
    ic: { right: icon('right'), out: icon('out'), down: icon('down'), up: icon('up', 16), mail: icon('mail', 18, 1.8), prev: icon('prev', 18), next: icon('next', 18), close: icon('close', 18) },
    build: { version: t0.toString(36), year: new Date().getFullYear() },
    news: { filters: newsFilters(news, site), all: newsAll(news, site) },
    menu: { ...menuParts(menu), lead: menu.lead, leadEn: menu.leadEn, updated: menu.updated, chargeTable: chargeTable(site.charge, { bi: true }), footnoteEn: site.charge.footnoteEn },
    shooting: shootingParts(site, news),
    gallery: galleryParts(site),
    voices: { list: voiceParts(site), closing: lines(site.voices.closing) }
  };

  const sitemap = [];
  // 日本語と英語で変わる部分（ヘッダー・メニュー・フッター・トップの本文）
  const byLang = {
    ja: { chrome: chromeParts(site, 'ja'), t: homeParts(site, menu, news, t0, 'ja') },
    en: { chrome: chromeParts(site, 'en', news.some((n) => n.genre === 'announce' && n.titleEn)), t: homeParts(site, menu, news, t0, 'en') }
  };

  function pageCtx(meta, urlPath, extra = {}) {
    const isTop = urlPath === '/';
    const lang = meta.lang || 'ja';
    return {
      ...shared,
      chrome: byLang[lang].chrome,
      page: {
        lang,
        locale: lang === 'en' ? 'en_US' : 'ja_JP',
        ui: site.ui[lang],
        t: byLang[lang].t,
        hreflang: ['/', '/en/'].includes(urlPath) ? `<link rel="alternate" hreflang="ja" href="${site.url}/">\n<link rel="alternate" hreflang="en" href="${site.url}/en/">\n<link rel="alternate" hreflang="x-default" href="${site.url}/">` : '',
        fullTitle: meta.fullTitle || (isTop ? `${site.fullName}｜${site.catch}` : `${meta.title}｜${site.name}`),
        description: meta.description || site.description,
        url: `${site.url}${urlPath}`,
        ogType: meta.ogType || (isTop ? 'website' : 'article'),
        robots: meta.noindex ? '<meta name="robots" content="noindex">' : '',
        canonical: meta.noindex ? '' : `<link rel="canonical" href="${site.url}${urlPath}">`,
        jsonld: meta.jsonld || '',
        image: meta.image || `${site.url}/assets/img/common/ogp.jpg`,
        fonts: meta.handwriting ? 'family=Jost:wght@400;500;600&family=Klee+One:wght@600&family=Zen+Kaku+Gothic+New:wght@400;500;700' : 'family=Jost:wght@400;500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700',
        bodyClass: meta.bodyClass ? ` class="${esc(meta.bodyClass)}"` : ''
      },
      ...extra
    };
  }

  async function writePage(urlPath, html) {
    const file = urlPath.endsWith('/') ? path.join(OUT, urlPath, 'index.html') : path.join(OUT, urlPath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // 日本語を文節の切れ目で改行させる（lib/phrase.mjs）
    const out = addPhraseBreaks(html);
    if (out.includes('/_blob/')) throw new Error(`${urlPath} にデザインカンプの画像パス（/_blob/）が残っています`);
    await fs.writeFile(file, out);
  }

  // 1) src/pages の各ページ
  const pageFiles = (await walk(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'));
  for (const file of pageFiles) {
    const rel = path.relative(path.join(SRC, 'pages'), file).split(path.sep).join('/');
    const { meta, body } = parseFrontMatter(await fs.readFile(file, 'utf8'), rel);
    const urlPath = meta.path || '/' + rel.replace(/index\.html$/, '');
    if (meta.cafeJsonLd) meta.jsonld = cafeJsonLd(site);
    const ctx = pageCtx(meta, urlPath);
    const content = render(body, ctx, partials, `pages/${rel}`);
    await writePage(urlPath, render(layouts.default, { ...ctx, content }, partials, '_layouts/default.html'));
    if (!meta.noindex) sitemap.push({ loc: `${site.url}${urlPath}`, lastmod: new Date(t0).toISOString().slice(0, 10) });
  }

  // 2) お知らせの記事ページ（/news/記事ID/）。本文（body）がある記事だけ
  const articleTpl = await fs.readFile(path.join(SRC, '_templates/news-article.html'), 'utf8');
  const withPage = news.filter((n) => n.hasPage);
  const navCard = (n, dir) => n
    ? `<a class="pn" href="/news/${n.id}/"><span class="lb">${dir === 'prev' ? `${icon('left')}前の記事` : `次の記事${icon('right')}`}</span><span class="t">${esc(n.short || n.title)}</span></a>`
    : '';
  for (const [i, n] of withPage.entries()) {
    const urlPath = `/news/${n.id}/`;
    const meta = { title: n.title, description: excerpt(n), ogType: 'article', image: articleImage(n, site), jsonld: articleJsonLd(n, site, `${site.url}${urlPath}`) };
    const ctx = pageCtx(meta, urlPath, {
      article: {
        title: n.title,
        crumb: n.short || n.title,
        date: n.date,
        dateLabel: dateLabel(n.date),
        updated: n.updated ? `<span class="upd">（更新 ${dateLabel(n.updated)}）</span>` : '',
        tag: genreTag(n, site),
        body: n.body.map(renderBlock).join('\n'),
        // 営業日などのお知らせ（announce）に英語（titleEn・bodyEn）があれば、日本語の下に英語を続ける（同じページ）
        enLink: n.titleEn ? `<a class="en-link" href="#en" lang="en">English below${icon('down', 13)}</a>` : '',
        en: n.titleEn ? `<section class="article-en" id="en" lang="en" aria-labelledby="en-h"><p class="label">ENGLISH</p><h2 id="en-h">${esc(n.titleEn)}</h2><div class="en-body">${(n.bodyEn || []).map(renderBlock).join('\n')}</div></section>` : '',
        // 一覧は新しい順なので、配列の後ろが「前の記事（古い）」、前が「次の記事（新しい）」
        pager: [navCard(withPage[i + 1], 'prev'), navCard(withPage[i - 1], 'next')].join('')
      }
    });
    const content = render(articleTpl, ctx, partials, '_templates/news-article.html');
    await writePage(urlPath, render(layouts.default, { ...ctx, content }, partials, '_layouts/default.html'));
    sitemap.push({ loc: `${site.url}${urlPath}`, lastmod: n.updated || (n.date.length === 7 ? `${n.date}-01` : n.date) });
  }

  // 3) サイトマップ
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemap.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n') + '\n</urlset>\n';
  await fs.writeFile(path.join(OUT, 'sitemap.xml'), xml);

  // 4) お知らせのデータ（/news.json）。pom-inc.co.jp がこれを読みにきて、会社サイトのお知らせにも載せる
  // 会社サイトは本文の基本の種類（p・img など）しか知らないので、RECOCO だけの種類を書き換えて出す
  const portable = (b) => {
    if (typeof b === 'string' || !b) return [b];
    if (b.type === 'img' && b.photo) return [{ type: 'img', src: photo(b.photo).src, alt: b.alt || '', ...(b.caption ? { caption: b.caption } : {}) }];
    if (b.type === 'photos') return b.items.map((x) => ({ type: 'img', src: photo(x.photo).src, alt: x.alt || '' }));
    if (b.type === 'credit') return [{ type: 'p', text: b.text }];
    if (b.type === 'note' && b.items) return [{ type: 'note', text: b.items.join('　') }];
    return [b];
  };
  const pub = news.map(({ hasPage, ...n }) => ({
    ...n,
    ...(n.body ? { body: n.body.flatMap(portable) } : {}),
    ...(n.image ? { imageUrl: `${site.url}${photo(n.image).src}` } : {}),
    url: `${site.url}${newsHref({ ...n, hasPage })}`
  }));
  await fs.writeFile(path.join(OUT, 'news.json'), JSON.stringify({ updated: new Date(t0).toISOString(), items: pub }, null, 1));

  // 5) RSS
  const rfc = (d) => new Date(`${d.length === 7 ? `${d}-01` : d}T09:00:00+09:00`).toUTCString();
  const rss = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n' +
    `<title>${esc(site.fullName)}</title>\n<link>${site.url}/</link>\n<description>${esc(site.catch)}</description>\n<language>ja</language>\n` +
    news.slice(0, 20).map((n) => `<item><title>${esc(n.title)}</title><link>${site.url}${newsHref(n)}</link><guid isPermaLink="false">${site.url}/news/${n.id}/</guid><pubDate>${rfc(n.date)}</pubDate><category>${esc(site.genres[n.genre])}</category><description>${esc(excerpt(n))}</description></item>`).join('\n') +
    '\n</channel>\n</rss>\n';
  await fs.writeFile(path.join(OUT, 'feed.xml'), rss);

  console.log(`書き出し完了: ${pageFiles.length}ページ＋お知らせの記事${withPage.length}件（お知らせ全${news.length}件）（${Date.now() - t0}ms）→ dist/`);
}

// ---------------------------------------------------------------
// 確認用サーバー（node build.mjs --serve）
// ---------------------------------------------------------------
function serve(port = 8080) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
  http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(OUT, path.normalize(p));
    if (!file.startsWith(OUT)) { res.writeHead(403); return res.end(); }
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await fs.readFile(path.join(OUT, '404.html')).catch(() => 'Not Found'));
    }
  }).listen(port, () => console.log(`確認用サーバー: http://localhost:${port}/`));
}

build()
  .then(() => { if (process.argv.includes('--serve')) serve(); })
  .catch((e) => { console.error('\n書き出しに失敗しました:\n' + e.message); process.exit(1); });
