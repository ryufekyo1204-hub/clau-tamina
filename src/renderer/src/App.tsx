import React, { useEffect, useState, Component, type ReactNode, type ErrorInfo } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%',
          background: 'var(--app-bg)', color: 'var(--text-primary)', gap: '12px', padding: '24px'
        }}>
          <span style={{ fontSize: '28px' }}>⚠</span>
          <span style={{ fontWeight: 600 }}>コンポーネントエラー</span>
          <pre style={{
            fontSize: '11px', color: 'var(--text-muted)', background: 'var(--app-bg-surface)',
            padding: '12px', borderRadius: '6px', maxWidth: '600px', overflow: 'auto', whiteSpace: 'pre-wrap'
          }}>{err.message}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '6px 16px', background: 'var(--accent)', color: '#000',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600
            }}
          >リトライ</button>
        </div>
      )
    }
    return this.props.children
  }
}
import { Header } from './components/Header'
import { SplitLayout } from './components/SplitLayout'
import { TerminalPane } from './components/Terminal'
import { ChatPane } from './components/ChatPane'
import { AgentCards } from './components/AgentCards'
import { SettingsModal } from './components/SettingsModal'
import { BrowserPane } from './components/BrowserPane'
import { RightPanel } from './components/RightPanel'
import { useSessionStore } from './store/session'

export function App(): React.ReactElement {
  const { totalCostUsd, setSplitRatio, setBypassPermissions, setCwd, loadFontSettings } = useSessionStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSplitRatio(s.splitRatio)
      setBypassPermissions(s.bypassPermissions)
      setCwd(s.currentWorkingDir)
      // Load persisted font settings if present
      const anyS = s as Record<string, unknown>
      const fontSize = typeof anyS['fontSizeTerminal'] === 'number' ? anyS['fontSizeTerminal'] : 14
      const fontFamily = typeof anyS['fontFamilyTerminal'] === 'string'
        ? anyS['fontFamilyTerminal']
        : '"Cascadia Code", "Cascadia Mono", Consolas, monospace'
      loadFontSettings(fontSize, fontFamily)
    })
  }, [setSplitRatio, setBypassPermissions, setCwd, loadFontSettings])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--app-bg)',
        overflow: 'hidden'
      }}
    >
      <ErrorBoundary>
        <Header totalCostUsd={totalCostUsd} onSettingsClick={() => setSettingsOpen(true)} />
      </ErrorBoundary>
      <SplitLayout
        left={<ErrorBoundary><TerminalPane /></ErrorBoundary>}
        right={
          <ErrorBoundary>
            <RightPanel
              chatPane={<ChatPane />}
              browserPane={<BrowserPane />}
            />
          </ErrorBoundary>
        }
      />
      <ErrorBoundary><AgentCards /></ErrorBoundary>
      <StatusBar />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function StatusBar(): React.ReactElement {
  const { isQuerying, totalCostUsd, totalInputTokens, totalOutputTokens } = useSessionStore()

  return (
    <div
      style={{
        height: '22px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: '16px',
        background: 'var(--app-bg)',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: isQuerying ? 'var(--status-running)' : 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}
      >
        {isQuerying ? '⚙ 実行中' : '● 待機中'}
      </span>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}
      >
        合計: ${totalCostUsd.toFixed(4)}
      </span>
      {(totalInputTokens > 0 || totalOutputTokens > 0) && (
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          ↓{totalInputTokens.toLocaleString()} ↑{totalOutputTokens.toLocaleString()} tok
        </span>
      )}
    </div>
  )
}
