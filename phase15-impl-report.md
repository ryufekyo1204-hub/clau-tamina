# Phase 15 実装レポート

## 実施日時
2026-05-22

## 実装サマリー

| 機能 | ファイル変更 | 状態 |
|---|---|---|
| A-1: Terminal Web Links (@xterm/addon-web-links) | package.json, Terminal.tsx, main/index.ts, preload/index.ts, api.d.ts | ✅ 完了 |
| A-2: Chat message search (Ctrl+Shift+G) | ChatPane.tsx | ✅ 完了 |
| A-3: Keyboard shortcuts overlay (Ctrl+? / ? button) | ShortcutsOverlay.tsx (new), Header.tsx, App.tsx | ✅ 完了 |
| A-4: Message timestamps (HH:mm, assistant only) | ChatPane.tsx (MessageBubble) | ✅ 完了 |
| A-5: Scroll-to-bottom sticky button | ChatPane.tsx | ✅ 完了 |

## 変更詳細

### A-1: Terminal Web Links
- `@xterm/addon-web-links@^0.12.0` を dependencies に追加・インストール
- `WebLinksAddon` をターミナル初期化時にロード
- リンクハンドラ: `window.api.openExternal(url)` 経由で `shell.openExternal()` を呼ぶ
- IPC 3層: `shell:open-external` を main/preload/api.d.ts に追加

### A-2: Chat message search
- `chatSearchOpen`, `chatSearchQuery`, `chatSearchInputRef` state 追加
- Ctrl+Shift+G でトグル、ESC で閉じる
- 検索バー: Cyber-Minimal スタイル（border-accent, font-mono, radius-sm）
- `filteredMessages`: query を含む messages のみ表示（大小文字区別なし）
- ChatPane header に 🔍 ボタン追加（アクティブ時 accent-subtle 背景）

### A-3: Keyboard shortcuts overlay
- 新規 `ShortcutsOverlay.tsx` コンポーネント作成
- 15 ショートカットを 4 カテゴリ（ナビゲーション/ターミナル/チャット/UI）に分類
- Cyber-Minimal: `code` タグにキーを表示（radius-sm, border-default, accent 色）
- Header に `?` ボタン追加（`onShortcutsClick` コールバック）
- App.tsx で `shortcutsOpen` state + Ctrl+? グローバルショートカット管理

### A-4: Message timestamps
- `MessageBubble` にアシスタントメッセージのみ HH:mm タイムスタンプを追加
- `text-xs`, `text-muted`, `font-mono`, `text-right` — 控えめな表示
- `msg.timestamp` は既存フィールドを使用（新規追加なし）

### A-5: Scroll-to-bottom sticky button
- `messagesScrollRef` + `onScroll` ハンドラで `isAtBottom` を管理
- `isAtBottom` が false のとき右下に絶対配置の `↓` ボタンを表示
- 自動スクロール (`scrollIntoView`) は `isAtBottom === true` のときのみ実行
- フェードインアニメーション `scroll-btn-fade` を追加

## ビルド結果
- `npx tsc --noEmit --skipLibCheck -p tsconfig.node.json` → エラーなし
- `npx tsc --noEmit --skipLibCheck -p tsconfig.web.json` → エラーなし
