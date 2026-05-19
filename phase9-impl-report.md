# Phase 9 実装レポート

## 実施日時
2026-05-19

## ビルド最終結果

成功（TypeScript エラーなし）

---

## 実装サマリー

### A-5: maxBudgetUsd コスト上限
- `src/main/index.ts`: `Settings` 型に `maxBudgetUsd?: number` を追加、`DEFAULT_SETTINGS` に `maxBudgetUsd: 0`
- `src/preload/index.ts`: `ApiSettings` に `maxBudgetUsd?: number` を追加
- `src/renderer/src/types/api.d.ts`: 同様に追加
- `src/main/index.ts`: `sdk:query` / `sdk:agent-query` ハンドラで `settings.maxBudgetUsd` を options に注入
- `src/sdk-host/sdkHost.mts`: ストリーム中に `message_delta.usage.output_tokens` からコスト推定し、上限超過時に abort + error メッセージ送信
- `src/renderer/src/components/SettingsModal.tsx`: 「全般」タブに数値入力欄（0=無制限）を追加

### A-1: OSC 9999 バッジ全機能対応（color フィールド + Bell タブバッジ）
- `src/pty-host/pty-host.ts`: `OSC_BADGE_RE` を `badge=<text>[;color=<hex>]` に拡張し `color` フィールドを送信
- `src/pty-host/pty-host.ts`: `processBgUpdateSequences` の後でも `processBadgeSequences` を適用（順序維持）
- `src/main/index.ts`: `badge-update` で `color` も転送、`bell` 受信時に `pty:tab-bell` も追加送信
- `src/preload/index.ts`: `onPtyBadgeUpdate` のコールバックに `color?: string` を追加、`onPtyTabBell` を追加
- `src/renderer/src/types/api.d.ts`: 同様に更新
- `src/renderer/src/components/LeftPanel.tsx`:
  - `TabBadge { text: string; color?: string }` interface を追加
  - `tabBadge` state を追加
  - `onPtyBadgeUpdate` / `onPtyTabBell` を購読
  - ターミナルタブ切り替え時に `setTabBadge(null)` でクリア
  - タブボタンに 8px バッジドットを表示（タブ非アクティブかつバッジあり時のみ）

### A-2: OSC 9998 ターミナル背景色変更
- `src/pty-host/pty-host.ts`: `OSC_BGSET_RE` を追加し `processBgUpdateSequences()` を実装、`pty.onData` の OSC パーサーチェーンに組み込む（`processCwdSequences` の後）
- `src/main/index.ts`: `bg-update` → `pty:bg-update` IPC に転送
- `src/preload/index.ts`: `onPtyBgUpdate(cb: (color: string) => void): () => void` を追加
- `src/renderer/src/types/api.d.ts`: `onPtyBgUpdate` を追加
- `src/renderer/src/components/Terminal.tsx`: `bgColor` state を追加、`onPtyBgUpdate` を購読し `containerRef` の `style.background` を更新（`transition: background 0.3s ease` 付き）

### A-4: CWD → ヘッダー色自動マッピング
- `src/main/index.ts`: `Settings` に `cwdColorMap?: Record<string, string>` を追加、`DEFAULT_SETTINGS` に `cwdColorMap: {}`
- `src/preload/index.ts` / `src/renderer/src/types/api.d.ts`: `ApiSettings` に `cwdColorMap?` を追加
- `src/renderer/src/components/Header.tsx`:
  - `cwdColorMap` state を追加
  - `onPtyCwdUpdate` を購読し CWD 変化時に `cwdColorMap` を参照してヘッダー背景色を自動更新
  - マッピングなし時はベースの `headerBackground` 設定に戻す
- `src/renderer/src/components/SettingsModal.tsx`:
  - 「全般」タブに「ディレクトリ別カラーマップ」セクションを追加
  - 既存エントリのカラーピッカー + 削除ボタンをリスト表示
  - 「現在の CWD を追加」ボタン実装

### A-3: promptSuggestions（クライアント実装）
- 注意: `@anthropic-ai/sdk` は `promptSuggestions` オプションをネイティブサポートしていない（`@anthropic-ai/claude-code` SDK 専用機能）。クライアント側ヒューリスティック実装で代替。
- `src/sdk-host/sdkHost.mts`: `extractPromptSuggestion()` を追加。Claude の応答の最後3文からクエスチョンマークを含む文を抽出し `prompt_suggestion` メッセージを送信
- `src/main/index.ts`: `prompt_suggestion` メッセージを `sdk:message` チャンネルに転送
- `src/renderer/src/types/api.d.ts`: `SdkMessage.type` に `'prompt_suggestion'` を追加、`suggestion?: string` フィールドを追加
- `src/preload/index.ts`: 同様に更新
- `src/renderer/src/store/session.ts`: `promptSuggestion: string` state、`setPromptSuggestion()` アクション、`handleSdkMessage` で `prompt_suggestion` を処理
- `src/renderer/src/components/ChatPane.tsx`:
  - `promptSuggestion` / `setPromptSuggestion` を Zustand から取得
  - 入力欄の上に `promptSuggestion` チップを表示（`var(--app-bg-elevated)` 背景、`var(--border-accent)` 枠）
  - クリックで `setInput(promptSuggestion)` + `setPromptSuggestion('')`
  - 新規送信時にも `setPromptSuggestion('')` でクリア

---

## OSC パーサー順序（最終）

1. `processClipboardSequences` (OSC 52)
2. `processBadgeSequences` (OSC 9999)
3. `processNotifySequences` (OSC 9, 777)
4. `processCwdSequences` (OSC 7)
5. `processBgUpdateSequences` (OSC 9998) ← 今回追加
6. `processProgressSequences` (OSC 9;4)
7. `processBellSequences` (スタンドアロン \x07)

---

## 未解決

なし。
