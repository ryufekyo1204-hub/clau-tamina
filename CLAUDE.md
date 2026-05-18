# clau-tamina — Claude Code 専用 GUI

PowerShell から起動でき、本物のターミナルを内包する Claude Code 特化型 Electron アプリ。

---

## プロジェクト概要

### コンセプト
「PowerShell の使用感を損なわずに Claude Code を使える」GUI アプリ。
ウィンドウ下部に **本物の PowerShell（ConPTY 経由）** を組み込み、上部にAIチャットペインを配置する。VSCode の統合ターミナルに近い感覚で動作する。

### ターゲットユーザー
- PowerShell から `claude` コマンドを普段使いしているユーザー
- チャット履歴・コスト・ファイル変更を一画面で管理したいユーザー

### 差別化ポイント（既存ツールとの比較）
| ツール | 特徴 | 本アプリとの差 |
|---|---|---|
| Opcode (Claudia) | Tauri + Rust、シングルセッション中心 | PowerShell 直接統合なし |
| Coide | Electron + node-pty、CLIをTTY制御 | PowerShell ファースト設計ではない |
| 公式デスクトップ | 完成度高いがWindowsはGit依存 | PowerShell ネイティブ起動に対応 |

本アプリの軸：**PowerShell が一等市民**（AIペインがおまけでなく、ターミナルがおまけでもない）。

---

## アーキテクチャ

### 4層プロセス構成

```
┌──────────────────────────────────────────────────────┐
│  Electron メインプロセス (main.ts)                     │
│  ウィンドウ管理 / メニュー / electron-store 設定        │
└───────┬──────────────────────────────────────────────┘
        │ IPC (ipcMain / ipcRenderer)
┌───────▼──────────────────────────────────────────────┐
│  レンダラープロセス (React + TypeScript)               │
│  xterm.js v6 (WebGL) + AIチャットペイン               │
│  CSS Grid による分割レイアウト                          │
└───────┬──────────────────────┬────────────────────────┘
        │ IPC (バッファリング送信) │ IPC
┌───────▼──────────────┐  ┌───▼────────────────────────┐
│  PTY ホストプロセス    │  │  Claude Code SDK プロセス  │
│  (pty-host.ts)        │  │  startup() でウォームアップ  │
│  node-pty v1.1.0      │  │  listSessions() など        │
│  PowerShell.exe       │  │  query() でストリーム配信   │
└──────────────────────┘  └────────────────────────────┘
```

**PTY ホストを別プロセスに分離する理由：**  
シェルがクラッシュしたときに UI が巻き込まれないようにするため（VS Code と同じ設計）。

**SDK プロセスを分離する理由：**  
Claude Code CLI の長時間タスク中に UI がブロックされないようにするため。

### データフロー

```
PowerShell キー入力
  → レンダラー xterm.js
    → IPC → PTY ホスト → node-pty → PowerShell.exe（ConPTY）
      → 出力 → PTY ホスト → IPC（バッファリング 4KB チャンク）
        → レンダラー xterm.js → 画面描画

ユーザーの AI 指示
  → レンダラー チャットペイン
    → IPC → SDK プロセス → Claude Code CLI（query()）
      → ストリーム応答 → IPC → レンダラー チャットペイン → 表示
```

---

## 技術スタック

### コアライブラリ
| 役割 | ライブラリ | バージョン | 備考 |
|---|---|---|---|
| フレームワーク | Electron | 最新安定版 | |
| UIレンダリング | React + TypeScript | 18 / 5.x | |
| ターミナルエミュレータ | `@xterm/xterm` | v6.x | v5→v6 で破壊的変更あり |
| ターミナルリサイズ | `@xterm/addon-fit` | v6.x | 必須アドオン |
| WebGL描画 | `@xterm/addon-webgl` | v6.x | 重い出力でも滑らか |
| PTY制御 | `node-pty` | v1.1.0 | ConPTY 使用、winpty は削除済み |
| AI SDK | `@anthropic-ai/claude-code` | 最新 | TypeScript SDK |
| 設定永続化 | `electron-store` | | レイアウト・テーマ等 |
| パッケージング | `electron-builder` | | NSIS インストーラー |
| ネイティブリビルド | `@electron/rebuild` | | node-pty の `.node` 再ビルド |

### 状態管理
- グローバル状態: Zustand（軽量、Claude Code SDK の型と相性が良い）
- セッションデータ: SDK の `listSessions()` / `getSessionMessages()` を正として扱い、独自 DB は持たない
- UIレイアウト設定: `electron-store` で `app.getPath('userData')` 以下に保存

---

## ディレクトリ構成（予定）

```
clau-tamina-app/
├── src/
│   ├── main/              # Electron メインプロセス
│   │   ├── main.ts
│   │   └── menu.ts
│   ├── pty-host/          # PTY ホスト（別 Node.js プロセス）
│   │   └── pty-host.ts
│   ├── sdk-host/          # Claude Code SDK ホスト（別プロセス）
│   │   └── sdk-host.ts
│   └── renderer/          # React アプリ
│       ├── App.tsx
│       ├── components/
│       │   ├── Terminal.tsx      # xterm.js ラッパー
│       │   ├── ChatPane.tsx      # AI チャット
│       │   ├── FileTree.tsx      # ファイルブラウザ（将来）
│       │   └── SplitLayout.tsx   # 分割レイアウト
│       └── store/
│           └── session.ts        # Zustand ストア
├── package.json
└── electron-builder.json
```

---

## UI レイアウト設計

### 通常モード（エージェント1体）

```
┌────────────────────────────────────────────────────────┐
│  [Projects ▾] [Sessions ▾]  🔴 通常モード  [Cost: $0]  │ ← 権限トグル常時表示
├─────────────────────────────────┬──────────────────────┤
│                                 │  Claude AI チャット   │
│   PowerShell（本物）             │  ─────────────────  │
│   (xterm.js / WebGL)            │  You: バグ修正して   │
│                                 │  Claude: ...         │
│   PS C:\project> _              │                      │
│                                 │  [承認] [拒否]        │
│                                 │  > _                 │
├─────────────────────────────────┴──────────────────────┤
│  Sonnet 4.6  |  トークン: 1,234  |  エージェント: 1/1  │
└────────────────────────────────────────────────────────┘
```

### マルチエージェントモード（2〜3体並列）

エージェントが複数起動した時点で**自動的にレイアウトが切り替わる**。

```
┌────────────────────────────────────────────────────────┐
│  [Projects ▾] [Sessions ▾]  🟢 バイパス中  [Cost: $0]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│   PowerShell（本物）      ← 上部に全幅で表示            │
│   PS C:\project> _                                     │
│                                                        │
├──────────────────┬──────────────────┬──────────────────┤
│  Agent 1 ✅完了  │  Agent 2 ⚙️実行中 │  Agent 3 ⏳待機  │
│  ──────────────  │  ──────────────  │  ──────────────  │
│  tests/ 修正完了 │  src/app.ts 編集 │  まだ開始前...   │
│  +3 -1 lines    │  > thinking...   │                  │
│  $0.002         │  $0.008          │  -               │
│  [詳細 ↗]       │  [詳細 ↗]        │  [詳細 ↗]        │
└──────────────────┴──────────────────┴──────────────────┘
│  Sonnet 4.6  |  合計: $0.010  |  実行中: 1/3 agents   │
└────────────────────────────────────────────────────────┘
```

`[詳細 ↗]` クリックでそのエージェントのチャット全文をオーバーレイ表示。

### レイアウトの原則
- エージェント数に応じてレイアウトが**自動切り替え**（1体 → 左右分割 / 複数 → 上下分割）
- ターミナルは常に全幅で上部に固定（マルチ時も縮小しない）
- 分割線はドラッグでリサイズ可能
- AI 作業中は非侵入的なスピナー（ペインをブロックしない）

---

## 権限モードトグル

### 概要
ヘッダー中央に**常時表示**し、クリック一発で切り替える。

```
🔴 通常モード   ←クリック→   🟢 バイパス中
（承認ダイアログあり）       （全自動・確認なし）
```

| | 通常モード | バイパスモード |
|---|---|---|
| ファイル変更 | 承認ダイアログあり | 自動承認 |
| コマンド実行 | 承認ダイアログあり | 自動承認 |
| 相当するCLIオプション | デフォルト | `--dangerously-skip-permissions` |
| ヘッダー背景 | 通常色 | うっすら緑がかる |

### 実装方針
- 設定は `electron-store` に保存し、**次回起動時も維持**される（デフォルト: バイパス）
- SDK の `canUseTool` コールバックで制御
  - 通常モード：GUI ダイアログを表示してユーザーが承認/拒否
  - バイパスモード：`canUseTool` が常に `true` を返す
- バイパス中は承認ダイアログを表示しないだけで、**ツール実行ログはチャットペインに記録**される

---

## デザインシステム

### 設計方針

**Wave Terminal の「使い勝手」× Claude Desktop の「ブランド温度感」**

- **構造・UX**：Wave Terminal をそのまま参考にする（パネル管理、ブロック分割、ドラッグリサイズ、将来的なブラウザ統合パネル等）
- **カラー**：黒ベース＋オレンジ差し色（Anthropic ブランドカラー）
- **ターミナル領域は一切変えない**：xterm.js + Wave Terminal のターミナルカラー設定をそのまま使用

---

### カラートークン

```css
/* === ベースカラー（黒系） === */
--app-bg:           #000000;   /* ウィンドウ最背面：純黒 */
--app-bg-surface:   #111110;   /* パネル・ブロック背景 */
--app-bg-elevated:  #1c1c1a;   /* カード・モーダル */
--app-bg-hover:     rgba(255, 255, 255, 0.06);
--app-bg-active:    rgba(255, 255, 255, 0.10);

/* === テキスト === */
--text-primary:     #f2ede4;   /* メインテキスト（Claudeのクリーム） */
--text-secondary:   #a09b95;   /* サブ情報 */
--text-muted:       #5a5550;   /* ラベル・キャプション */
--text-inverse:     #000000;   /* アクセント背景上のテキスト */

/* === アクセント：オレンジ（Anthropic シグネチャ） === */
--accent:           #d97757;   /* プライマリアクセント */
--accent-hover:     #e8895a;   /* ホバー */
--accent-pressed:   #c96442;   /* プレス */
--accent-subtle:    rgba(217, 119, 87, 0.15); /* 薄い強調背景 */
--accent-glow:      0 0 14px rgba(217, 119, 87, 0.25); /* グロー */

/* === ステータス（Wave Terminal 準拠） === */
--status-running:   #58c142;   /* 実行中：Wave グリーン */
--status-error:     #e54d2e;   /* エラー */
--status-warning:   #e0b956;   /* 警告 */
--status-waiting:   #53b4ea;   /* 待機中 */
--status-done:      #5a5550;   /* 完了（ミュート） */

/* === ボーダー === */
--border-subtle:    rgba(255, 255, 255, 0.07);
--border-default:   rgba(255, 255, 255, 0.13);
--border-strong:    rgba(255, 255, 255, 0.22);
--border-accent:    rgba(217, 119, 87, 0.45);

/* === シャドウ === */
--shadow-sm:   0 1px 4px rgba(0, 0, 0, 0.6);
--shadow-md:   0 4px 14px rgba(0, 0, 0, 0.7);
--shadow-lg:   0 8px 28px rgba(0, 0, 0, 0.85);

/* === ターミナル専用（Wave Terminal のまま） === */
--term-background:  #000000;
--term-foreground:  #d3d7cf;
--term-black:       #000000;  --term-bright-black:   #727272;
--term-red:         #cc0000;  --term-bright-red:     #cc9d97;
--term-green:       #4e9a06;  --term-bright-green:   #a3dd97;
--term-yellow:      #c4a000;  --term-bright-yellow:  #cbcaaa;
--term-blue:        #3465a4;  --term-bright-blue:    #9ab6cb;
--term-magenta:     #bc3fbc;  --term-bright-magenta: #cc8ecb;
--term-cyan:        #06989a;  --term-bright-cyan:    #b7b8cb;
--term-white:       #d0d0d0;  --term-bright-white:   #f0f0f0;
```

---

### タイポグラフィ

```css
--font-ui:      "Inter", system-ui, sans-serif;      /* UI全般 */
--font-mono:    "Hack", "JetBrains Mono", monospace; /* コード・ターミナル外ラベル */
--font-display: "Poppins", "Inter", sans-serif;      /* 見出し・ブランド要素 */

/* サイズ */
--text-xs:   10px;  /* ラベル・バッジ */
--text-sm:   11px;  /* Wave header-font 相当 */
--text-base: 13px;  /* UI本文 */
--text-md:   14px;  /* チャットテキスト */
--text-lg:   16px;  /* パネルタイトル */
```

---

### コンポーネント別スタイル方針

#### ヘッダーバー（Wave Terminal の 30px ヘッダー踏襲）
- 高さ 36px、背景 `#000000`、下線 `border-default`
- `-webkit-app-region: drag` でドラッグ可能
- フォント：Inter 11px / weight 700（Wave 準拠）
- 権限トグルはヘッダー中央に配置

#### ブロック・パネル（Wave Terminal の block 設計踏襲）
- 背景 `rgba(0,0,0,0.5)`（Wave `--block-bg-color` と同値）
- 角丸 `8px`（Wave `--block-border-radius` と同値）
- ボーダー `border-default`
- フォーカス時：`2px solid #d97757`（Wave のグリーンをオレンジに変更）
- ヘッダー部分に `1px solid border-subtle` の下線

#### ターミナルブロック（変更なし）
- `--term-*` 変数をそのまま適用
- Wave Terminal のフォーカス枠だけ `#d97757` に変更

#### エージェントカード（下部パネル）
- 背景 `#1c1c1a`、角丸 `10px`
- ステータスドット：`--status-*` カラー
- アクティブ時：`border-accent` + `accent-glow`
- コスト・トークン：`font-mono` 11px、`text-muted`

#### チャットペイン
- 背景 `#000000`（ターミナルと統一）
- ユーザー発言：右寄せ、`app-bg-elevated` 背景、`border-subtle`
- Claude 発言：左寄せ、背景なし、`text-primary`、行間 1.65
- 入力欄：`app-bg-surface` 背景、フォーカス時 `border-accent`

#### 権限トグル（バイパス時の視覚フィードバック）
- 通常：`🔴` + `text-secondary`
- バイパス：`🟢` + アクセントオレンジ色のテキスト
  - ヘッダーに `box-shadow: inset 0 -1px 0 rgba(217,119,87,0.3)` の細いライン

#### スクロールバー（Wave Terminal 準拠）
```css
width: 4px;
thumb: rgba(255,255,255,0.12);
thumb:hover: rgba(255,255,255,0.28);
```

---

### アニメーション（Wave Terminal 準拠）
- パネル展開：`max-height 0.3s ease-out, opacity 0.3s ease-out`
- タブ切り替え：`transform 0.3s ease`
- ホバー：`background 0.15s ease, border-color 0.15s ease`
- エージェントカード出現：`opacity 0 → 1, translateY(4px → 0)` の 0.1s フェードイン

---

### Wave Terminal から採用するUX機能

| 機能 | 詳細 |
|---|---|
| **ブロック分割** | ドラッグで任意にリサイズ可能なペイン |
| **マグニファイ** | ブロックを最大化表示（`blur(10px)` オーバーレイ）|
| **コマンド履歴ブロック** | 実行コマンドを意味的ブロック単位でグループ化 |
| **接続ステータス表示** | セッション・エージェントの状態をアイコンで常時表示 |
| **将来: ブラウザパネル** | Wave のようにブラウザをパネルとして埋め込み可能にする拡張性を確保 |

---

## Windows / PowerShell 固有の実装注意事項

### node-pty の起動方法
```typescript
const pty = require('node-pty');
const term = pty.spawn('powershell.exe', [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.USERPROFILE,
  env: {
    ...process.env,
    SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',  // 必須: 未設定時にクラッシュ
    TERM: 'xterm-256color',
  }
});
```

### xterm.js の設定
```typescript
const terminal = new Terminal({
  convertEol: true,   // Windows の \r\n を正しく処理（実質必須）
  cursorBlink: true,
  fontFamily: 'Cascadia Code, Consolas, monospace',
  theme: { background: '#1e1e1e' },
});
```

### IPC のバッファリング（Hyper の設計から）
ターミナルデータを 1 文字ずつ送信すると GC プレッシャーが高くなる。
4KB チャンクにバッファリングしてまとめて送信する。

```typescript
// pty-host.ts
let buffer = '';
let flushTimer: NodeJS.Timeout | null = null;

term.onData((data: string) => {
  buffer += data;
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      ipc.send('pty-data', buffer);
      buffer = '';
      flushTimer = null;
    }, 8); // 8ms バッファリング
  }
});
```

---

## Claude Code SDK の使い方

```typescript
import { query, startup, listSessions } from '@anthropic-ai/claude-code';

// アプリ起動時にウォームアップ
await startup();

// セッション開始・ストリーム受信
for await (const message of query({
  prompt: userInput,
  options: {
    cwd: currentProjectPath,
    allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
  }
})) {
  if (message.type === 'assistant') {
    chatPane.append(message.message);
  }
  if (message.type === 'result') {
    statusBar.updateCost(message.total_cost_usd);
  }
}

// ツール実行の承認をGUI側に委譲
canUseTool: async (tool) => {
  return await showApprovalDialog(tool); // GUI ダイアログ表示
}
```

---

## セッション管理

セッションデータは SDK が `~/.claude/` 以下に JSONL で自動保存するため、**GUI 側は独自 DB を持たない**。

| データ種別 | 管理場所 |
|---|---|
| チャット履歴 | SDK の `listSessions()` / `getSessionMessages()` |
| コスト累計 | オプションで `better-sqlite3`（`~/.config/clau-tamina/costs.db`） |
| UIレイアウト・テーマ | `electron-store` |
| セッションタグ・タイトル | SDK の `tagSession()` / `renameSession()` |

---

## ビルドとパッケージング

### ビルドスクリプト（package.json）
```json
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "dev": "concurrently \"tsc -w\" \"electron .\"",
    "build": "tsc && electron-builder"
  }
}
```

### PowerShell から起動するための PATH 登録
electron-builder の NSIS スクリプトで `clau-tamina` コマンドを PATH に追加し、
`PS C:\> clau-tamina` で起動できるようにする。

### コード署名
- 開発初期：署名なし（SmartScreen 警告を許容）
- 一般配布時：Azure Trusted Signing を `electron-builder` の `win.azureSignOptions` で統合

---

## 実装フェーズ

### Phase 1: 動く最小構成
- [ ] Electron + xterm.js + node-pty で PowerShell が動くウィンドウ
- [ ] 分割レイアウト（ターミナル左 / チャット右）の骨格
- [ ] PTY ホストの別プロセス分離
- [ ] `electron-builder` で NSIS インストーラー生成

### Phase 2: AI 統合
- [ ] Claude Code SDK の組み込み（`query()` ストリーム）
- [ ] チャットペインの実装
- [ ] ツール実行承認ダイアログ
- [ ] セッション一覧（`listSessions()`）

### Phase 3: UX 改善
- [ ] コスト・トークン表示（ステータスバー）
- [ ] セッション検索
- [ ] テーマ / フォント設定
- [ ] ファイルブラウザパネル（オプション）

---

## 参考リポジトリ・ドキュメント

- [Coide](https://github.com/vicmaster/coide) — Electron + node-pty で Claude Code CLI を制御する最も近い先行実装
- [Opcode (旧Claudia)](https://github.com/winfunc/opcode) — Tauri 版の設計思想参考
- [xterm.js 公式](https://xtermjs.org/) — ターミナルエミュレータ
- [microsoft/node-pty](https://github.com/microsoft/node-pty) — ConPTY 経由の PTY 制御
- [VS Code 統合ターミナル設計](https://deepwiki.com/microsoft/vscode/6-integrated-terminal) — PTY ホスト分離の詳細
- [Claude Code TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript) — セッション管理・ストリーミング API
