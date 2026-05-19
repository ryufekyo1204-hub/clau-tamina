# リサーチレポート 2026-05-23

## 調査方法
WebSearch / WebFetch で以下のトピックを調査:
- Wave Terminal v0.14.4 〜 v0.14.5 のリリースノート詳細（keybindings / wsh コマンド）
- xterm.js `@xterm/addon-progress` の ConEmu OSC 9;4 プログレス表示
- Electron 42 の新 API（`Notification.handleActivation`、IPC パフォーマンス改善）
- Warp Terminal 2026 の最新 UX（ブロック、ワークフロー、エージェントモード）
- Claude Code SDK TypeScript 2026 新機能

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: ConEmu OSC 9;4 プログレスバー（Wave Terminal v0.14.x 準拠）
- **概要**: Wave Terminal が内部的に使用している ConEmu OSC シーケンス `ESC ] 9 ; 4 ; <state> ; <value> BEL` を PTY ホストで検出し、ヘッダー/ステータスバーにプログレスインジケーターを表示する。xterm.js の `@xterm/addon-progress` アドオンを使えばシーケンス解析が不要になる。
  - state 0: プログレス消去
  - state 1: 通常（青、0〜100%）
  - state 2: エラー（赤）
  - state 3: 不定（スピナー）
  - state 4: 一時停止/警告（黄）
- **根拠**: PowerShell スクリプトや npm run build などの長時間タスクが `Write-Progress` や ConEmu シーケンスでプログレスを出力するケースが多い。Phase 7 で Bell 視覚インジケーターを実装したのと同じパターンで追加実装コストが最小。`@xterm/addon-progress` が `allowProposedApi: true` の下で動作するため既存インフラと整合。
- **実装難易度**: 低〜中
  - `npm install @xterm/addon-progress` を追加
  - `src/renderer/src/components/Terminal.tsx`: `ProgressAddon` をロード。`addon.onChange((state) => { window.api.reportProgress(state.value, state.state) })` でメインへ転送
  - `src/preload/index.ts`: `reportProgress(value: number, state: number): void` を追加
  - `src/renderer/src/types/api.d.ts`: `reportProgress` を追加
  - `src/renderer/src/components/StatusBar.tsx`（または Header）: `progressValue` / `progressState` state を追加し、プログレスバーを表示（state 0 で非表示）
- **CLAUDE.md との整合性**: OK（Wave Terminal の UX パターン踏襲）

#### A-2: F2 タブリネーム（Wave Terminal v0.14.5 準拠）
- **概要**: Wave Terminal v0.14.5 で追加された「F2 でアクティブタブをリネーム」に相当する機能として、clau-tamina の LeftPanel タブバーのタブをダブルクリックまたは F2 キーでインラインリネームできるようにする。
- **根拠**: Wave Terminal の F2 ショートカットはユーザーからの要望が多かった機能。clau-tamina の LeftPanel には「ターミナル / ファイル / プロセス」の固定タブがあるが、ユーザーがプロジェクト名でタブに名前をつけられると長いセッションでの作業効率が向上する。electron-store に保存して次回起動時も維持。
- **実装難易度**: 低
  - `src/renderer/src/components/LeftPanel.tsx`: タブボタンにダブルクリックハンドラー追加。`editingTab` state で inline `<input>` に切り替え。Enter/Blur で確定。カスタムラベルを `electron-store` / `settings.json` に保存（`window.api.setSetting('tabLabels', ...)` 経由）
  - `src/main/index.ts`: `settings` の型に `tabLabels: Record<string, string>` を追加
  - `src/renderer/src/types/api.d.ts`: `ApiSettings` に `tabLabels` を追加
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 準拠）

#### A-3: wsh run 相当 — Claude タスクを新しいエージェントカードで実行（Wave Terminal wsh run 参考）
- **概要**: Wave Terminal の `wsh run` コマンド（新しいブロックでコマンドを実行し完了後自動クローズ）を参考に、clau-tamina の ChatPane の入力欄にプレフィックス `!` を追加する。`!<prompt>` と入力すると、現在のチャットセッションとは別に新規並列エージェントとして query を開始し、AgentCards に自動追加される。
- **根拠**: Phase 3 で並列エージェント（AgentCards）は実装済みだが、既存の ChatPane から並列エージェントを起動する UI が存在しない。Wave の `wsh run` がシェルから新ブロックを起動するのと同様に、チャット入力から並列エージェントを簡単に起動できると、マルチエージェント UX の訴求力が大幅に向上する。
- **実装難易度**: 低
  - `src/renderer/src/components/ChatPane.tsx`: 送信時に `input.startsWith('!')` をチェック。マッチした場合は `window.api.sdkAgentQuery(agentId, prompt.slice(1), options)` を呼ぶ（`agentId` は `Date.now().toString()` で生成）
  - 通常の送信と同じコードパスで、分岐のみ追加
  - 既存の `AgentCards` が自動的に新エージェントを表示する（Phase 3 実装済み）
- **CLAUDE.md との整合性**: OK（マルチエージェントモード拡充）

#### A-4: Electron 42 Windows 通知クリックハンドラー（`Notification.handleActivation`）
- **概要**: Electron 42 で追加された `Notification.handleActivation(callback)` を使い、Phase 6 で実装した OSC 9 / OSC 777 デスクトップ通知のクリック時にウィンドウをフォアグラウンドに持ってくる。コールドスタート（通知クリックでアプリが起動した場合）にも対応。
- **根拠**: 現在 Phase 6 の OSC 9/777 通知は `new Notification({ title, body }).show()` で送信しているが、クリックしても何も起きない。Electron 42 の `handleActivation` で `mainWindow.show(); mainWindow.focus()` を呼ぶだけで完成するため、実装コストが極めて低い。
- **実装難易度**: 極低（3〜5行追加）
  - `src/main/index.ts`: `startPtyHost()` 内の `notify` ハンドラーを修正
    ```typescript
    const notif = new Notification({ title, body })
    Notification.handleActivation(() => {
      mainWindow?.show()
      mainWindow?.focus()
    })
    notif.show()
    ```
  - Electron バージョン確認: `package.json` の electron バージョンが 42+ であることを確認してから実装
- **CLAUDE.md との整合性**: OK（Windows 専用アプリとして通知 UX 改善）

#### A-5: タブバー背景色カスタマイズ（Wave Terminal v0.14.4 `tab:background` 準拠）
- **概要**: Wave Terminal v0.14.4 で追加された `tab:background` 設定を参考に、clau-tamina のヘッダーバー背景または LeftPanel タブバーに単色のカスタム背景色を設定できるようにする。設定モーダルにカラーピッカーを追加し、`electron-store` に保存する。
- **根拠**: プロジェクトごとにウィンドウカラーを変えることで、複数の clau-tamina ウィンドウを開いているときに視覚的に区別しやすくなる。Wave Terminal のタブ背景設定は人気機能で、PowerShell ユーザーも複数プロジェクトを並行して扱うことが多い。
- **実装難易度**: 低
  - `src/main/index.ts`: `Settings` 型に `headerBackground?: string` を追加
  - `src/renderer/src/components/SettingsModal.tsx`: カラーピッカー（`<input type="color">`）を追加し、`setSetting('headerBackground', color)` で保存
  - `src/renderer/src/components/Header.tsx`: `getSettings()` で `headerBackground` を読み込み、`style={{ background: headerBackground ?? 'var(--app-bg)' }}` を適用
  - `src/renderer/src/types/api.d.ts`: `ApiSettings` に `headerBackground?: string` を追加
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.4 準拠）

---

### 優先度B（将来サイクル候補）

#### B-1: wsh badge CLI 相当 — PowerShell プロファイルへの clau-tamina 通知関数
- **概要**: Wave Terminal の `wsh badge` コマンドに相当する、clau-tamina 用の PowerShell ヘルパー関数を PowerShell プロファイルに自動インストールする機能。`ctbadge "テスト完了" --color green` などのコマンドで OSC 9999 バッジを更新できる。
- **実装難易度**: 中
- **CLAUDE.md との整合性**: OK（PowerShell-first の設計思想と整合）

#### B-2: Warp Notebook ブロック相当 — マークダウンメモをチャットに挿入
- **概要**: Warp Terminal の Notebook ブロック（コマンド + 出力 + テキストを組み合わせた共有可能なドキュメント）を参考に、ChatPane にマークダウンメモを挿入するボタンを追加する。ユーザーが書いたテキストをそのままプロンプトコンテキストに含める形で実装。
- **実装難易度**: 低〜中
- **CLAUDE.md との整合性**: OK

#### B-3: Electron 42 IPC パフォーマンス改善の活用
- **概要**: Electron 42 は「IPC dispatch と option-dictionary パース」のパフォーマンスを改善した。現在の `pty:data` / `sdk:message` など高頻度 IPC チャンネルの送信方式を見直し（`ipcMain.on` → `webContents.postMessage` の structuredClone 最適化）、Electron 42 のベンチマークを取って効果を検証する。
- **実装難易度**: 中〜高
- **CLAUDE.md との整合性**: OK

#### B-4: Claude Code 統合ドキュメント（Wave Terminal `docs.waveterm.dev/claude-code` 参考）
- **概要**: Wave Terminal が公式に Claude Code 統合ドキュメント（`docs.waveterm.dev/claude-code`）を持っていることが判明。同様に clau-tamina の Claude Code 統合使い方ガイドを README に追加する。
- **実装難易度**: 極低（ドキュメントのみ）
- **CLAUDE.md との整合性**: OK

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 マルチターン | 不安定プレビュー（継続） |
| node-pty v1.2.0-beta アップグレード | beta のためリスクあり（安定版待ち） |
| Warp Cloud Agents / Oz | SaaS 連携のため Windows-only Electron アプリのスコープ外 |
| Wave Terminal Durable Sessions (SSH) | SSH サポートは本アプリの設計スコープ外 |

---

## 参考リンク

- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Wave Terminal v0.14.5 GitHub Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.5)
- [Wave Terminal Keybindings](https://docs.waveterm.dev/keybindings)
- [wsh Reference](https://docs.waveterm.dev/wsh-reference)
- [xterm.js @xterm/addon-progress npm](https://www.npmjs.com/package/@xterm/addon-progress)
- [ConEmu OSC 9;4 Progress Bar (rockorager.dev)](https://rockorager.dev/misc/osc-9-4-progress-bars/)
- [Microsoft Learn: Set the progress bar in Windows Terminal](https://learn.microsoft.com/en-us/windows/terminal/tutorials/progress-bar-sequences)
- [Electron 42 Blog](https://www.electronjs.org/blog/electron-42-0)
- [Warp Terminal 2026 AI Agent Guide](https://www.digitalapplied.com/blog/warp-ai-terminal-agentic-cli-workflows-guide)
- [Claude Code SDK TypeScript Agent SDK Reference](https://code.claude.com/docs/en/agent-sdk/typescript)
