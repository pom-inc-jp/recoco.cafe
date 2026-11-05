# recoco.cafe

レコードカフェ RECOCO（渋谷・下北沢）のサイト。2026年11月に WordPress から静的サイトに切り替えて公開中。しくみは姉妹店の casse.cafe（と retopo.cafe・pom-inc.co.jp）と同じ。

```
node build.mjs           # dist/ に書き出す
node build.mjs --serve   # 書き出して http://localhost:8080 で確認
```

Node.js 18 以上だけで動く（npm install 不要）。

## ページ

| URL | 中身 |
| --- | --- |
| `/` | トップ（写真の切り替え・お知らせ・ABOUT・楽しみ方・料金・メニューの抜粋・ご利用案内・店内の様子・お客さまの声・店舗・アクセス（2店舗）・アーティストとのコラボ） |
| `/menu/` | メニューと料金（2店舗共通。旧メニューPDFのQRコードの転送先） |
| `/news/` | お知らせ一覧（カテゴリで絞り込み） |
| `/news/記事ID/` | お知らせの記事（本文がある記事だけ） |
| `/shooting/` | 撮影・取材・コラボのご依頼（渋谷店のみ） |
| `/gallery/` | ギャラリー（店舗で絞り込み・拡大表示） |
| `/voice/` | お客さまの声 |
| `/en/` | 英語の案内（トップと同じ部品で、英語の言葉を入れたもの）。メニューは `/menu/` を日英共通で使う |

英語のページは `/en/` だけ。お知らせ一覧・記事・撮影・ギャラリー・お客さまの声の英語版はない。

## ファイル

| 場所 | 中身 |
| --- | --- |
| `src/_data/site.json` | 2店舗の情報（`stores`）・ナビ・トップの写真と文章・楽しみ方・料金・ご利用案内・ギャラリー・お客さまの声・撮影ページの文言と料金・フッター |
| `src/_data/menu.json` | メニューと価格（カテゴリごと） |
| `src/_data/news.json` | お知らせ |
| `src/_partials/` | 共通部品（head・ヘッダー・フッター・スマホのレコードプレーヤー型メニュー・写真の拡大表示）。`home-hero.html`・`home-body.html` はトップと英語ページで共通の本文（言葉は site.json の `ui` と各項目から言語ごとに入る） |
| `src/_templates/news-article.html` | お知らせ記事ページのひな形 |
| `src/pages/` | 各ページ |
| `src/assets/css/recoco.css` | 見た目（色は先頭の変数を使う） |
| `src/assets/js/recoco.js` | スマホのメニュー・写真の切り替え・お知らせとギャラリーの絞り込み・拡大表示・クリック計測 |
| `src/assets/img/photos/` | 写真（WebP）。`名前.webp` と、小さく出すとき用の `名前-400.webp` |
| `src/assets/img/common/` | ロゴ（PNG。加工しない）・シェア用の画像 `ogp.jpg` |
| `src/static/` | `.htaccess`・ファビコン・robots.txt など（dist/ 直下にコピー） |
| `lib/` | 日本語を文節で改行させる部品（`phrase.mjs` と BudouX）。casse.cafe と同じもの。BudouX は同梱の外部ライブラリなので書き換えない |

## 店の情報を変えるとき（`src/_data/site.json`）

同じ情報は1か所にだけ書く。書き出すときに、トップ・フッター・検索エンジン向けのデータへ配る。

| 変えたいもの | 直す場所 |
| --- | --- |
| 営業時間 | `stores` の各店の `opens`・`closes`・`lastOrder` |
| 住所 | `stores` の `zip`・`address`（表示）と `region`・`locality`・`street`（検索エンジン向け）。地図は `mapQuery` |
| 行き方 | `stores` の `access`（店舗・アクセス）と `accessShort`（トップの店舗カード） |
| 定休日・駐車場・JASRAC・Instagram | `stores` の `holiday`・`parking`・`jasrac`・`instagram` |
| 料金 | `charge.rows` の `prices`。注記は `charge.footnote` |
| 楽しみ方・ご利用案内 | `steps`・`info`。ご利用案内のアイコンは `icon`（build.mjs の `INFO_ICONS` の名前） |
| トップのメニュー抜粋 | `menuPreview.items` に menu.json の品名を書く。価格は menu.json から自動で引く（品名が見つからないと書き出しが止まる） |
| トップの写真 | `hero.photos`（約6秒ごとに切り替わる）・`about.photosA`／`photosB` |
| ナビの並び | `nav`（`fabOnly` はスマホのメニューだけ）。英語ページは `en.nav` |
| 渋谷店の個室 | `stores` の渋谷店の `privateRoom`（トップの ABOUT の下の緑の帯と、店舗・アクセスの「個室あり」）。写真ができたら `photo` に `{ "file": "…", "alt": "…", "altEn": "…" }` を書くと写真の枠が出る。料金の金額は書かない |
| 撮影ページ | `shooting`（並びは casse.cafe と同じ。`times`・`prices`・`minTime`・`priceNotes`・`flow`・`features`・`press`・`collabs` など）。問い合わせメールの件名と本文の項目は `mailSubject`・`mailItems` など | コラボ実績のカードに `news`（お知らせの id）を書くと、カードがその記事へのリンクになる（記事ページがない id だと書き出しが止まる）

## 英語ページ（`/en/`）

トップと同じ部品を使い、言葉だけを英語にしている。英語は、日本語の項目と同じところに `項目名En` で書く（例：`steps` の `title` と `titleEn`、`info` の `label` と `labelEn`、写真の `alt` と `altEn`、`stores` の `nameEn`・`addressEn` など）。英語が抜けていると、書き出しが止まってどこが足りないかを知らせる。

- 英語ページに出さないもの：お知らせ（下の「営業日のお知らせ」を除く）・アーティストとのコラボ・撮影・取材・コラボへの入口・お客さまの声。ご利用案内で `jaOnly: true` の項目
- 見出しやボタンなどの言葉は `ui.ja`・`ui.en`、英語ページだけの文は `en`、フッターは `footer.en`
- メニューは `/menu/` を日英共通で使う（menu.json の `en`）

## メニューを変えるとき（`src/_data/menu.json`）

価格は税込の数字（`price`）。品名（`name`）を変えたら、トップの抜粋（site.json の `menuPreview.items`）も同じ名前に直す。カテゴリに `photo` を書くと見出しの下に写真が出る。

## 写真を足すとき

写真は WebP にして、大きい版と小さい版（横400px）の2枚を置く。

1. ファイル名を決める（半角英小文字・数字・ハイフン。例：`shibuya-counter`。店の写真は `shibuya-`・`shimokita-`、コラボは `collab-` で始める）
2. 2枚作る。Google の `cwebp` か、Python の Pillow で作れる

   ```
   # cwebp の場合（大きい版は長い辺を1600pxに。縦長なら -resize 0 1600）
   cwebp -q 80 -resize 1600 0 元の写真.jpg -o src/assets/img/photos/shibuya-counter.webp
   cwebp -q 78 -resize 400 0 元の写真.jpg -o src/assets/img/photos/shibuya-counter-400.webp
   ```

   ```
   # Pillow の場合
   python3 -c "from PIL import Image, ImageOps; im = ImageOps.exif_transpose(Image.open('元の写真.jpg')).convert('RGB'); b = im.copy(); b.thumbnail((1600, 1600)); b.save('src/assets/img/photos/shibuya-counter.webp', quality=80); im.resize((400, round(im.height * 400 / im.width))).save('src/assets/img/photos/shibuya-counter-400.webp', quality=78)"
   ```

   Claude に写真を渡せば、変換して置くところまで行う
3. 使う場所に名前を書く（`.webp` は付けない）
4. `node build.mjs` で書き出す。名前を書き間違えていると「写真が見つかりません」と出て止まる

## お知らせの書き方

`src/_data/news.json` の `items` に追加する。書き方は casse.cafe・pom-inc.co.jp と同じ。

| 項目 | 書き方 |
| --- | --- |
| id | 半角英小文字・数字・ハイフン。URL になる（`/news/michael-movie/`）。公開後は変えない。旧サイトの記事は旧URLの記事名とそろえている |
| date | `2026-12-01` の形（日が分からないときは `2026-12`） |
| store | いつも `"recoco"` |
| genre | `announce`（お知らせ）`press`（メディア掲載）`collab`（コラボ）`campaign`（イベント）`other`（その他） |
| title | 一覧と記事の見出し。`short` を書くと、パンくずと前後の記事のリンクではそちらを使う |
| image | 一覧の小さな写真（photos のファイル名）。ないときは女の子のロゴの枠になる。記事のシェア画像にも使う |
| body | 本文。書いた記事だけ記事ページができる（ない記事は一覧に見出しだけを出す）。文字だけの行は段落。`img`（`photo` に写真の名前）・`photos`（3枚並べる）・`table`（項目と内容の表）・`h2`・`ul`・`note`（ご注意の枠。`items` に箇条書き）・`credit`（小さな注記）・`buttons` が使える（build.mjs の `renderBlock` を参照） |

### 営業日のお知らせを英語でも出すとき

年末年始の営業や臨時休業など、営業日・営業時間のお知らせ（`genre` が `announce`）だけ、英語を添えられる。ほかの種類は英語にしない。

- `titleEn`（英語の見出し）と `bodyEn`（英語の本文。`body` と同じ書き方）を書く
- 記事ページでは、日本語の本文の下に英語の枠が続き、上に「English below」のボタンが出る（英語だけの別ページは作らない）
- 英語ページ（`/en/`）のお知らせ欄に、新しいものから3件まで出る。記事ページがあれば英語の部分（`/news/記事ID/#en`）につながる

`genre` が `announce` 以外の記事は、pom-inc.co.jp のお知らせにも自動で載る（書き出し時に `/news.json` を公開し、会社サイトが読みに来る）。`/news.json` の本文は、会社サイトが読める基本の種類（p・img・note など）に書き換えて出す（photos は img を並べ、credit は p に）。本文のない記事は、会社サイトの一覧から RECOCO のお知らせ一覧へ直接リンクされる。

## 改行の位置（文節）

書き出しのとき `lib/phrase.mjs` が日本語を文節に区切り、切れ目に `<wbr>` を入れる（CSS は `word-break: keep-all`）。HTML に `<wbr>` を手で書かない。

- トップの流れる文字のように1行のまま見せる部分は、要素に `data-nobreak` を付ける（付け忘れると何行にも崩れる）
- 切りたくない語句は `<span class="nb">…</span>` で囲む

## 旧サイトからの転送（`src/static/.htaccess`）

- `/wp-content/uploads/` の中のPDF → `/menu/`（印刷物のQRコード対策。外さない）
- `/archives/news/記事名` → `/news/記事名/`（記事ページがないものはお知らせ一覧へ）
- `/archives/gallery` → `/gallery/`、`/archives/voice`（とその下） → `/voice/`
- そのほかの `/archives/...`・`/category/` などの一覧・`?p=123` → トップ
- `/feed` → `/feed.xml`、`/wp-sitemap*.xml` → `/sitemap.xml`
- `/wp-login.php`・`/wp-admin` など → 404
- 旧サイトの `/#access_map` はトップの `#access` に当たる（`#` 以降はサーバーに届かないので転送はしない）

## 公開

`.github/workflows/deploy.yml`。中身は店舗サイト共通のワークフロー（[pom-inc-jp/site-tools](https://github.com/pom-inc-jp/site-tools) の `deploy-static.yml@v1`）で、ここには動かすタイミングと、RECOCOだけの設定（残すファイル・切り替えの変数）だけを書いている。`main` に変更が入ると書き出し、Xserver の公開フォルダへ rsync で反映する。

- 公開先の接続情報は組織（pom-inc-jp）の Secrets を使う（site-tools の README）。このリポジトリの環境 `production` に同じ名前の Secrets があると、そちらが優先される
- 変数 `RECOCO_LIVE` が `true` のときは、`main` に入るたび、と毎日 3:20（日本時間）に反映する。`true` でないあいだは「試し（dry-run）」だけで、消えるファイルの一覧を実行結果に出す。そのあいだに反映するときは、Actions → 公開 → Run workflow で mode を `deploy` にする（その1回だけ反映）
- 2026年11月時点では、本番に反映済みだが `RECOCO_LIVE` はまだ `true` にしておらず、マージのたびに手動で反映している（STATUS.md）
- 消さないもの：`recoco_movie_app/` など `_movie_app` で終わるフォルダ、`movie/`・`movie_app/`、mp4 が入っているフォルダ、`.well-known/`、`wp-content/uploads/`、検索エンジンの確認ファイル（`google*.html`・`BingSiteAuth.xml`）、`.user.ini`（Xserver の PHP 設定。動画アプリが使うことがある）
- pom-inc.co.jp の `newsSources` に recoco.cafe を追加済み。Search Console でのサイトマップ（`https://recoco.cafe/sitemap.xml`）の送信は STATUS.md で管理

## 計測（Googleタグマネージャー → GA4）

`site.json` の `gtmId`（GTM-5FQ27XG8。旧サイトの Site Kit と同じコンテナ）のタグを全ページに入れている（空にすると入らない）。サイトは `dataLayer` に次の2種類を送る（`src/assets/js/recoco.js`）。

| イベント | いつ | 項目 |
|---|---|---|
| `link_click` | Instagram・地図・メール・外部サイトへのリンクを押したとき | `link_type`（instagram / map / mail / external）・`link_place`・`link_url`・`link_store`（shibuya / shimokita / recoco） |
| `click_cta` | 主なボタン・メニューなどを押したとき | `cta_name`（下の表）・`cta_label`・`cta_place`・`cta_url`・`cta_store` |

| cta_name | どこ |
|---|---|
| shoot_entry / press_entry / collab_entry | トップの「撮影について」「取材について」「コラボ・貸切」 |
| shoot_anchor / press_anchor / collab_anchor | 撮影ページ冒頭のボタン |
| shoot_mail / press_mail / collab_mail | 撮影ページの問い合わせボタン |
| sister_shooting | 撮影ページの CASSE への案内 |
| gallery_open / gallery_prev / gallery_next / gallery_thumb / gallery_filter | ギャラリー・撮影ページの写真 |
| menu_all / menu_chip | トップの「メニューをすべて見る」／メニューページの目次 |
| news_more / news_filter | お知らせ一覧へ／カテゴリの絞り込み |
| news_item | お知らせの各記事（トップ・一覧） |
| store_card | トップ写真の下の店舗カード（`cta_store` に shibuya / shimokita） |
| room_access | 渋谷店の個室の帯の「渋谷店のアクセス」 |
| collab_item | トップのアーティストとのコラボの各カード |
| collab_card | 撮影ページのコラボ実績のカード（記事があるもの） |
| hero_dot / hero_swipe | トップ写真の点を押した／スマホで左右にスワイプした（`cta_label` に next / prev） |
| collab_more / gallery_more / voice_more | トップの各「見る」リンク |
| nav_header / nav_fab / fab_toggle | 上のメニュー／スマホのレコードプレーヤー型メニュー（中のリンク・開け閉め） |
| lang_switch | JP / EN の切り替え |
| logo_header / logo_footer / to_top_fab | ロゴ・右下の「上へ戻る」丸ボタン |
