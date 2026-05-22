import React, { useEffect } from 'react'

interface ShortcutsOverlayProps {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: { key: string; desc: string; category: string }[] = [
  // Navigation
  { category: 'ナビゲーション', key: 'Ctrl+Shift+H', desc: 'ターミナルにフォーカス' },
  { category: 'ナビゲーション', key: 'Ctrl+Shift+L', desc: 'チャットにフォーカス' },
  { category: 'ナビゲーション', key: 'Ctrl+Shift+A', desc: 'チャットパネル 表示/非表示' },
  // Terminal
  { category: 'ターミナル', key: 'Ctrl+Shift+F', desc: 'ターミナル内検索' },
  { category: 'ターミナル', key: 'Ctrl+Shift+M', desc: 'ターミナル最大化 (Block Magnify)' },
  { category: 'ターミナル', key: 'Ctrl+Shift+S', desc: 'スクロールバックを保存' },
  { category: 'ターミナル', key: 'Ctrl+Click URL', desc: 'URL をブラウザで開く' },
  // Chat
  { category: 'チャット', key: 'Enter', desc: 'メッセージ送信' },
  { category: 'チャット', key: 'Shift+Enter', desc: '改行' },
  { category: 'チャット', key: 'Ctrl+Shift+G', desc: 'チャット内検索' },
  { category: 'チャット', key: '! + プロンプト', desc: '並列エージェント起動' },
  // UI
  { category: 'UI', key: 'F2', desc: 'アクティブタブをリネーム' },
  { category: 'UI', key: 'Ctrl+Alt+T', desc: 'Quake Mode (グローバル表示/非表示)' },
  { category: 'UI', key: 'Ctrl+?', desc: 'このショートカット一覧を表示' },
  { category: 'UI', key: 'Esc', desc: 'ダイアログ / 検索バーを閉じる' },
]

const CATEGORIES = Array.from(new Set(SHORTCUTS.map((s) => s.category)))

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps): React.ReactElement | null {
  // Ctrl+? and Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.ctrlKey && e.key === '?')) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        background: 'rgba(0,0,0,0.80)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '540px',
          maxHeight: '80vh',
          background: 'var(--app-bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--ls-label)'
            }}
          >
            KEYBOARD SHORTCUTS
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px' }}>
          {CATEGORIES.map((cat) => (
            <div key={cat} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--ls-label)',
                  marginBottom: '6px',
                  paddingBottom: '4px',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                {cat}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                  <div
                    key={s.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '4px 0'
                    }}
                  >
                    <code
                      style={{
                        flexShrink: 0,
                        padding: '1px 6px',
                        background: 'var(--app-bg)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {s.key}
                    </code>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-ui)'
                      }}
                    >
                      {s.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0
          }}
        >
          ESC または Ctrl+? で閉じる
        </div>
      </div>
    </div>
  )
}
