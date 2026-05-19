import React, { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '../store/session'
import type { ParallelAgent, ChatMessage } from '../store/session'

const STATUS_COLOR: Record<ParallelAgent['status'], string> = {
  running: 'var(--status-running)',
  done: 'var(--status-done)',
  error: 'var(--status-error)'
}

// Badge backgrounds (semi-transparent fill)
const STATUS_BG: Record<ParallelAgent['status'], string> = {
  running: 'rgba(88,193,66,0.12)',
  done: 'rgba(90,85,80,0.15)',
  error: 'rgba(229,77,46,0.15)'
}

// Badge: icon + short label (Wave Terminal v0.14.2 style block badges)
const STATUS_BADGE: Record<ParallelAgent['status'], { icon: string; label: string }> = {
  running: { icon: '⚙', label: '実行中' },
  done:    { icon: '✓', label: '完了' },
  error:   { icon: '✗', label: 'エラー' }
}

// ---- Process Viewer types ----
interface ProcessInfo {
  name: string
  cpu: number
  memMb: number
}

// Pill-shaped badge component (Wave Terminal v0.14.2 block badges)
function StatusBadge({
  status,
  customText
}: {
  status: ParallelAgent['status']
  customText?: string
}): React.ReactElement {
  const { icon, label } = STATUS_BADGE[status]
  const color = STATUS_COLOR[status]
  const bg = STATUS_BG[status]
  return (
    <>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '999px',
          background: bg,
          border: `1px solid ${color}`,
          fontSize: 'var(--text-xs)',
          color,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          animation: status === 'running' ? 'badge-pulse 2s ease-in-out infinite' : 'none',
          lineHeight: 1.4,
          whiteSpace: 'nowrap'
        }}
      >
        <span style={{ fontSize: '9px' }}>{icon}</span>
        {customText ?? label}
      </span>
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  )
}

// Terminal OSC badge display — shows badge from PTY output (A-2 wsh badge)
function PtyBadge(): React.ReactElement | null {
  const [badgeText, setBadgeText] = React.useState<string | null>(null)

  React.useEffect(() => {
    const off = window.api.onPtyBadgeUpdate((text) => {
      setBadgeText(text || null)
    })
    return off
  }, [])

  if (!badgeText) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        background: 'rgba(83,180,234,0.12)',
        border: '1px solid var(--status-waiting)',
        fontSize: 'var(--text-xs)',
        color: 'var(--status-waiting)',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap'
      }}
      title="ターミナルバッジ (OSC 9999)"
    >
      {badgeText}
    </span>
  )
}

function AgentCard({
  agent,
  onFocus,
  onRemove
}: {
  agent: ParallelAgent
  onFocus: () => void
  onRemove: () => void
}): React.ReactElement {
  const isActive = agent.status === 'running'
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '10px 12px',
        background: 'var(--app-bg-elevated)',
        border: isActive ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: isActive ? 'var(--accent-glow)' : 'none',
        transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        position: 'relative'
      }}
    >
      {/* Remove button — only for completed/errored agents */}
      {agent.status !== 'running' && (
        <button
          onClick={onRemove}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '16px',
            height: '16px',
            borderRadius: '4px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '11px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: 0
          }}
          title="カードを削除"
        >
          ×
        </button>
      )}

      {/* Card header: pill badge (Wave Terminal block badge style) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <StatusBadge status={agent.status} />
      </div>

      {/* Prompt (truncated as summary) */}
      <div
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          marginBottom: '6px'
        }}
      >
        {agent.prompt || '—'}
      </div>

      {/* Cost */}
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}
      >
        ${agent.costUsd.toFixed(4)}
      </div>

      {/* Detail button */}
      <button
        onClick={onFocus}
        style={{
          marginTop: '6px',
          fontSize: 'var(--text-xs)',
          color: 'var(--accent)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          padding: 0
        }}
      >
        詳細↗
      </button>
    </div>
  )
}

// ---- Process Viewer panel ----
function ProcessViewer(): React.ReactElement {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.listProcesses()
      setProcesses(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'プロセス取得失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh every 5s when expanded
  useEffect(() => {
    if (!expanded) return
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [expanded, refresh])

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--app-bg)',
        flexShrink: 0
      }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          textAlign: 'left'
        }}
      >
        <span
          style={{
            fontSize: '9px',
            transition: 'transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
            display: 'inline-block'
          }}
        >
          ▶
        </span>
        プロセスビューワー
        {loading && <span style={{ color: 'var(--status-running)', marginLeft: '4px' }}>●</span>}
        {!loading && processes.length > 0 && (
          <span style={{ marginLeft: '4px', color: 'var(--text-muted)' }}>({processes.length})</span>
        )}
      </button>

      {expanded && (
        <div
          style={{
            maxHeight: '160px',
            overflowY: 'auto',
            padding: '0 10px 8px'
          }}
        >
          {error && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', padding: '4px 0' }}>
              {error}
            </div>
          )}
          {!error && processes.length === 0 && !loading && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: '4px 0' }}>
              データなし
            </div>
          )}
          {processes.length > 0 && (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              <thead>
                <tr>
                  {['プロセス名', 'CPU%', 'MEM(MB)'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'プロセス名' ? 'left' : 'right',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        padding: '2px 4px',
                        borderBottom: '1px solid var(--border-subtle)'
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processes.map((p, i) => (
                  <tr
                    key={`${p.name}-${i}`}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'var(--app-bg-hover)'
                    }}
                  >
                    <td
                      style={{
                        color: 'var(--text-secondary)',
                        padding: '2px 4px',
                        maxWidth: '160px',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {p.name}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '2px 4px',
                        color: p.cpu > 10 ? 'var(--status-warning)' : 'var(--text-muted)'
                      }}
                    >
                      {p.cpu.toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '2px 4px', color: 'var(--text-muted)' }}>
                      {p.memMb.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={refresh}
              disabled={loading}
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent)',
                background: 'transparent',
                border: 'none',
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono)',
                padding: '2px 0',
                opacity: loading ? 0.5 : 1
              }}
            >
              更新
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Renders only when 1 or more parallel agents are active (or always shows ProcessViewer)
export function AgentCards(): React.ReactElement | null {
  const { parallelAgents, focusedAgentId, setFocusedAgentId, removeParallelAgent } = useSessionStore()
  const agents = Object.values(parallelAgents)

  // When no agents: only show ProcessViewer and PTY badge (collapsed by default, unobtrusive)
  if (agents.length === 0) return (
    <>
      <PtyBadge />
      <ProcessViewer />
    </>
  )

  const focusedAgent = focusedAgentId ? parallelAgents[focusedAgentId] : null

  return (
    <>
      {/* Agent cards row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px 10px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--app-bg)',
          alignItems: 'flex-start'
        }}
      >
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onFocus={() => setFocusedAgentId(agent.id)}
            onRemove={() => removeParallelAgent(agent.id)}
          />
        ))}
        <PtyBadge />
      </div>

      {/* Process Viewer — collapsible, below agent cards */}
      <ProcessViewer />

      {/* Detail overlay */}
      {focusedAgent && (
        <div
          onClick={() => setFocusedAgentId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '680px',
              maxHeight: '70vh',
              background: 'var(--app-bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            {/* Overlay header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                gap: '8px'
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis'
                }}
              >
                {focusedAgent.prompt}
              </span>
              <button
                onClick={() => setFocusedAgentId(null)}
                style={{
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {focusedAgent.messages.map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '10px'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '88%',
                      padding: msg.role === 'user' ? '8px 12px' : '0',
                      background: msg.role === 'user' ? 'var(--app-bg)' : 'transparent',
                      border: msg.role === 'user' ? '1px solid var(--border-subtle)' : 'none',
                      borderRadius: msg.role === 'user' ? 'var(--radius-md)' : '0',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-md)',
                      lineHeight: '1.65',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Cost footer */}
            <div
              style={{
                padding: '8px 16px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              コスト: ${focusedAgent.costUsd.toFixed(4)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
