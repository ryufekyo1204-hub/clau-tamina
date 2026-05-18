import React, { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/session'
import type { SessionSummary } from '../types/api'

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function SessionRow({
  session,
  onRestore,
  onDelete
}: {
  session: SessionSummary
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)
  const currentId = useSessionStore((s) => s.currentSessionId)
  const isActive = currentId === session.id

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 10px',
        cursor: 'pointer',
        background: isActive
          ? 'var(--accent-subtle)'
          : hovered
            ? 'var(--app-bg-hover)'
            : 'transparent',
        borderRadius: '6px',
        transition: 'background 0.15s ease'
      }}
      onClick={() => onRestore(session.id)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            fontWeight: isActive ? 600 : 400
          }}
        >
          {session.title || '無題のセッション'}
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginTop: '1px'
          }}
        >
          {formatDate(session.updatedAt)}
        </div>
      </div>

      {/* Delete button — only visible on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(session.id)
        }}
        style={{
          flexShrink: 0,
          width: '18px',
          height: '18px',
          borderRadius: '4px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.1s ease, color 0.1s ease'
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--status-error)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
        }}
        title="セッションを削除"
      >
        ✕
      </button>
    </div>
  )
}

export function SessionList(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const { savedSessions, loadSavedSessions, saveCurrentSession, restoreSession, deleteSession, clearMessages } =
    useSessionStore()
  const popoverRef = useRef<HTMLDivElement>(null)
  // Hold a stable ref to loadSavedSessions to avoid useEffect re-running
  // if Zustand ever re-creates the store (e.g. during HMR or store re-init)
  const loadSavedSessionsRef = useRef(loadSavedSessions)
  loadSavedSessionsRef.current = loadSavedSessions

  // Load sessions on first open
  useEffect(() => {
    if (open) loadSavedSessionsRef.current()
  }, [open])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearchText('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleRestore = async (id: string) => {
    await restoreSession(id)
    setOpen(false)
    setSearchText('')
  }

  const handleDelete = async (id: string) => {
    await deleteSession(id)
  }

  const handleNew = () => {
    clearMessages()
    setOpen(false)
    setSearchText('')
  }

  const handleSave = async () => {
    await saveCurrentSession()
    await loadSavedSessions()
  }

  const filteredSessions = searchText.trim()
    ? savedSessions.filter((s) => s.title.toLowerCase().includes(searchText.toLowerCase()))
    : savedSessions

  return (
    <div ref={popoverRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: 'var(--text-sm)',
          color: open ? 'var(--accent)' : 'var(--text-secondary)',
          border: '1px solid ' + (open ? 'var(--border-accent)' : 'var(--border-subtle)'),
          background: open ? 'var(--accent-subtle)' : 'transparent',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease'
        }}
      >
        Sessions
        <span
          style={{
            fontSize: '8px',
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            marginTop: '1px'
          }}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '260px',
            background: 'var(--app-bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeSlideDown 0.1s ease-out'
          }}
        >
          {/* Popover header actions */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-subtle)'
            }}
          >
            <button
              onClick={handleNew}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: '6px',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600
              }}
            >
              + 新規セッション
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: '6px',
                fontSize: 'var(--text-xs)',
                color: 'var(--accent)',
                border: '1px solid var(--border-accent)',
                background: 'var(--accent-subtle)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600
              }}
            >
              保存
            </button>
          </div>

          {/* Search input */}
          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              placeholder="セッションを検索..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 8px',
                background: 'var(--app-bg)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-ui)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Session list */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '6px'
            }}
          >
            {filteredSessions.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)'
                }}
              >
                {searchText.trim() ? '一致するセッションはありません' : '保存済みセッションはありません'}
              </div>
            ) : (
              filteredSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onRestore={handleRestore}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          <style>{`
            @keyframes fadeSlideDown {
              from { opacity: 0; transform: translateY(-4px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
