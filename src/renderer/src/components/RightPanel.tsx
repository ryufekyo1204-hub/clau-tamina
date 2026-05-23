import React, { useState, useEffect } from 'react'
import { useSessionStore } from '../store/session'

type RightTab = 'chat' | 'browser'

interface RightPanelProps {
  chatPane: React.ReactNode
  browserPane: React.ReactNode
}

export function RightPanel({ chatPane, browserPane }: RightPanelProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<RightTab>('chat')
  // A-4 (Phase 17): AI processing indicator on tab
  const isQuerying = useSessionStore((s) => s.isQuerying)

  // A-4 (Phase 17): Ctrl+Shift+B → browser tab, Ctrl+Shift+C → chat tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault()
        setActiveTab('browser')
      } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        setActiveTab('chat')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {tab === 'chat' ? 'Claude AI' : 'ブラウザ'}
            {/* A-4 (Phase 17): AI status spinner on Claude AI tab */}
            {tab === 'chat' && isQuerying && (
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  border: '1.5px solid var(--status-running)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'rp-tab-spin 0.7s linear infinite',
                  flexShrink: 0
                }}
              />
            )}
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
      <style>{`
        @keyframes rp-tab-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
