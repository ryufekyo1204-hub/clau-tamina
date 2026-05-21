import React, { useState, useEffect, useRef, useCallback } from 'react'
import { FileTreePane } from './FileTreePane'
import { ProcessViewer } from './ProcessViewer'
import { SessionList } from './SessionList'

type LeftTab = 'terminal' | 'files' | 'processes' | 'sessions'

const TAB_LABEL: Record<LeftTab, string> = {
  terminal: 'ターミナル',
  files: 'ファイル',
  processes: 'プロセス',
  sessions: 'セッション'
}

interface LeftPanelProps {
  terminalPane: React.ReactNode
  tabBarOrientation?: 'horizontal' | 'vertical'
}

interface TabBadge {
  text: string
  color?: string
}

// A-4 (Phase 14): Tab context menu state (Wave Terminal B-3)
interface ContextMenu {
  tab: LeftTab
  x: number
  y: number
}

export function LeftPanel({ terminalPane, tabBarOrientation = 'horizontal' }: LeftPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<LeftTab>('terminal')
  // A-2: F2 tab rename
  const [tabLabels, setTabLabels] = useState<Record<string, string>>({})
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  // A-1: tab badge (OSC 9999 + bell)
  const [tabBadge, setTabBadge] = useState<TabBadge | null>(null)
  // A-4 (Phase 14): tab context menu (Wave Terminal B-3)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  // Load persisted tab labels on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setTabLabels(s.tabLabels ?? {})
    }).catch(() => { /* ignore */ })
  }, [])

  // A-1: subscribe to badge updates and bell for tab badge display
  useEffect(() => {
    const offBadge = window.api.onPtyBadgeUpdate((text, color) => {
      setTabBadge({ text, color })
    })
    const offBell = window.api.onPtyTabBell(() => {
      setTabBadge({ text: '🔔', color: undefined })
    })
    return () => {
      offBadge()
      offBell()
    }
  }, [])

  // A-2 (Phase 10): OSC 9997 setmeta — dynamically update terminal tab label from shell
  useEffect(() => {
    const off = window.api.onPtySetMeta((title, icon) => {
      const label = (icon ? icon + ' ' : '') + title
      // Update in-memory label only (not persisted to electron-store)
      setTabLabels((prev: Record<string, string>) => ({ ...prev, terminal: label }))
    })
    return off
  }, [])

  // Focus inline input when editingTabId changes
  useEffect(() => {
    if (editingTabId !== null) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingTabId])

  const startEditing = useCallback((tab: LeftTab) => {
    setEditingTabId(tab)
    setEditingValue(tabLabels[tab] ?? TAB_LABEL[tab])
  }, [tabLabels])

  // A-5 (Phase 12): F2 key triggers rename on active tab (Wave Terminal v0.14.5)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && editingTabId === null) {
        e.preventDefault()
        startEditing(activeTab)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTab, editingTabId, startEditing])

  // A-4 (Phase 14): close context menu on outside click / Escape
  useEffect(() => {
    if (!contextMenu) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent) { if (e.key === 'Escape') setContextMenu(null) }
      else setContextMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [contextMenu])

  const commitEdit = useCallback(() => {
    if (editingTabId === null) return
    const trimmed = editingValue.trim()
    const updated = { ...tabLabels }
    if (trimmed && trimmed !== TAB_LABEL[editingTabId as LeftTab]) {
      updated[editingTabId] = trimmed
    } else {
      delete updated[editingTabId]
    }
    setTabLabels(updated)
    window.api.setSetting('tabLabels', updated).catch(() => { /* ignore */ })
    setEditingTabId(null)
  }, [editingTabId, editingValue, tabLabels])

  const cancelEdit = useCallback(() => {
    setEditingTabId(null)
  }, [])

  const allTabs: LeftTab[] = tabBarOrientation === 'vertical'
    ? ['terminal', 'files', 'sessions', 'processes']
    : ['terminal', 'files', 'processes']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          height: '30px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--app-bg)'
        }}
      >
        {allTabs.map((tab) => (
          <div
            key={tab}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              height: '100%',
              borderBottom:
                activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s'
            }}
            onClick={() => {
              setActiveTab(tab)
              if (tab === 'terminal') setTabBadge(null)
            }}
            onDoubleClick={() => startEditing(tab)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ tab, x: e.clientX, y: e.clientY })
            }}
          >
            {editingTabId === tab ? (
              <input
                ref={editInputRef}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--app-bg-elevated)',
                  border: '1px solid var(--border-accent)',
                  borderRadius: '3px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 600,
                  padding: '1px 4px',
                  width: '80px',
                  outline: 'none'
                }}
              />
            ) : (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontFamily: 'var(--font-ui)',
                  userSelect: 'none'
                }}
                title="ダブルクリックでリネーム"
              >
                {tabLabels[tab] ?? TAB_LABEL[tab]}
                {tab === 'terminal' && tabBadge !== null && activeTab !== 'terminal' && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: tabBadge.color ?? 'var(--status-warning)',
                      flexShrink: 0
                    }}
                    title={tabBadge.text}
                  />
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Pane content — keep terminal always mounted to preserve PTY state */}
      <div
        style={{ flex: 1, overflow: 'hidden', display: activeTab === 'terminal' ? 'flex' : 'none' }}
      >
        {terminalPane}
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: activeTab === 'files' ? 'flex' : 'none',
          position: 'relative'
        }}
      >
        <FileTreePane />
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: activeTab === 'processes' ? 'flex' : 'none',
          flexDirection: 'column'
        }}
      >
        {activeTab === 'processes' && <ProcessViewer />}
      </div>
      {tabBarOrientation === 'vertical' && (
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: activeTab === 'sessions' ? 'flex' : 'none',
            flexDirection: 'column'
          }}
        >
          <SessionList orientation="vertical" />
        </div>
      )}

      {/* A-4 (Phase 14): Tab context menu (Wave Terminal B-3) */}
      {contextMenu && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9000,
            background: 'var(--app-bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            minWidth: '140px',
            padding: '4px 0',
            animation: 'ctx-fade 0.08s ease-out'
          }}
        >
          {[
            {
              label: 'リネーム',
              action: () => { startEditing(contextMenu.tab); setContextMenu(null) }
            },
            {
              label: 'デフォルトに戻す',
              action: () => {
                const updated = { ...tabLabels }
                delete updated[contextMenu.tab]
                setTabLabels(updated)
                window.api.setSetting('tabLabels', updated).catch(() => { /* ignore */ })
                setContextMenu(null)
              }
            },
            ...(contextMenu.tab === 'terminal' && tabBadge !== null
              ? [{ label: 'バッジをクリア', action: () => { setTabBadge(null); setContextMenu(null) } }]
              : [])
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 14px',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                transition: 'background 0.1s'
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--app-bg-hover)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <style>{`
        @keyframes ctx-fade {
          from { opacity: 0; transform: scale(0.96) translateY(-2px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
