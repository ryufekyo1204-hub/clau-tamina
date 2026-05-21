import React, { useEffect, useState } from 'react'
import { useSessionStore } from '../store/session'
import { SessionList } from './SessionList'

interface HeaderProps {
  totalCostUsd: number
  onSettingsClick: () => void
  chatVisible?: boolean
  onChatToggle?: () => void
}

export function Header({ totalCostUsd, onSettingsClick, chatVisible = true, onChatToggle }: HeaderProps): React.ReactElement {
  const { bypassPermissions, setBypassPermissions, totalInputTokens, totalOutputTokens, parallelAgents } = useSessionStore()

  // A-2: Bell visual indicator
  const [bellVisible, setBellVisible] = useState(false)
  useEffect(() => {
    const off = window.api.onPtyBell(() => {
      setBellVisible(true)
      setTimeout(() => setBellVisible(false), 3000)
    })
    return off
  }, [])

  // A-1: OSC 9;4 progress bar
  const [progressState, setProgressState] = useState(0)
  const [progressValue, setProgressValue] = useState(0)
  useEffect(() => {
    const off = window.api.onPtyProgress((state, value) => {
      setProgressState(state)
      setProgressValue(value)
    })
    return off
  }, [])

  // A-5: header background color
  const [headerBackground, setHeaderBackground] = useState<string | undefined>(undefined)
  // A-4: CWD→header color map
  const [cwdColorMap, setCwdColorMap] = useState<Record<string, string>>({})
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setHeaderBackground(s.headerBackground)
      setCwdColorMap(s.cwdColorMap ?? {})
    }).catch(() => { /* ignore */ })
  }, [])

  // A-4: subscribe to CWD updates — use locally-cached map to avoid IPC on every cd
  const cwdColorMapRef = React.useRef(cwdColorMap)
  const headerBackgroundBaseRef = React.useRef(headerBackground)
  useEffect(() => { cwdColorMapRef.current = cwdColorMap }, [cwdColorMap])
  useEffect(() => { headerBackgroundBaseRef.current = headerBackground }, [headerBackground])

  useEffect(() => {
    const off = window.api.onPtyCwdUpdate((cwd) => {
      const color = cwdColorMapRef.current[cwd]
      setHeaderBackground(color ?? headerBackgroundBaseRef.current)
    })
    return off
  }, [])

  // Count agents in each state for header badges (Wave Terminal block badges roll-up)
  const agentList = Object.values(parallelAgents)
  const runningCount = agentList.filter((a) => a.status === 'running').length
  const errorCount   = agentList.filter((a) => a.status === 'error').length

  const formatCost = (usd: number): string =>
    usd < 0.001 ? '$0.000' : `$${usd.toFixed(3)}`

  // Progress bar color by state
  const progressColor =
    progressState === 2 ? 'var(--status-error)' :
    progressState === 4 ? 'var(--status-warning)' :
    'var(--status-running)'

  return (
    <header
      className="app-header"
      style={{ background: headerBackground ?? undefined, position: 'relative' }}
    >
      {/* A-1: OSC 9;4 progress bar — 2px line at header bottom edge */}
      {progressState > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '2px',
            width: progressState === 3 ? '100%' : `${Math.min(100, progressValue)}%`,
            background: progressState === 3
              ? `linear-gradient(90deg, transparent 0%, ${progressColor} 50%, transparent 100%)`
              : progressColor,
            backgroundSize: progressState === 3 ? '200% 100%' : undefined,
            animation: progressState === 3 ? 'progress-indeterminate 1.5s ease-in-out infinite' : undefined,
            transition: progressState !== 3 ? 'width 0.3s ease' : undefined,
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      )}
      <div className="header-left">
        <span className="header-brand">clau-tamina</span>
        <SessionList />
      </div>

      <div className="header-center">
        <button
          className={`permission-toggle ${bypassPermissions ? 'bypass' : 'normal'}`}
          onClick={() => setBypassPermissions(!bypassPermissions)}
          title={bypassPermissions ? 'バイパスモード（全自動）— クリックで通常モードへ' : '通常モード（承認あり）— クリックでバイパスへ'}
        >
          <span className="toggle-dot">{bypassPermissions ? '🟢' : '🔴'}</span>
          <span className="toggle-label">
            {bypassPermissions ? 'バイパス中' : '通常モード'}
          </span>
        </button>
      </div>

      <div className="header-right">
        {/* Agent status badges (Wave Terminal block badges roll-up) */}
        {runningCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 7px',
              borderRadius: '999px',
              background: 'rgba(88,193,66,0.15)',
              border: '1px solid rgba(88,193,66,0.35)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--status-running)',
              fontWeight: 600
            }}
            title={`${runningCount}体のエージェントが実行中`}
          >
            <span style={{ fontSize: '8px' }}>⚙</span>
            {runningCount}
          </span>
        )}
        {errorCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 7px',
              borderRadius: '999px',
              background: 'rgba(229,77,46,0.15)',
              border: '1px solid rgba(229,77,46,0.4)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--status-error)',
              fontWeight: 600
            }}
            title={`${errorCount}体のエージェントがエラー`}
          >
            <span style={{ fontSize: '8px' }}>✗</span>
            {errorCount}
          </span>
        )}
        <span
          className="header-tokens"
          title={`入力: ${totalInputTokens.toLocaleString()} / 出力: ${totalOutputTokens.toLocaleString()} tokens`}
        >
          {totalInputTokens > 0 || totalOutputTokens > 0
            ? `↓${(totalInputTokens / 1000).toFixed(1)}k ↑${(totalOutputTokens / 1000).toFixed(1)}k`
            : '—'}
        </span>
        <span className="header-cost">{formatCost(totalCostUsd)}</span>
        <span className="header-model" style={{ color: 'var(--accent)' }}>Sonnet 4.6</span>
        {/* A-2/A-5: Bell visual indicator with pulse animation */}
        {bellVisible && (
          <span
            title="ターミナルベル"
            style={{
              fontSize: '12px',
              color: 'var(--status-warning)',
              animation: 'bell-pulse 3s ease-out forwards',
              pointerEvents: 'none',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            🔔
          </span>
        )}
        {onChatToggle && (
          <button
            className="settings-btn"
            onClick={onChatToggle}
            title={`チャットパネル ${chatVisible ? '非表示' : '表示'} (Ctrl+Shift+A)`}
            style={{
              color: chatVisible ? 'var(--accent)' : 'var(--text-muted)',
              borderColor: chatVisible ? 'var(--border-accent)' : 'var(--border-subtle)',
              background: chatVisible ? 'var(--accent-subtle)' : 'transparent'
            }}
          >
            ≡
          </button>
        )}
        <button
          className="settings-btn"
          onClick={onSettingsClick}
          title="設定"
        >
          ⚙
        </button>
      </div>

      <style>{`
        @keyframes progress-indeterminate {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes bell-pulse {
          0%   { opacity: 1; transform: scale(1.2); }
          15%  { transform: scale(0.9) rotate(-8deg); }
          30%  { transform: scale(1.05) rotate(6deg); }
          50%  { transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        .app-header {
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          background: var(--app-bg);
          border-bottom: 1px solid var(--border-default);
          -webkit-app-region: drag;
          flex-shrink: 0;
          user-select: none;
        }
        .header-left, .header-center, .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          -webkit-app-region: no-drag;
        }
        .header-left { min-width: 200px; }
        .header-right { min-width: 120px; justify-content: flex-end; }

        .header-brand {
          font-family: var(--font-display);
          font-size: var(--text-sm);
          font-weight: 700;
          color: var(--accent);
          letter-spacing: var(--ls-label);
        }

        .permission-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          font-weight: 600;
          transition: background 0.15s ease, border-color 0.15s ease;
          border: 1px solid var(--border-subtle);
          cursor: pointer;
        }
        .permission-toggle.normal {
          color: var(--text-secondary);
        }
        .permission-toggle.bypass {
          color: var(--accent);
          border-color: var(--border-accent);
          background: var(--accent-subtle);
        }
        .permission-toggle:hover {
          background: var(--app-bg-hover);
        }
        .toggle-dot { font-size: 10px; }
        .toggle-label { font-family: var(--font-ui); }

        .header-tokens {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
          cursor: default;
        }
        .header-cost {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .header-model {
          font-size: var(--text-xs);
          color: var(--text-muted);
        }
        .settings-btn {
          background: transparent;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          width: 22px;
          height: 22px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .settings-btn:hover {
          background: var(--app-bg-hover);
          color: var(--text-primary);
        }
      `}</style>
    </header>
  )
}
