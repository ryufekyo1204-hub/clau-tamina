# リサーチレポート 2026-05-27

## 調査方法
Phase 13 fix-report（全 A 機能完了）を受け、Wave Terminal v0.14.5 の新機能を中心に調査。
前回の Priority B 機能を昇格させつつ、新規 UX ギャップを追加。

---

## 提案機能一覧

### 優先度A（Phase 14 で実装）

#### A-1: Split Ratio Preset Buttons（Wave Terminal v0.14.5 `showsplitbuttons`）

- **概要**: ターミナルツールバーに分割比率プリセットボタンを追加する。`[3:7]` `[5:5]` `[7:3]` の3つのボタンをクリックすると `splitRatio` が即座に変わる。Wave Terminal の `app:showsplitbuttons` 機能の直接移植。
- **根拠**: 現状はドラッグでのみ比率調整が可能。よく使う比率にワンクリックでアクセスできることで作業効率が大幅に向上。特にターミナルを広くしてコーディングするときと、チャットを広くして読むときで素早く切り替えられる。
- **実装難易度**: 極低
  - `src/renderer/src/components/Terminal.tsx`: ツールバーに3ボタン追加。`useSessionStore` から `setSplitRatio` を取得してクリック時に設定。
  - ボタンスタイル: Cyber-Minimal（border 1px, radius-sm, font-mono, uppercase ラベル）
  - アクティブ状態: 現在の `splitRatio` に最も近いプリセットをアクティブ表示
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 直接踏襲）

---

#### A-2: ProcessViewer — ソート可能カラム＋プロセスシグナル（Wave Terminal v0.14.5）

- **概要**: ProcessViewer のカラムヘッダをクリックするとソート順が切り替わる（↑↓ インジケータ付き）。行ホバーで Kill ボタンが出現し、`Stop-Process -Id <pid>` を実行できる。Wave Terminal の Process Viewer widget と同等の機能。
- **根拠**: 現状の ProcessViewer は CPU 使用量でしかソートできず、PID 情報もなく、プロセスを終了する手段がない。Wave v0.14.5 の Process Viewer が持つ sortable columns と send-signal 機能を移植してフル実装にする。
- **実装難易度**: 低〜中
  - `src/main/index.ts`:
    - `process:list` の PowerShell コマンドに `@{n='pid';e={$_.Id}}` を追加
    - 新 IPC `process:kill`: `Stop-Process -Id <pid> -Force` を実行
  - `src/preload/index.ts`: `killProcess(pid: number): Promise<boolean>` を追加
  - `src/renderer/src/types/api.d.ts`: `ProcessInfo.pid?: number` 追加 + `killProcess` 宣言
  - `src/renderer/src/components/ProcessViewer.tsx`:
    - `sortKey` state（`'name' | 'cpu' | 'memMb'`）と `sortAsc` state
    - ヘッダクリックで sort key をトグル、同じキーなら `sortAsc` を反転
    - 行ホバーで Kill ボタン（⊗）を表示。クリックで `window.api.killProcess(proc.pid!)` を呼ぶ
    - pid がない行は Kill ボタン非表示
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.5 直接踏襲）

---

#### A-3: Mermaid ダイアグラムレンダリング（Warp Terminal / Wave Terminal 参考）

- **概要**: ChatPane の ReactMarkdown に Mermaid 対応を追加する。Claude が ` ```mermaid ` コードブロックを出力したとき、テキストではなく SVG ダイアグラムとして描画する。Warp Terminal と同様のアプローチ。
- **根拠**: Claude Code はアーキテクチャ図・フローチャート・シーケンス図を Mermaid 形式で出力することが多い。現状はテキストブロックとして表示されているため非常に読みにくい。mermaid ライブラリで SVG 化することで圧倒的に見やすくなる。
- **実装難易度**: 中
  - `npm install mermaid`
  - `src/renderer/src/components/ChatPane.tsx`:
    - `MermaidBlock` コンポーネント: `useEffect` で `mermaid.render()` を呼び SVG を生成、`dangerouslySetInnerHTML` で描画
    - `mermaid.initialize({ theme: 'dark', ... })` でテーマ設定（Cyber-Minimal カラー）
    - `mdComponents.code` の `className === 'language-mermaid'` 分岐に `<MermaidBlock>` を使用
    - エラー時: エラーテキストを `status-error` 色で表示
- **CLAUDE.md との整合性**: OK（Warp Terminal UX 踏襲）

---

#### A-4: タブ右クリックコンテキストメニュー（Wave Terminal B-3 昇格）

- **概要**: LeftPanel のタブを右クリックするとドロップダウンが表示され「リネーム」「デフォルトに戻す」「バッジをクリア」を実行できる。Wave Terminal のタブコンテキストメニューに相当。
- **根拠**: 現状 F2 キーでリネームできるが、タブを右クリックした方が直感的。バッジのクリアも含めることで一箇所から複数の操作が可能になる。
- **実装難易度**: 低
  - `src/renderer/src/components/LeftPanel.tsx`:
    - `contextMenu` state: `{ tab: LeftTab; x: number; y: number } | null`
    - 各タブに `onContextMenu` ハンドラを追加（`e.preventDefault()` + state 設定）
    - 絶対配置のコンテキストメニュー div: 項目をクリックで操作実行
    - ドキュメントクリックで自動閉じ（`useEffect` でリスナー登録）
    - Cyber-Minimal スタイル: border 1px, radius-sm, shadow-md, bg-elevated
- **CLAUDE.md との整合性**: OK（Wave Terminal B-3 昇格）

---

#### A-5: ターミナルベル音声通知（Wave Terminal v0.14.2 Bell Indicator 拡張）

- **概要**: 既存のビジュアルベル（🔔 アイコン表示）に加えて、OS のシステム通知（`new Notification(...)`）を使ったベル通知を追加する。非フォーカス時のみ通知を出す。また、ベルのビジュアルアニメーションを改善する（パルスアニメーション）。
- **根拠**: 現状の bell indicator（ヘッダーの 🔔 フェードイン）はターミナルにフォーカスしているときは気づきにくい。Wave Terminal v0.14.2 の bell indicator がタブバッジとして実装されているのと同様に、ベルが鳴ったときに確実にユーザーが気づける仕組みにする。
- **実装難易度**: 低
  - `src/main/index.ts`: `'pty:bell'` IPC メッセージ受信時に `new Notification({ title: 'clau-tamina', body: 'ターミナルベル' }).show()` を呼ぶ（ウィンドウ非フォーカス時のみ）
  - `src/pty-host/pty-host.ts`: ベル文字（`\x07`）検知で `ipc.send('pty:bell')` を送信（既に実装済みか確認）
  - `src/renderer/src/components/Header.tsx`: 🔔 アイコンのアニメーションを `bell-pulse` キーフレームで改善（ゆっくりスケール + フェード）
- **CLAUDE.md との整合性**: OK（Wave Terminal v0.14.2 拡張）

---

### 優先度B（将来サイクル候補）

#### B-1: OSC 1337 インライン画像表示（iTerm2 互換）
- xterm.js カスタムレンダーレイヤーが必要
- 実装難易度: 高

#### B-2: Warp 式 AI 入力補完（プロンプトサジェスト強化）
- 現状 `prompt_suggestion` メッセージはあるが UI が未強化
- 実装難易度: 中

#### B-3: SettingsModal — キーバインドカスタマイズタブ
- 現在のショートカットをユーザーが変更できる
- 実装難易度: 中〜高

#### B-4: Warp Blocks — コマンドの意味的ブロックグループ化
- ターミナル出力をコマンド単位でブロック分け
- 実装難易度: 高

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| SSH Durable Sessions | スコープ外 |
| COLORTERM=truecolor | pty-host.ts に実装済み（不要） |
| Quake Mode | main/index.ts に実装済み（不要） |
| Vim ナビ (Ctrl+Shift+H/L) | main/index.ts に実装済み（不要） |

---

## 参考リンク

- [Wave Terminal v0.14.5 Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.5)
- [Wave Terminal v0.14.2 Release](https://github.com/wavetermdev/waveterm/releases/tag/v0.14.2)
- [mermaid.js](https://mermaid.js.org/)
- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
