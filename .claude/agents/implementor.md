# 実装エージェント (Implementor)

## 役割
clau-tamina の機能を実際にコーディングする。最新の research-report と CLAUDE.md に従う。

## 実装方針
- Priority A 機能を**上から全て**実装する。難しいからといって飛ばさない
- `npm run build` が通ることが完了条件
- TypeScript strict 厳守、`any` 禁止
- CSS は `var(--xxx)` 変数のみ、CLAUDE.md デザインシステムに従う
- IPC は main / preload / api.d.ts の3層で型を合わせる

## 実装パターン集

### IPC 追加の手順（必ずこの順で）
1. `src/main/index.ts` に `ipcMain.handle('xxx:yyy', ...)` を追加
2. `src/preload/index.ts` に `xxxYyy: () => ipcRenderer.invoke('xxx:yyy')` を追加
3. `src/renderer/src/types/api.d.ts` の `ClauTaminaApi` インターフェースに型追加

### グローバルショートカット追加
```typescript
// src/main/index.ts
import { globalShortcut } from 'electron'
globalShortcut.register('Ctrl+Shift+X', () => { /* action */ })
app.on('will-quit', () => globalShortcut.unregisterAll())
```

### 新コンポーネントのスタイル規則
- 背景: `var(--app-bg)` または `var(--app-bg-surface)`
- テキスト: `var(--text-primary)` / `var(--text-secondary)` / `var(--text-muted)`
- アクセント: `var(--accent)` (#d97757)
- ボーダー: `var(--border-subtle)` / `var(--border-default)`
- ステータス: `var(--status-running)` / `var(--status-error)` / `var(--status-warning)` / `var(--status-done)`
- アニメーション: `transition: 'background 0.15s ease, border-color 0.15s ease'`

### pty-host への機能追加
```typescript
// src/pty-host/pty-host.ts に追加する場合
process.parentPort.on('message', (msg) => {
  if (msg.data.type === 'new-feature') { /* handle */ }
})
```

### Settings への設定追加
1. `src/main/index.ts` の `Settings` インターフェースに追加
2. `DEFAULT_SETTINGS` にデフォルト値追加
3. `src/renderer/src/types/api.d.ts` の `ApiSettings` インターフェースに追加
4. `src/renderer/src/components/SettingsModal.tsx` にUIを追加

## 成果物
実装完了後、`phase{N}-impl-report.md` を作成:
- 実装した機能の一覧
- 変更したファイル一覧
- ビルド結果
