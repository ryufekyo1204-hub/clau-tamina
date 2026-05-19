# Phase 6 実装レポート

## 実施日時
2026-05-19

## ビルド結果
成功（TypeScript エラーなし、vite ビルド完了）

---

## 実装サマリー

### A-4: カーソルスタイルカスタマイズ（Wave Terminal v0.14.1 準拠）

**変更ファイル:**
- `src/main/index.ts`: `Settings` インターフェースに `cursorStyle: 'block' | 'bar' | 'underline'` と `cursorBlink: boolean` を追加。`DEFAULT_SETTINGS` に `cursorStyle: 'block', cursorBlink: true` を設定
- `src/preload/index.ts`: `ApiSettings` に同フィールドを追加
- `src/renderer/src/types/api.d.ts`: `ApiSettings` に同フィールドを追加
- `src/renderer/src/components/SettingsModal.tsx`: ターミナルタブに「カーソルスタイル」3択ボタン（ブロック/バー/アンダー）と「カーソル点滅」トグルボタンを追加。`window.api.setSetting` で即時永続化
- `src/renderer/src/components/Terminal.tsx`: `setup()` async IIFE 内で `window.api.getSettings()` を呼び出し、`cursorStyle`/`cursorBlink` を xterm.js Terminal 初期化オプションに適用

### A-1: Vim スタイルペインナビゲーション

**変更ファイル:**
- `src/main/index.ts`: `registerPaneShortcuts()` 関数を追加。`Ctrl+Shift+H` → `focus:terminal` IPC、`Ctrl+Shift+L` → `focus:chat` IPC を送信。`app.whenReady()` と `settings:set` 再登録処理の両方から呼び出し
- `src/preload/index.ts`: `onFocusTerminal(cb)` / `onFocusChat(cb)` を追加（IPC チャンネル `focus:terminal` / `focus:chat`）
- `src/renderer/src/types/api.d.ts`: `ClauTaminaApi` に `onFocusTerminal` / `onFocusChat` を追加
- `src/renderer/src/components/Terminal.tsx`: `setup()` 内で `window.api.onFocusTerminal(() => term.focus())` を登録
- `src/renderer/src/components/ChatPane.tsx`: `useEffect` で `window.api.onFocusChat(() => textareaRef.current?.focus())` を登録

### A-2: OSC 9 デスクトップ通知

**変更ファイル:**
- `src/pty-host/pty-host.ts`: `processNotifySequences()` 関数を追加。OSC 9 (`\x1b]9;<msg>\x07`) と OSC 777 (`\x1b]777;notify;<title>;<body>\x07`) を検出し、`process.parentPort.postMessage({ type: 'notify', title, body })` を送信。シーケンスを出力から除去
- `src/main/index.ts`: `electron` から `Notification` を import。`ptyProcess.on('message')` ハンドラーに `notify` 分岐を追加し、`Notification.isSupported()` 確認後に `new Notification({ title, body }).show()` を呼び出し

**使い方の例:**
```powershell
npm run build; printf "\033]9;ビルド完了\007"
```

### A-3: OSC 7 CWD 自動トラッキング

**変更ファイル:**
- `src/pty-host/pty-host.ts`: `processCwdSequences()` 関数を追加。OSC 7 (`\x1b]7;file://hostname/path\x07`) を検出し、`decodeURIComponent()` でパスをデコードして `process.parentPort.postMessage({ type: 'cwd-update', cwd })` を送信。シーケンスを除去
- `src/main/index.ts`: `ptyProcess.on('message')` ハンドラーに `cwd-update` 分岐を追加し、`mainWindow.webContents.send('pty:cwd-update', m.cwd)` で転送
- `src/preload/index.ts`: `onPtyCwdUpdate(cb: (cwd: string) => void)` を追加
- `src/renderer/src/types/api.d.ts`: `onPtyCwdUpdate` を追加
- `src/renderer/src/App.tsx`: `useEffect` で `window.api.onPtyCwdUpdate((cwd) => { setCwd(cwd); void window.api.setSetting('currentWorkingDir', cwd) })` を追加

**PowerShell での有効化方法:**
```powershell
function prompt {
    $loc = Get-Location
    $escPath = [uri]::EscapeDataString($loc.Path)
    Write-Host -NoNewline "`e]7;file://$env:COMPUTERNAME/$escPath`a"
    "PS $loc> "
}
```

### A-5: ターミナルスクロールバック保存

**変更ファイル:**
- `src/main/index.ts`: `electron` から `dialog` を import。`fs/promises` の `writeFile` を import。`ipcMain.handle('pty:save-scrollback', ...)` を追加。`dialog.showSaveDialog()` でファイルパスを取得し `writeFile` で保存。保存先パスを返す
- `src/preload/index.ts`: `saveScrollback(text: string): Promise<string | null>` を追加
- `src/renderer/src/types/api.d.ts`: `saveScrollback` を追加
- `src/renderer/src/components/Terminal.tsx`: ターミナル上部にツールバーを追加し「💾」ボタンを配置。`term.buffer.active` を走査してスクロールバック全文を取得し `window.api.saveScrollback(text)` を呼ぶ。`Ctrl+Shift+S` でもトリガー可能

---

## アーキテクチャ変更点

### pty-host.ts の OSC パーサー追加

```
onData(raw) → processBadgeSequences() → processNotifySequences() → processCwdSequences() → buffer
```

全処理は順次適用され、各 OSC シーケンスが除去された後のデータのみが xterm.js に転送される。

### Terminal.tsx の async 初期化

従来の同期 `useEffect` を async IIFE パターンに変更。`getSettings()` の await 完了後に Terminal インスタンスを生成するため、カーソル設定が確実に反映される。
