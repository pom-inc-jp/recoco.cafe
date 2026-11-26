# いまの状況（recoco.cafe）

新しいチャットで作業を始めるときは、まずこのファイルを読む。作業が終わったら、この表を最新に書き換える。

最終更新：2026-11-26

## 公開の状態

| 項目 | 状態 |
| --- | --- |
| 本番 | 2026年11月に WordPress から切り替えて公開中。ただし変数 `RECOCO_LIVE` はまだ true ではなく、マージのたびに Run workflow（mode: deploy）で手動反映している |
| 公開のしくみ | site-tools の共通ワークフロー（`deploy-static.yml@v1`）。接続情報は組織の Secrets |
| 残すもの | `recoco_movie_app/` など `_movie_app` で終わるフォルダ、`movie/`・`movie_app/`、mp4 の入ったフォルダ、`.well-known/`、`wp-content/uploads/`、`google*.html`・`BingSiteAuth.xml`、`.user.ini` |
| ページ | トップ・`/menu/`（日英）・`/news/`・`/shooting/`・`/gallery/`・`/voice/`・`/en/` |
| お知らせ | 51件（2026-11-26「RECOCO渋谷 12月1日（火）短縮営業のお知らせ」（社内研修のため11:00-18:00。日英。カレンダーは受け取ったPDFを画像にして白い余白だけを切った `src/assets/img/news/20261126-shibuya-dec1-calendar.webp`、PC 330px・スマホ 260px）。ほかに、最新は 2026-11-21「RECOCO下北沢 年末年始休業のお知らせ」（カレンダーは `src/assets/img/news/20261121-shimokita-calendar.webp`、受け取った画像の左端の白い線だけを切ったもの。PC 330px・スマホ 260px）と 2026-11-26「RECOCO渋谷 年末年始休業のお知らせ」（カレンダーは `src/assets/img/news/20261126-shibuya-calendar.webp`、受け取ったスクリーンショットの端の黒い縁だけを切ったもの。PC 330px・スマホ 260px）。どちらも日英、休業明け以降も残す。11-20 に出した渋谷の同じお知らせ（12/1 の短縮営業の一文入り）は依頼者の指示で削除した）。`/news.json` を公開し、announce 以外を pom-inc.co.jp が取り込む（`newsSources` 追加済み） |
| 計測 | GTM `GTM-5FQ27XG8`（旧サイトの Site Kit と同じコンテナ）。`link_click`・`click_cta` を dataLayer に送る |

## やりかけ・次にやること

- [ ] `RECOCO_LIVE` を true にする（Settings → Secrets and variables → Actions → Variables）。true でないと、毎日の書き出し（お知らせの「NEW」を外す）が本番に反映されず、マージのたびに手動反映が必要
- [ ] Search Console でサイトマップ `https://recoco.cafe/sitemap.xml` を送信する（済んでいたらこの行を消す）
- [ ] ソニー公式グッズ（2026-05）・FREAK’S STORE（2025-09）のお知らせは日が分からず月だけ。分かったら news.json の `date` を日まで書く（コラボのカードの日付も自動で変わる）
- [ ] 渋谷店の個室の写真ができたら、`stores` の `privateRoom.photo` に書く

## 決めたこと

- アクセスは渋谷店「渋谷駅C1出口から徒歩4分」、下北沢店「下北沢駅東口から徒歩2分」
- 撮影・取材・コラボのご相談はメールで受ける（Instagram の DM では受けない）
- 渋谷店の個室の追加料金は金額を書かない
- 英語ページには営業日のお知らせ以外のお知らせ・コラボ・撮影・お客さまの声を出さない
- 本番に関わる変更は、プルリクエストを出して管理者の承認後にマージする
- 店舗・アクセスの店舗ごとの表に「席」の行は出さない（席の案内は「楽しみ方」と「ご利用案内」に書く。渋谷店の個室は店名の帯の「個室あり」で示す）

- 2026-11-20：お知らせの画像は、`img` に `width`（PC）・`widthSp`（スマホ）を書くと 4:3 に切り抜かずにその幅で出せる（セルフォト・CASSEと同じ）。受け取った画像は縮小・圧縮しない。差し替えるときはファイル名を変える

- コラボのカード（トップ・撮影ページ）の日付は、リンク先のお知らせの投稿日（`date`）から自動で入れる。site.json に日付を二重に書かない
- 店舗・アクセスの2店舗は subgrid で段をそろえ、表の行数が違っても地図とボタンの上辺がそろうようにする
- リンクに下線は付けない（マウスを重ねると赤くなる）。文字だけのリンク（フッター・パンくず）には線の矢印を添える（サイト内は →、外のサイトとメールは ↗、パンくずは ←）。例外はヘッダーのメニューで、いま見ているページの印として赤い下線を付ける
- 2026-11-22：川浦の判断で、「日本初」は RECOCO（各席にレコードプレーヤー）・CASSE（カセットテープカフェ）・RETOPO（Y2Kカルチャーをテーマにした平成体験型カフェ）にだけ使う、に全サイトでそろえた（それまではサイトごとに決まりが違っていた）

## 関連するサイト

| サイト | 管理 |
| --- | --- |
| pom-inc.co.jp | GitHub `pom-inc-jp/pom-inc.co.jp`。このサイトの `/news.json` を取り込む |
| casse.cafe | GitHub `pom-inc-jp/casse.cafe`。姉妹店。撮影ページから案内している |
| site-tools | GitHub `pom-inc-jp/site-tools`。公開のワークフロー |
