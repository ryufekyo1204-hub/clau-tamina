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
  OSC_BADGE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OSC_BADGE_RE.exec(data)) !== null) {
    process.parentPort.postMessage({ type: 'badge-update', text: match[1] })
  }
  return data.replace(OSC_BADGE_RE, '')
}

// OSC 9: ESC ] 9 ; <message> BEL/ST
const OSC9_RE = /\x1b\]9;([^\x07\x1b]*?)(?:\x07|\x1b\\)/g
// OSC 777: ESC ] 777 ; notify ; <title> ; <body> BEL/ST
const OSC777_RE = /\x1b\]777;notify;([^\x07\x1b;]*?);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 9 / OSC 777 notification sequences.
 * Sends notify messages to the parent process.
 * Returns the data with notification sequences removed.
 */
function processNotifySequences(data: string): string {
  OSC9_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OSC9_RE.exec(data)) !== null) {
    process.parentPort.postMessage({ type: 'notify', title: 'clau-tamina', body: match[1] })
  }
  let stripped = data.replace(OSC9_RE, '')

  OSC777_RE.lastIndex = 0
  while ((match = OSC777_RE.exec(stripped)) !== null) {
    process.parentPort.postMessage({ type: 'notify', title: match[1] || 'clau-tamina', body: match[2] })
  }
  stripped = stripped.replace(OSC777_RE, '')
  return stripped
}

// OSC 7: ESC ] 7 ; file:// <hostname> <path> BEL/ST
// Captures the path portion after the hostname
const OSC7_RE = /\x1b\]7;file:\/\/[^/\x07\x1b]*([^\x07\x1b]*?)(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 7 CWD sequences.
 * Sends cwd-update messages to the parent process.
 * Returns the data with CWD sequences removed.
 */
function processCwdSequences(data: string): string {
  OSC7_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OSC7_RE.exec(data)) !== null) {
    try {
      const cwd = decodeURIComponent(match[1])
      if (cwd) process.parentPort.postMessage({ type: 'cwd-update', cwd })
    } catch {
      // ignore malformed URIs
    }
  }
  return data.replace(OSC7_RE, '')
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
    let cleaned = processBadgeSequences(data)
    cleaned = processNotifySequences(cleaned)
    cleaned = processCwdSequences(cleaned)
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
