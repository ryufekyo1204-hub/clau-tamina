# Phase 15 デバッグレポート

## 実施日時
2026-05-22

## 検証項目

| チェック項目 | 結果 |
|---|---|
| `tsc --noEmit -p tsconfig.node.json` | ✅ エラーなし |
| `tsc --noEmit -p tsconfig.web.json` | ✅ エラーなし |
| IPC 3層整合性 (shell:open-external) | ✅ main/preload/api.d.ts すべて追加済み |
| WebLinksAddon: setup() スコープ内でロード | ✅ SearchAddon 直後に配置 |
| ChatPane: useCallback import 追加 | ✅ `handleMessagesScroll` に使用 |
| A-5 sticky button: position:relative 親 | ✅ ChatPane ルート div に追加 |
| ShortcutsOverlay: `open=false` 時 null return | ✅ |
| Cyber-Minimal 原則遵守 | ✅ radius-sm/md/lg, border 1px, font-mono labels, accent/cyan 2色のみ |

## 検出した問題

なし。

## 軽微な考慮事項

- `@xterm/addon-web-links` のクリック動作は Ctrl+Click（デフォルト）。
  Windows では Ctrl+Click が多くのアプリで「別タブ」の慣習。electron 環境で `openExternal` を直接呼ぶため問題なし。
- `isAtBottom` の閾値は 40px。長いメッセージが届いたとき正確に判定できるよう余裕を持たせている。
