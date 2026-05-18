# Phase 3 実装レポート

## 実施日時
2026-05-19

## 実装概要

Phase 2 のビルドが完全に成功していることを確認（phase2-fix-report.md: 全問題解決）。
Phase 3 の優先機能を下記の通り実装した。

---

## 実装済み機能

### 1. ファイルブラウザパネル（新規）

**追加ファイル:**
- `src/renderer/src/components/FileTreePane.tsx` — ディレクトリ一覧UI
- `src/renderer/src/components/LeftPanel.tsx` — 左ペインのタブ切替ラッパー

**変更ファイル:**
- `src/renderer/src/App.tsx` — LeftPanel を SplitLayout の left に差し替え
- `src/main/index.ts` — `fs:list-dir` IPC ハンドラー追加（readdir + stat による安全なリスト）
- `src/preload/index.ts` — `listDirectory()` を expose、`FileEntry` インターフェース追加
- `src/renderer/src/types/api.d.ts` — `FileEntry` インターフェース追加、`listDirectory()` 追加

**機能詳細:**
- 左ペインに「ターミナル」「ファイル」タブを追加。切替後も PTY は常時マウント（PTY 状態を保持）
- ディレクトリ優先でアルファベット順ソート
- ▶ クリックでサブディレクトリへ移動、ファイルクリックでパスをクリップボードにコピー
- 「CWD」ボタンで現在表示ディレクトリを Claude AI の作業ディレクトリに設定（electron-store に即時保存）
- 上へ / 再読み込みボタン付き

### 2. BrowserPane お気に入り機能

**変更ファイル:**
- `src/renderer/src/components/BrowserPane.tsx`

**機能詳細:**
- `localStorage` に `clau-tamina:browser-favorites` キーで永続保存（次回起動時も維持）
- ★ / ☆ ボタンで現在ページをお気に入り追加/済み表示
- ≡ ボタンでお気に入りドロップダウンを表示（クリックでジャンプ、✕で削除）
- `page-title-updated` イベントでページタイトルを取得し、タイトルとURLをセットで保存

### 3. SettingsModal 完成（タブ付き強化版）

**変更ファイル:**
- `src/renderer/src/components/SettingsModal.tsx`

**変更詳細:**
- 「ターミナル」「ワークスペース」の2タブ構成に変更
- ターミナルタブ: フォントサイズ（10〜22px）、フォントファミリー（Hack追加）、左ペイン幅スライダー（20〜80%）
- ワークスペースタブ: CWD 入力＋「適用」ボタン（Enter でも確定）、権限モードのヒント表示
- CWD は `setCwd()` + `window.api.setSetting()` で Zustand・electron-store 両方に即時反映

### 4. 型定義の整合修正

**変更ファイル:**
- `src/renderer/src/types/api.d.ts`

**変更詳細:**
- `SdkMessage` に `agentId?`, `inputTokens?`, `outputTokens?` を追加（preload との差異を解消）
- `sdkAgentQuery()` / `onSdkAgentMessage()` を `ClauTaminaApi` インターフェースに追加

---

## ビルド結果

```
✓ main bundle:    out/main/index.js    (18.91 kB)
✓ preload bundle: out/preload/index.js (2.32 kB)
✓ renderer bundle: out/renderer/assets/index-ZOqCMZ7D.js (885.68 kB)
Built in 5.16s — TypeScript エラーなし
```

---

## 変更ファイル一覧

| ファイル | 種別 | 変更内容 |
|---|---|---|
| `src/renderer/src/components/FileTreePane.tsx` | 新規 | ファイルブラウザパネル |
| `src/renderer/src/components/LeftPanel.tsx` | 新規 | 左ペインタブラッパー |
| `src/renderer/src/App.tsx` | 変更 | LeftPanel 差し替え |
| `src/main/index.ts` | 変更 | fs:list-dir IPC ハンドラー |
| `src/preload/index.ts` | 変更 | listDirectory expose、FileEntry 型追加 |
| `src/renderer/src/types/api.d.ts` | 変更 | FileEntry、agent API 型追加 |
| `src/renderer/src/components/BrowserPane.tsx` | 変更 | お気に入り機能追加 |
| `src/renderer/src/components/SettingsModal.tsx` | 変更 | タブ付き強化版 |
