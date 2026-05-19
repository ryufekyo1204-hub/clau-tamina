# Phase 9 デバッグレポート

## 実施日時
2026-05-19

## ビルド検証

`npm run build` 0 エラー。

---

## チェックリスト

### TypeScript 型整合性
- [x] `maxBudgetUsd`: `Settings`（main）/ `ApiSettings`（preload, api.d.ts）の3層で型一致
- [x] `cwdColorMap`: 同上3層で型一致
- [x] `onPtyBadgeUpdate(text: string, color?: string)`: preload と api.d.ts で一致
- [x] `onPtyBgUpdate(color: string)`: preload と api.d.ts で一致
- [x] `onPtyTabBell()`: preload と api.d.ts で一致
- [x] `SdkMessage.type` に `'prompt_suggestion'` を追加（preload + api.d.ts）
- [x] `SdkMessage.suggestion?: string` を追加（preload + api.d.ts）

### IPC 3層
- [x] `pty:bg-update`: pty-host → main → preload → renderer
- [x] `pty:badge-update` (+ color): pty-host → main → preload → renderer
- [x] `pty:tab-bell`: main → preload → renderer
- [x] `sdk:message` (prompt_suggestion): sdk-host → main → preload → renderer

### React コンポーネント
- [x] `LeftPanel`: `tabBadge` state / `useEffect` クリーンアップ関数 OK
- [x] `Terminal`: `bgColor` state / `useEffect` クリーンアップ OK
- [x] `Header`: `cwdColorMap` state / `useEffect` クリーンアップ OK
- [x] `ChatPane`: `promptSuggestion` / `setPromptSuggestion` OK
- [x] `SettingsModal`: `maxBudgetUsd` / `cwdColorMap` 初期値ロード OK

### 潜在的問題
- A-5 (maxBudgetUsd) の SDK ネイティブサポートなし: クライアント実装で代替。`message_delta` イベントの `usage.output_tokens` のみで推定するため精度に限界あり（入力コストを含まない）。完全実装は `@anthropic-ai/claude-code` SDK への移行時に対応。
- A-3 (promptSuggestion) のヒューリスティック: Claude の応答末尾に疑問文がない場合はサジェスチョン非表示。許容範囲内。
- `Header.tsx` の `onPtyCwdUpdate` コールバック内で `getSettings()` を呼ぶため CWD 変化のたびに IPC が発生するが、頻度は低く問題なし。

---

## 未解決の問題

なし。修正フェーズは不要。
