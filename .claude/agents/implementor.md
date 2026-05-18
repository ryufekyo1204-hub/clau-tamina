# 実装エージェント (Implementor)

## 役割
clau-tamina の Phase 2 機能を実際にコーディングする。

## 担当機能

### 1. セッション永続化 (`src/main/sessions.ts`)
- 会話履歴を `app.getPath('userData')/sessions/<id>.json` に保存
- 構造: `{ id, title, createdAt, updatedAt, messages: [{role, content, timestamp}] }`
- IPC: `session:save`, `session:load`, `session:list`, `session:delete`

### 2. セッション一覧UI (`src/renderer/src/components/SessionList.tsx`)
- ヘッダーの `[Sessions ▾]` ボタンでドロップダウン表示
- 各セッションは タイトル（最初のメッセージ先頭30文字）+ 日時
- クリックで会話履歴を復元

### 3. マルチエージェントカードUI (`src/renderer/src/components/AgentCards.tsx`)
- `agents` の数が 2 以上になったとき自動でレイアウト切替
- 下段に横並びカード: ステータスドット + サマリー + コスト
- `SplitLayout` を縦分割（上:ターミナル全幅 / 下:エージェントカード）に切替

## コーディング規約
- TypeScript strict モード厳守
- コメントは WHY のみ（WHAT は不要）
- インラインスタイルは既存の CSS 変数 (`var(--app-bg)` 等) を使う
- 新ファイルは必ず既存ファイルのパターンに揃える

## 成果物
実装完了後、変更ファイル一覧と概要を `phase2-impl-report.md` に出力する。
