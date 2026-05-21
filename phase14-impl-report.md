# Phase 14 実装レポート

## 実施日時
2026-05-27

## ビルド結果
成功（TypeScript エラーなし、`npm run build` 通過）

---

## 実装内容

### A-1: Split Ratio Preset Buttons（Wave Terminal v0.14.5 showsplitbuttons）✅

- `Terminal.tsx` ツールバーに3ボタン追加: `[3:7]` `[5:5]` `[7:3]`
- `useSessionStore` から `splitRatio` / `setSplitRatio` を取得
- アクティブ状態: 現在の `splitRatio` と最も近いプリセット（誤差 0.05 以内）をハイライト
- スタイル: border 1px, radius-sm, font-mono, Cyber-Minimal

**変更ファイル**: `src/renderer/src/components/Terminal.tsx`

---

### A-2: ProcessViewer ソート可能カラム＋プロセスシグナル（Wave Terminal v0.14.5）✅

- `process:list` PowerShell コマンドに `@{n='pid';e={$_.Id}}` を追加（最大 80 プロセスに増加）
- 新 IPC `process:kill`: `Stop-Process -Id <pid> -Force` を実行
- preload に `killProcess(pid: number): Promise<boolean>` を追加
- `ProcessInfo` に `pid?: number` を追加（api.d.ts + preload）
- `ProcessViewer.tsx`:
  - `sortKey` / `sortAsc` state でカラムヘッダクリック時のソート
  - ↑↓ ⇅ ソートインジケータ（アクティブカラムはアクセントカラー）
  - 行ホバーで Kill ボタン（⊗）表示 → `window.api.killProcess(pid)` 呼び出し
  - 終了中プロセスを opacity 0.4 でフェード

**変更ファイル**: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/types/api.d.ts`, `src/renderer/src/components/ProcessViewer.tsx`

---

### A-3: Mermaid ダイアグラムレンダリング（Warp Terminal 参考）✅

- `mermaid` npm パッケージをインストール
- `ChatPane.tsx` に `MermaidBlock` コンポーネントを追加
  - `mermaid.initialize()` で Cyber-Minimal ダークテーマ設定（accent `#d97757`）
  - `useEffect` で `mermaid.render()` を非同期呼び出し → SVG を `dangerouslySetInnerHTML` で描画
  - エラー時: `status-error` カラーのエラーメッセージ
  - ローディング中: `...` プレースホルダー
- `mdComponents.code` に `language-mermaid` 分岐を追加

**変更ファイル**: `src/renderer/src/components/ChatPane.tsx`, `package.json`

---

### A-4: タブ右クリックコンテキストメニュー（Wave Terminal B-3）✅

- `LeftPanel.tsx` に `ContextMenu` 型・`contextMenu` state を追加
- 各タブに `onContextMenu` ハンドラ（`e.preventDefault()` + state 設定）
- 絶対配置のドロップダウン: リネーム / デフォルトに戻す / バッジをクリア（ターミナルタブのみ）
- `ctx-fade` キーフレーム（scale + translateY フェードイン 0.08s）
- 外側クリック / Escape で自動閉じ

**変更ファイル**: `src/renderer/src/components/LeftPanel.tsx`

---

### A-5: ベル OS 通知（Wave Terminal v0.14.2 拡張）✅

- `main/index.ts`: `pty:bell` 受信時にウィンドウ非フォーカスであれば `new Notification({ title: 'clau-tamina', body: 'ターミナルベル' }).show()` を実行
- `Header.tsx`: 🔔 アイコンのアニメーションを `bell-pulse` キーフレームに変更（スケール + 揺れ + フェードアウト 3s）

**変更ファイル**: `src/main/index.ts`, `src/renderer/src/components/Header.tsx`
