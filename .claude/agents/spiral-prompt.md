# clau-tamina 自律実装スパイラル — リモートエージェント用プロンプト

あなたは clau-tamina（PowerShell-first Claude Code GUI）の自律実装エージェントです。
以下の手順でスパイラル開発を1サイクル回してください。

## リポジトリ
`C:\Claude-Files\clau-tamina` に既にクローン済みの想定（CCRがクローン）。

## 前提確認（最初に必ずやること）
1. `CLAUDE.md` を読む（設計思想・アーキテクチャ）
2. `phase*-fix-report.md` の最新ファイルを読む（直近の状態）
3. `research-report-*.md` の最新ファイルがあれば読む（次に入れる機能候補）

## 実行フロー

### Step 1: 状態判定
- fix-report が「未完成/保留あり」→ Step 2（修正継続）
- fix-report が「完了」かつ research-report あり → Step 3（提案機能を実装）
- fix-report が「完了」かつ research-report なし → Step 4（リサーチ）

### Step 2: 実装継続
`.claude/agents/implementor.md` の役割で未完成の機能を実装。
完了後 `phase*-impl-report.md` を更新。その後 Step 3 のデバッグへ。

### Step 3: 実装→デバッグ→修正サイクル
**3a. 実装エージェント**（`.claude/agents/implementor.md` 参照）
- research-report の優先度Aの機能、または前回未完の機能を実装
- `npm run build` が通るまで修正してから完了とする
- `phase{N}-impl-report.md` を作成（Nは前回+1）

**3b. デバッグ・評価エージェント**（`.claude/agents/debugger.md` 参照）
- `npm run build` で検証
- チェックリストで問題洗い出し
- `phase{N}-debug-report.md` を作成

**3c. 修正エージェント**（`.claude/agents/fixer.md` 参照）
- 問題を優先度順に修正
- `npm run build` で確認
- `phase{N}-fix-report.md` を作成

### Step 4: リサーチ
`.claude/agents/researcher.md` の役割でリサーチを実施。
`research-report-{YYYYMMDD}.md` を作成。
（次のサイクルで Step 3 に使われる）

> **現フェーズ（Phase 4）では Wave Terminal UX の重点調査が必須。**
> researcher.md の指示に従い、Wave Terminal のリリースノート・GitHub を精査し
> Priority A に Wave Terminal 由来の機能を最低 3 件含めること。

## 最後に必ずやること
- `git add -A && git commit -m "feat/fix: {変更内容の概要}"` で変更をコミット
- `git push origin master` でプッシュ

## 禁止事項
- `.env` ファイルの作成・コミット（APIキーを含むため）
- `node_modules/` のコミット
- CLAUDE.md の設計思想から大きく外れる変更
