# リサーチレポート Phase 17

## 調査日
2026-05-23

## 調査方法
Phase 16 fix-report（全 A 機能完了）を受け、日常利用における摩擦ポイントを洗い出し。
ChatPane の情報密度向上・ターミナル快適化・UI polish を中心に調査。

---

## 提案機能一覧

### 優先度A（Phase 17 で実装）

#### A-1: ChatPane インラインコードの file path linkification

- **概要**: ReactMarkdown の `code` コンポーネントをカスタマイズし、インラインコード（バッククォート）の内容がファイルパスのパターンに一致する場合、クリッカブルリンクとして描画する。クリックでパスをターミナル入力欄に送信する。
- **根拠**: Claude Code はほぼ必ず「`src/components/Foo.tsx`」「`src/main/index.ts:123`」といった形式でファイルパスをバッククォートに入れて出力する。現状はテキストのままで、毎回コピーして terminal に貼り付けなければならない。クリックでターミナルにパスを送れるだけで大幅に作業効率が上がる。
- **実装難易度**: 低
  - `src/renderer/src/components/ChatPane.tsx`:
    - `mdComponents.code` のインラインコード分岐（`!isBlock`）で file path 判定を追加
    - 判定パターン: `/(^|\s)(\.{0,2}\/[\w\-.\/]+\.(tsx?|jsx?|py|md|json|css|html|toml|yaml|yml|rs|go|sh)(?::\d+)*)/`
    - マッチした場合: `<button>` or `<span>` で `onClick={() => window.api.ptyInput(path)}` を呼ぶ
    - スタイル: `var(--accent)` 色 + hover 時に下線、`var(--font-mono)` フォント
- **CLAUDE.md との整合性**: OK（Phase 16 研究 B-1 昇格）

---

#### A-2: メッセージタイムスタンプ（hover reveal）

- **概要**: `ChatMessage.timestamp` は既に存在するので、メッセージバブルにホバーした際に右下に `HH:MM:SS` 形式のタイムスタンプを表示する。
- **根拍**: 長い会話セッションで「いつ何をやったか」を後から確認したい場面がある。コードレビューやバグ調査時に時刻は重要な参照情報。常時表示ではなく hover reveal にすることで UI がうるさくならない。
- **実装難易度**: 極低（データは既存）
  - `src/renderer/src/components/ChatPane.tsx` の `MessageBubble`:
    - `hovered` state は既存（copy ボタン用）なので共有できる
    - `hovered && <span>HH:MM:SS</span>` を bubble 内に absolute 配置
    - スタイル: `var(--text-muted)`, `var(--font-mono)`, `--text-xs`
- **CLAUDE.md との整合性**: OK（UI polish）

---

#### A-3: ChatPane オートスクロール一時停止 + JUMP ボタン

- **概要**: チャットのメッセージリストをスクロールアップして読んでいるときに、新しいメッセージが来ても位置をキープし、画面右下に「↓ JUMP」ボタンを表示する。ボタンクリックで最下部に戻り自動スクロールを再開。
- **根拠**: 現状は新しいメッセージが来るたびに最下部にスクロールするので、長い出力を読んでいる途中で表示が飛んでしまう。Wave Terminal のスクロール挙動と同じ UX。
- **実装難易度**: 低〜中
  - `src/renderer/src/components/ChatPane.tsx`:
    - `messagesEndRef` と同様に `messagesContainerRef` を追加
    - `onScroll` ハンドラ: `scrollTop + clientHeight >= scrollHeight - 32` なら `autoScroll=true`、そうでなければ `false`
    - メッセージ追加時: `autoScroll` が true のときだけ `scrollToBottom()`
    - `!autoScroll` のとき: 絶対配置の「↓ JUMP」ボタンを表示
- **CLAUDE.md との整合性**: OK（Wave Terminal スクロール UX）

---

#### A-4: RightPanel ブラウザタブ Ctrl+Shift+B ショートカット + AI ステータスバッジ

- **概要**: 2つの改善を同時実装する。
  1. `Ctrl+Shift+B` で RightPanel をブラウザタブに切り替える（現在未実装）
  2. `Claude AI` タブに `isQuerying` 時はスピナーアニメーションを表示し、現在 AI が処理中であることをタブレベルで示す
- **根拠**: ブラウザパネルへの素早いアクセスキーがない。また、チャットペインが見えていない状態（ブラウザタブや chat hidden）でも Claude の処理状況がわかると便利。
- **実装難易度**: 低
  - `src/renderer/src/components/RightPanel.tsx`:
    - `useSessionStore` から `isQuerying` を取得
    - `useEffect` で `Ctrl+Shift+B` → `setActiveTab('browser')` / `Ctrl+Shift+C` → `setActiveTab('chat')`
    - `Claude AI` タブのラベル横に: `isQuerying && <span className="tab-spinner" />`
    - `@keyframes tab-spin { to { transform: rotate(360deg); } }` 12px 円弧
- **CLAUDE.md との整合性**: OK（Wave Terminal タブステータス表示）

---

#### A-5: ターミナルスクロールバックバッファサイズ設定

- **概要**: SettingsModal の「ターミナル」タブにスクロールバックサイズの設定を追加する。設定値は electron-store に保存し、Terminal の `scrollback` オプションに反映する。xterm.js は `term.options.scrollback` をランタイムで変更可能。
- **根拠**: デフォルトの xterm.js scrollback は 1000 行で、長時間の作業では不足する。特に Claude が長い出力を生成したあとに過去のコマンドに戻れないことがある。設定で 5000 や 10000 に増やせると助かる。
- **実装難易度**: 極低
  - `src/renderer/src/components/SettingsModal.tsx`:
    - `scrollbackLines` state（デフォルト 5000）を追加
    - Terminal タブに `<select>` を追加: `[1000, 3000, 5000, 10000]` 行から選択
    - `window.api.setSetting('scrollbackLines', value)` で保存
  - `src/renderer/src/components/Terminal.tsx`:
    - `getSettings()` で `scrollbackLines` を読み込み
    - `new Terminal({ ..., scrollback: scrollbackLines })` に設定
    - `term.options.scrollback` への動的更新（store listener）は複雑すぎるので再起動反映のみ
- **CLAUDE.md との整合性**: OK（ターミナル設定の充実）

---

### 優先度B（将来サイクル候補）

#### B-1: OSC 1337 インライン画像表示（iTerm2 互換）
- xterm.js カスタムレンダーレイヤーが必要
- 実装難易度: 高

#### B-2: SettingsModal — キーバインドカスタマイズタブ
- 実装難易度: 中〜高

#### B-3: Warp Blocks — コマンドの意味的ブロックグループ化
- 実装難易度: 高

#### B-4: ChatPane 内コードブロック "Run in Terminal" ボタン
- コードブロックにワンクリックで実行できるボタンを追加
- 実装難易度: 低〜中

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| SSH Durable Sessions | スコープ外 |
| Warp AI 入力補完強化 | prompt_suggestion は実装済み |

---

## 参考リンク

- [xterm.js Terminal Options](https://xtermjs.org/docs/api/terminal/interfaces/iterminaloptions/)
- [Wave Terminal Scroll UX](https://docs.waveterm.dev/)
- [ReactMarkdown components](https://github.com/remarkjs/react-markdown#use-custom-components)
