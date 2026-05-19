// Utility process: manages node-pty lifecycle and buffers output

import * as nodePty from 'node-pty'

interface SpawnMsg { type: 'spawn'; cwd: string }
interface InputMsg  { type: 'input';  data: string }
interface ResizeMsg { type: 'resize'; cols: number; rows: number }
type IncomingMsg = SpawnMsg | InputMsg | ResizeMsg

let pty: nodePty.IPty | null = null
let buffer = ''
let flushTimer: ReturnType<typeof setTimeout> | null = null

// OSC 9999 badge pattern: ESC ] 9999 ; badge=<text> BEL  or  ESC ] 9999 ; badge=<text> ESC \
const OSC_BADGE_RE = /\x1b\]9999;badge=([^\x07\x1b]*?)(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 9999 badge sequences from a data chunk.
 * Sends badge-update messages to the parent process for any found.
 * Returns the data with badge sequences removed.
 */
function processBadgeSequences(data: string): string {
  let stripped = data
  let match: RegExpExecArray | null
  OSC_BADGE_RE.lastIndex = 0
  while ((match = OSC_BADGE_RE.exec(data)) !== null) {
    process.parentPort.postMessage({ type: 'badge-update', text: match[1] })
  }
  stripped = data.replace(OSC_BADGE_RE, '')
  return stripped
}

function flush(): void {
  if (buffer.length === 0) return
  process.parentPort.postMessage({ type: 'data', data: buffer })
  buffer = ''
  flushTimer = null
}

function scheduleFlush(): void {
  if (flushTimer === null) {
    flushTimer = setTimeout(flush, 8)
  }
}

function spawnPty(cwd: string): void {
  if (pty) {
    pty.kill()
    pty = null
  }

  pty = nodePty.spawn('powershell.exe', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd,
    env: {
      ...process.env,
      SystemRoot: process.env['SystemRoot'] ?? 'C:\\Windows',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor'
    } as Record<string, string>
  })

  pty.onData((data: string) => {
    const cleaned = processBadgeSequences(data)
    buffer += cleaned
    // flush when chunk >= 4KB
    if (buffer.length >= 4096) {
      if (flushTimer) clearTimeout(flushTimer)
      flush()
    } else {
      scheduleFlush()
    }
  })

  pty.onExit(({ exitCode }) => {
    process.parentPort.postMessage({ type: 'exit', exitCode })
    pty = null
  })
}

process.parentPort.on('message', (event: { data: IncomingMsg }) => {
  const msg = event.data
  switch (msg.type) {
    case 'spawn':
      spawnPty(msg.cwd)
      break
    case 'input':
      pty?.write(msg.data)
      break
    case 'resize':
      pty?.resize(msg.cols, msg.rows)
      break
  }
})

// auto-spawn on start
spawnPty(process.env['USERPROFILE'] ?? 'C:\\Users')
