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

export function LeftPanel({ terminalPane, tabBarOrientation = 'horizontal' }: LeftPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<LeftTab>('terminal')
  // A-2: F2 tab rename
  const [tabLabels, setTabLabels] = useState<Record<string, string>>({})
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Load persisted tab labels on mount
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setTabLabels(s.tabLabels ?? {})
    }).catch(() => { /* ignore */ })
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
            onClick={() => setActiveTab(tab)}
            onDoubleClick={() => startEditing(tab)}
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
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontFamily: 'var(--font-ui)',
                  userSelect: 'none'
                }}
                title="ダブルクリックでリネーム"
              >
                {tabLabels[tab] ?? TAB_LABEL[tab]}
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
    </div>
  )
}
