# Phase 16 実装レポート

## 実施日時
2026-05-22

## 実装サマリー

| 機能 | ファイル変更 | 状態 |
|---|---|---|
| A-1: Chat prompt history (Up/Down recall) | ChatPane.tsx | ✅ 完了 |
| A-2: Claude メッセージ hover copy ボタン | ChatPane.tsx | ✅ 完了 |
| A-3: チャット履歴クリア (CLR ボタン + Ctrl+Shift+Delete) | ChatPane.tsx | ✅ 完了 |
| A-4: ターミナルツールバー COPY/CLR ボタン | Terminal.tsx | ✅ 完了 |
| A-5: SplitLayout ディバイダー ダブルクリック → 50:50 リセット | SplitLayout.tsx | ✅ 完了 |

## 変更詳細

### A-1: Chat prompt history
- `promptHistoryRef` (useRef<string[]>) と `historyIdxRef` (useRef<number>) をローカルに保持
- `submit` 時に `promptHistoryRef.current.unshift(prompt)` し最大50件にトリム
- `onKeyDown` で `ArrowUp` → historyIdx++ してインプットを更新
- `ArrowDown` → historyIdx-- または -1 でクリア（新規入力に戻る）
- カーソルが position 0 またはテキスト空のときのみ history に入る

### A-2: Hover copy button
- `MessageBubble` に `hovered` / `copied` state を追加
- `onMouseEnter` / `onMouseLeave` で切り替え
- `!isUser && hovered` のときに absolute 配置の COPY ボタン表示
- `navigator.clipboard.writeText(msg.content)` でコピー、1.5s で COPIED → COPY に戻る
- `msg-copy-fade` アニメーション追加 (0.1s フェードイン)

### A-3: Clear chat
- clearMessages はすでに session store に実装済み → UI 追加のみ
- ChatPane ヘッダーに "CLR" ボタン追加（messages.length === 0 で disabled + opacity: 0.4）
- `Ctrl+Shift+Delete` グローバルショートカット追加
- クリア時に promptHistory + historyIdx もリセット
- ボタン色: `--status-error`（視覚的に "危険操作" を示す）

### A-4: Terminal COPY/CLR buttons
- `hasSelection` state: `term.onSelectionChange` で `!!term.getSelection()` を監視
- **COPY ボタン**: `hasSelection` が true のときのみ有効（opacity 1、cursor pointer）
  - `navigator.clipboard.writeText(term.getSelection())` でコピー
  - `selCopied` state: 1.2s 後に COPIED → COPY
- **CLR ボタン**: `window.api.ptyInput('\x0C')` で PowerShell に Ctrl+L を送信
- `onSelChange.dispose()` を cleanupRef に追加してメモリリーク防止

### A-5: Divider double-click reset
- SplitLayout のドラッグハンドル div に `onDoubleClick={() => setSplitRatio(0.5)}` を追加
- `title` 属性でユーザーにヒントを提供: "ダブルクリックで 50:50 リセット"
- アニメーション不要（setSplitRatio の結果として CSS トランジションが自然に適用）

### ShortcutsOverlay 更新
- Phase 16 の新ショートカット 3件を追加:
  - `↑ / ↓`: プロンプト履歴を呼び出す
  - `Ctrl+Shift+Delete`: チャット履歴をクリア
  - `ダブルクリック(仕切)`: ペイン比率を 50:50 にリセット

## ビルド結果
- `npx tsc --noEmit --skipLibCheck -p tsconfig.node.json` → プリエグジスティングエラーのみ（@types/node 未インストール環境）
- `npx tsc --noEmit --skipLibCheck -p tsconfig.web.json` → プリエグジスティングエラーのみ（react パッケージ未インストール環境）
- 変更ファイルに新規 TypeScript エラーなし
