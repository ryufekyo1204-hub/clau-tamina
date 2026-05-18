import React from 'react'
import { useSessionStore } from '../store/session'
import type { ParallelAgent, ChatMessage } from '../store/session'

const STATUS_COLOR: Record<ParallelAgent['status'], string> = {
  running: 'var(--status-running)',
  done: 'var(--status-done)',
  error: 'var(--status-error)'
}

const STATUS_BG: Record<ParallelAgent['status'], string> = {
  running: 'rgba(88,193,66,0.12)',
  done: 'rgba(90,85,80,0.15)',
  error: 'rgba(229,77,46,0.15)'
}

const STATUS_ICON: Record<ParallelAgent['status'], string> = {
  running: '⚙',
  done: '✓',
  error: '✗'
}

const STATUS_LABEL: Record<ParallelAgent['status'], string> = {
  running: '実行中',
  done: '完了',
  error: 'エラー'
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
        borderRadius: '10px',
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

      {/* Card header: pill badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            background: STATUS_BG[agent.status],
            border: `1px solid ${STATUS_COLOR[agent.status]}`,
            fontSize: 'var(--text-xs)',
            color: STATUS_COLOR[agent.status],
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            animation: agent.status === 'running' ? 'badge-pulse 2s ease-in-out infinite' : 'none'
          }}
        >
          <span style={{ fontSize: '9px' }}>{STATUS_ICON[agent.status]}</span>
          {STATUS_LABEL[agent.status]}
        </span>
      </div>
      <style>{`
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

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

// Renders only when 1 or more parallel agents are active
export function AgentCards(): React.ReactElement | null {
  const { parallelAgents, focusedAgentId, setFocusedAgentId, removeParallelAgent } = useSessionStore()
  const agents = Object.values(parallelAgents)

  if (agents.length === 0) return null

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
          background: 'var(--app-bg)'
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
      </div>

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
              borderRadius: '12px',
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
                      borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '0',
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
