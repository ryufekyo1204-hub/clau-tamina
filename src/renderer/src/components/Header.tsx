import React from 'react'
import { useSessionStore } from '../store/session'
import { SessionList } from './SessionList'

interface HeaderProps {
  totalCostUsd: number
  onSettingsClick: () => void
}

export function Header({ totalCostUsd, onSettingsClick }: HeaderProps): React.ReactElement {
  const { bypassPermissions, setBypassPermissions, totalInputTokens, totalOutputTokens, parallelAgents } = useSessionStore()

  // Count agents in each state for header badges (Wave Terminal block badges roll-up)
  const agentList = Object.values(parallelAgents)
  const runningCount = agentList.filter((a) => a.status === 'running').length
  const errorCount   = agentList.filter((a) => a.status === 'error').length

  const formatCost = (usd: number): string =>
    usd < 0.001 ? '$0.000' : `$${usd.toFixed(3)}`

  return (
    <header className="app-header">
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
        <button
          className="settings-btn"
          onClick={onSettingsClick}
          title="設定"
        >
          ⚙
        </button>
      </div>

      <style>{`
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
          letter-spacing: 0.5px;
        }

        .permission-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 12px;
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
