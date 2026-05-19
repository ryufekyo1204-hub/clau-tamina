import React, { useState, useEffect } from 'react'
import { useSessionStore } from '../store/session'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

type SettingsTab = 'terminal' | 'workspace' | 'general'

export function SettingsModal({ open, onClose }: SettingsModalProps): React.ReactElement | null {
  const {
    fontSizeTerminal,
    fontFamilyTerminal,
    setFontSizeTerminal,
    setFontFamilyTerminal,
    currentWorkingDir,
    setCwd,
    splitRatio,
    setSplitRatio
  } = useSessionStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('terminal')
  const [cwdInput, setCwdInput] = useState(currentWorkingDir)
  const [globalHotkey, setGlobalHotkey] = useState('Ctrl+Alt+T')
  const [hotkeyInput, setHotkeyInput] = useState('Ctrl+Alt+T')
  const [hotkeyEditing, setHotkeyEditing] = useState(false)
  const [tabBarOrientation, setTabBarOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [cursorStyle, setCursorStyleState] = useState<'block' | 'bar' | 'underline'>('block')
  const [cursorBlink, setCursorBlinkState] = useState(true)
  // A-5: header background color
  const [headerBackground, setHeaderBackgroundState] = useState<string>('#000000')
  // A-5: maxBudgetUsd cost limit
  const [maxBudgetUsd, setMaxBudgetUsdState] = useState<number>(0)
  // A-4: CWD color map
  const [cwdColorMap, setCwdColorMapState] = useState<Record<string, string>>({})
  // A-1 (Phase 10): Claude Code hooks
  const [hooksInstalled, setHooksInstalled] = useState<boolean | null>(null)
  const [hooksLoading, setHooksLoading] = useState(false)

  // Sync input when currentWorkingDir is updated externally (e.g. from FileTreePane)
  useEffect(() => {
    setCwdInput(currentWorkingDir)
  }, [currentWorkingDir])

  // Load persisted hotkey, orientation, cursor, and header background settings on modal open
  useEffect(() => {
    if (open) {
      window.api.getSettings().then((s) => {
        const hotkey = s.globalHotkey ?? 'Ctrl+Alt+T'
        setGlobalHotkey(hotkey)
        setHotkeyInput(hotkey)
        setTabBarOrientation(s.tabBarOrientation ?? 'horizontal')
        setCursorStyleState(s.cursorStyle ?? 'block')
        setCursorBlinkState(s.cursorBlink ?? true)
        setHeaderBackgroundState(s.headerBackground ?? '#000000')
        setMaxBudgetUsdState(s.maxBudgetUsd ?? 0)
        setCwdColorMapState(s.cwdColorMap ?? {})
      })
      window.api.checkClaudeHooks().then(setHooksInstalled).catch(() => setHooksInstalled(false))
    }
  }, [open])

  const handleTabBarOrientationChange = (val: 'horizontal' | 'vertical') => {
    setTabBarOrientation(val)
    void window.api.setSetting('tabBarOrientation', val)
  }

  const handleCursorStyleChange = (val: 'block' | 'bar' | 'underline') => {
    setCursorStyleState(val)
    void window.api.setSetting('cursorStyle', val)
  }

  const handleCursorBlinkChange = (val: boolean) => {
    setCursorBlinkState(val)
    void window.api.setSetting('cursorBlink', val)
  }

  if (!open) return null

  const handleCwdApply = () => {
    const trimmed = cwdInput.trim()
    if (!trimmed) return
    setCwd(trimmed)
    void window.api.setSetting('currentWorkingDir', trimmed)
  }

  const handleHotkeyApply = () => {
    const trimmed = hotkeyInput.trim()
    if (!trimmed) return
    void window.api.setSetting('globalHotkey', trimmed)
    setGlobalHotkey(trimmed)
    setHotkeyEditing(false)
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '500px',
          background: 'var(--app-bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            設定
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--app-bg-surface)'
          }}
        >
          {(['terminal', 'workspace', 'general'] as SettingsTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
                fontWeight: activeTab === tab ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'color 0.15s, border-color 0.15s'
              }}
            >
              {tab === 'terminal' ? 'ターミナル' : tab === 'workspace' ? 'ワークスペース' : '全般'}
            </button>
          ))}
        </div>

        {/* Modal body */}
        <div style={{ padding: '18px' }}>
          {activeTab === 'terminal' && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: 'var(--ls-label)',
                  textTransform: 'uppercase',
                  marginBottom: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ターミナル表示
              </div>

              {/* Font size */}
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    フォントサイズ
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {fontSizeTerminal}px
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={22}
                  step={1}
                  value={fontSizeTerminal}
                  onChange={(e) => setFontSizeTerminal(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' } as React.CSSProperties}
                />
              </label>

              {/* Font family */}
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  フォントファミリー
                </div>
                <select
                  value={fontFamilyTerminal}
                  onChange={(e) => setFontFamilyTerminal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--app-bg)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none'
                  }}
                >
                  <option value='"Cascadia Code", "Cascadia Mono", Consolas, monospace'>
                    Cascadia Code
                  </option>
                  <option value='"JetBrains Mono", "Cascadia Code", Consolas, monospace'>
                    JetBrains Mono
                  </option>
                  <option value='"Consolas", "Courier New", monospace'>Consolas</option>
                  <option value='"Fira Code", "Cascadia Code", monospace'>Fira Code</option>
                  <option value='"Hack", "Cascadia Code", monospace'>Hack</option>
                </select>
              </label>

              {/* Split ratio */}
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    左ペイン幅
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {Math.round(splitRatio * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={1}
                  value={Math.round(splitRatio * 100)}
                  onChange={(e) => setSplitRatio(Number(e.target.value) / 100)}
                  style={{ width: '100%', accentColor: 'var(--accent)' } as React.CSSProperties}
                />
              </label>

              {/* Cursor style (A-4) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  カーソルスタイル
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['block', 'bar', 'underline'] as const).map((style) => (
                    <button
                      key={style}
                      onClick={() => handleCursorStyleChange(style)}
                      style={{
                        flex: 1,
                        padding: '5px 0',
                        borderRadius: '6px',
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: cursorStyle === style ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                        background: cursorStyle === style ? 'var(--accent-subtle)' : 'transparent',
                        color: cursorStyle === style ? 'var(--accent)' : 'var(--text-secondary)',
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s'
                      }}
                    >
                      {style === 'block' ? 'ブロック' : style === 'bar' ? 'バー' : 'アンダー'}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  次回ターミナル起動時に適用されます
                </div>
              </div>

              {/* Cursor blink (A-4) */}
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    カーソル点滅
                  </span>
                  <button
                    onClick={() => handleCursorBlinkChange(!cursorBlink)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: cursorBlink ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                      background: cursorBlink ? 'var(--accent-subtle)' : 'transparent',
                      color: cursorBlink ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'background 0.15s, border-color 0.15s, color 0.15s'
                    }}
                  >
                    {cursorBlink ? 'オン' : 'オフ'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div>
              {/* A-5: Header background color */}
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: 'var(--ls-label)',
                  textTransform: 'uppercase',
                  marginBottom: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                外観
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  ヘッダー背景色
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="color"
                    value={headerBackground}
                    onChange={(e) => {
                      setHeaderBackgroundState(e.target.value)
                      void window.api.setSetting('headerBackground', e.target.value)
                    }}
                    style={{
                      width: '40px',
                      height: '28px',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '2px'
                    }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {headerBackground}
                  </span>
                  <button
                    onClick={() => {
                      setHeaderBackgroundState('#000000')
                      void window.api.setSetting('headerBackground', undefined)
                    }}
                    style={{
                      padding: '4px 10px',
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      fontSize: 'var(--text-xs)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)'
                    }}
                  >
                    リセット
                  </button>
                </div>
                <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  複数ウィンドウを開くときにプロジェクトごとに色で区別できます
                </div>
              </div>

              {/* A-5: maxBudgetUsd cost limit */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  コスト上限（USD、0 = 無制限）
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={maxBudgetUsd}
                    onChange={(e) => {
                      const v = Math.max(0, Number(e.target.value))
                      setMaxBudgetUsdState(v)
                      void window.api.setSetting('maxBudgetUsd', v)
                    }}
                    style={{
                      width: '90px',
                      padding: '5px 8px',
                      background: 'var(--app-bg)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {maxBudgetUsd === 0 ? '無制限' : `$${maxBudgetUsd.toFixed(2)} 上限`}
                  </span>
                </div>
                <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  1クエリあたりのコスト上限。超過した場合は自動停止します
                </div>
              </div>

              {/* A-4: CWD color map */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  ディレクトリ別カラーマップ
                </div>
                {Object.entries(cwdColorMap).length === 0 && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    エントリーなし — 「現在の CWD を追加」で登録できます
                  </div>
                )}
                {Object.entries(cwdColorMap).map(([path, color]) => (
                  <div key={path} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const updated = { ...cwdColorMap, [path]: e.target.value }
                        setCwdColorMapState(updated)
                        void window.api.setSetting('cwdColorMap', updated)
                      }}
                      style={{
                        width: '30px',
                        height: '24px',
                        border: '1px solid var(--border-default)',
                        borderRadius: '4px',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '1px',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {path}
                    </span>
                    <button
                      onClick={() => {
                        const updated = { ...cwdColorMap }
                        delete updated[path]
                        setCwdColorMapState(updated)
                        void window.api.setSetting('cwdColorMap', updated)
                      }}
                      style={{
                        padding: '2px 7px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        color: 'var(--status-error)',
                        fontSize: 'var(--text-xs)',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    >
                      削除
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const cwd = currentWorkingDir || 'C:\\'
                    if (cwdColorMap[cwd]) return
                    const updated = { ...cwdColorMap, [cwd]: '#000000' }
                    setCwdColorMapState(updated)
                    void window.api.setSetting('cwdColorMap', updated)
                  }}
                  style={{
                    marginTop: '4px',
                    padding: '5px 12px',
                    background: 'var(--accent-subtle)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: '6px',
                    color: 'var(--accent)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)'
                  }}
                >
                  現在の CWD を追加 ({currentWorkingDir || '未設定'})
                </button>
                <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  ディレクトリを移動するたびに自動でヘッダー色が切り替わります
                </div>
              </div>

              {/* A-1 (Phase 10): Claude Code hooks */}
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: 'var(--ls-label)',
                  textTransform: 'uppercase',
                  marginBottom: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Claude Code フック
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Claude 完了時バッジ通知 (Stop フック)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      color: hooksInstalled === true ? 'var(--status-running)' : 'var(--text-muted)'
                    }}
                  >
                    {hooksInstalled === null ? '確認中...' : hooksInstalled ? '✓ インストール済み' : '○ 未設定'}
                  </span>
                  <button
                    disabled={hooksLoading || hooksInstalled === true}
                    onClick={async () => {
                      setHooksLoading(true)
                      const ok = await window.api.installClaudeHooks()
                      if (ok) setHooksInstalled(true)
                      setHooksLoading(false)
                    }}
                    style={{
                      padding: '3px 10px',
                      background: 'var(--accent-subtle)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: '6px',
                      color: 'var(--accent)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      cursor: (hooksLoading || hooksInstalled === true) ? 'default' : 'pointer',
                      opacity: (hooksLoading || hooksInstalled === true) ? 0.5 : 1,
                      fontFamily: 'var(--font-ui)'
                    }}
                  >
                    インストール
                  </button>
                  {hooksInstalled === true && (
                    <button
                      disabled={hooksLoading}
                      onClick={async () => {
                        setHooksLoading(true)
                        const ok = await window.api.removeClaudeHooks()
                        if (ok) setHooksInstalled(false)
                        setHooksLoading(false)
                      }}
                      style={{
                        padding: '3px 10px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: 'var(--status-error)',
                        fontSize: 'var(--text-xs)',
                        cursor: hooksLoading ? 'default' : 'pointer',
                        opacity: hooksLoading ? 0.5 : 1,
                        fontFamily: 'var(--font-ui)'
                      }}
                    >
                      削除
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  ~/.claude/settings.json にフックを追加します。Claude が応答完了するとターミナルタブにバッジが表示されます。
                </div>
              </div>

              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: 'var(--ls-label)',
                  textTransform: 'uppercase',
                  marginBottom: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Quake Mode
              </div>

              {/* Global Hotkey — Quake Mode (A-4) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  グローバルホットキー（ウィンドウ表示/非表示）
                </div>
                {hotkeyEditing ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      value={hotkeyInput}
                      onChange={(e) => setHotkeyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleHotkeyApply()
                        else if (e.key === 'Escape') setHotkeyEditing(false)
                      }}
                      placeholder="例: Ctrl+Alt+T"
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '6px 8px',
                        background: 'var(--app-bg)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-mono)',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={handleHotkeyApply}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--accent-subtle)',
                        border: '1px solid var(--border-accent)',
                        borderRadius: '6px',
                        color: 'var(--accent)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                        flexShrink: 0
                      }}
                    >
                      適用
                    </button>
                    <button
                      onClick={() => setHotkeyEditing(false)}
                      style={{
                        padding: '6px 10px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-sm)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                        flexShrink: 0
                      }}
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code
                      style={{
                        padding: '4px 10px',
                        background: 'var(--app-bg)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {globalHotkey}
                    </code>
                    <button
                      onClick={() => { setHotkeyInput(globalHotkey); setHotkeyEditing(true) }}
                      style={{
                        padding: '4px 10px',
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-xs)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-ui)'
                      }}
                    >
                      変更
                    </button>
                  </div>
                )}
                <div style={{ marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  他のアプリ使用中でもこのキーでウィンドウを瞬時に呼び出せます。<br />
                  形式: Ctrl+Alt+T / Ctrl+Shift+Space / F12 など
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: 'var(--ls-label)',
                  textTransform: 'uppercase',
                  marginBottom: '14px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ワークスペース設定
              </div>

              {/* CWD */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  作業ディレクトリ（Claude AIが参照するCWD）
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={cwdInput}
                    onChange={(e) => setCwdInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCwdApply() }}
                    placeholder="C:\Users\..."
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      background: 'var(--app-bg)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--border-accent)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)' }}
                  />
                  <button
                    onClick={handleCwdApply}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--accent-subtle)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: '6px',
                      color: 'var(--accent)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-ui)',
                      flexShrink: 0
                    }}
                  >
                    適用
                  </button>
                </div>
                <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  現在: {currentWorkingDir || '未設定'}
                </div>
              </div>

              {/* Tab bar orientation (A-4) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  タブバー方向
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['horizontal', 'vertical'] as const).map((val) => (
                    <button
                      key={val}
                      onClick={() => handleTabBarOrientationChange(val)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: '6px',
                        fontSize: 'var(--text-xs)',
                        fontFamily: 'var(--font-ui)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: tabBarOrientation === val ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                        background: tabBarOrientation === val ? 'var(--accent-subtle)' : 'transparent',
                        color: tabBarOrientation === val ? 'var(--accent)' : 'var(--text-secondary)',
                        transition: 'background 0.15s, border-color 0.15s, color 0.15s'
                      }}
                    >
                      {val === 'horizontal' ? '横 (標準)' : '縦 (サイドバー)'}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '4px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  縦モードにするとセッション一覧が左パネルのタブに追加されます
                </div>
              </div>

              {/* Bypass permissions default */}
              <div
                style={{
                  padding: '12px',
                  background: 'var(--app-bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  lineHeight: '1.6'
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>ヒント:</span>{' '}
                権限モード（バイパス/通常）はヘッダーのトグルで切り替えできます。設定は次回起動時も維持されます。
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: '6px',
              fontSize: 'var(--text-sm)',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            完了
          </button>
        </div>
      </div>
    </div>
  )
}
