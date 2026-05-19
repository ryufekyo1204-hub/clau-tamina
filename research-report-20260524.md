# リサーチレポート 2026-05-24

## 調査方法
WebSearch / WebFetch で以下のトピックを調査:
- Wave Terminal 最新リリース（v0.14.5 以降）の UX・機能
- Wave Terminal カスタマイズ・キーバインド詳細
- Warp Terminal 2026 の最新 UX（エージェントモード・ブロック改善・MCP）
- Claude Code SDK TypeScript 新機能（2025-2026）
- Electron v36 新機能

---

## 提案機能一覧

### 優先度A（次サイクルで実装推奨）

#### A-1: wsh badge 相当 — OSC 9999 バッジ全機能対応（Wave Terminal v0.14.2 ブロックバッジ拡充）

- **概要**: Wave Terminal v0.14.2 で追加された「ブロックバッジ」機能に倣い、clau-tamina の既存 OSC 9999 バッジ実装を強化する。具体的には: (1) バッジにカラーを持てるようにする（`OSC 9999;badge=<text>;color=<hex>`）、(2) ターミナルが BELL を受信したとき LeftPanel タブのターミナルタブに自動バッジ表示、(3) バッジはタブをアクティブにすると自動クリア、の3点。
- **根拠**: Phase 7 で Bell 視覚インジケーター（Header 3秒表示）を実装したが、タブが非アクティブ時（ファイル/プロセスタブ閲覧中）は見えない。Wave の「バッジがタブバーに roll-up される」設計を取り込むと、タブを切り替えずに状態把握できる。
- **実装難易度**: 低
  - `src/pty-host/pty-host.ts`: OSC 9999 パーサーにカラー対応を追加（`badge=<text>` + optional `;color=<hex>`）
  - `src/main/index.ts`: `bell` / `badge-update` メッセージを `pty:tab-badge` に統一 or 追加チャンネル
  - `src/renderer/src/components/LeftPanel.tsx`: タブボタンに小さなバッジドット（`8px` 円）を表示するロジックを追加。`onPtyBell` / `onPtyBadgeUpdate` を購読し、アクティブタブ切り替え時にクリア
  - `src/renderer/src/types/api.d.ts`: `onPtyTabBadge` 型追加（任意）
- **CLAUDE.md との整合性**: OK（Wave Terminal ブロックバッジ踏襲）

---

#### A-2: `wsh setbg` 相当 — OSC シーケンスでターミナルブロック背景を変更（Wave Terminal wsh setbg 参考）

- **概要**: Wave Terminal の `wsh setbg "#ff0000"` コマンドを参考に、clau-tamina でも PowerShell から OSC シーケンス経由でターミナルペインの背景色を動的に変更できるようにする。例: `Write-Host -NoNewline "\e]9998;bg=#1a2a1a\a"` を PowerShell スクリプトに書けばターミナル背景が変わる。
- **根拠**: Phase 8 で「ヘッダー背景色」をカスタマイズできるようにしたが、ターミナルブロック自体の色はまだ固定。wsh setbg 相当の OSC を実装するとプロジェクト別に視覚的な区別がさらに強化される。複数プロジェクトを開いているユーザーに訴求力が高い。
- **実装難易度**: 低
  - `src/pty-host/pty-host.ts`: `OSC_BGSET_RE = /\x1b\]9998;bg=([^;\x07\x1b]+)(?:\x07|\x1b\\)/g` を追加し `bg-update` メッセージを送信
  - `src/main/index.ts`: `bg-update` を `pty:bg-update` IPC に転送
  - `src/preload/index.ts`: `onPtyBgUpdate(cb: (color: string) => void): () => void` を追加
  - `src/renderer/src/types/api.d.ts`: `onPtyBgUpdate` を追加
  - `src/renderer/src/components/Terminal.tsx`: `onPtyBgUpdate` を購読し、`containerRef.current` の `style.background` を更新
- **CLAUDE.md との整合性**: OK（Wave Terminal wsh setbg 踏襲）

---

#### A-3: Claude Code SDK `promptSuggestions` — 次プロンプトの予測表示（Claude Code SDK 新機能）

- **概要**: Claude Code SDK の新オプション `promptSuggestions: true` を有効にすると、各ターン終了後に `type: "prompt_suggestion"` メッセージが届き、Claude が次のユーザープロンプトを予測提案する。これを ChatPane の入力欄下部にチップとして表示し、クリックで入力欄にセットできるようにする。
- **根拠**: Warp Terminal の「AI suggestions wired into shell history」と同様の UX。「次に何を聞けばよいか」というユーザーの認知的負荷を下げ、Claude との会話を加速する。実装は SDK オプション1個 + メッセージ型1種類の追加のみで非常に軽量。
- **実装難易度**: 低
  - `src/sdk-host/sdk-host.mjs`: `query()` オプションに `promptSuggestions: true` を追加
  - `src/renderer/src/store/session.ts`: `SdkMessage.type` に `'prompt_suggestion'` を追加。`promptSuggestion: string` state を追加し、`handleSdkMessage` で `prompt_suggestion` メッセージを受け取ったら保存
  - `src/renderer/src/components/ChatPane.tsx`: 入力欄の下（または上）に `promptSuggestion` が存在するとき小さなチップを表示。クリックで `setInput(promptSuggestion)` + `setPomptSuggestion('')`
- **CLAUDE.md との整合性**: OK（Claude Code SDK 新機能活用）

---

#### A-4: Warp 式「ディレクトリ→ヘッダー色」自動マッピング（Warp Terminal directory-to-color 参考）

- **概要**: Warp Terminal が実装した「ディレクトリ→タブ色の自動マッピング」を clau-tamina に取り込む。Phase 8 で実装した `headerBackground` 設定を拡張し、CWD ごとのヘッダー色マッピング（`Record<string, string>` の `cwdColorMap`）を保存できるようにする。CWD が変わるたびに（`onPtyCwdUpdate` イベント）マッピングを参照してヘッダー色を自動切り替えする。
- **根拠**: Phase 7 で OSC 7 CWD トラッキングを実装済み。Phase 8 でヘッダー背景色カスタマイズも実装済み。この2つを組み合わせるだけで Warp の killer feature が実現できる。PowerShell ユーザーが複数プロジェクトを行き来するとき視覚的な文脈切り替えが即座にわかる。
- **実装難易度**: 低〜中
  - `src/main/index.ts`: `Settings` に `cwdColorMap?: Record<string, string>` を追加
  - `src/renderer/src/types/api.d.ts`: `ApiSettings` に `cwdColorMap?` を追加
  - `src/renderer/src/components/Header.tsx`:
    - `onPtyCwdUpdate` を購読し、`getSettings()` の `cwdColorMap` から色を引いてヘッダー背景を自動更新
  - `src/renderer/src/components/SettingsModal.tsx`:
    - 「外観」セクションに「ディレクトリ別カラーマップ」テーブルを追加（現在の CWD を追加するボタン + カラーピッカー + 削除ボタン）
- **CLAUDE.md との整合性**: OK（Warp Terminal directory-to-color 参考 + 既存 OSC 7 実装活用）

---

#### A-5: Claude Code SDK `maxBudgetUsd` — コスト上限ガード（Claude Code SDK 新機能）

- **概要**: Claude Code SDK の新オプション `maxBudgetUsd: number` を使い、1クエリのコストが設定した上限を超えたら自動停止する機能を追加する。設定モーダルに「1クエリあたりのコスト上限（USD）」スライダーを追加し、0（無制限）〜5.00ドルの範囲で設定できるようにする。
- **根拠**: Phase 3 以降コスト表示は実装済みだが「上限を超えたら止める」仕組みがなかった。長時間タスクや誤操作で意図せず高額になるリスクを低コストで軽減できる。SDK の1オプション追加のみで機能する。
- **実装難易度**: 極低（3〜5行）
  - `src/main/index.ts` or `sdk-host.mjs`: `query()` オプションに `maxBudgetUsd: settings.maxBudgetUsd ?? 0` を追加（0 は無制限扱い）
  - `src/main/index.ts`: `Settings` に `maxBudgetUsd?: number` を追加
  - `src/renderer/src/types/api.d.ts`: `ApiSettings` に `maxBudgetUsd?` を追加
  - `src/renderer/src/components/SettingsModal.tsx`: 「全般」タブに「コスト上限」スライダーを追加（0=無制限と表示）
- **CLAUDE.md との整合性**: OK（Claude Code SDK 新機能活用）

---

### 優先度B（将来サイクル候補）

#### B-1: Electron v36 `roundedCorners` — フレームレスウィンドウ角丸

- **概要**: Electron v36 で Windows にも `roundedCorners` オプションが追加された。`titleBarStyle: 'hidden'` のフレームレスウィンドウに現代的な角丸を適用する。
- **実装難易度**: 極低
- **CLAUDE.md との整合性**: OK

#### B-2: `contextBridge.executeInMainWorld`（Electron v36）— セキュリティ強化

- **概要**: Electron v36 の新 API `contextBridge.executeInMainWorld` を使い、現在 `sandbox: false` で運用しているプリロードのセキュリティ境界を段階的に強化する。
- **実装難易度**: 高（全 preload を見直す必要あり）
- **CLAUDE.md との整合性**: OK

#### B-3: Warp 式エージェント思考ブロック折りたたみ

- **概要**: Warp Terminal の「Agent thinking blocks with toggleable expand/collapse」を参考に、ChatPane の長い Claude 応答に折りたたみ/展開ボタンを追加する。
- **実装難易度**: 中
- **CLAUDE.md との整合性**: OK

#### B-4: Claude Code SDK `enableFileCheckpointing` + `rewindFiles()`

- **概要**: SDK の `enableFileCheckpointing: true` を有効化し、ファイル変更を追跡してチェックポイントに戻せるようにする。ChatPane に「このターンの前に戻す」ボタンを追加。
- **実装難易度**: 中〜高
- **CLAUDE.md との整合性**: OK

#### B-5: Warp 式 Markdown テーブル・Mermaid 図レンダリング

- **概要**: Warp が実装した「マークダウンテーブル・Mermaid 図のチャット内レンダリング」を clau-tamina の ChatPane に実装する。`react-markdown` + `mermaid.js` を追加。
- **実装難易度**: 中
- **CLAUDE.md との整合性**: OK

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| Warp Cloud Agents / Oz 統合 | SaaS 連携のためスコープ外 |
| Electron v36 `contextBridge.executeInMainWorld` 全面移行 | リスクが高い（sandbox: false を使っているため大規模改修が必要） |
| Wave Terminal Durable SSH Sessions | SSH サポートはスコープ外 |
| `WebContents.focusedFrame`（Electron v36） | 現時点で clau-tamina に応用場面なし |

---

## 参考リンク

- [Wave Terminal Release Notes](https://docs.waveterm.dev/releasenotes)
- [Wave Terminal v0.14.5 GitHub Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.5)
- [Wave Terminal Customization](https://docs.waveterm.dev/customization)
- [Wave Terminal Keybindings](https://docs.waveterm.dev/keybindings)
- [wsh Reference](https://docs.waveterm.dev/wsh-reference)
- [Warp Terminal 2026 Changelog](https://docs.warp.dev/changelog/2026/)
- [Warp Guide 2026: Agent Mode, MCP](https://www.deployhq.com/guides/warp)
- [Claude Code SDK TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript)
- [Claude Code SDK TypeScript V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [Electron v36.0.0 Release](https://github.com/electron/electron/releases/tag/v36.0.0)
