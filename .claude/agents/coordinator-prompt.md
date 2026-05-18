# Phase 2 マルチエージェント実行プロンプト
# terminal で `claude` を起動した後、このプロンプトをそのまま貼り付ける

以下の手順で clau-tamina の Phase 2 実装を進めてください。

## エージェント構成
3つのサブエージェントを順番に起動してください:

### Agent 1: 実装エージェント
役割ファイル: `.claude/agents/implementor.md` を読み込み、以下を実装する:
1. `src/main/sessions.ts` — セッション永続化（保存・読込・一覧・削除）
2. `src/renderer/src/components/SessionList.tsx` — セッション一覧ドロップダウン
3. `src/renderer/src/components/AgentCards.tsx` — マルチエージェントカードUI
4. 既存の `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/App.tsx`,
   `src/renderer/src/store/session.ts` を必要に応じて修正する

実装完了後 `phase2-impl-report.md` を作成する。

### Agent 2: デバッグ・評価エージェント
役割ファイル: `.claude/agents/debugger.md` を読み込み:
- `phase2-impl-report.md` を参照して変更ファイルを確認
- `npm run build` を実行してビルドを検証
- チェックリストに基づいて問題点を洗い出す
- `phase2-debug-report.md` を作成する

### Agent 3: 修正エージェント
役割ファイル: `.claude/agents/fixer.md` を読み込み:
- `phase2-debug-report.md` の問題点を優先度順に修正
- 修正後 `npm run build` でビルド確認
- `phase2-fix-report.md` を作成する

## 完了条件
`npm run build` がエラーなく通り、`phase2-fix-report.md` が作成されていること。
