import React, { useState } from 'react'
import { FileTreePane } from './FileTreePane'

type LeftTab = 'terminal' | 'files'

interface LeftPanelProps {
  terminalPane: React.ReactNode
}

export function LeftPanel({ terminalPane }: LeftPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<LeftTab>('terminal')

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
        {(['terminal', 'files'] as LeftTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0 16px',
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
            {tab === 'terminal' ? 'ターミナル' : 'ファイル'}
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
    </div>
  )
}
