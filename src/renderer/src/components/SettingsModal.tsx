import React from 'react'
import { useSessionStore } from '../store/session'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps): React.ReactElement | null {
  const { fontSizeTerminal, fontFamilyTerminal, setFontSizeTerminal, setFontFamilyTerminal } =
    useSessionStore()

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '480px',
          background: 'var(--app-bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            設定
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '18px' }}>
          {/* Section: ターミナル */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--accent)',
                fontWeight: 700,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              ターミナル
            </div>

            {/* Font size */}
            <label style={{ display: 'block', marginBottom: '12px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
              >
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  フォントサイズ
                </span>
                <span
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {fontSizeTerminal}px
                </span>
              </div>
              <input
                type="range"
                min={12}
                max={20}
                step={1}
                value={fontSizeTerminal}
                onChange={(e) => setFontSizeTerminal(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' } as React.CSSProperties}
              />
            </label>

            {/* Font family */}
            <label style={{ display: 'block' }}>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                フォントファミリー
              </div>
              <select
                value={fontFamilyTerminal}
                onChange={(e) => setFontFamilyTerminal(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'var(--app-bg)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <option value='"Cascadia Code", "Cascadia Mono", Consolas, monospace'>
                  Cascadia Code
                </option>
                <option value='"JetBrains Mono", "Cascadia Code", Consolas, monospace'>
                  JetBrains Mono
                </option>
                <option value='"Consolas", "Courier New", monospace'>Consolas</option>
                <option value='"Fira Code", "Cascadia Code", monospace'>Fira Code</option>
              </select>
            </label>
          </div>
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: '6px',
              fontSize: 'var(--text-sm)',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
            }}
          >
            完了
          </button>
        </div>
      </div>
    </div>
  )
}
