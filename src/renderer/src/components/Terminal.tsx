import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useSessionStore } from '../store/session'

export function TerminalPane(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const cleanupRef = useRef<Array<() => void>>([])
  const [savingScrollback, setSavingScrollback] = useState(false)
  // A-2: OSC 9998 terminal background color
  const [bgColor, setBgColor] = useState<string | null>(null)
  // A-3 (Phase 10): Block Magnify
  const [magnified, setMagnified] = useState(false)
  // A-5 (Phase 10): error context (Active AI style)
  const [errorContext, setErrorContext] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A-3 (Phase 13): terminal search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const fontSizeTerminal = useSessionStore((s) => s.fontSizeTerminal)
  const fontFamilyTerminal = useSessionStore((s) => s.fontFamilyTerminal)
  const currentWorkingDir = useSessionStore((s) => s.currentWorkingDir)
  const bypassPermissions = useSessionStore((s) => s.bypassPermissions)
  const isQuerying = useSessionStore((s) => s.isQuerying)
  const addUserMessage = useSessionStore((s) => s.addUserMessage)
  // A-1: split ratio preset buttons (Wave Terminal v0.14.5 showsplitbuttons)
  const splitRatio = useSessionStore((s) => s.splitRatio)
  const setSplitRatio = useSessionStore((s) => s.setSplitRatio)
  // A-4 (Phase 16): selection copy state
  const [hasSelection, setHasSelection] = useState(false)
  const [selCopied, setSelCopied] = useState(false)

  // A-5: save scrollback to file via main process dialog
  const handleSaveScrollback = useCallback(async () => {
    const term = termRef.current
    if (!term || savingScrollback) return
    setSavingScrollback(true)
    try {
      const buf = term.buffer.active
      const lines: string[] = []
      for (let i = 0; i < buf.length; i++) {
        lines.push(buf.getLine(i)?.translateToString(true) ?? '')
      }
      await window.api.saveScrollback(lines.join('\n'))
    } finally {
      setSavingScrollback(false)
    }
  }, [savingScrollback])

  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    // A-4: load cursor settings before creating terminal
    const setup = async () => {
      let cursorStyle: 'block' | 'bar' | 'underline' = 'block'
      let cursorBlink = true
      let scrollback = 5000
      try {
        const s = await window.api.getSettings()
        cursorStyle = s.cursorStyle ?? 'block'
        cursorBlink = s.cursorBlink ?? true
        scrollback = s.scrollbackLines ?? 5000
      } catch {
        // use defaults
      }

      if (disposed || !containerRef.current) return

      const term = new Terminal({
        convertEol: true,
        cursorBlink,
        cursorStyle,
        scrollback,
        fontFamily: fontFamilyTerminal,
        fontSize: fontSizeTerminal,
        lineHeight: 1.2,
        theme: {
          background:      '#000000',
          foreground:      '#d3d7cf',
          cursor:          '#d97757',
          cursorAccent:    '#000000',
          selectionBackground: 'rgba(217,119,87,0.3)',
          black:           '#000000',
          brightBlack:     '#727272',
          red:             '#cc0000',
          brightRed:       '#cc9d97',
          green:           '#4e9a06',
          brightGreen:     '#a3dd97',
          yellow:          '#c4a000',
          brightYellow:    '#cbcaaa',
          blue:            '#3465a4',
          brightBlue:      '#9ab6cb',
          magenta:         '#bc3fbc',
          brightMagenta:   '#cc8ecb',
          cyan:            '#06989a',
          brightCyan:      '#b7b8cb',
          white:           '#d0d0d0',
          brightWhite:     '#f0f0f0'
        },
        allowProposedApi: true,
        rescaleOverlappingGlyphs: true
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)

      // A-3 (Phase 13): Search addon
      const searchAddon = new SearchAddon()
      term.loadAddon(searchAddon)
      searchAddonRef.current = searchAddon

      // A-1 (Phase 15): Web Links addon — Ctrl+Click opens URLs in default browser
      const webLinksAddon = new WebLinksAddon((_, url) => {
        window.api.openExternal(url)
      })
      term.loadAddon(webLinksAddon)

      // WebGL addon — fallback to canvas on unsupported environments
      try {
        const webgl = new WebglAddon()
        webgl.onContextLoss(() => webgl.dispose())
        term.loadAddon(webgl)
      } catch {
        // Canvas renderer fallback
      }

      term.open(containerRef.current)
      fitAddon.fit()
      term.focus()

      termRef.current = term
      fitRef.current = fitAddon

      // A-4 (Phase 16): track text selection for copy button
      const onSelChange = term.onSelectionChange(() => {
        setHasSelection(!!term.getSelection())
      })

      // Send keystrokes to PTY
      const onData = term.onData((data) => window.api.ptyInput(data))

      // Receive PTY output
      const offPtyData = window.api.onPtyData((data) => term.write(data))
      const offPtyExit = window.api.onPtyExit((code) => {
        term.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`)
      })

      // A-1: Vim pane navigation — focus terminal on Ctrl+Shift+H
      const offFocusTerm = window.api.onFocusTerminal(() => term.focus())

      // Handle resize
      const ro = new ResizeObserver(() => {
        fitAddon.fit()
        window.api.ptyResize(term.cols, term.rows)
      })
      ro.observe(containerRef.current)

      cleanupRef.current = [
        () => onSelChange.dispose(),
        () => onData.dispose(),
        offPtyData,
        offPtyExit,
        offFocusTerm,
        () => ro.disconnect(),
        () => term.dispose()
      ]
    }

    void setup()

    return () => {
      disposed = true
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
      termRef.current = null
      fitRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update font settings dynamically when they change
  useEffect(() => {
    const term = termRef.current
    const fitAddon = fitRef.current
    if (!term || !fitAddon) return
    term.options.fontSize = fontSizeTerminal
    term.options.fontFamily = fontFamilyTerminal
    // Small timeout to let font load before refitting
    const t = setTimeout(() => fitAddon.fit(), 50)
    return () => clearTimeout(t)
  }, [fontSizeTerminal, fontFamilyTerminal])

  // A-5: Ctrl+Shift+S keyboard shortcut for save scrollback
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        void handleSaveScrollback()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [savingScrollback]) // eslint-disable-line react-hooks/exhaustive-deps

  // A-2: OSC 9998 terminal background color change
  useEffect(() => {
    const off = window.api.onPtyBgUpdate((color) => {
      setBgColor(color)
    })
    return off
  }, [])

  // A-1 (Phase 12): drop target visual feedback state
  const [isDragOver, setIsDragOver] = useState(false)

  // A-3 (Phase 10): Block Magnify — Ctrl+Shift+M shortcut + Escape to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        setMagnified((m) => !m)
      } else if (e.key === 'Escape' && magnified) {
        setMagnified(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [magnified])

  // A-3: re-fit terminal after magnify state change
  useEffect(() => {
    const fitAddon = fitRef.current
    if (!fitAddon) return
    const id = setTimeout(() => fitAddon.fit(), 50)
    return () => clearTimeout(id)
  }, [magnified])

  // A-3 (Phase 13): Terminal search — Ctrl+Shift+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        setSearchOpen((o) => !o)
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 30)
    } else {
      setSearchResultCount(null)
      // Return focus to terminal
      termRef.current?.focus()
    }
  }, [searchOpen])

  const runSearch = (query: string, direction: 'next' | 'prev' = 'next') => {
    const addon = searchAddonRef.current
    if (!addon || !query.trim()) { setSearchResultCount(null); return }
    const decorations = {
      matchBackground: 'rgba(217,119,87,0.35)',
      matchBorder: 'rgba(217,119,87,0.6)',
      matchOverviewRuler: 'rgba(217,119,87,0.5)',
      activeMatchBackground: 'rgba(217,119,87,0.75)',
      activeMatchBorder: '#d97757',
      activeMatchColorOverviewRuler: '#d97757'
    }
    const found = direction === 'next'
      ? addon.findNext(query, { decorations })
      : addon.findPrevious(query, { decorations })
    setSearchResultCount(found ? 1 : 0)
  }

  // A-5 (Phase 10): subscribe to error context from PTY host
  useEffect(() => {
    const off = window.api.onPtyErrorContext((output) => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
      setErrorContext(output)
      errorTimerRef.current = setTimeout(() => setErrorContext(null), 5000)
    })
    return () => {
      off()
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    }
  }, [])

  // A-5: send error context to Claude
  const handleAskClaude = useCallback(() => {
    if (!errorContext || isQuerying) return
    const prompt = `以下のターミナル出力でエラーが発生しました。原因と修正方法を教えてください:\n\n${errorContext}`
    addUserMessage(prompt)
    window.api.sdkQuery(prompt, { cwd: currentWorkingDir, bypassPermissions })
    setErrorContext(null)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [errorContext, isQuerying, currentWorkingDir, bypassPermissions, addUserMessage])

  return (
    <>
      {/* A-3: Magnify backdrop overlay */}
      {magnified && (
        <div
          onClick={() => setMagnified(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px) brightness(0.4)'
          }}
        />
      )}
    <div
      style={
        magnified
          ? { position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', background: '#000000' }
          : { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }
      }
    >
      {/* Toolbar with save scrollback button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '2px 4px',
          background: '#000000',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          gap: '4px'
        }}
      >
        {/* A-1: Split ratio preset buttons (Wave Terminal v0.14.5 showsplitbuttons) */}
        {([0.3, 0.5, 0.7] as const).map((ratio) => {
          const label = ratio === 0.3 ? '3:7' : ratio === 0.5 ? '5:5' : '7:3'
          const isActive = Math.abs(splitRatio - ratio) < 0.05
          return (
            <button
              key={ratio}
              onClick={() => setSplitRatio(ratio)}
              title={`分割比率 ${label}`}
              style={{
                padding: '1px 6px',
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                borderRadius: '3px',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '9px',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.03em',
                transition: 'color 0.15s, border-color 0.15s, background 0.15s'
              }}
            >
              {label}
            </button>
          )
        })}
        {/* A-4 (Phase 16): Copy selection button */}
        <button
          onClick={() => {
            const sel = termRef.current?.getSelection()
            if (!sel) return
            navigator.clipboard.writeText(sel).then(() => {
              setSelCopied(true)
              setTimeout(() => setSelCopied(false), 1200)
            }).catch(() => undefined)
          }}
          disabled={!hasSelection}
          title="選択テキストをコピー"
          style={{
            padding: '1px 6px',
            background: selCopied ? 'var(--accent-subtle)' : 'transparent',
            border: selCopied ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
            borderRadius: '3px',
            color: selCopied ? 'var(--accent)' : hasSelection ? 'var(--text-secondary)' : 'var(--text-muted)',
            fontSize: 'var(--text-xs)',
            cursor: hasSelection ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.03em',
            opacity: hasSelection ? 1 : 0.4,
            transition: 'color 0.15s, border-color 0.15s, background 0.15s'
          }}
        >
          {selCopied ? 'COPIED' : 'COPY'}
        </button>
        {/* A-4 (Phase 16): CLR (Ctrl+L) button */}
        <button
          onClick={() => window.api.ptyInput('\x0C')}
          title="ターミナルクリア (Ctrl+L)"
          style={{
            padding: '1px 6px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '3px',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.03em',
            transition: 'color 0.15s, border-color 0.15s'
          }}
        >
          CLR
        </button>
        {/* A-3 (Phase 13): Search toggle button */}
        <button
          onClick={() => setSearchOpen((o) => !o)}
          title="ターミナル検索 (Ctrl+Shift+F)"
          style={{
            padding: '1px 6px',
            background: searchOpen ? 'var(--accent-subtle)' : 'transparent',
            border: searchOpen ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
            borderRadius: '4px',
            color: searchOpen ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.15s, border-color 0.15s, background 0.15s'
          }}
        >
          🔍
        </button>
        {/* A-5: Section mark button */}
        <button
          onClick={() => {
            const term = termRef.current
            if (term) term.write('\r\n\x1b[2m────────── MARK ──────────\x1b[0m\r\n')
          }}
          title="セクションマークを挿入"
          style={{
            padding: '1px 6px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.15s, border-color 0.15s'
          }}
        >
          ⊘
        </button>
        {/* A-5: Save scrollback button */}
        <button
          onClick={() => void handleSaveScrollback()}
          disabled={savingScrollback}
          title="ターミナルログを保存 (Ctrl+Shift+S)"
          style={{
            padding: '1px 6px',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            color: savingScrollback ? 'var(--text-muted)' : 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            cursor: savingScrollback ? 'default' : 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.15s, border-color 0.15s'
          }}
        >
          {savingScrollback ? '...' : '💾'}
        </button>
        {/* A-3 (Phase 10): Block Magnify button */}
        <button
          onClick={() => setMagnified((m) => !m)}
          title={magnified ? '縮小 (Esc)' : 'ターミナルを最大化 (Ctrl+Shift+M)'}
          style={{
            padding: '1px 6px',
            background: magnified ? 'var(--accent-subtle)' : 'transparent',
            border: magnified ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
            borderRadius: '4px',
            color: magnified ? 'var(--accent)' : 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.15s, border-color 0.15s, background 0.15s'
          }}
        >
          {magnified ? '⊡' : '⛶'}
        </button>
      </div>
      {/* A-5 (Phase 10): error context "Claudeに聞く" button */}
      {errorContext !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 8px',
            background: 'rgba(229,77,46,0.12)',
            borderBottom: '1px solid rgba(229,77,46,0.35)',
            flexShrink: 0,
            animation: 'error-ctx-fade 0.1s ease-out'
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', fontFamily: 'var(--font-mono)' }}>
            ❌ エラーを検出
          </span>
          <button
            onClick={handleAskClaude}
            disabled={isQuerying}
            style={{
              padding: '2px 10px',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-accent)',
              borderRadius: '5px',
              color: 'var(--accent)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: isQuerying ? 'default' : 'pointer',
              fontFamily: 'var(--font-ui)',
              opacity: isQuerying ? 0.5 : 1,
              transition: 'opacity 0.15s'
            }}
          >
            Claude に聞く
          </button>
          <button
            onClick={() => setErrorContext(null)}
            style={{
              marginLeft: 'auto',
              padding: '2px 6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}
      {/* A-3 (Phase 13): Terminal search overlay */}
      {searchOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: 'var(--app-bg-surface)',
            borderBottom: '1px solid var(--border-accent)',
            flexShrink: 0,
            animation: 'error-ctx-fade 0.1s ease-out'
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              runSearch(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); runSearch(searchQuery, e.shiftKey ? 'prev' : 'next') }
              else if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
            }}
            placeholder="ターミナル内を検索..."
            style={{
              flex: 1,
              padding: '3px 7px',
              background: 'var(--app-bg)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              maxWidth: '240px'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--border-accent)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)' }}
          />
          {searchResultCount !== null && (
            <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: searchResultCount > 0 ? 'var(--accent)' : 'var(--status-error)' }}>
              {searchResultCount > 0 ? '✓' : '—'}
            </span>
          )}
          <button
            onClick={() => runSearch(searchQuery, 'prev')}
            disabled={!searchQuery.trim()}
            title="前へ (Shift+Enter)"
            style={{ padding: '2px 7px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', cursor: searchQuery.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-mono)', opacity: searchQuery.trim() ? 1 : 0.4 }}
          >↑</button>
          <button
            onClick={() => runSearch(searchQuery, 'next')}
            disabled={!searchQuery.trim()}
            title="次へ (Enter)"
            style={{ padding: '2px 7px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', cursor: searchQuery.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-mono)', opacity: searchQuery.trim() ? 1 : 0.4 }}
          >↓</button>
          <button
            onClick={() => { setSearchOpen(false); setSearchQuery('') }}
            title="閉じる (Esc)"
            style={{ padding: '2px 7px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}
          >✕</button>
        </div>
      )}
      <div
        ref={containerRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => {
          if (!containerRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          // A-1 (Phase 12): handle OS file drops — quote paths with spaces
          const files = Array.from(e.dataTransfer?.files ?? [])
          if (files.length > 0) {
            const paths = files
              .map((f) => {
                const p = (f as unknown as { path: string }).path
                return p.includes(' ') ? `"${p}"` : p
              })
              .join(' ')
            if (paths) { window.api.ptyInput(paths); return }
          }
          // Fallback: text/plain drag
          const text = e.dataTransfer?.getData('text/plain')
          if (text) window.api.ptyInput(text)
        }}
        style={{
          flex: 1,
          overflow: 'hidden',
          background: bgColor ?? '#000000',
          padding: '4px',
          transition: 'background 0.3s ease, outline-color 0.15s ease',
          outline: isDragOver ? '2px solid var(--border-accent)' : '2px solid transparent',
          outlineOffset: '-2px'
        }}
      />
    </div>
    <style>{`
      @keyframes error-ctx-fade {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    </>
  )
}
