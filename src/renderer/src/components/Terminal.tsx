import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import { useSessionStore } from '../store/session'

export function TerminalPane(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const cleanupRef = useRef<Array<() => void>>([])
  const [savingScrollback, setSavingScrollback] = useState(false)
  // A-2: OSC 9998 terminal background color
  const [bgColor, setBgColor] = useState<string | null>(null)
  // A-3 (Phase 10): Block Magnify
  const [magnified, setMagnified] = useState(false)
  // A-5 (Phase 10): error context (Active AI style)
  const [errorContext, setErrorContext] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fontSizeTerminal = useSessionStore((s) => s.fontSizeTerminal)
  const fontFamilyTerminal = useSessionStore((s) => s.fontFamilyTerminal)
  const currentWorkingDir = useSessionStore((s) => s.currentWorkingDir)
  const bypassPermissions = useSessionStore((s) => s.bypassPermissions)
  const isQuerying = useSessionStore((s) => s.isQuerying)
  const addUserMessage = useSessionStore((s) => s.addUserMessage)

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
      try {
        const s = await window.api.getSettings()
        cursorStyle = s.cursorStyle ?? 'block'
        cursorBlink = s.cursorBlink ?? true
      } catch {
        // use defaults
      }

      if (disposed || !containerRef.current) return

      const term = new Terminal({
        convertEol: true,
        cursorBlink,
        cursorStyle,
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

      // Drag-and-drop file path support (Phase 5 A-3)
      const termElement = containerRef.current
      const handleDragOver = (e: DragEvent) => {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      }
      const handleDrop = (e: DragEvent) => {
        e.preventDefault()
        const path = e.dataTransfer?.getData('text/plain')
        if (path) window.api.ptyInput(path)
      }
      termElement.addEventListener('dragover', handleDragOver)
      termElement.addEventListener('drop', handleDrop)

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
        () => onData.dispose(),
        offPtyData,
        offPtyExit,
        offFocusTerm,
        () => ro.disconnect(),
        () => {
          termElement.removeEventListener('dragover', handleDragOver)
          termElement.removeEventListener('drop', handleDrop)
        },
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
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          background: bgColor ?? '#000000',
          padding: '4px',
          transition: 'background 0.3s ease'
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
