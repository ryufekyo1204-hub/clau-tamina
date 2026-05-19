# リサーチレポート 2026-05-22

## 調査方法
WebSearch で以下のトピックを調査:
- Wave Terminal v0.14.2 〜 v0.14.5 リリースノート詳細
- Electron 40 / 41 の新機能
- node-pty v1.2.0-beta 最新動向
- xterm.js v6 新オプション（rescaleOverlappingGlyphs 等）
- OSC 52 クリップボードの実装例

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: OSC 52 クリップボードサポート（Wave Terminal v0.14.x 準拠）
- **概要**: Wave Terminal は OSC 52 のデフォルトを `"always"` に設定し、CLI アプリがフォーカス外でもシステムクリップボードに書き込める。PTY ホストで `\x1b]52;c;<base64>\x07` を検出し、`clipboard.writeText(atob(base64))` を呼ぶ
- **根拠**: tmux, Neovim, Helix 等のモダンエディタが OSC 52 に対応。Phase 6 で OSC 9/7 パーサーを実装したため、同一パターンで追加実装コスト最小。日本語開発環境では特に CJK テキストのコピーで有用
- **実装難易度**: 低
  - `src/pty-host/pty-host.ts`: `processClipboardSequences()` を追加。パターン: `/\x1b\]52;[a-zA-Z]*;([A-Za-z0-9+/=]*?)(?:\x07|\x1b\)/g`。`process.parentPort.postMessage({ type: 'clipboard-write', text: Buffer.from(match[1], 'base64').toString('utf8') })`
  - `src/main/index.ts`: `clipboard` を electron から import。`clipboard-write` メッセージで `clipboard.writeText(text)` を呼ぶ
  - preload / api.d.ts の変更なし（main 側で完結）
- **CLAUDE.md との整合性**: OK

#### A-2: Bell 視覚インジケーター（Wave Terminal v0.14.2 準拠）
- **概要**: Wave Terminal v0.14.2 の「Terminal Bell Indicator（term:bellindicator）」を参考に、PTY がベル文字 `\x07` を出力したとき Header または StatusBar に「🔔」を短時間表示する
- **根拠**: 長時間コマンドの完了通知として `echo -e "\007"` がよく使われる。Phase 6 の OSC 9 デスクトップ通知より軽量で、フォーカス中のみ有効な視覚フィードバックとして補完的に機能する
- **実装難易度**: 低
  - `src/pty-host/pty-host.ts`: `processBellSequences()` を追加。ただし OSC シーケンスの終端 `\x07` と区別するため、OSC パーサーの後で残っている単独の `\x07` のみを対象とする
  - `src/main/index.ts`: `pty:bell` IPC でレンダラーへ転送
  - `src/preload/index.ts` / `api.d.ts`: `onPtyBell(cb: () => void)` を追加
  - `src/renderer/src/components/StatusBar` または `Header.tsx`: ベル受信時に 🔔 バッジを 3s 表示（`setTimeout` で消去）
- **CLAUDE.md との整合性**: OK

#### A-3: xterm.js v6 `rescaleOverlappingGlyphs` 有効化（1行追加）
- **概要**: xterm.js v6 で追加された `rescaleOverlappingGlyphs: true` オプションを Terminal コンストラクターに追加する。WebGL 加速時に隣接セルにはみ出す可能性のあるグリフ（CJK・絵文字など）を自動縮小し、表示崩れを防ぐ
- **根拠**: `allowProposedApi: true` は設定済み。Terminal の async 初期化パターン（Phase 6 で導入）に1行追加するだけで日本語ユーザーへの恩恵が大きい。コスト：5分
- **実装難易度**: 低（1行追加）
  - `src/renderer/src/components/Terminal.tsx`: `new Terminal({..., rescaleOverlappingGlyphs: true})` に追加
- **CLAUDE.md との整合性**: OK

#### A-4: プロセスビューワーウィジェット強化（Wave Terminal v0.14.5 準拠）
- **概要**: Wave Terminal v0.14.5 の「Process Viewer（CPU・メモリ表示、シグナル送信可能）」を参考に、既存の LeftPanel に「プロセス」タブを追加する。`process:list` IPC ハンドラーはすでに実装済みのため、ビューのみ追加
- **根拠**: ProcessViewer の IPC ハンドラー（`ipcMain.handle('process:list', ...)`) は Phase 3 で実装済み。レンダラー側のビューコンポーネントが未実装のため、LeftPanel に「プロセス」タブを追加するだけで完成する
- **実装難易度**: 低〜中
  - `src/renderer/src/components/LeftPanel.tsx`: `ProcessTab` コンポーネントを追加（30秒ごとに `window.api.listProcesses()` を呼んで CPU/メモリをテーブル表示）
  - タブバーに「プロセス」を追加
  - Kill ボタンは不要（表示のみ）
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 の Process Viewer に対応）

#### A-5: ターミナルセクションマーク（Wave Terminal コマンドブロック参考）
- **概要**: Wave Terminal の「コマンド履歴ブロック」設計を参考に、ターミナルツールバーに「── MARK ──」区切り線を手動挿入するボタンを追加する。Phase 6 で追加したツールバーに「⊘」ボタンを1つ追加するだけ
- **根拠**: 長いデバッグセッションでコマンドグループを視覚的に分離でき、Phase 6 A-5 のスクロールバック保存と組み合わせてセクション単位で後から参照しやすくなる
- **実装難易度**: 低
  - `src/renderer/src/components/Terminal.tsx`: ツールバーに「⊘」ボタンを追加。クリック時に `term.write('\r\n\x1b[2m────────── MARK ──────────\x1b[0m\r\n')` でローカル書き込み（PTY 送信なし）
- **CLAUDE.md との整合性**: OK

---

### 優先度B（将来サイクル候補）

#### B-1: Electron 40 の ASAR Integrity 有効化
- **概要**: Electron 39 で stable 化された ASAR Integrity 機能を `electron-builder` 設定で有効化する。アプリ改ざん検知が可能になる
- **実装難易度**: 低（設定ファイル1行）
- **CLAUDE.md との整合性**: OK

#### B-2: Electron 41 の `focusOnNavigation: false`
- **概要**: Electron 41 の `webPreferences.focusOnNavigation: false` を `createWindow()` に追加し、FileTreePane 操作後のターミナルフォーカス奪取を防ぐ
- **実装難易度**: 低（1行追加）
- **CLAUDE.md との整合性**: OK

#### B-3: node-pty v1.2.0-beta 安定版移行
- **概要**: node-pty v1.2.0-beta.12（2026年3月）は ConPTY バージョン 1.25.260303002 を含む。安定版リリース後に `@electron/rebuild` で移行する
- **実装難易度**: 中（ネイティブモジュール再ビルド）
- **CLAUDE.md との整合性**: OK

#### B-4: Wave Terminal app:showsplitbuttons 相当 — ターミナル縦横分割
- **概要**: Wave Terminal v0.14.5 の「app:showsplitbuttons」を参考に、ターミナルを上下または左右に2分割する機能を追加する（2つの node-pty インスタンスを並列で管理）
- **実装難易度**: 高
- **CLAUDE.md との整合性**: OK（将来フェーズ）

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 マルチターン | 不安定プレビュー（継続） |
| Durable SSH Sessions | 高難易度（継続） |
| node-pty v1.2.0-beta アップグレード | beta のためリスクあり（安定版待ち） |
| Electron 40 アップグレード | ネイティブモジュール再ビルドのリスク（将来検討） |

---

## 参考リンク

- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Wave Terminal v0.14.5 GitHub Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.5)
- [Wave Terminal v0.14.4 GitHub Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.4)
- [Wave Terminal v0.14.2 GitHub Release](https://github.com/wavetermdev/waveterm/releases)
- [Wave Terminal wsh reference](https://docs.waveterm.dev/wsh-reference)
- [Electron 40.0.0 Blog](https://www.electronjs.org/blog/electron-40-0)
- [Electron 41 Blog](https://www.electronjs.org/blog/electron-41-0)
- [node-pty releases](https://github.com/microsoft/node-pty/releases)
- [xterm.js npm @xterm/xterm](https://www.npmjs.com/@xterm/xterm)
- [OSC 52 Clipboard / Wave Terminal Issue #2845](https://github.com/wavetermdev/waveterm/issues/2845)
