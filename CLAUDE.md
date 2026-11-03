# CLAUDE.md（recoco.cafe）

レコードカフェ RECOCO（渋谷・下北沢）のサイト。`src/` を編集し、`node build.mjs` で `dist/` に静的HTMLを書き出す。詳しい構成は README.md を参照。しくみは姉妹店の casse.cafe と同じ。

## 守ること

- `dist/` は直接編集しない。必ず `src/` を直す
- 店の情報（住所・行き方・営業時間・定休日・JASRAC・Instagram）・料金・ご利用案内・楽しみ方・撮影の料金と条件は `src/_data/site.json`、メニューと価格は `src/_data/menu.json` だけを直す。HTML に直書きしない。2店舗の情報は `site.json` の `stores` に1回だけ書く
- 色は `src/assets/css/recoco.css` 先頭の変数を使う。クリーム地・こげ茶の文字・RECOCOの赤（#A7242A）が基本。緑（#2F5D50）は渋谷店、赤は下北沢店の印にも使う。マスタード（#D9A441）は「コラボ」のタグだけ。ほかの色を足さない
- ロゴ画像（`src/assets/img/common/logo-ink.png`・`logo-cream.png`・`recoco-girl-red.png`・`girl.png`）は加工しない
- サーバーの `recoco_movie_app/`（名前が `_movie_app` で終わるフォルダすべて）・`movie/`・`movie_app/`、mp4 が入っているフォルダ、`wp-content/uploads/` は消さない・上書きしない（公開の設定で除外している。除外を外さない）
- 旧サイトのメニューPDF（`/wp-content/uploads/…pdf`）は印刷物のQRコードが指している。`.htaccess` の `/menu/` への転送を外さない
- 旧サイトの記事URL（`/archives/news/記事名`）は `.htaccess` で `/news/記事名/` に転送している。公開済みのお知らせの `id` は変えない
- WordPress のバックアップやデータベースのファイルをこのリポジトリに入れない
- 変更したら `node build.mjs` が成功することを確認し、`node build.mjs --serve` で見た目を確認する（スマホ幅も）
- 公開は `main` へのマージで自動的に行われる。本番に関わる変更は、管理者の承認（プルリクエストのレビュー）を経る

## 文章のトーン

- です・ます調で、落ち着いた言い回し。顔文字や記号の飾りは使わない
- 「日本初」は使わない
- 撮影は「場所の貸し出し」。撮影・制作を請け負うような書き方をしない
- 撮影で使われた雑誌は「〇〇の撮影に店内をご利用いただきました」と書く

## お知らせ

`src/_data/news.json` に追加する。`genre` が `announce` 以外（メディア掲載・コラボ・イベント・その他）は pom-inc.co.jp にも載る。`id` は公開後に変えない（URLになるため）。`body` を書いた記事だけ記事ページができる。
