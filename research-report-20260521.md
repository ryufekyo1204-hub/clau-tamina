# リサーチレポート 2026-05-21

## 調査方法
WebSearch / WebFetch で以下のトピックを調査:
- Wave Terminal v0.14.0〜v0.14.5 リリースノート詳細
- Wave Terminal v0.14.1 vim-style ナビゲーション・focus follows cursor
- Electron 37 / 39 の新機能
- wsh コマンドリファレンス（badge / notify / termscrollback）
- OSC 7 CWD トラッキング

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: Vim スタイルブロックナビゲーション（Wave Terminal v0.14.1 準拠）
- **概要**: Wave Terminal v0.14.1 で追加された `Ctrl+Shift+H/J/K/L` のブロック間 Vim ナビゲーションを参考に、clau-tamina でも `Ctrl+Shift+H/L` でターミナルペイン↔チャットペインのフォーカス移動を実装する
- **根拠**: マウスを使わずキーボードだけでターミナルとチャットを行き来できる。特にコーディング中にチャットに切り替えて指示を出し、すぐターミナルに戻る操作が高速化される
- **実装難易度**: 低
  - `src/main/index.ts` にグローバルショートカット `Ctrl+Shift+H` / `Ctrl+Shift+L` を追加
  - IPC: `focus:terminal` → `focus:chat` チャンネルを追加
  - `src/renderer/src/components/Terminal.tsx` に `window.api.onFocusTerminal(() => term.focus())` を追加
  - `src/renderer/src/components/ChatPane.tsx` に `window.api.onFocusChat(() => inputRef.current?.focus())` を追加
  - `src/preload/index.ts` / `api.d.ts` に `onFocusTerminal` / `onFocusChat` を追加
- **CLAUDE.md との整合性**: OK（Wave Terminal UX 機能として明示）

#### A-2: wsh notify 相当の OSC 通知コマンド（Wave Terminal v0.14.x 準拠）
- **概要**: Wave Terminal の `wsh notify "メッセージ"` に相当する機能として、PTY ホストが OSC 9 シーケンス（`\x1b]9;メッセージ\x07`）または OSC 777（`\x1b]777;notify;タイトル;本文\x07`）を検出し、Electron の `Notification` API でデスクトップ通知を発火させる
- **根拠**: 長時間のビルドや npm install などのコマンド完了時にデスクトップ通知を受け取れる。`npm run build && printf "\033]9;ビルド完了\007"` という使い方が可能になる。A-2 の OSC 9999 バッジ実装とほぼ同じパターンで追加できる
- **実装難易度**: 低
  - `src/pty-host/pty-host.ts` に OSC 9 / OSC 777 のパターンを追加（`/\x1b\]9;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g`）
  - `process.parentPort.postMessage({ type: 'notify', title: ..., body: ... })` を送信
  - `src/main/index.ts` に `new Notification({ title, body }).show()` を呼ぶハンドラーを追加
  - `src/preload/index.ts` / `api.d.ts` の変更は不要（main 側だけで完結）
- **CLAUDE.md との整合性**: OK

#### A-3: OSC 7 CWD トラッキング（Wave Terminal v0.14.0 準拠）
- **概要**: Wave Terminal が実装している OSC 7 シーケンス（`\x1b]7;file://hostname/path\x07`）を PTY ホストで検出し、PowerShell の `cd` や `pushd` などによるディレクトリ変更を clau-tamina の CWD として自動同期する
- **根拠**: FileTreePane は現在 CWD を手動で設定する必要があるが、PowerShell でディレクトリを移動すると FileTreePane と Claude AI の CWD が自動更新されれば UX が大幅に向上する。PowerShell の `$PROMPT` 関数に OSC 7 を出力する設定を追加するだけで動作する
- **実装難易度**: 低〜中
  - `src/pty-host/pty-host.ts` に OSC 7 パターン（`/\x1b\]7;file:\/\/[^/]*([^\x07\x1b]*?)(?:\x07|\x1b\\)/g`）を追加し、`process.parentPort.postMessage({ type: 'cwd-update', cwd: decodedPath })` を送信
  - `src/main/index.ts` に `pty:cwd-update` IPC でレンダラーへ転送
  - `src/preload/index.ts` に `onPtyCwdUpdate(cb)` を追加
  - `src/renderer/src/App.tsx` で受信 → `setCwd()` 呼び出し + `window.api.setSetting('currentWorkingDir', cwd)`
  - `src/renderer/src/types/api.d.ts` に `onPtyCwdUpdate` を追加
- **CLAUDE.md との整合性**: OK

#### A-4: カーソルスタイルカスタマイズ（Wave Terminal v0.14.1 準拠）
- **概要**: Wave Terminal v0.14.1 の「Terminal Cursor Style & Blink — New settings for cursor style (block/bar/underline) and blink, configurable per-block」を参考に、xterm.js の `cursorStyle` と `cursorBlink` を Settings から変更できるようにする
- **根拠**: 現在の xterm.js は `cursorBlink: true` のみ設定されており、スタイルは `block` 固定。`bar` スタイルは IDE 系ターミナルで好まれるため、ユーザーが好みを設定できると使い心地が向上する
- **実装難易度**: 低
  - `src/renderer/src/components/SettingsModal.tsx` の「ターミナル」タブに「カーソルスタイル: ブロック / バー / アンダーライン」セレクターと「点滅: オン/オフ」トグルを追加
  - `src/renderer/src/store/session.ts` に `cursorStyle: 'block' | 'bar' | 'underline'` と `cursorBlink: boolean` を追加
  - `src/renderer/src/components/Terminal.tsx` で `term.options.cursorStyle` / `term.options.cursorBlink` を動的に更新
  - `src/main/index.ts` の `Settings` インターフェースに追加（永続化）
  - `src/preload/index.ts` / `api.d.ts` の `ApiSettings` に追加
- **CLAUDE.md との整合性**: OK

#### A-5: ターミナルスクロールバック保存（Wave Terminal v0.14.1 準拠）
- **概要**: Wave Terminal v0.14.1 の「Terminal Scrollback Save — new context menu item and wsh command to save terminal scrollback to a file」を参考に、TerminalPane の右クリックコンテキストメニュー（または Header ボタン）からターミナルの全スクロールバックをファイルに保存する機能を追加する
- **根拠**: デバッグセッションやビルドログを後から参照したいケースで有用。xterm.js の `buffer.active` を走査してテキストを取得し、`fs.writeFile` で保存できる
- **実装難易度**: 低〜中
  - `src/renderer/src/components/Terminal.tsx` にコンテキストメニュー（または Ctrl+Shift+S）を追加
  - `term.buffer.active` を走査してスクロールバック全文を抽出
  - IPC: `pty:save-scrollback` チャンネルで main プロセスに文字列を送信
  - `src/main/index.ts` に `ipcMain.handle('pty:save-scrollback', ...)` を追加し `dialog.showSaveDialog` → `fs.writeFile` で保存
  - `src/preload/index.ts` / `api.d.ts` に `saveScrollback(text: string): Promise<string | null>` を追加（保存先ファイルパスを返す）
- **CLAUDE.md との整合性**: OK

---

### 優先度B（将来サイクル候補）

#### B-1: Electron 37 の `-electron-corner-smoothing` CSS 適用
- **概要**: Electron 37.0.0（Chromium 138）の独自 CSS プロパティ `-electron-corner-smoothing` を使い、モーダル・カード・バッジの角丸をスクワークルにする（`system-ui` 値 = macOS 60%、Windows 0%）
- **実装難易度**: 低（CSS 変数に追加するだけ）ただし Electron 37 以上へのアップグレードが前提
- **CLAUDE.md との整合性**: OK

#### B-2: Electron 37 の `before-mouse-event` でリサイズ精度向上
- **概要**: `webContents.on('before-mouse-event', ...)` でマウスイベントをインターセプトし、SplitLayout リサイズバー付近でのクリック誤爆を防止
- **実装難易度**: 低
- **CLAUDE.md との整合性**: OK

#### B-3: OSC 52 クリップボードサポート（Wave Terminal v0.14.0 準拠）
- **概要**: `\x1b]52;c;<base64-text>\x07` を PTY ホストで検出し、Electron の `clipboard.writeText()` でシステムクリップボードに書き込む
- **実装難易度**: 低（OSC 9999 / OSC 7 パターンと同様）
- **CLAUDE.md との整合性**: OK（以前「将来検討」として見送っていたが実装コストが低いため再検討の余地あり）

#### B-4: Bell 通知バッジ（Wave Terminal v0.14.2 準拠）
- **概要**: PTY がベル文字（`\x07`）を送信した際に StatusBar または Header にベルバッジを表示。`term:bellindicator` 相当
- **実装難易度**: 低
- **CLAUDE.md との整合性**: OK

#### B-5: Electron 39 IPC パフォーマンス改善へのアップグレード
- **概要**: Electron 39 では「native event emission, IPC dispatch, and option-dictionary parsing のパフォーマンス改善」が含まれる。ターミナル出力の多い clau-tamina に恩恵がある
- **実装難易度**: 中（`electron-rebuild` でネイティブモジュールの再ビルドが必要）
- **CLAUDE.md との整合性**: OK

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 マルチターン | 不安定プレビュー（前回から継続） |
| Durable SSH Sessions | 高難易度（Phase 5 後で検討） |
| node-pty 1.2.0-beta | beta のためリスクあり |
| Pinned tabs 復活 | Wave Terminal が v0.14.0 で削除 |

---

## 参考リンク

- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Wave Terminal v0.14.1 GitHub Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.1)
- [Wave Terminal wsh reference](https://docs.waveterm.dev/wsh-reference)
- [Wave Terminal Key Bindings](https://docs.waveterm.dev/keybindings)
- [Electron 37.0.0 Blog](https://www.electronjs.org/blog/electron-37-0)
- [Electron -electron-corner-smoothing CSS](https://www.electronjs.org/docs/latest/api/corner-smoothing-css)
- [Electron 39.0.0 Blog](https://www.electronjs.org/blog/electron-39-0)
