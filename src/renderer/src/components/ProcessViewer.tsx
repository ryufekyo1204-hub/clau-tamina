import React, { useState, useEffect, useCallback } from 'react'
import type { ProcessInfo } from '../types/api'

type SortKey = 'name' | 'cpu' | 'memMb'

const REFRESH_INTERVAL = 5000

export function ProcessViewer(): React.ReactElement {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  // A-2 (Phase 14): sortable columns (Wave Terminal v0.14.5)
  const [sortKey, setSortKey] = useState<SortKey>('memMb')
  const [sortAsc, setSortAsc] = useState(false)
  const [hoverRow, setHoverRow] = useState<number | null>(null)
  const [killingPid, setKillingPid] = useState<number | null>(null)

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a)
    } else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  const handleKill = useCallback(async (pid: number) => {
    setKillingPid(pid)
    try {
      await window.api.killProcess(pid)
      // Remove from list immediately after kill
      setProcesses((prev) => prev.filter((p) => p.pid !== pid))
    } catch {
      // ignore
    } finally {
      setKillingPid(null)
    }
  }, [])

  const filtered = (filter
    ? processes.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : processes
  ).slice().sort((a, b) => {
    let cmp = 0
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortKey === 'cpu') cmp = (a.cpu ?? 0) - (b.cpu ?? 0)
    else cmp = (a.memMb ?? 0) - (b.memMb ?? 0)
    return sortAsc ? cmp : -cmp
  })

  const formatMem = (mb: number): string =>
    mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`

  const formatCpu = (cpu: number): string =>
    cpu > 0 ? cpu.toFixed(1) : '—'

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span style={{ color: 'var(--text-muted)', opacity: 0.35 }}>⇅</span>
    return <span style={{ color: 'var(--accent)' }}>{sortAsc ? '↑' : '↓'}</span>
  }

  const COLS: { key: SortKey; label: string }[] = [
    { key: 'name', label: 'プロセス名' },
    { key: 'cpu',  label: 'CPU' },
    { key: 'memMb', label: 'メモリ' }
  ]

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
            borderRadius: 'var(--radius-sm)',
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
            borderRadius: 'var(--radius-sm)',
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
              {COLS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  style={{
                    padding: '5px 8px',
                    textAlign: key === 'name' ? 'left' : 'right',
                    color: sortKey === key ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '10px',
                    letterSpacing: 'var(--ls-label)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'color 0.15s'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
              {/* Kill column header — empty */}
              <th style={{ width: '28px' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={4}
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
            {filtered.map((proc, idx) => {
              const isKilling = proc.pid !== undefined && killingPid === proc.pid
              return (
                <tr
                  key={`${proc.pid ?? proc.name}-${idx}`}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: hoverRow === idx ? 'var(--app-bg-hover)' : 'transparent',
                    opacity: isKilling ? 0.4 : 1,
                    transition: 'background 0.1s, opacity 0.2s'
                  }}
                  onMouseEnter={() => setHoverRow(idx)}
                  onMouseLeave={() => setHoverRow(null)}
                >
                  <td
                    style={{
                      padding: '4px 8px',
                      color: 'var(--text-primary)',
                      maxWidth: '130px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={proc.pid !== undefined ? `${proc.name} (PID: ${proc.pid})` : proc.name}
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
                  {/* Kill button — only if pid is available */}
                  <td style={{ padding: '2px 6px', textAlign: 'center', width: '28px' }}>
                    {proc.pid !== undefined && hoverRow === idx && (
                      <button
                        onClick={() => { void handleKill(proc.pid!) }}
                        disabled={isKilling}
                        title={`PID ${proc.pid} を終了`}
                        style={{
                          padding: '1px 4px',
                          background: 'rgba(229,77,46,0.15)',
                          border: '1px solid rgba(229,77,46,0.4)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--status-error)',
                          fontSize: '9px',
                          cursor: isKilling ? 'default' : 'pointer',
                          fontFamily: 'var(--font-mono)',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isKilling) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229,77,46,0.3)'
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(229,77,46,0.15)'
                        }}
                      >
                        ⊗
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
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
