# Phase 7 デバッグレポート

## 実施日時
2026-05-19

## ビルド検証結果

`npm run build` 成功（エラーなし）。

---

## 検出した問題

| 問題ID | 重大度 | 概要 | 対処 |
|---|---|---|---|
| D-1 | 軽微 | `ProcessViewer.tsx` が `ProcessEntry` をインポートしていたが `api.d.ts` に未定義 | `ProcessEntry` インターフェースを `api.d.ts` に追加して修正済み |
| D-2 | 設計上の制限 | ベル検出で残留 `\x07` を除去するため、本来の BEL 音はターミナルに届かない | Bell の視覚インジケーターに特化した設計のため許容（xterm.js の bell スタイルは設定可能） |

---

## 検証チェックリスト

- [x] `npm run build` が通る
- [x] `src/pty-host/pty-host.ts` — OSC パーサー順序: clipboard → badge → notify → cwd → bell（正しい順）
- [x] `src/main/index.ts` — `clipboard` import 追加、`clipboard-write` / `bell` メッセージハンドラー追加
- [x] `src/preload/index.ts` — `onPtyBell` 追加
- [x] `src/renderer/src/types/api.d.ts` — `onPtyBell` + `ProcessEntry` 追加
- [x] `src/renderer/src/components/Header.tsx` — `bellVisible` state + `useEffect` 登録
- [x] `src/renderer/src/components/Terminal.tsx` — `rescaleOverlappingGlyphs: true` + ⊘ ボタン追加
- [x] IPC 3 層（main / preload / api.d.ts）の型整合

## 未解決

なし
