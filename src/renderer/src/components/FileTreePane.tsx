import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/session'
import type { FileEntry } from '../types/api'

async function fetchDir(dirPath: string): Promise<FileEntry[]> {
  return window.api.listDirectory(dirPath)
}

/** Drive root pattern: C:\ D:\ など */
function isDriveRoot(p: string): boolean {
  return /^[A-Za-z]:\\?$/.test(p)
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
        gap: '8px',
        padding: '5px 10px',
        cursor: 'pointer',
        background: hovered
          ? entry.isDir ? 'rgba(217,119,87,0.08)' : 'var(--app-bg-hover)'
          : 'transparent',
        borderRadius: '4px',
        borderLeft: hovered && entry.isDir ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.1s ease, border-color 0.1s ease',
        minHeight: '26px'
      }}
      onClick={() => {
        if (entry.isDir) {
          onNavigate(entry.path)
        } else {
          onInsertPath(entry.path)
        }
      }}
      title={entry.isDir ? `${entry.path}  (クリックで移動)` : `${entry.path}  (クリックでパスをコピー)`}
    >
      <span style={{
        fontSize: '12px',
        flexShrink: 0,
        color: entry.isDir ? 'var(--accent)' : 'var(--text-muted)',
        lineHeight: 1
      }}>
        {entry.isDir ? '▸' : '·'}
      </span>
      <span
        style={{
          fontSize: 'var(--text-base)',
          color: entry.isDir ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          flex: 1,
          fontFamily: entry.isDir ? 'var(--font-ui)' : 'var(--font-mono)',
          fontWeight: entry.isDir ? 600 : 400,
          letterSpacing: entry.isDir ? '0.01em' : 0
        }}
      >
        {entry.name}
      </span>
    </div>
  )
}

export function FileTreePane(): React.ReactElement {
  const { currentWorkingDir, setCwd } = useSessionStore()
  // Initialize once from CWD; browsing never resets back automatically
  const initPath = currentWorkingDir || 'C:\\'
  const [currentPath, setCurrentPath] = useState(initPath)
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState(initPath)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathInputRef = useRef<HTMLInputElement>(null)

  const loadDir = useCallback(async (path: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Normalize drive root: 'C:' → 'C:\'
      const normalized = /^[A-Za-z]:$/.test(path) ? path + '\\' : path
      const list = await fetchDir(normalized)
      setEntries(list)
      setCurrentPath(normalized)
      setPathInput(normalized)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ディレクトリを読み込めませんでした')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load on mount only
  useEffect(() => {
    void loadDir(initPath)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateUp = () => {
    if (isDriveRoot(currentPath)) return
    const normalized = currentPath.replace(/[/\\]+$/, '')
    const parts = normalized.split(/[/\\]/)
    parts.pop()
    // ['C:'] → 'C:\'
    const parent = parts.length === 1 && /^[A-Za-z]:$/.test(parts[0])
      ? parts[0] + '\\'
      : parts.join('\\') || 'C:\\'
    void loadDir(parent)
  }

  const handleInsertPath = (path: string) => {
    navigator.clipboard.writeText(path).catch(() => {})
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    setCopied(path)
    copiedTimerRef.current = setTimeout(() => setCopied(null), 1500)
  }

  const handleSetAsCwd = () => {
    setCwd(currentPath)
    void window.api.setSetting('currentWorkingDir', currentPath)
  }

  const handleGoToCwd = () => {
    void loadDir(currentWorkingDir || 'C:\\')
  }

  const startEditPath = () => {
    setPathInput(currentPath)
    setEditingPath(true)
    setTimeout(() => { pathInputRef.current?.select() }, 0)
  }

  const commitPathEdit = () => {
    setEditingPath(false)
    if (pathInput.trim()) void loadDir(pathInput.trim())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--app-bg)', position: 'relative' }}>
      {/* Toolbar */}
      <div
        style={{
          height: '34px',
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
          style={{ ...toolBtnStyle, opacity: isDriveRoot(currentPath) ? 0.3 : 1 }}
          disabled={isDriveRoot(currentPath)}
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
        {/* Path — click to edit, type any path directly */}
        {editingPath ? (
          <input
            ref={pathInputRef}
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPathEdit()
              if (e.key === 'Escape') { setEditingPath(false); setPathInput(currentPath) }
            }}
            onBlur={commitPathEdit}
            style={{
              flex: 1,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              background: 'var(--app-bg)',
              border: '1px solid var(--border-accent)',
              borderRadius: '4px',
              padding: '2px 6px',
              outline: 'none'
            }}
          />
        ) : (
          <span
            onClick={startEditPath}
            style={{
              flex: 1,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              cursor: 'text',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid transparent'
            }}
            title={`${currentPath}  (クリックでパスを編集)`}
          >
            {currentPath}
          </span>
        )}
        <button
          onClick={handleGoToCwd}
          title="Claude AIの作業ディレクトリへ戻る"
          style={toolBtnStyle}
        >
          ⌂
        </button>
        <button
          onClick={handleSetAsCwd}
          title="このフォルダをClaude AIの作業ディレクトリに設定"
          style={{ ...toolBtnStyle, fontSize: '9px', padding: '2px 6px', width: 'auto', color: 'var(--accent)' }}
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
