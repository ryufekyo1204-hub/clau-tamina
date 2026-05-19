// Utility process: manages node-pty lifecycle and buffers output

import * as nodePty from 'node-pty'

interface SpawnMsg { type: 'spawn'; cwd: string }
interface InputMsg  { type: 'input';  data: string }
interface ResizeMsg { type: 'resize'; cols: number; rows: number }
type IncomingMsg = SpawnMsg | InputMsg | ResizeMsg

let pty: nodePty.IPty | null = null
let buffer = ''
let flushTimer: ReturnType<typeof setTimeout> | null = null

// OSC 52 clipboard pattern: ESC ] 52 ; <params> ; <base64> BEL/ST
const OSC52_RE = /\x1b\]52;[a-zA-Z]*;([A-Za-z0-9+/=]*?)(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 52 clipboard sequences from a data chunk.
 * Sends clipboard-write messages to the parent process for any found.
 * Returns the data with clipboard sequences removed.
 */
function processClipboardSequences(data: string): string {
  OSC52_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OSC52_RE.exec(data)) !== null) {
    try {
      const text = Buffer.from(match[1], 'base64').toString('utf8')
      process.parentPort.postMessage({ type: 'clipboard-write', text })
    } catch {
      // ignore malformed base64
    }
  }
  return data.replace(OSC52_RE, '')
}

// OSC 9999 badge pattern: ESC ] 9999 ; badge=<text>[;color=<hex>] BEL/ST
const OSC_BADGE_RE = /\x1b\]9999;badge=([^;\x07\x1b]*?)(?:;color=([^;\x07\x1b]*?))?(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 9999 badge sequences from a data chunk.
 * Sends badge-update messages (with optional color) to the parent process for any found.
 * Returns the data with badge sequences removed.
 */
function processBadgeSequences(data: string): string {
  OSC_BADGE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OSC_BADGE_RE.exec(data)) !== null) {
    const text = match[1]
    const color = match[2] ?? undefined
    process.parentPort.postMessage({ type: 'badge-update', text, color })
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

// OSC 9998 terminal background color: ESC ] 9998 ; bg=<color> BEL/ST
const OSC_BGSET_RE = /\x1b\]9998;bg=([^;\x07\x1b]+)(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 9998 background-color sequences from a data chunk.
 * Sends bg-update messages to the parent process for any found.
 * Returns the data with bg-set sequences removed.
 */
function processBgUpdateSequences(data: string): string {
  OSC_BGSET_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = OSC_BGSET_RE.exec(data)) !== null) {
    process.parentPort.postMessage({ type: 'bg-update', color: match[1] })
  }
  return data.replace(OSC_BGSET_RE, '')
}

// OSC 9;4 ConEmu progress pattern: ESC ] 9 ; 4 ; <state> ; <value> BEL/ST
// state: 0=off, 1=normal, 2=error, 3=indeterminate, 4=paused
// value: 0-100
const OSC94_RE = /\x1b\]9;4;(\d+);(\d+)(?:\x07|\x1b\\)/g

/**
 * Parse and strip OSC 9;4 ConEmu progress sequences from a data chunk.
 * Sends progress-update messages to the parent process for any found.
 * Returns the data with progress sequences removed.
 */
function processProgressSequences(data: string): { output: string; progress: { value: number; state: number } | null } {
  OSC94_RE.lastIndex = 0
  let match: RegExpExecArray | null
  let lastProgress: { value: number; state: number } | null = null
  while ((match = OSC94_RE.exec(data)) !== null) {
    const state = Number(match[1])
    const value = Number(match[2])
    lastProgress = { state, value }
    process.parentPort.postMessage({ type: 'progress-update', state, value })
  }
  return { output: data.replace(OSC94_RE, ''), progress: lastProgress }
}

/**
 * Parse and strip standalone bell sequences (\x07) from a data chunk.
 * Must be called after all OSC parsers so OSC terminator \x07 is already consumed.
 * Returns { output: string; hasBell: boolean }.
 */
function processBellSequences(data: string): { output: string; hasBell: boolean } {
  const hasBell = data.includes('\x07')
  const output = data.replace(/\x07/g, '')
  return { output, hasBell }
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
    let cleaned = processClipboardSequences(data)
    cleaned = processBadgeSequences(cleaned)
    cleaned = processNotifySequences(cleaned)
    cleaned = processCwdSequences(cleaned)
    cleaned = processBgUpdateSequences(cleaned)
    const { output: afterProgress } = processProgressSequences(cleaned)
    cleaned = afterProgress
    const { output, hasBell } = processBellSequences(cleaned)
    if (hasBell) {
      process.parentPort.postMessage({ type: 'bell' })
    }
    cleaned = output
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
