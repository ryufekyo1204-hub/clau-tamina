# Phase 6 デバッグレポート

## 実施日時
2026-05-19

## ビルド検証結果

```
npm run build → 成功（TypeScript エラーなし）
```

---

## チェックリスト

| 項目 | 結果 |
|---|---|
| `npm run build` 成功 | ✅ |
| TypeScript strict エラーなし | ✅ |
| `any` 型使用なし（新規追加コード） | ✅ |
| IPC チャンネル名の3層一致（main/preload/api.d.ts） | ✅ |
| ipcMain.handle / ipcRenderer.invoke の対応 | ✅ |
| ipcMain.on / ipcRenderer.send の対応 | ✅ |
| cleanup 関数の登録（useEffect return） | ✅ |
| OSC RegExp の `lastIndex` リセット | ✅ |
| `decodeURIComponent` の例外ハンドリング | ✅ |
| `Notification.isSupported()` チェック | ✅ |
| `dialog` / `writeFile` の import 追加 | ✅ |

---

## 発見した問題

### D-1: Terminal.tsx の useEffect が async 化された副作用

**内容:** `setup()` async IIFE パターンに切り替えたため、`cleanupRef.current` の設定が Promise 解決後になる。React の StrictMode では2回マウントされるが、`disposed` フラグによって2回目の setup は中断される。

**影響:** 開発環境の StrictMode でのみ潜在的な問題。プロダクションビルドでは問題なし。

**対処:** `disposed` フラグと `cleanupRef.current` の適切なリセット（`termRef.current = null`, `fitRef.current = null`）を追加済み。

### D-2: カーソル設定の動的更新なし（設計上の制限）

**内容:** `cursorStyle`/`cursorBlink` は Terminal 初期化時のみ適用。設定変更後はターミナル再起動が必要（Settings モーダルにその旨を明記）。

**影響:** UX 上の軽微な制限。xterm.js は `term.options.cursorStyle` を動的更新すると WebGL アドオンとの相性問題が出るリスクがあるため、初期化時のみとした。

**対処:** SettingsModal に「次回ターミナル起動時に適用されます」の注釈を追加済み。

---

## 未解決

なし
