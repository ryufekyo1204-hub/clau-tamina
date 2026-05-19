import React, { useEffect, useRef } from 'react'
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

  const fontSizeTerminal = useSessionStore((s) => s.fontSizeTerminal)
  const fontFamilyTerminal = useSessionStore((s) => s.fontFamilyTerminal)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
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
      allowProposedApi: true
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

    // Drag-and-drop file path support (A-3)
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
      () => ro.disconnect(),
      () => {
        termElement.removeEventListener('dragover', handleDragOver)
        termElement.removeEventListener('drop', handleDrop)
      },
      () => term.dispose()
    ]

    return () => {
      cleanupRef.current.forEach((fn) => fn())
      cleanupRef.current = []
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

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: 'hidden',
        background: '#000000',
        padding: '4px'
      }}
    />
  )
}
