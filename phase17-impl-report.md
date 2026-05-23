# Phase 17 実装レポート

## 実施日時
2026-05-23

## 実装機能

### A-1: ChatPane インラインコードの file path linkification ✅
- `FILE_PATH_RE` 正規表現でファイルパスを検出（スラッシュを含む `.ts`, `.tsx`, `.py` 等）
- `mdComponents.code` の inline コード分岐でパターンマッチ時に `<button>` としてレンダリング
- クリックで `window.api.ptyInput(path)` を呼んでターミナルにパスを貼り付け
- スタイル: `var(--accent)` 色 + dotted underline、hover 時に `accent-hover` + `border-accent`

### A-2: コードブロックに「→TERM」ボタン ✅
- `TermButton` コンポーネントを追加（CopyButton の隣）
- クリックでコードブロック全体を `window.api.ptyInput(text)` でターミナルに貼り付け
- 自動実行しないので安全（ユーザーが Enter で確認）
- `pasted` state で 1.5 秒間 `→OK` フィードバックを表示
- コードブロックの `paddingRight` を `52px → 108px` に拡張してボタンと重ならないように調整

### A-3: メッセージタイムスタンプを hover-only に変更 ✅
- Phase 15 では assistant メッセージのみ常時表示していたタイムスタンプを hover-only に変更
- `hovered` state（copy ボタン用、既存）を共有して条件表示
- user/assistant 両方のメッセージで `hovered` 時に表示
- `ts-fade` キーフレーム（opacity 0→1, 0.15s）でスムーズに出現

### A-4: RightPanel AI タブバッジ + Ctrl+Shift+B/C ショートカット ✅
- `useSessionStore` から `isQuerying` を取得して Claude AI タブに回転スピナーを追加
- スピナー: 8px 円弧（`border-top transparent` CSS トリック）、`rp-tab-spin 0.7s linear infinite`
- `Ctrl+Shift+B` → browser タブに切り替え
- `Ctrl+Shift+C` → chat タブに切り替え
- ShortcutsOverlay に2ショートカットを追記

### A-5: ターミナルスクロールバックバッファサイズ設定 ✅
- `ApiSettings.scrollbackLines?: number` を型定義に追加
- SettingsModal の Terminal タブに `<select>` ドロップダウンを追加（1000/3000/5000/10000/30000 行）
- `window.api.setSetting('scrollbackLines', v)` で electron-store に保存
- Terminal.tsx の `setup()` で `getSettings()` から読み込み `new Terminal({ scrollback })` に適用
- デフォルト: 5000 行（xterm.js デフォルト 1000 より多く設定）

## ビルド結果
✅ TypeScript エラーなし（tsconfig.web.json / tsconfig.node.json）
✅ `npm run build` 成功
