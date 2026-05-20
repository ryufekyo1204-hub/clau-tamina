# Phase 13 実装レポート

## 実施日時
2026-05-20

## ビルド結果
成功（TypeScript エラーなし、`npm run build` 通過）

---

## 実装内容

### A-1: ChatPane Markdown レンダリング + コードブロック構文ハイライト ✅

- `react-markdown` + `remark-gfm` をインストール
- `MessageBubble` の Claude 応答描画を `<ReactMarkdown>` に切り替え
- `CopyButton` コンポーネント: コードブロック右上に COPY/COPIED ボタン
- カスタム `mdComponents`: code ブロック・インラインコード・テーブル・引用・リスト・見出し・水平線・リンクを Cyber-Minimal スタイルで描画
- ユーザー発言は従来どおり `whiteSpace: pre-wrap` のまま
- 既存の折りたたみ機能（300文字超）との共存: ReactMarkdown を collapsed state に基づき部分描画

**変更ファイル**: `src/renderer/src/components/ChatPane.tsx`

---

### A-2: Electron 37 `-electron-corner-smoothing: system-ui` ✅

- `src/renderer/src/styles/globals.css` の `*` セレクタに `-electron-corner-smoothing: system-ui` を追加
- macOS で角丸がスクワークル形状になる。他 OS では no-op

**変更ファイル**: `src/renderer/src/styles/globals.css`

---

### A-3: Terminal Find/Search（`@xterm/addon-search` + Ctrl+Shift+F）✅

- `@xterm/addon-search` v0.16.0 をインストール
- `Terminal.tsx` に `SearchAddon` を組み込み
- Ctrl+Shift+F でトグル / Escape で閉じる
- Cyber-Minimal スタイルの検索オーバーレイ（ツールバー直下）
  - 入力欄・↑前へ・↓次へ・✕閉じる
  - マッチ色: `rgba(217,119,87,0.35)` / アクティブ: `rgba(217,119,87,0.75)`
  - 結果あり: `✓`（accent 色）/ なし: `—`（error 色）
- ツールバーに 🔍 ボタンを追加
- Enter で次へ / Shift+Enter で前へ

**変更ファイル**: `src/renderer/src/components/Terminal.tsx`

---

### A-4: チャット履歴 Markdown エクスポート ✅

- `src/main/index.ts`: `ipcMain.handle('chat:export', ...)` を追加（`dialog.showSaveDialog` + `writeFileSync`）
- `src/preload/index.ts`: `exportChat(content: string): Promise<string | null>` を追加
- `src/renderer/src/types/api.d.ts`: 型定義を追加
- `ChatPane.tsx` ヘッダーに「MD」ボタン追加
  - メッセージ配列を `# clau-tamina チャット履歴\n\n## ユーザー\n...\n\n## Claude\n...` 形式でエクスポート
  - メッセージが空の場合は無効化（`opacity: 0.4`）

**変更ファイル**: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/types/api.d.ts`, `src/renderer/src/components/ChatPane.tsx`

---

### A-5: カスタムシステムプロンプト設定 ✅

- `src/main/index.ts`: `Settings` に `systemPrompt?: string` を追加
- `src/preload/index.ts` + `api.d.ts`: `ApiSettings.systemPrompt` を追加
- `SettingsModal.tsx`:
  - `SettingsTab` に `'ai'` を追加
  - タブバーに「AI」タブを追加
  - AI タブ: `<textarea>` でシステムプロンプトを編集・`onBlur` で `setSetting('systemPrompt', ...)` を自動保存
  - デフォルトプロンプトをプレビュー表示（`status-waiting` カラーのラベル付き）
- `ChatPane.tsx`: useEffect でシステムプロンプトをロード、`sdkQuery` の options に `systemPrompt` を渡す
- `sdkHost.mts`: `options['systemPrompt']` があればそれを使い、CWD を付記。なければデフォルトを使用

**変更ファイル**: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/types/api.d.ts`, `src/renderer/src/components/SettingsModal.tsx`, `src/renderer/src/components/ChatPane.tsx`, `src/sdk-host/sdkHost.mts`
