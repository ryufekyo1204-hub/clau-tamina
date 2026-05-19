# リサーチレポート 2026-05-19

## 調査方法
WebSearch / WebFetch で以下のトピックを調査:
- Wave Terminal v0.14.5 以降の UX・機能（リリースノート、wsh リファレンス、Claude Code 連携ドキュメント）
- Warp Terminal 2026 の新機能（ブロック改善・Active AI）
- Claude Code ライフサイクルフック 2026 最新状況
- Electron v37 / v38 新機能

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: Claude Code ライフサイクルフック — Stop/PostToolUse 通知（Wave Terminal Claude Code 連携 + Claude Code Hooks 2026）

- **概要**: Claude Code のライフサイクルフック（`Stop` / `PostToolUse` / `PreToolUse`）を活用し、clau-tamina から Claude Code セッションが完了した際にフック経由で視覚通知を出す仕組みを追加する。Wave Terminal は `~/.claude/settings.json` の `hooks.Stop` に `wsh badge --icon robot --color green` を書くことで "Claude が応答完了" バッジを出している。clau-tamina も同様に:
  1. 設定モーダルに「Claude Code フック自動設定」ボタンを追加。クリックすると `~/.claude/settings.json` の `hooks.Stop` に、OSC 9999 バッジシーケンスを書く PowerShell ワンライナーを書き込む（`Write-Host -NoNewline "\e]9999;badge=✓;color=#58c142\a"`）
  2. `Stop` フック受信時に LeftPanel のターミナルタブにグリーンバッジが自動表示（Phase 9 実装済みのバッジシステムを活用）
  3. 設定モーダルに「フックを削除」ボタンも追加
- **根拠**: Wave Terminal の最大の差別化点が Claude Code フック連携。「Claude が何かをしているときにタブを見ていなくてもわかる」UX は clau-tamina でも同様に価値が高い。Phase 9 で OSC 9999 バッジシステムが完成したため、あとはフックのインストール UI を作るだけで実現できる。
- **実装難易度**: 低
  - `src/main/index.ts`: `ipcMain.handle('claude:install-hooks', ...)` を追加。`~/.claude/settings.json` を読み込み、`hooks.Stop` に PowerShell ワンライナーを書き込む（`fs.readFile` + JSON parse + merge + `fs.writeFile`）
  - `src/main/index.ts`: `ipcMain.handle('claude:remove-hooks', ...)` を追加
  - `src/preload/index.ts`: `installClaudeHooks(): Promise<boolean>` / `removeClaudeHooks(): Promise<boolean>` / `checkClaudeHooks(): Promise<boolean>` を追加
  - `src/renderer/src/types/api.d.ts`: 同様に追加
  - `src/renderer/src/components/SettingsModal.tsx`: 「全般」タブに「Claude Code フック」セクションを追加。インストール / 削除ボタン + 現在のフック状態表示（インストール済み: 緑チェック / 未設定: グレー）
- **CLAUDE.md との整合性**: OK（Wave Terminal Claude Code 連携設計を直接踏襲）

---

#### A-2: wsh setmeta 相当 — OSC 9997 でブロックタイトル・アイコンを設定（Wave Terminal wsh setmeta 参考）

- **概要**: Wave Terminal の `wsh setmeta frame:title=<text> frame:icon=<name>` に相当する機能を、clau-tamina の OSC 9997 シーケンスとして実装する。PowerShell スクリプトから `Write-Host -NoNewline "\e]9997;title=<text>;icon=<icon>\a"` を書くと LeftPanel のターミナルタブラベルが自動更新される。
  - 例: `cd ~/proj-a && Write-Host -NoNewline "\e]9997;title=ProjA;icon=⚡\a"` でタブが「⚡ ProjA」に変わる
  - OSC 9997 は未使用なので干渉なし
- **根拠**: Phase 8 で F2 によるタブリネームは実装済みだが「スクリプトから自動的に変える」仕組みがない。Wave Terminal の setmeta はシェルの `cd` と組み合わせて使うのが典型パターン。CWD 変化と連動させると A-4 の「ディレクトリ別ヘッダー色」との相性も良い。
- **実装難易度**: 低
  - `src/pty-host/pty-host.ts`: `OSC_SETMETA_RE = /\x1b\]9997;title=([^;\x07\x1b]*?)(?:;icon=([^;\x07\x1b]*?))?(?:\x07|\x1b\\)/g` を追加し `setmeta` メッセージを送信（OSC パーサーチェーンに `processBgUpdateSequences` の後に組み込む）
  - `src/main/index.ts`: `setmeta` → `mainWindow.webContents.send('pty:setmeta', title, icon)` に転送
  - `src/preload/index.ts`: `onPtySetMeta(cb: (title: string, icon?: string) => void): () => void` を追加
  - `src/renderer/src/types/api.d.ts`: 同様に追加
  - `src/renderer/src/components/LeftPanel.tsx`: `onPtySetMeta` を購読し、ターミナルタブの表示ラベルを更新。`icon` があれば先頭に絵文字として追加（`setTabLabels({ ...tabLabels, terminal: (icon ? icon + ' ' : '') + title })`）
- **CLAUDE.md との整合性**: OK（Wave Terminal wsh setmeta 踏襲）

---

#### A-3: Block Magnify（フォーカス拡大） — Wave Terminal Magnify UX（Wave Terminal v0.14.x ブロック Magnify）

- **概要**: Wave Terminal の「ブロックを最大化してオーバーレイ表示する」Magnify 機能を clau-tamina に実装する。TerminalPane とチャットペインの右上に「最大化」ボタン（⛶）を追加。クリックすると対象ペインが画面全体に拡大（`position: fixed; inset: 0; z-index: 2000`）、背景は `backdrop-filter: blur(6px) brightness(0.4)` でオーバーレイ。Escape / 同ボタン再クリックで元のレイアウトに戻る。
  - ショートカット: Ctrl+Shift+M（ターミナル最大化）
  - CLAUDE.md のデザインシステムに「マグニファイ: ブロックを最大化表示 (`blur(10px)` オーバーレイ)」として既に明記済みで未実装
- **根拠**: 長い Claude の回答を読むときや、ターミナル出力をフルスクリーンで確認したいときに現在の分割レイアウトが窮屈になる。Magnify は Wave Terminal の核心 UX の一つで CLAUDE.md にも明記されているが未実装。実装は React state + CSS で完結するため低難易度。
- **実装難易度**: 低〜中
  - `src/renderer/src/App.tsx`（または SplitLayout 相当）: `magnifiedPane: 'terminal' | 'chat' | null` state を追加
  - `App.tsx` 経由で `terminalPane` と `ChatPane` に `onMagnify` / `magnified` props を渡す
  - `src/renderer/src/components/Terminal.tsx`: ツールバーに最大化ボタン（⛶）を追加。`magnified === true` 時: `position: fixed; inset: 0; z-index: 2000; background: #000` でレンダリング、`FitAddon.fit()` を再実行
  - `src/renderer/src/components/ChatPane.tsx`: パネルヘッダーに最大化ボタンを追加
  - 共通: `document.addEventListener('keydown', ...)` で Escape → `setMagnifiedPane(null)`
  - CLAUDE.md デザインシステム記述（`blur(10px)` オーバーレイ）と整合
- **CLAUDE.md との整合性**: OK（設計書に明示済み・未実装）

---

#### A-4: Electron 37 `-electron-corner-smoothing` — スクワークル角丸（Electron v37 新 CSS プロパティ）

- **概要**: Electron 37（2026年4月リリース）で追加された `-electron-corner-smoothing` CSS プロパティを適用し、全パネル・カード要素の角丸を macOS スタイルの「スクワークル（squircle）」形状に変更する。`border-radius` の通常の四分円弧より自然な曲線で、Electron 公式ブログでは "Apple's macOS design language" に合わせるためと説明されている。
  - 適用対象: SettingsModal、エージェントカード、ツール承認ダイアログ、チャットバブル
  - 値: `system-ui`（OS の角丸値を継承）または `75%`
- **根拠**: Electron 37 で新規追加。3〜5行の CSS 変更で全体の質感が大幅に向上する。コストゼロに近い visual polish。
- **実装難易度**: 極低
  - `src/renderer/src/assets/main.css`（またはグローバル CSS）: `:root { -electron-corner-smoothing: system-ui; }` を追加
  - `border-radius` 値は変更不要（`-electron-corner-smoothing` は補完であり上書きではない）
- **CLAUDE.md との整合性**: OK（既存デザインシステムの品質向上）

---

#### A-5: Active AI 風「エラー自動解析」— 終了コード非0時に Claude へ自動提案（Warp Terminal Active AI 参考）

- **概要**: Warp Terminal の「Active AI」（exit code + shell output から自動的に原因を提案する）に相当する機能を実装する。PowerShell でコマンドが非0終了コードで終了した際、ターミナルのツールバーに「❌ Claudeに聞く」ボタンを一時表示（5秒間フェードイン→フェードアウト）。クリックすると直前の出力を ChatPane に自動セットして送信する。
  - 終了コードの検出: PTY の `onData` で PowerShell の `PS>` プロンプト出現直前に `\r\n` で終わる行を「直前のコマンド出力」としてバッファリング。`pty.onExit` ではなく出力パターンで検出（バックグラウンドプロセス対策）
  - 送信するプロンプト: `「<直前30行>」で失敗しました。原因と修正方法を教えてください。`
- **根拠**: clau-tamina のコアユースケースは「PowerShell でエラーが出たら Claude に聞く」。現在この操作には手動コピペが必要。Warp の Active AI はこのフローを自動化しており、clau-tamina でも同様に実装すると大きな差別化になる。
- **実装難易度**: 中
  - `src/pty-host/pty-host.ts`: `lastOutputBuffer: string` を保持し、出力行を最大 30 行分バッファリング。PowerShell プロンプトパターン（`\r\n[^>]+> $` 等）を検出したら `error-context` メッセージで送信。`$LASTEXITCODE` の値は `]9;4;2;` 相当（エラー = state 2）で代用するか、プロンプト前の `ExitCode:N` 出力パターンを検出
  - `src/main/index.ts`: `error-context` → `mainWindow.webContents.send('pty:error-context', output)` に転送
  - `src/preload/index.ts`: `onPtyErrorContext(cb: (output: string) => void): () => void` を追加
  - `src/renderer/src/components/Terminal.tsx`: `errorContext: string | null` state を追加。5秒後に自動クリアされる「Claudeに聞く」ボタンを表示
  - ボタンクリック時: `window.api.sdkQuery(...)` でエラーコンテキスト付きプロンプトを送信

---

### 優先度B（将来サイクル候補）

#### B-1: wsh getvar/setvar 相当 — OSC 9996 でキーバリューをメインプロセスへ永続化

- **概要**: Wave Terminal の `wsh setvar`（セッション変数の永続化）を参考に、PowerShell スクリプトから OSC シーケンス経由で electron-store の値を読み書きできるようにする。
- **実装難易度**: 中
- **CLAUDE.md との整合性**: OK

#### B-2: Block-level セマンティックゾーン（OSC 133 Shell Integration）

- **概要**: Wave Terminal の「コマンド履歴ブロック（意味的ブロック単位でグループ化）」に相当する機能。OSC 133 シーケンスを PTY ホストで検出しコマンドと出力を分離してレンダリングする。CLAUDE.md の設計書にも明記済み。
- **実装難易度**: 高
- **CLAUDE.md との整合性**: OK（設計書記載済み）

#### B-3: Electron 38 システムアクセントカラー統合

- **概要**: Electron 38 の「システムアクセントカラーカスタマイズ」API を使い、clau-tamina のオレンジアクセント（`#d97757`）を Electron のシステムウィンドウボーダーに設定して OS レベルのビジュアル統合を強化する。
- **実装難易度**: 極低
- **CLAUDE.md との整合性**: OK

#### B-4: Wave Terminal wsh run 相当 — ChatPane コマンドボタンからサイドカー実行

- **概要**: Wave Terminal の `wsh run` に相当する機能。ChatPane で Claude が提案したコマンドブロックにクリック実行ボタンを追加し、PTY に直接書き込んで結果を返す。
- **実装難易度**: 中
- **CLAUDE.md との整合性**: OK

#### B-5: Wave Terminal wsh secret 相当 — API キー管理 UI

- **概要**: Wave Terminal の `wsh secret` コマンド（シークレット管理）に相当する UI を SettingsModal に追加する。現在 `.env` ファイルに直書きしている `ANTHROPIC_API_KEY` を GUI から安全に設定できるようにする。
- **実装難易度**: 低〜中
- **CLAUDE.md との整合性**: OK

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| Wave Terminal Durable SSH Sessions | SSH サポートはスコープ外 |
| Wave Terminal wsl 統合 | WSL2 サポートは将来フェーズ |
| Electron 37 `before-mouse-event` | 現時点で clau-tamina に明確な応用場面なし |
| Warp Cloud Agents / Oz 統合 | SaaS 連携のためスコープ外 |
| `contextBridge.executeInMainWorld` 全面移行 | リスク高・sandbox: false を使っているため大規模改修が必要 |

---

## 参考リンク

- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Wave Terminal Claude Code Integration](https://docs.waveterm.dev/claude-code)
- [Wave Terminal wsh Reference](https://docs.waveterm.dev/wsh-reference)
- [Wave Terminal Key Bindings](https://docs.waveterm.dev/keybindings)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Complete Guide 2026](https://thepromptshelf.dev/blog/claude-code-hooks-complete-reference-2026/)
- [Electron 37.0.0 Release](https://www.electronjs.org/blog/electron-37-0)
- [Electron 38.0.0 Release](https://www.electronjs.org/blog/electron-38-0)
- [Warp Terminal 2026 Changelog](https://docs.warp.dev/changelog/2026/)
- [Warp Terminal Active AI Guide](https://www.digitalapplied.com/blog/warp-ai-terminal-agentic-cli-workflows-guide)
