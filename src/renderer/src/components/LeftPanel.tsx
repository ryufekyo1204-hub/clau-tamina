import React, { useState } from 'react'
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
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0 14px',
              height: '100%',
              background: 'transparent',
              border: 'none',
              borderBottom:
                activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              fontWeight: activeTab === tab ? 600 : 400,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            {TAB_LABEL[tab]}
          </button>
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
