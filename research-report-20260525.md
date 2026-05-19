# リサーチレポート 2026-05-25

## 調査方法
WebFetch / WebSearch で以下のトピックを調査:
- Wave Terminal v0.14.5 (GitHub Releases)
- Warp Terminal 2026 オープンソース化・新機能
- Claude Code SDK ファイルチェックポイント API
- Electron v36/v37 新 API

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: Wave Terminal v0.14.5 Drag & Drop ファイルパス貼り付け

- **概要**: Wave Terminal v0.14.5 で追加された「ファイルをターミナルにドラッグ＆ドロップするとクォートされたパスが貼り付けられる」機能を実装する。エクスプローラーや Finder からファイルを Terminal ペインにドロップすると `"C:\Users\user\project\file.txt"` 形式でパスが入力される。
- **根拠**: PowerShell ユーザーが頻繁に行う操作（ファイルパスの手動入力）を劇的に簡略化できる。xterm.js はドロップイベントを透過するため、コンテナ div の `onDrop` で拾い文字列化するだけで実現できる。
- **実装難易度**: 低
  - `src/renderer/src/components/Terminal.tsx`: `containerRef.current` に `onDragOver` + `onDrop` ハンドラを追加。`e.dataTransfer.files` を取得し、各ファイルパスを `"${path}"` に変換して `window.api.ptyInput(text)` で送信。ドロップ中は `border: 1px solid var(--border-accent)` のドロップターゲット視覚フィードバックを追加。
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 Drag & Drop 踏襲）

---

#### A-2: Electron 36 `roundedCorners` — Windows フレームレスウィンドウ角丸

- **概要**: Electron v36 で Windows にも追加された `roundedCorners: true` オプションを `BrowserWindow` に追加する。Windows 11 (Build 22000+) で有効になり、フレームレスウィンドウが OS ネイティブの角丸スタイルになる。旧 Windows では no-op のため安全。
- **根拠**: clau-tamina は `titleBarStyle: 'hidden'` のフレームレスウィンドウを使用中。`roundedCorners: true` 1行で Windows 11 ネイティブな見た目になり、Cyber-Minimal との相性も良い（OS の丸みは我々の CSS 角丸とは別レイヤー）。
- **実装難易度**: 極低（1行）
  - `src/main/index.ts`: `new BrowserWindow({ ..., roundedCorners: true })` を追加するだけ。
- **CLAUDE.md との整合性**: OK（Electron v36 新機能）

---

#### A-3: Claude Code SDK `enableFileCheckpointing` + 「前の状態に戻す」ボタン

- **概要**: SDK の `enableFileCheckpointing: true` オプションと `rewindFiles()` メソッドを使い、Claude が変更したファイルを任意のターン前の状態に戻せる機能を追加する。チャットペインに「↩ 変更前に戻す」ボタンを表示し、クリックすると最後のチェックポイントまでファイルを復元する。
- **根拠**: Phase 3 以降 Claude がファイルを変更するケースが増えている。「意図しない変更を素早くアンドゥしたい」は PowerShell ユーザーにとって重大なニーズ。SDK が提供する `rewindFiles()` は Bash 変更を除くWrite/Edit/NotebookEdit ツールをカバーする。
- **実装難易度**: 中
  - `src/sdk-host/sdkHost.mts`:
    - `query()` オプションに `enableFileCheckpointing: true`, `extraArgs: { 'replay-user-messages': null }` を追加
    - `message.type === 'user' && message.uuid` のとき `{ type: 'checkpoint', uuid: message.uuid }` を parentPort に送信
    - `rewindFiles(uuid)` を呼ぶ IPC ハンドラを追加（`type: 'rewind'` メッセージを受信）
  - `src/main/index.ts`: `sdk:rewind` IPC を受けて sdkProcess に `{ type: 'rewind', uuid }` を送信
  - `src/preload/index.ts`: `sdkRewind(uuid: string): void` を追加
  - `src/renderer/src/types/api.d.ts`: `SdkMessage.type` に `'checkpoint'` 追加、`sdkRewind(uuid: string): void` 追加
  - `src/renderer/src/store/session.ts`: `lastCheckpointUuid: string | null` を状態に追加。`handleSdkMessage` で `'checkpoint'` メッセージを受けて保存
  - `src/renderer/src/components/ChatPane.tsx`: `isQuerying === false && lastCheckpointUuid` のとき入力欄の上に「↩ 変更前に戻す」ボタンを表示
- **CLAUDE.md との整合性**: OK（Claude Code SDK 新機能活用）

---

#### A-4: Warp 式「思考ブロック折りたたみ」— Claude 長文応答の展開/折りたたみ

- **概要**: Warp Terminal がオープンソース化した「Agent thinking blocks with toggleable expand/collapse」を参考に、ChatPane の長い Claude 応答（300文字以上）に折りたたみ/展開ボタンを追加する。デフォルトは折りたたみ（先頭3行のみ表示）、クリックで全文展開。
- **根拠**: Warp が 2026 年にオープンソース化（MIT + AGPL v3）し、ブロック折りたたみ実装が参照可能になった。Claude の長い応答が ChatPane を埋め尽くすのを防ぎ、重要な情報へのスクロールが楽になる。
- **実装難易度**: 低〜中
  - `src/renderer/src/components/ChatPane.tsx`: `MessageBubble` コンポーネントに `collapsed` state を追加。`msg.content.length > 300 && msg.role === 'assistant'` の場合、デフォルトを `collapsed: true` にして先頭 3 行のみ表示。フッターに「…続き (N行) ▾」ボタンを表示し、クリックで展開。
  - スタイル: 折りたたみ時の末端に `mask-image: linear-gradient(to bottom, black 60%, transparent)` でフェードアウト。展開ボタンは `var(--accent)` / `var(--font-mono)` / `var(--radius-sm)` で Cyber-Minimal 準拠。
- **CLAUDE.md との整合性**: OK（Warp Terminal UX 参考）

---

#### A-5: Wave Terminal v0.14.5 `F2` タブリネーム — キーボード起動対応

- **概要**: Wave Terminal v0.14.5 で追加された「F2 キーでアクティブタブをリネーム」を clau-tamina に追加する。現在は既に「ダブルクリックでリネーム」が実装されているが、F2 キーバインドがない。Electron のグローバルショートカット登録は不要で、レンダラー側の `keydown` イベントで処理できる。
- **根拠**: Phase 6 でダブルクリックリネームを実装済み。F2 追加は既存コードへの 1 行追加で完了できる。Wave Terminal v0.14.5 との機能同等性を確保する。
- **実装難易度**: 極低（数行）
  - `src/renderer/src/components/LeftPanel.tsx`: `useEffect` で `document.addEventListener('keydown', ...)` を追加し、`e.key === 'F2'` のとき `startEditing(activeTab)` を呼ぶ。クリーンアップで `removeEventListener`。
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 F2 リネーム踏襲）

---

### 優先度B（将来サイクル候補）

#### B-1: Electron 37 `-electron-corner-smoothing` CSS プロパティ

- **概要**: Electron v37 の新 CSS プロパティ `-electron-corner-smoothing` を使い、角丸を連続曲線（スクワークル形状）にする。`system-ui` 値でOSスタイルに合わせる（macOS で 60%）。
- **実装難易度**: 極低（CSS 1行）
- **CLAUDE.md との整合性**: OK

#### B-2: Wave Terminal `showsplitbuttons` — ターミナルヘッダーに水平/垂直分割ボタン

- **概要**: Wave Terminal v0.14.5 の `app:showsplitbuttons` 設定を参考に、TerminalPane のヘッダーに水平・垂直分割ボタンを追加する。SplitLayout の比率を動的に調整する。
- **実装難易度**: 中
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 踏襲）

#### B-3: Warp 式 Markdown テーブル・Mermaid 図レンダリング

- **概要**: ChatPane に `react-markdown` を導入し、Markdown テーブル・コードブロック・Mermaid 図のレンダリングを追加する。Warp のオープンソース実装が参照可能。
- **実装難易度**: 中（依存パッケージ追加が必要）
- **CLAUDE.md との整合性**: OK

#### B-4: OSC 1337 インライン画像表示（iTerm2 互換）

- **概要**: iTerm2 の OSC 1337 インライン画像プロトコルを実装し、ターミナル内で画像を表示できるようにする。xterm.js のカスタムレンダーレイヤーで実現。
- **実装難易度**: 高
- **CLAUDE.md との整合性**: OK

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| Warp Cloud Agents / Oz 統合 | SaaS 連携のためスコープ外 |
| Electron v36 `contextBridge.executeInMainWorld` | sandbox: false からの大規模移行リスク |
| Wave Terminal SSH Durable Sessions | SSH サポートはスコープ外 |

---

## 参考リンク

- [Wave Terminal v0.14.5 GitHub Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.5)
- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Warp Terminal Open Source 2026](https://thecodersblog.com/warp-terminal-goes-open-source-2026/)
- [Warp Agentic Features 2026](https://www.deployhq.com/guides/warp)
- [Claude Code SDK File Checkpointing](https://code.claude.com/docs/en/agent-sdk/file-checkpointing)
- [Electron 36 Release Notes](https://releases.electronjs.org/release/v36.0.0)
- [Electron 37 Blog Post](https://www.electronjs.org/blog/electron-37-0)
