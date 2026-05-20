# リサーチレポート 2026-05-26

## 調査方法
Phase 12 fix-report（全 A 機能完了）を受け、前回 research-report-20260525.md の
Priority B 機能を昇格させつつ、新規 UX ギャップを調査・追加。

---

## 提案機能一覧

### 優先度A（Phase 13 で実装）

#### A-1: ChatPane Markdown レンダリング + コードブロック構文ハイライト

- **概要**: `react-markdown` + `remark-gfm` を導入し、Claude 応答を Markdown として描画する。コードブロックには `<pre><code>` スタイルのシンタックスハイライト（Cyber-Minimal ダークテーマ）とコピーボタンを追加。テーブル・太字・斜体・インラインコードも対応。
- **根拠**: 現在 `<pre style="whiteSpace: pre-wrap">` でプレーンテキスト表示。Warp Terminal がオープンソース化した Markdown レンダリングを参考に、ChatPane を大幅に見やすくする。Claude 応答の多くが Markdown 形式であるため UX インパクトが最大。
- **実装難易度**: 中
  - `npm install react-markdown remark-gfm`
  - `src/renderer/src/components/ChatPane.tsx`: `MessageBubble` の `displayContent` 描画を `<ReactMarkdown>` に切り替え。ユーザーメッセージはプレーンテキストのまま。
  - コードブロック: `<code>` を `<pre>` でラップし、Cyber-Minimal ダークテーマ（`var(--app-bg-elevated)` 背景 + `var(--term-bright-green)` テキスト）。右上にコピーボタン（クリックで `navigator.clipboard.writeText`）。
  - 既存の折りたたみ機能（300文字超）との共存: `ReactMarkdown` を `collapsed` ステートに基づき部分描画。
- **CLAUDE.md との整合性**: OK（Warp Terminal UX 参考）

---

#### A-2: Electron 37 `-electron-corner-smoothing` CSS

- **概要**: Electron v37 の新 CSS プロパティ `-electron-corner-smoothing: system-ui` を全要素に適用し、角丸を Apple/Windows の連続曲線（スクワークル形状）にする。macOS で特に効果的。
- **根拠**: B-1 から昇格。前回 `roundedCorners: true` (Electron 36) を実装済み。今回は CSS レイヤーでの角丸改善を追加し、UI の質感を向上させる。
- **実装難易度**: 極低（CSS 1行）
  - `src/renderer/src/styles/globals.css`: `* { -electron-corner-smoothing: system-ui; }` を追加。
- **CLAUDE.md との整合性**: OK（Electron 37 新機能）

---

#### A-3: Terminal Find/Search（`@xterm/addon-search` + Ctrl+Shift+F）

- **概要**: `@xterm/addon-search` を使い、ターミナルペインにテキスト検索機能を追加する。Ctrl+Shift+F で Cyber-Minimal スタイルの検索オーバーレイが表示される。前後ナビゲーション（↑↓ またはボタン）、ヒット件数表示、Escape で閉じる。
- **根拠**: Wave Terminal の find-in-terminal 機能の直接移植。ターミナル出力からエラーメッセージ・パスを検索する操作は PowerShell ユーザーに必須。現状 xterm.js の SelectAll → Ctrl+F（ブラウザ）しか手段がなく不便。
- **実装難易度**: 低〜中
  - `npm install @xterm/addon-search`
  - `src/renderer/src/components/Terminal.tsx`: `SearchAddon` を初期化し `term.loadAddon(searchAddon)`。`searchAddonRef` で保持。
  - `Ctrl+Shift+F` キーイベントで `setSearchOpen(true)` → 検索オーバーレイを表示。
  - 検索オーバーレイ: 絶対配置、右上 or 上部中央。`input` + 「↑ 前へ」「↓ 次へ」「✕」ボタン。`searchAddon.findPrevious()` / `findNext()`。
  - ハイライト色: `decorations: { matchBackground: 'rgba(217,119,87,0.4)', activeMatchBackground: 'rgba(217,119,87,0.7)' }`
- **CLAUDE.md との整合性**: OK（Wave Terminal find 機能踏襲）

---

#### A-4: チャット履歴 Markdown エクスポート

- **概要**: ChatPane ヘッダーに「📄 エクスポート」ボタンを追加し、現在の会話履歴を Markdown ファイルとして保存できるようにする。Electron の `dialog.showSaveDialog` を使い保存先を選択。
- **根拠**: セッション保存機能（JSONL）は実装済みだが、人間が読める形式でエクスポートする手段がない。ChatGPT エクスポートのような基本的な UX 期待に応える。
- **実装難易度**: 低
  - `src/main/index.ts`: `ipcMain.handle('chat:export', async (_, content: string) => { const { filePath } = await dialog.showSaveDialog(...); if (filePath) writeFileSync(filePath, content, 'utf-8'); })`
  - `src/preload/index.ts`: `exportChat(content: string): Promise<string | null>` を追加
  - `src/renderer/src/types/api.d.ts`: 型定義を追加
  - `src/renderer/src/components/ChatPane.tsx`: ヘッダーにエクスポートボタン追加。メッセージ配列を `# clau-tamina Chat Export\n\n## User\n{content}\n\n## Claude\n{content}\n` 形式で Markdown 文字列化して IPC に渡す。
- **CLAUDE.md との整合性**: OK（ユーザー要望の高い機能）

---

#### A-5: カスタムシステムプロンプト設定

- **概要**: SettingsModal に「AI」タブを追加し、SDK に渡すシステムプロンプトをユーザーが自由に編集できるようにする。デフォルトは現在 `sdkHost.mts` にハードコードされているもの。変更は `electron-store` に永続化。
- **根拠**: ユーザーが特定の役割（テスト専門家・Rust エンジニア等）をデフォルト設定したい場合に対応する。sdkHost でのシステムプロンプトが現在ハードコードされており、柔軟性がない。
- **実装難易度**: 中
  - `src/main/index.ts`: `Settings` に `systemPrompt?: string` を追加。
  - `src/preload/index.ts` + `api.d.ts`: `ApiSettings.systemPrompt` を追加。
  - `src/renderer/src/components/SettingsModal.tsx`: 新タブ「AI」を追加。`<textarea>` でシステムプロンプトを編集。保存時 `window.api.setSetting('systemPrompt', value)`。
  - `src/renderer/src/components/ChatPane.tsx`: `sdkQuery` オプションに `systemPrompt` を含める（`window.api.getSettings()` から取得済みの値を渡す）。
  - `src/sdk-host/sdkHost.mts`: `options['systemPrompt']` が存在する場合はそれを優先使用。
- **CLAUDE.md との整合性**: OK（パワーユーザー向けカスタマイズ）

---

### 優先度B（将来サイクル候補）

#### B-1: Wave Terminal `showsplitbuttons` — ターミナルヘッダーに分割ボタン
- `SplitLayout` の比率を動的に変更するボタン群
- 実装難易度: 中

#### B-2: OSC 1337 インライン画像表示（iTerm2 互換）
- xterm.js カスタムレンダーレイヤーが必要
- 実装難易度: 高

#### B-3: Tab context menu（右クリック → 閉じる/複製/保存）
- LeftPanel に ContextMenu を追加
- 実装難易度: 低〜中

#### B-4: Warp 式 Markdown テーブル・Mermaid 図レンダリング
- A-1 完了後に追加で `@mermaid-js/mermaid` 等を導入
- 実装難易度: 中

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| SSH Durable Sessions | スコープ外 |
| Warp Cloud Agents | SaaS 連携のためスコープ外 |

---

## 参考リンク

- [react-markdown GitHub](https://github.com/remarkjs/react-markdown)
- [remark-gfm](https://github.com/remarkjs/remark-gfm)
- [@xterm/addon-search](https://www.npmjs.com/package/@xterm/addon-search)
- [Electron 37 Blog Post](https://www.electronjs.org/blog/electron-37-0)
- [Wave Terminal find-in-terminal](https://github.com/wavetermdev/waveterm)
