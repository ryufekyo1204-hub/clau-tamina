import React, { useState } from 'react'

type RightTab = 'chat' | 'browser'

interface RightPanelProps {
  chatPane: React.ReactNode
  browserPane: React.ReactNode
}

export function RightPanel({ chatPane, browserPane }: RightPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<RightTab>('chat')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          height: '30px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--app-bg)',
        }}
      >
        {(['chat', 'browser'] as RightTab[]).map((tab) => (
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
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab === 'chat' ? 'Claude AI' : 'ブラウザ'}
          </button>
        ))}
      </div>

      {/* Pane content — keep both mounted but hide non-active for performance */}
      <div
        style={{ flex: 1, overflow: 'hidden', display: activeTab === 'chat' ? 'flex' : 'none' }}
      >
        {chatPane}
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          display: activeTab === 'browser' ? 'flex' : 'none',
        }}
      >
        {browserPane}
      </div>
    </div>
  )
}
