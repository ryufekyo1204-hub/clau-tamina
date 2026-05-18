import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/session'
import type { FileEntry } from '../types/api'

// Fetches directory listing via IPC
async function fetchDir(dirPath: string): Promise<FileEntry[]> {
  return window.api.listDirectory(dirPath)
}

function FileRow({
  entry,
  onNavigate,
  onInsertPath
}: {
  entry: FileEntry
  onNavigate: (path: string) => void
  onInsertPath: (path: string) => void
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        cursor: 'pointer',
        background: hovered ? 'var(--app-bg-hover)' : 'transparent',
        borderRadius: '4px',
        transition: 'background 0.1s ease'
      }}
      onClick={() => {
        if (entry.isDir) {
          onNavigate(entry.path)
        } else {
          onInsertPath(entry.path)
        }
      }}
      title={entry.isDir ? 'クリックで移動' : 'クリックでパスをコピー'}
    >
      <span style={{ fontSize: '11px', flexShrink: 0, color: entry.isDir ? 'var(--status-waiting)' : 'var(--text-muted)' }}>
        {entry.isDir ? '▶' : '·'}
      </span>
      <span
        style={{
          fontSize: 'var(--text-sm)',
          color: entry.isDir ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          flex: 1,
          fontFamily: entry.isDir ? 'var(--font-ui)' : 'var(--font-mono)',
          fontWeight: entry.isDir ? 600 : 400
        }}
      >
        {entry.name}
      </span>
    </div>
  )
}

export function FileTreePane(): React.ReactElement {
  const { currentWorkingDir, setCwd } = useSessionStore()
  const [currentPath, setCurrentPath] = useState(currentWorkingDir || 'C:\\')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadDir = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await fetchDir(path)
      setEntries(list)
      setCurrentPath(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ディレクトリを読み込めませんでした')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load initial directory on mount and when cwd changes
  useEffect(() => {
    const dir = currentWorkingDir || 'C:\\'
    setCurrentPath(dir)
    void loadDir(dir)
  }, [currentWorkingDir, loadDir])

  const navigateUp = () => {
    const parts = currentPath.replace(/[/\\]+$/, '').split(/[/\\]/)
    if (parts.length <= 1) return
    parts.pop()
    const parent = parts.join('\\') || 'C:\\'
    void loadDir(parent)
  }

  const handleInsertPath = (path: string) => {
    // Copy path to clipboard for easy use in terminal/chat
    navigator.clipboard.writeText(path).catch(() => {})
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    setCopied(path)
    copiedTimerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  const handleSetAsCwd = () => {
    setCwd(currentPath)
    // Fire-and-forget: persist to electron-store without blocking UI
    void window.api.setSetting('currentWorkingDir', currentPath)
  }

  const displayPath = currentPath.length > 36
    ? '…' + currentPath.slice(-34)
    : currentPath

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--app-bg)', position: 'relative' }}>
      {/* Toolbar */}
      <div
        style={{
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 8px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--app-bg-surface)'
        }}
      >
        <button
          onClick={navigateUp}
          title="上のディレクトリへ"
          style={toolBtnStyle}
        >
          ↑
        </button>
        <button
          onClick={() => void loadDir(currentPath)}
          title="再読み込み"
          style={toolBtnStyle}
        >
          ↺
        </button>
        <span
          style={{
            flex: 1,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis'
          }}
          title={currentPath}
        >
          {displayPath}
        </span>
        <button
          onClick={handleSetAsCwd}
          title="このフォルダをClaude AIの作業ディレクトリに設定"
          style={{ ...toolBtnStyle, fontSize: '9px', padding: '2px 6px', width: 'auto' }}
        >
          CWD
        </button>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        {isLoading && (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            読み込み中...
          </div>
        )}

        {error && !isLoading && (
          <div style={{ padding: '12px', fontSize: 'var(--text-xs)', color: 'var(--status-error)', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            空のディレクトリ
          </div>
        )}

        {!isLoading && !error && entries.map((entry) => (
          <FileRow
            key={entry.path}
            entry={entry}
            onNavigate={(p) => void loadDir(p)}
            onInsertPath={handleInsertPath}
          />
        ))}
      </div>

      {/* Copy notification */}
      {copied && (
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--app-bg-elevated)',
            border: '1px solid var(--border-accent)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10
          }}
        >
          コピー完了
        </div>
      )}
    </div>
  )
}

const toolBtnStyle: React.CSSProperties = {
  width: '22px',
  height: '22px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '13px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
}
