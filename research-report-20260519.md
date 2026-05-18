# リサーチレポート 2026-05-19

## 調査方法
WebSearch で以下のトピックを調査:
- Wave Terminal 最新動向（2026年リリース）
- Electron 35/36 の新機能
- Claude Code / Agent SDK の最新API
- xterm.js v6 アドオン更新
- node-pty / ConPTY の動向

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: プロセスビューワーウィジェット（Wave Terminal v0.14.5 準拠）
- **概要**: Wave Terminal v0.14.5（2026-04-16）が実装した「Process Viewer」を参考に、実行中の PowerShell プロセス・子プロセスをリスト表示するパネルを追加
- **根拠**: Wave Terminal はプロセス・CPU・メモリを表示し、シグナル送信も可能。clau-tamina でエージェントが起動した子プロセスを可視化することでデバッグ性が向上する
- **実装難易度**: 中
  - `ps` / `Get-Process` を pty 経由で実行するか、Electron の `process` API + `child_process` で取得
  - 既存の AgentCards パネルの下に追加タブとして配置できる
- **CLAUDE.md との整合性**: OK（Wave Terminal UX 機能の採用として明示されている）

#### A-2: ブロックバッジ・実行状態インジケーター（Wave Terminal v0.14.2 準拠）
- **概要**: Wave Terminal v0.14.2（2026-03-12）の「block badges」を参考に、AgentCards の各カードに色付きバッジを追加。タブバーにもロールアップ表示する
- **根拠**: 複数エージェントが並列実行中、ステータスをひと目で確認できる。特にエージェントがエラーになったとき即時に気づける
- **実装難易度**: 低
  - AgentCards.tsx の STATUS_COLOR / STATUS_LABEL を拡張し、ドット→バッジ（数字・アイコン付き）に変更するだけ
  - Header.tsx にエラー中エージェント数を表示
- **CLAUDE.md との整合性**: OK

#### A-3: Claude Agent SDK V2 マルチターン対応（TypeScript V2 Preview）
- **概要**: Agent SDK V2（プレビュー）が提供する `send()` / `stream()` パターンを使い、sdk-host.ts を更新してセッションIDを維持したマルチターン会話を実現する
- **根拠**: 現在の `query()` は毎回独立した会話として処理される。V2 の session-based API を使えば、会話履歴を SDK 側が管理するため、クライアントで history を手動で渡す必要がなくなる
- **実装難易度**: 高（V2 が不安定プレビューのため API 変更リスクあり）
- **CLAUDE.md との整合性**: OK（Claude Code SDK の新APIとして調査テーマに含まれる）
- **注意**: V2 は不安定。実装は V2 と V1 のフォールバックを持つ設計にすること

#### A-4: Quake Mode（グローバルホットキーでウィンドウ表示/非表示）
- **概要**: Wave Terminal v0.14.5 の「Quake Mode」を参考に、グローバルショートカットキーで clau-tamina ウィンドウをトグル表示/非表示にする
- **根拠**: PowerShell から `clau-tamina` を起動するだけでなく、他のアプリ作業中に瞬時に呼び出せる。Electron の `globalShortcut` API で実装可能
- **実装難易度**: 低
  - `electron.globalShortcut.register('Ctrl+Alt+T', ...)` で main.ts に追加するだけ
  - Settings に「グローバルホットキー設定」欄を追加する必要あり
- **CLAUDE.md との整合性**: OK（Wave Terminal のUX機能として採用対象）

---

### 優先度B（将来サイクル候補）

#### B-1: node-pty 1.2.0 beta への移行検討
- **概要**: node-pty 1.2.0-beta.13（2026-05-13）が利用可能。現在 1.1.0 を使用しているが、beta での ConPTY 改善が含まれる可能性
- **根拠**: Ctrl-C ハンドリングや PowerShell 互換性の改善が含まれている可能性
- **実装難易度**: 低（package.json の更新のみだが、beta のためリスクあり）
- **CLAUDE.md との整合性**: OK

#### B-2: Electron 36 へのアップグレード（BrowserWindow.isSnapped() 活用）
- **概要**: Electron 36.0.0 の `BrowserWindow.isSnapped()` で Windows Snap レイアウトとの統合を改善
- **根拠**: Windows 11 の Snap レイアウトでウィンドウを配置した際に検知して、SplitLayout の比率を自動調整するなどの UX 改善が可能
- **実装難易度**: 低（Electron アップグレード + isSnapped() 検知追加）
- **CLAUDE.md との整合性**: OK（Windows 固有の最適化）

#### B-3: ファイルチェックポインティング（Agent SDK enableFileCheckpointing）
- **概要**: Agent SDK の `enableFileCheckpointing: true` オプションを sdk-host.ts に追加し、エージェントによるファイル変更前にバックアップを自動作成
- **根拠**: バイパスモードでの自動実行中に誤ったファイル変更をロールバック可能にする
- **実装難易度**: 低（オプション追加のみ）
- **CLAUDE.md との整合性**: OK

#### B-4: xterm.js シャドウDOM対応（WebGL addon）
- **概要**: xterm.js v6 の WebGL addon がシャドウDOM をサポート済み。将来的に複数ターミナルをカード内に組み込む際に有効
- **根拠**: マルチエージェントモードで各エージェントに独立したミニターミナルを提供する場合に必要
- **実装難易度**: 高（現在の構成を大幅に変更する必要あり）
- **CLAUDE.md との整合性**: 要確認（設計思想に反しない範囲で）

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Claude Agent SDK V2 の即時採用 | 不安定プレビュー（API が変更される可能性が高い） |
| macOS Writing Tools（Electron 36） | Windows 専用アプリのため対象外 |
| クロスプラットフォーム対応 | CLAUDE.md の設計思想（Windows 専用）に反する |
| WSL2 ターミナル統合 | Phase 1〜3 の範囲を超える。将来フェーズで検討 |

---

## 参考リンク
- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Electron 35.0.0](https://www.electronjs.org/blog/electron-35-0)
- [Electron 36.0.0](https://www.electronjs.org/blog/electron-36-0)
- [Claude Agent SDK TypeScript V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [node-pty npm](https://www.npmjs.com/package/node-pty)
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js)
