# リサーチレポート Phase 15

## 調査日
2026-05-22

## 調査方法
Phase 14 fix-report（全 A 機能完了）を受け、Priority B 機能の昇格 + 新規 UX ギャップを調査。
xterm.js エコシステムの未活用アドオン、チャット UX の細部改善、ナビゲーション補助に着目。

---

## 提案機能一覧

### 優先度A（Phase 15 で実装）

#### A-1: Terminal Web Links（@xterm/addon-web-links）

- **概要**: ターミナル出力に含まれる URL を自動検出し、Ctrl+Click で既定ブラウザを開く。
  xterm.js 公式アドオン `@xterm/addon-web-links` を利用。
- **根拠**: git の PR URL、エラーの Stack Overflow リンク、npm パッケージ URL など、ターミナルで URL が頻出する。
  現状はコピー&ペーストが必要で摩擦が大きい。Wave Terminal もデフォルトで URL クリック対応している。
- **実装難易度**: 極低（アドオン追加のみ）
  - `npm install @xterm/addon-web-links --ignore-scripts`
  - `src/renderer/src/components/Terminal.tsx`: `WebLinksAddon` をロード、`openURL` コールバックで `window.api.openExternal(url)` を呼ぶ
  - `src/preload/index.ts`: `openExternal(url)` 追加（`shell:open-external` IPC）
  - `src/main/index.ts`: `ipcMain.on('shell:open-external', ...)` で `shell.openExternal(url)` 実行
  - `src/renderer/src/types/api.d.ts`: `openExternal(url: string): void` 宣言
- **CLAUDE.md との整合性**: OK（xterm.js エコシステム内、Wave Terminal 同等機能）

---

#### A-2: ChatPane — メッセージ検索（Ctrl+Shift+G）

- **概要**: チャット内のメッセージを検索・ハイライトする。Ctrl+Shift+G でメッセージ一覧の上に
  フローティング検索バーが展開し、入力したキーワードを含むメッセージだけをフィルタ表示する。
  ESC または再度 Ctrl+Shift+G で閉じる。
- **根拠**: Claude との長い会話で特定のファイル名・エラー名を遡って検索したい場面が多い。
  現状は手動スクロールのみ。Wave Terminal のコマンド履歴検索と同じ UX コンセプト。
- **実装難易度**: 低
  - `src/renderer/src/components/ChatPane.tsx`:
    - `chatSearchOpen`, `chatSearchQuery` state 追加
    - Ctrl+Shift+G でトグル
    - メッセージ一覧の上部に検索バーを表示（Cyber-Minimal: border-accent, font-mono）
    - `filteredMessages`: `chatSearchQuery` が空なら全件、空でなければ content に query を含む行のみ
    - マッチ数バッジを検索バー右端に表示
- **CLAUDE.md との整合性**: OK（Wave Terminal 検索 UX 踏襲）

---

#### A-3: キーボードショートカット ヘルプオーバーレイ（Ctrl+?）

- **概要**: Header の `?` ボタン または Ctrl+? でショートカット一覧モーダルを表示する。
  全ショートカットを Cyber-Minimal グリッド（2列）でリスト表示。読み取り専用。
- **根拠**: 機能が増えるにつれてショートカットが増加し、ユーザーが覚えられなくなる。
  Wave Terminal の `Ctrl+?` ショートカットヘルプに相当する機能。
- **実装難易度**: 極低（静的データのモーダル）
  - `src/renderer/src/components/ChatPane.tsx` または新規 `ShortcutsOverlay.tsx`:
    - ショートカット一覧を静的配列として定義
    - モーダルオーバーレイに 2列グリッドで表示
    - `key` + `description` のペア、Cyber-Minimal スタイル（font-mono for key, radius-sm border）
  - `src/renderer/src/components/Header.tsx`: `?` ボタン追加、クリックで `onShortcutsClick` コールバック
  - `src/renderer/src/App.tsx`: `shortcutsOpen` state + `ShortcutsOverlay` コンポーネント追加
- **CLAUDE.md との整合性**: OK（Wave Terminal `Ctrl+?` 踏襲）

---

#### A-4: チャットメッセージ タイムスタンプ表示

- **概要**: アシスタントメッセージの右下に HH:mm タイムスタンプを常時表示する。
  メッセージにはすでに `timestamp: Date.now()` フィールドがある。
- **根拠**: 「あの Claude の返答はいつだったか」を確認する場面がある。
  Wave Terminal のブロック実行時刻表示と同コンセプト。コードは最小変更。
- **実装難易度**: 極低
  - `src/renderer/src/components/ChatPane.tsx`:
    - `MessageBubble` の末尾に timestamp を表示（`text-xs`, `text-muted`, `font-mono`, `text-right`）
    - フォーマット: `HH:mm`（`new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })`）
    - ユーザー発言には表示しない（右寄せバブル内には timestamp 不要）
- **CLAUDE.md との整合性**: OK（Wave Terminal ブロック時刻表示 踏襲）

---

#### A-5: チャット スクロール to Bottom スティッキーボタン

- **概要**: ユーザーがチャットメッセージ一覧を上方向にスクロールすると、右下に「↓ 新着」
  スティッキーボタンが出現する。クリックで最下部に滑らかにスクロールし、ボタンは消える。
  新しいメッセージが届いても自動スクロールしない（スクロール位置を尊重）。
- **根拠**: Claude の応答を読んでいる途中に新しいメッセージが届くと、現状は自動スクロールで
  読んでいた場所が失われる。スティッキーボタンでユーザーが任意に「戻る」を制御できる。
  Wave Terminal の「新着メッセージへ」UX と同コンセプト。
- **実装難易度**: 低
  - `src/renderer/src/components/ChatPane.tsx`:
    - メッセージ一覧 div に `onScroll` ハンドラ追加
    - `isAtBottom` state: `scrollTop + clientHeight >= scrollHeight - 40`
    - `isAtBottom` が false のとき右下に絶対配置の `↓` ボタンを表示
    - 自動スクロール (`scrollIntoView`) を `isAtBottom` が true のときのみ行う
- **CLAUDE.md との整合性**: OK（Wave Terminal スクロール制御 踏襲）

---

### 優先度B（将来サイクル候補）

#### B-1: OSC 1337 インライン画像表示（iTerm2 互換）
- xterm.js カスタムレンダーレイヤーが必要
- 実装難易度: 高

#### B-2: Warp Blocks — コマンドの意味的ブロックグループ化
- ターミナル出力をコマンド単位でブロック分け（PTY ホスト側でコマンド境界を検出）
- 実装難易度: 高

#### B-3: SettingsModal — キーバインドカスタマイズタブ（完全版）
- ショートカット一覧の「変更」まで実装（Phase 15 は読み取り専用）
- 実装難易度: 中〜高

#### B-4: Warp 式 AI 入力補完強化
- `prompt_suggestion` に加えて複数の候補を表示するスライドアップ UI
- 実装難易度: 中

---

## 今回見送り

| 機能 | 見送り理由 |
|---|---|
| Agent SDK V2 本番実装 | 不安定プレビュー（継続） |
| OSC 1337 インライン画像 | xterm カスタムレイヤー必要（高難度） |
| キーバインドカスタマイズ完全版 | スコープ大きすぎ（次フェーズ） |

---

## 参考リンク

- [@xterm/addon-web-links npm](https://www.npmjs.com/package/@xterm/addon-web-links)
- [Wave Terminal Keyboard Shortcuts](https://docs.waveterm.dev/keyboardshortcuts)
- [xterm.js WebLinksAddon](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-web-links)
