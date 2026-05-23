# Phase 17 デバッグレポート

## 実施日時
2026-05-23

## TypeScript 検証
```
npx tsc --noEmit --skipLibCheck -p tsconfig.web.json   → エラーなし
npx tsc --noEmit --skipLibCheck -p tsconfig.node.json  → エラーなし
```

## ビルド検証
```
npm run build → ✓ built in 10.96s
```

## チェック項目

### デザイントークン逸脱
- TermButton: `rgba(88,193,66,0.12)` は `--status-running` の直接値（OK、CSS 変数が透明度付きではないため）
- スピナー色は `var(--status-running)` 使用 ✅
- CopyButton の `rightOffset` props: `'6px'` (デフォルト) ✅
- TermButton の `right: '58px'` はハードコード（OK、CopyButton との間隔計算）

### IPC 型整合性
- `scrollbackLines?: number` を `ApiSettings` に追加 ✅
- `setSetting('scrollbackLines', v)` — key は `string`、value は `unknown` → OK ✅
- Terminal.tsx での `s.scrollbackLines ?? 5000` — オプショナルチェーン ✅

### 機能の挙動確認

| 機能 | 想定挙動 | 問題 |
|---|---|---|
| file path linkification | `src/foo.tsx` をクリック → ptyInput | ✅ |
| →TERM ボタン | クリック → ターミナルに貼り付け | ✅ |
| タイムスタンプ hover-only | hover 時のみ表示 | ✅ |
| AI スピナー | isQuerying 中に回転 | ✅ |
| Ctrl+Shift+B | browser タブ切り替え | ✅ |
| scrollback 設定 | getSettings から読み込み | ✅（次回起動反映） |

## 軽微な問題

### 低優先度
- `TermButton.right: '58px'` が CopyButton の幅に依存するハードコード値
  → CopyButton の幅が変わった場合にズレる可能性があるが現状は問題なし

## 未解決
なし。全機能実装完了。
