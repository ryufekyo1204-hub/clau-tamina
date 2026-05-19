import React, { useState, useEffect, useCallback } from 'react'
import type { ProcessInfo } from '../types/api'

const REFRESH_INTERVAL = 5000

export function ProcessViewer(): React.ReactElement {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchProcesses = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.api.listProcesses()
      setProcesses(list)
      setLastUpdated(new Date())
    } catch {
      // ignore errors silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProcesses()
    const timer = setInterval(() => { void fetchProcesses() }, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [fetchProcesses])

  const filtered = filter
    ? processes.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : processes

  const formatMem = (mb: number): string =>
    mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`

  const formatCpu = (cpu: number): string =>
    cpu > 0 ? cpu.toFixed(1) : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--app-bg)'
        }}
      >
        <input
          type="text"
          placeholder="プロセス名でフィルター..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 8px',
            background: 'var(--app-bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '5px',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)',
            outline: 'none'
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--border-accent)' }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border-subtle)' }}
        />
        <button
          onClick={() => { void fetchProcesses() }}
          disabled={loading}
          title="更新"
          style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '5px',
            color: loading ? 'var(--text-muted)' : 'var(--text-secondary)',
            cursor: loading ? 'default' : 'pointer',
            fontSize: '12px',
            transition: 'color 0.15s ease'
          }}
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          <thead>
            <tr
              style={{
                position: 'sticky',
                top: 0,
                background: 'var(--app-bg-surface)',
                borderBottom: '1px solid var(--border-subtle)',
                zIndex: 1
              }}
            >
              {(['プロセス名', 'CPU (s)', 'メモリ'] as const).map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '5px 8px',
                    textAlign: col === 'プロセス名' ? 'left' : 'right' as const,
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '10px',
                    letterSpacing: 'var(--ls-label)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={3}
                  style={{
                    textAlign: 'center',
                    padding: '24px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  {filter ? 'プロセスが見つかりません' : 'データなし（Windows 専用機能）'}
                </td>
              </tr>
            )}
            {filtered.map((proc, idx) => (
              <tr
                key={`${proc.name}-${idx}`}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background =
                    'var(--app-bg-hover)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                }}
              >
                <td
                  style={{
                    padding: '4px 8px',
                    color: 'var(--text-primary)',
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={proc.name}
                >
                  {proc.name}
                </td>
                <td
                  style={{
                    padding: '4px 8px',
                    textAlign: 'right',
                    color:
                      proc.cpu > 50
                        ? 'var(--status-error)'
                        : proc.cpu > 10
                          ? 'var(--status-warning)'
                          : 'var(--text-secondary)'
                  }}
                >
                  {formatCpu(proc.cpu)}
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                  {formatMem(proc.memMb)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div
          style={{
            padding: '4px 10px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0
          }}
        >
          {filtered.length}/{processes.length} プロセス — {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
