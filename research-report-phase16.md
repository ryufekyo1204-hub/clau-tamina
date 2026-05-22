# リサーチレポート Phase 16

## 調査日
2026-05-22

## 調査方法
Phase 15 fix-report（全 A 機能完了）を受け、現状のコードベースで「ユーザーが毎日使う動作」にまだ摩擦があるポイントを調査。
ChatPane/Terminal/SplitLayout の使い勝手ギャップを中心に、低コスト・高リターンの改善を優先選定。

---

## 提案機能一覧

### 優先度A（Phase 16 で実装）

#### A-1: Chat prompt history（Up/Down arrow recall）

- **概要**: ChatPane の入力欄で ↑↓ キーにより送信済みプロンプトを呼び出す。シェル history と同じ操作感。最大 50 件をセッション内メモリに保持する。
- **根拠**: AI チャットで少し前に送ったプロンプトを再利用したい場面は頻出する。毎回コピー&ペーストするのは手間。ChatGPT・Warp Terminal ともに実装済みの基本機能。
- **実装難易度**: 極低
  - `src/renderer/src/components/ChatPane.tsx`:
    - `promptHistory` ref（`useRef<string[]>([])`）と `historyIdx` ref（`useRef(-1)`）を追加
    - `submit` 時に `promptHistory.current.unshift(prompt)` し最大50件にトリム
    - `onKeyDown` で `ArrowUp` → `historyIdx++` しインプットを更新、`ArrowDown` → `historyIdx--` or `-1` でクリア
    - カーソルが先頭またはテキストなしのときのみ history に入る
- **CLAUDE.md との整合性**: OK（Warp Terminal history recall 踏襲）

---

#### A-2: Claude メッセージ hover copy ボタン

- **概要**: アシスタントメッセージにマウスを乗せると右上に "COPY" ボタンが出現し、クリックでメッセージの raw Markdown テキストをクリップボードにコピーする。
- **根拠**: Claude の出力コードや手順を手動で選択コピーするのは煩雑。hover copy は Claude.ai・ChatGPT・Cursor ともに標準実装。現状のチャットには一切コピー機能がない（コードブロック個別の COPY はあるが、メッセージ全体はない）。
- **実装難易度**: 極低
  - `src/renderer/src/components/ChatPane.tsx` の `MessageBubble`:
    - `const [hovered, setHovered] = useState(false)` と `const [copied, setCopied] = useState(false)`
    - 外側 div に `onMouseEnter={() => setHovered(true)}` / `onMouseLeave={() => setHovered(false)}`
    - `hovered && !isUser` のときに absolute 配置の COPY ボタンを表示
    - Cyber-Minimal: `radius-sm`, `font-mono`, `text-xs`, accent color on copied
- **CLAUDE.md との整合性**: OK（Claude.ai / Warp Terminal 標準 UX）

---

#### A-3: チャット履歴クリア（CLR ボタン + Ctrl+L）

- **概要**: ChatPane ヘッダーに "CLR" ボタンを追加。クリックで現在のチャット履歴を全消去する。`clearMessages()` は既に session store に実装済みなので UI を追加するだけ。また Ctrl+L ショートカットも追加する。
- **根拠**: Claude と作業していると「別のトピックに切り替えたい」場面が多い。現状は履歴をクリアする UI がなく、毎回アプリを再起動するしかない。Ctrl+L はターミナルの clear と同じ操作感で直感的。
- **実装難易度**: 極低（clearMessages は store に実装済み）
  - `src/renderer/src/components/ChatPane.tsx`:
    - ヘッダーに "CLR" ボタン追加（危険操作なので `window.confirm` で確認しない → シンプルに即実行、Ctrl+Z 相当の「戻す」は rewind で代替）
    - `useEffect` で `Ctrl+L` キーバインド追加（ChatPane にフォーカスしているときのみ、inputの Ctrl+L は消さない）
    - 実際は document level で `Ctrl+Shift+L` を chat clear に割り当てる（ターミナルの `Ctrl+Shift+H/L` と重複しないか確認済み：`Ctrl+Shift+H` = focus terminal, `Ctrl+Shift+L` = focus chat → 別のキーを使う）
    - `Ctrl+Shift+Delete` を chat clear に割り当て
- **CLAUDE.md との整合性**: OK（Wave Terminal のワークスペースクリア操作 踏襲）

---

#### A-4: ターミナルツールバー — 選択テキストコピー + Ctrl+L クリアボタン

- **概要**: Terminal.tsx のツールバーに2ボタンを追加する。
  1. **SEL** ボタン: `term.getSelection()` をクリップボードにコピー（選択なしの時は非活性）
  2. **CLR** ボタン: `window.api.ptyInput('\x0C')` を呼び出して `Ctrl+L` をターミナルに送信（画面クリア）
- **根拠**: ターミナルのテキストを選択してコピーするには右クリックやブラウザの Ctrl+C が必要だが、Electron では右クリックメニューが出ないケースがある。ボタンでクリップボードコピーを提供することで確実にコピーできる。CLR はターミナルを素早くクリアするためによく使われる操作。
- **実装難易度**: 極低
  - `src/renderer/src/components/Terminal.tsx`:
    - `termRef.current?.hasSelection()` を監視する `selectionActive` state（`onSelectionChange` で更新）
    - SEL ボタン: `navigator.clipboard.writeText(termRef.current?.getSelection() ?? '')` 
    - CLR ボタン: `window.api.ptyInput('\x0C')`
    - 両ボタンとも既存ツールバーのスタイルに準拠
- **CLAUDE.md との整合性**: OK（Wave Terminal clipboard actions 踏襲）

---

#### A-5: SplitLayout ディバイダー ダブルクリック → 50:50 リセット

- **概要**: ターミナル／チャットの分割ディバイダーをダブルクリックすると、`splitRatio` が 0.5（50:50）にリセットされる。シングルクリックは現在の動作（ドラッグ開始）を維持。
- **根拠**: 比率プリセットボタン（Phase 14 A-1）で 5:5 に戻せるが、ディバイダー自体をダブルクリックする方がより直感的。Wave Terminal のパネルリサイズ UX に合わせた改善。
- **実装難易度**: 極低（1行追加）
  - `src/renderer/src/components/SplitLayout.tsx`:
    - ディバイダー div に `onDoubleClick={() => setSplitRatio(0.5)}` を追加
    - 短い scale アニメーション（`transform: scaleX(1.5)` 80ms）でダブルクリックをフィードバック
- **CLAUDE.md との整合性**: OK（Wave Terminal パネルリセット UX 踏襲）

---

### 優先度B（将来サイクル候補）

#### B-1: File path linkification in ChatPane
- Claude が出力するファイルパス（`src/foo.ts:12`）をクリッカブルリンクにする
- クリックで `code <path>` をターミナルに送信
- 実装難易度: 中（ReactMarkdown カスタム text レンダラー必要）

#### B-2: OSC 1337 インライン画像表示（iTerm2 互換）
- xterm.js カスタムレンダーレイヤーが必要
- 実装難易度: 高

#### B-3: SettingsModal — キーバインドカスタマイズタブ
- ShortcutsOverlay で表示中のショートカットを実際に変更できる UI
- 実装難易度: 中〜高

#### B-4: Warp Blocks — コマンドの意味的ブロックグループ化
- ターミナル出力をコマンド単位でブロック分け（PTY ホスト側でコマンド境界を検出）
- 実装難易度: 高

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| OSC 1337 インライン画像 | xterm カスタムレイヤー必要（高難度） |
| キーバインドカスタマイズ完全版 | スコープ大きすぎ（継続） |

---

## 参考リンク

- [Wave Terminal Keyboard Shortcuts](https://docs.waveterm.dev/keyboardshortcuts)
- [xterm.js Terminal.getSelection()](https://xtermjs.org/docs/api/terminal/classes/terminal/#getselection)
- [xterm.js Terminal.onSelectionChange()](https://xtermjs.org/docs/api/terminal/classes/terminal/#onselectionchange)
