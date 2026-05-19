# リサーチレポート 2026-05-20

## 調査方法
WebSearch / WebFetch で以下のトピックを調査:
- Wave Terminal v0.14.x リリースノート（docs.waveterm.dev + GitHub）
- Electron 36 / 37 の新機能
- xterm.js v6 のアドオン動向
- node-pty 1.2 beta の動向

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: スライドアウト AI チャットパネル（Wave Terminal v0.14.5 準拠）
- **概要**: Wave Terminal v0.14.5 の「Slide-Out Chat Panel」を参考に、ショートカットキー（Ctrl+Shift+A）でチャットペインを画面端から引き出すスライドアニメーションパネルを追加する
- **根拠**: 現在のチャットペインは常時表示されているが、Wave Terminal のようにホットキーでオン/オフできると、ターミナル作業に集中しながら必要なときだけ AI に話しかけられる。`position: fixed; right: 0; transform: translateX(100%)` のスタイルで既存 React コンポーネントを流用できる
- **実装難易度**: 低〜中
  - `RightPanel.tsx` をオーバーレイ化する or `SplitLayout.tsx` の右ペインを折りたたみ可能にする
  - ショートカットは `preload` 経由で Electron の `globalShortcut` に登録（A-4 の Quake Mode と同じパターン）
  - アニメーション: `transform 0.25s cubic-bezier(0.4,0,0.2,1)` で Wave Terminal 準拠のスムーズなスライドイン
- **CLAUDE.md との整合性**: OK（Wave Terminal UX 機能として明示されている）

#### A-2: wsh badge 相当の通知バッジ CLI コマンド（Wave Terminal v0.14.2 準拠）
- **概要**: Wave Terminal の `wsh badge` コマンドに相当する仕組みとして、PTY ホストが受け取った **OSC エスケープシーケンス**（例: `\x1b]9999;badge=エラー\x07`）を検出し、AgentCards のバッジを自動更新する
- **根拠**: Wave Terminal v0.14.2 の `wsh badge` は「PID-linked auto-clearing（プロセス終了時にバッジが消える）」と「CLI からブロックバッジを設定できる」点が革新的。clau-tamina ではエージェントが `printf "\033]9999;badge=done\007"` を出力することでバッジを更新できるようにする
- **実装難易度**: 中
  - `pty-host.ts` の出力バッファで OSC 9999 シーケンスをパース
  - IPC で `badge-update` メッセージをレンダラーに送信
  - AgentCards の `StatusBadge` にカスタムテキストモードを追加
- **CLAUDE.md との整合性**: OK

#### A-3: ドラッグ & ドロップ ファイルパス入力（Wave Terminal v0.14.5 準拠）
- **概要**: Wave Terminal v0.14.5 の「Drag-and-drop file paths into terminals」機能を参考に、FileTreePane のファイルをターミナルにドラッグ & ドロップするとファイルパスが挿入される機能を追加
- **根拠**: FileTreePane（Phase 3 実装済み）でファイルを選択し、ターミナルペインにドロップするとそのファイルパスが PTY 入力として送信される。`onDragStart` でファイルパスを `dataTransfer` にセットし、Terminal.tsx の `onDrop` で受け取り `ptyInput()` に送る実装
- **実装難易度**: 低
  - `FileTreePane.tsx` の各ファイルエントリに `draggable={true}` と `onDragStart` を追加
  - `Terminal.tsx` に `onDrop` / `onDragOver` ハンドラーを追加
  - xterm.js の DOM element に `addEventListener('drop', ...)` を追加
- **CLAUDE.md との整合性**: OK（Wave Terminal UX 機能）

#### A-4: Vertical Tab Bar オプション（Wave Terminal v0.14.4 準拠）
- **概要**: Wave Terminal v0.14.4 の「Vertical Tab Bar Option」を参考に、SessionList をヘッダーバーから左サイドバーに移動するオプションを追加する
- **根拠**: 多くのセッションを管理する場合、横並びのセッションリストは狭い。縦型タブバーにすることで多数のセッションを視認性よく管理できる。Settings の「ワークスペース」タブに「タブバー方向」トグルを追加し、左パネルの最上部に縦型リストを表示する
- **実装難易度**: 低〜中
  - `SessionList.tsx` のレイアウトを縦方向に変更するモードを追加
  - `SettingsModal.tsx` に「タブバー方向：横 / 縦」のセレクターを追加
  - `electron-store` / `settings.json` に `tabBarOrientation: 'horizontal' | 'vertical'` を追加
- **CLAUDE.md との整合性**: OK

#### A-5: COLORTERM=truecolor 環境変数の明示設定（Wave Terminal v0.14.5 準拠）
- **概要**: Wave Terminal v0.14.5 が「Terminal sessions now set `COLORTERM=truecolor`」を実装したことに倣い、PTY ホストの `env` に `COLORTERM: 'truecolor'` を追加してトゥルーカラー対応 CLI ツールの色再現性を向上させる
- **根拠**: 現在の `pty-host.ts` は `TERM: 'xterm-256color'` のみ設定しているが、`COLORTERM=truecolor` を追加することで `bat`、`eza`、`delta`、`lazygit` などのツールが 24-bit カラーを正しく出力できる。実装は 1 行追加のみ
- **実装難易度**: 極低（1 行変更）
  - `src/pty-host/pty-host.ts` の `env` オブジェクトに `COLORTERM: 'truecolor'` を追加
- **CLAUDE.md との整合性**: OK（Windows / PowerShell 固有実装の改善）

---

### 優先度B（将来サイクル候補）

#### B-1: Electron 37 の `-electron-corner-smoothing` CSS 適用
- **概要**: Electron 37.0.0（Chromium 138）の独自 CSS プロパティ `-electron-corner-smoothing` を使い、モーダル・カード・バッジの角丸をスクワークルにする
- **根拠**: `border-radius` より自然な曲線で Wave Terminal / Claude Desktop に近いビジュアル品質になる。`system-ui` 値を使えば将来の macOS 移植時も一貫したデザインが維持できる
- **実装難易度**: 低（CSS 変数に追加するだけ）ただし Electron 37 へのアップグレードが前提
- **CLAUDE.md との整合性**: OK

#### B-2: Electron 37 の `before-mouse-event` 活用
- **概要**: Electron 37 の `webContents.on('before-mouse-event', ...)` でマウスイベントをインターセプトし、ターミナルエリアと AI チャットエリアの境界線でのドラッグ精度を向上させる
- **根拠**: SplitLayout のリサイズバー付近でのクリック誤爆を防止できる
- **実装難易度**: 低
- **CLAUDE.md との整合性**: OK

#### B-3: Durable SSH セッション（Wave Terminal v0.14.0 準拠）
- **概要**: Wave Terminal v0.14.0 の「Durable SSH Sessions」に相当する仕組みとして、PTY ホストがクラッシュ・再起動した際にセッション ID を保持し、再接続後にバッファの一部を復元する
- **根拠**: 現在の PTY ホストはクラッシュ時にセッションが完全に失われる。Wave Terminal 準拠のセッション永続化でエージェント作業中の事故を減らせる
- **実装難易度**: 高（pty-host と main の間にセッション永続化レイヤーを追加する必要あり）
- **CLAUDE.md との整合性**: OK（PTY ホスト設計の改善として位置づけ可能）

#### B-4: node-pty 1.2.0-beta へのアップグレード
- **概要**: node-pty 1.2.0-beta.13（2026-05-13）への移行。ConPTY の改善が含まれる可能性があり、PowerShell の Ctrl-C ハンドリングや Unicode 出力の安定性が向上する場合あり
- **実装難易度**: 低（package.json 更新 + `electron-rebuild`）ただし beta のためリスクあり
- **CLAUDE.md との整合性**: OK

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 マルチターン | 不安定プレビュー（前回から継続） |
| OSC 52 クリップボード対応 | Phase 3 までのスコープと離れすぎる |
| Pinned tabs 復活 | Wave Terminal が v0.14.0 で削除しており逆行する |

---

## 参考リンク

- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Wave Terminal wsh reference](https://docs.waveterm.dev/wsh-reference)
- [Wave Terminal Secrets](https://docs.waveterm.dev/secrets)
- [Electron 36.0.0](https://www.electronjs.org/blog/electron-36-0)
- [Electron 37.0.0](https://www.electronjs.org/blog/electron-37-0)
- [xterm.js GitHub releases](https://github.com/xtermjs/xterm.js/releases)
- [node-pty npm](https://www.npmjs.com/package/node-pty)
