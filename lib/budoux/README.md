# BudouX（文節で改行するための日本語モデル）

Google の BudouX v0.6.4（Apache License 2.0）から `parser.js` と日本語モデル `ja.js` だけを取り出して置いています。
書き出し時に日本語の文を文節に区切り、区切り位置に `<wbr>` を入れるために使います（`lib/phrase.mjs`）。

- 出典: https://github.com/google/budoux
- ライセンス: Apache License 2.0（https://www.apache.org/licenses/LICENSE-2.0）
- 著作権表示: Copyright 2021 Google LLC

更新するときは、npm の `budoux` パッケージの `module/parser.js` と `module/data/models/ja.js` を差し替えます。
