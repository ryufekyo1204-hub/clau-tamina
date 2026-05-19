import React, { useEffect, useRef, useState } from 'react'
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

  const fontSizeTerminal = useSessionStore((s) => s.fontSizeTerminal)
  const fontFamilyTerminal = useSessionStore((s) => s.fontFamilyTerminal)

  // A-5: save scrollback to file via main process dialog
  const handleSaveScrollback = async () => {
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
  }

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
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
      </div>
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
  )
}
