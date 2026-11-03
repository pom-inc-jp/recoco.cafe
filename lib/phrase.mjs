// =================================================================
// phrase.mjs　日本語の文を文節で改行させる
//
// 書き出したHTMLの本文（<body> の中の文字）を BudouX で文節に区切り、
// 区切り位置に <wbr> を入れる。CSS で word-break:keep-all にしているので、
// 改行は <wbr> の位置（＝文節の切れ目）でだけ起きる。
// 「…店舗を企画・運営しています」の「運営し / ています」のような中途半端な改行を防ぐ。
// =================================================================
import { Parser } from './budoux/parser.js';
import { model } from './budoux/ja.js';

const parser = new Parser(model);
const JA = /[぀-ヿ㐀-鿿]/;
// 中身に手を入れないタグ
const SKIP = new Set(['script', 'style', 'textarea', 'title', 'pre', 'code', 'svg', 'option', 'noscript']);

function breakText(text) {
  if (!JA.test(text)) return text;
  // &amp; などの文字参照を1文字として扱うため、一時的に私用文字に置き換える
  const ents = [];
  const plain = text.replace(/&#?\w+;/g, (m) => { ents.push(m); return String.fromCharCode(0xe000 + ents.length - 1); });
  // 「企画・運営」のように中黒でつながる言葉は、中黒の直後では区切らない
  const chunks = parser.parse(plain).reduce((acc, c) => {
    if (acc.length && /[・＆&]$/.test(acc[acc.length - 1])) acc[acc.length - 1] += c;
    else acc.push(c);
    return acc;
  }, []);
  const out = chunks.join('<wbr>');
  return out.replace(/[-]/g, (c) => ents[c.charCodeAt(0) - 0xe000]);
}

export function addPhraseBreaks(html) {
  const bodyAt = html.search(/<body[\s>]/i);
  if (bodyAt < 0) return html;
  const head = html.slice(0, bodyAt);
  const parts = html.slice(bodyAt).split(/(<[^>]*>)/);
  const stack = [];
  // data-nobreak や class="nb" を付けた要素の中（流れる文字など、改行させないところ）も手を入れない
  let nb = null; // { name, depth }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (p[0] === '<') {
      const m = p.match(/^<(\/?)([a-zA-Z][\w-]*)/);
      if (!m) continue;
      const name = m[2].toLowerCase();
      const selfClose = p.endsWith('/>') || name === 'wbr' || name === 'br' || name === 'img' || name === 'input' || name === 'meta' || name === 'link' || name === 'source' || name === 'hr';
      if (nb) {
        if (name === nb.name && !selfClose) nb.depth += m[1] ? -1 : 1;
        if (nb.depth === 0) nb = null;
      } else if (!m[1] && !selfClose && (/\sdata-nobreak[\s=>]/.test(p) || /\sclass="(?:[^"]*\s)?nb(?:\s[^"]*)?"/.test(p))) {
        nb = { name, depth: 1 };
      }
      if (SKIP.has(name) && !selfClose) {
        if (m[1]) { const k = stack.lastIndexOf(name); if (k >= 0) stack.splice(k, 1); }
        else stack.push(name);
      }
      continue;
    }
    if (!stack.length && !nb) parts[i] = breakText(p);
  }
  return head + parts.join('');
}
