import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, shell, utilityProcess, Notification, dialog } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { readdir, stat, writeFile, readFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import { config as loadDotenv } from 'dotenv'
import { saveSession, loadSession, listSessions, deleteSession } from './sessions'

const execAsync = promisify(exec)

// .env をプロジェクトルートから読む（GEMINI_API_KEY など）
// dev: __dirname = out/main/ → 2つ上がプロジェクトルート
// prod: app.getAppPath() = asar内 → cwd fallback
const dotenvPaths = [
  join(app.getAppPath(), '.env'),          // prod / electron-builder
  join(__dirname, '..', '..', '.env'),      // dev: out/main → project root
  join(process.cwd(), '.env')              // fallback
]
for (const p of dotenvPaths) {
  const result = loadDotenv({ path: p })
  if (!result.error) break
}

const SETTINGS_PATH = join(app.getPath('userData'), 'settings.json')

interface Settings {
  bypassPermissions: boolean
  windowBounds: { width: number; height: number; x?: number; y?: number }
  splitRatio: number
  currentWorkingDir: string
  globalHotkey: string   // Quake Mode hotkey, e.g. "Ctrl+Alt+T"
  tabBarOrientation: 'horizontal' | 'vertical'
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  tabLabels?: Record<string, string>
  headerBackground?: string
  maxBudgetUsd?: number
  cwdColorMap?: Record<string, string>
}

const DEFAULT_SETTINGS: Settings = {
  bypassPermissions: true,
  windowBounds: { width: 1280, height: 800 },
  splitRatio: 0.55,
  currentWorkingDir: process.env.USERPROFILE ?? 'C:\\Users',
  globalHotkey: 'Ctrl+Alt+T',
  tabBarOrientation: 'horizontal',
  cursorStyle: 'block',
  cursorBlink: true,
  tabLabels: {},
  headerBackground: undefined,
  maxBudgetUsd: 0,
  cwdColorMap: {}
}

function loadSettings(): Settings {
  try {
    if (existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8')) }
    }
  } catch {
    // ignore corrupt settings
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: Settings): void {
  try {
    const dir = join(SETTINGS_PATH, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
  } catch {
    // ignore write errors
  }
}

type UtilProc = ReturnType<typeof utilityProcess.fork>

let mainWindow: BrowserWindow | null = null
let ptyProcess: UtilProc | null = null
let sdkProcess: UtilProc | null = null
let settings = loadSettings()
let sdkQueryId = 0

// ---- Quake Mode: globalShortcut (A-4) ----
function registerQuakeHotkey(hotkey: string): void {
  // Re-register only the quake hotkey; chat toggle is always registered
  if (hotkey) {
    try {
      globalShortcut.register(hotkey, () => {
        if (!mainWindow) return
        if (mainWindow.isVisible() && mainWindow.isFocused()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      })
    } catch {
      // Silently ignore invalid accelerator strings
    }
  }
}

// ---- Chat toggle shortcut (A-1 slide-out panel) ----
function registerChatToggleShortcut(): void {
  try {
    globalShortcut.register('Ctrl+Shift+A', () => {
      if (mainWindow) {
        mainWindow.webContents.send('chat:toggle')
      }
    })
  } catch {
    // Silently ignore
  }
}

// ---- Pane navigation shortcuts (A-1 Vim style) ----
function registerPaneShortcuts(): void {
  try {
    globalShortcut.register('Ctrl+Shift+H', () => {
      if (mainWindow) mainWindow.webContents.send('focus:terminal')
    })
  } catch {
    // Silently ignore
  }
  try {
    globalShortcut.register('Ctrl+Shift+L', () => {
      if (mainWindow) mainWindow.webContents.send('focus:chat')
    })
  } catch {
    // Silently ignore
  }
}

function createWindow(): BrowserWindow {
  const { windowBounds } = settings

  const win = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    roundedCorners: true,
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#a09b95',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  })

  win.on('resize', () => {
    const [width, height] = win.getSize()
    const [x, y] = win.getPosition()
    settings.windowBounds = { width, height, x, y }
    saveSettings(settings)
  })

  win.on('move', () => {
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    settings.windowBounds = { width, height, x, y }
    saveSettings(settings)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function startPtyHost(): void {
  const ptyHostPath = join(__dirname, 'ptyHost.js')
  ptyProcess = utilityProcess.fork(ptyHostPath, [], {
    stdio: 'pipe'
  })

  ptyProcess.on('message', (msg: unknown) => {
    if (!mainWindow) return
    const m = msg as Record<string, unknown>
    if (m.type === 'data') {
      mainWindow.webContents.send('pty:data', m.data)
    } else if (m.type === 'exit') {
      mainWindow.webContents.send('pty:exit', m.exitCode)
    } else if (m.type === 'badge-update') {
      mainWindow.webContents.send('pty:badge-update', m.text, m.color)
    } else if (m.type === 'bg-update') {
      // A-2: OSC 9998 terminal background color change
      mainWindow.webContents.send('pty:bg-update', m.color)
    } else if (m.type === 'notify') {
      // A-2: OSC 9 / OSC 777 desktop notification
      const title = typeof m.title === 'string' ? m.title : 'clau-tamina'
      const body = typeof m.body === 'string' ? m.body : ''
      if (Notification.isSupported()) {
        new Notification({ title, body }).show()
      }
    } else if (m.type === 'cwd-update') {
      // A-3: OSC 7 CWD tracking
      mainWindow.webContents.send('pty:cwd-update', m.cwd)
    } else if (m.type === 'clipboard-write') {
      // A-1: OSC 52 clipboard write
      if (typeof m.text === 'string') {
        clipboard.writeText(m.text)
      }
    } else if (m.type === 'bell') {
      // A-2: Bell visual indicator
      mainWindow.webContents.send('pty:bell')
      // A-1: also send tab-badge for bell
      mainWindow.webContents.send('pty:tab-bell')
    } else if (m.type === 'progress-update') {
      // A-1: OSC 9;4 ConEmu progress bar
      const state = typeof m.state === 'number' ? m.state : 0
      const value = typeof m.value === 'number' ? m.value : 0
      mainWindow.webContents.send('pty:progress', state, value)
    } else if (m.type === 'setmeta') {
      // A-2 (Phase 10): OSC 9997 setmeta — update tab title/icon
      const title = typeof m.title === 'string' ? m.title : ''
      const icon = typeof m.icon === 'string' ? m.icon : undefined
      mainWindow.webContents.send('pty:setmeta', title, icon)
    } else if (m.type === 'error-context') {
      // A-5 (Phase 10): error context from ConEmu progress state 2
      const output = typeof m.output === 'string' ? m.output : ''
      mainWindow.webContents.send('pty:error-context', output)
    }
  })

  ptyProcess.on('exit', () => {
    ptyProcess = null
  })
}

function startSdkHost(): void {
  const sdkHostPath = join(__dirname, 'sdkHost.mjs')
  sdkProcess = utilityProcess.fork(sdkHostPath, [], {
    stdio: 'pipe'
  })

  sdkProcess.on('message', (msg: unknown) => {
    if (!mainWindow) return
    const m = msg as Record<string, unknown>
    const channel = m.agentId ? 'sdk:agent-message' : 'sdk:message'
    if (m.type === 'stream' || m.type === 'result' || m.type === 'error') {
      mainWindow.webContents.send(channel, m)
    } else if (m.type === 'tool-request') {
      mainWindow.webContents.send('sdk:tool-request', m)
    } else if (m.type === 'prompt_suggestion') {
      // A-3: prompt suggestion — forward only to main chat (no agentId)
      mainWindow.webContents.send('sdk:message', m)
    }
  })

  sdkProcess.on('exit', () => {
    sdkProcess = null
  })
}

// IPC handlers — PTY
ipcMain.on('pty:input', (_, data: string) => {
  ptyProcess?.postMessage({ type: 'input', data })
})

ipcMain.on('pty:resize', (_, cols: number, rows: number) => {
  ptyProcess?.postMessage({ type: 'resize', cols, rows })
})

ipcMain.on('pty:spawn', (_, cwd: string) => {
  ptyProcess?.postMessage({ type: 'spawn', cwd })
})

// IPC handlers — SDK
ipcMain.on('sdk:query', (_, prompt: string, options: Record<string, unknown>) => {
  const id = ++sdkQueryId
  // A-5: inject maxBudgetUsd from settings
  const enriched = { ...options, maxBudgetUsd: settings.maxBudgetUsd ?? 0 }
  sdkProcess?.postMessage({ type: 'query', id, prompt, options: enriched })
})

// Agent-specific query: sends sdk:agent-message back (not sdk:message)
ipcMain.on('sdk:agent-query', (_, agentId: string, prompt: string, options: Record<string, unknown>) => {
  const id = ++sdkQueryId
  const enriched = { ...options, agentId, maxBudgetUsd: settings.maxBudgetUsd ?? 0 }
  sdkProcess?.postMessage({ type: 'query', id, prompt, options: enriched })
})

ipcMain.on('sdk:tool-response', (_, approve: boolean) => {
  sdkProcess?.postMessage({ type: 'tool-response', approve })
})

ipcMain.on('sdk:abort', () => {
  sdkProcess?.postMessage({ type: 'abort' })
})

// IPC handlers — Sessions
ipcMain.handle('session:save', (_, data) => saveSession(data))
ipcMain.handle('session:load', (_, id: string) => loadSession(id))
ipcMain.handle('session:list', () => listSessions())
ipcMain.handle('session:delete', (_, id: string) => deleteSession(id))

// IPC handlers — File system (read-only listing for file tree panel)
ipcMain.handle('fs:list-dir', async (_, dirPath: string) => {
  try {
    const names = await readdir(dirPath)
    const entries = await Promise.all(
      names.map(async (name) => {
        const fullPath = join(dirPath, name)
        try {
          const s = await stat(fullPath)
          return { name, isDir: s.isDirectory(), path: fullPath }
        } catch {
          return { name, isDir: false, path: fullPath }
        }
      })
    )
    // Directories first, then files, both alphabetically
    return entries.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {
    return []
  }
})

// IPC handlers — Settings
ipcMain.handle('settings:get', () => settings)

ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
  (settings as unknown as Record<string, unknown>)[key] = value
  saveSettings(settings)
  // Re-register global hotkeys if quake hotkey changed
  if (key === 'globalHotkey' && typeof value === 'string') {
    globalShortcut.unregisterAll()
    registerChatToggleShortcut()
    registerQuakeHotkey(value)
    registerPaneShortcuts()
  }
  return settings
})

// ---- A-1 (Phase 10): Claude Code hooks install/remove/check ----
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json')
// OSC 9999 badge sequence for PowerShell (Stop hook)
const CLAUDE_HOOK_COMMAND = 'powershell.exe -NoProfile -Command "Write-Host -NoNewline \\"$([char]27)]9999;badge=DONE;color=#58c142$([char]7)\\""'

interface ClaudeHookEntry {
  matcher?: string
  hooks?: Array<{ type: string; command: string }>
}

async function readClaudeSettings(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(CLAUDE_SETTINGS_PATH, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

function hasClaudeHook(data: Record<string, unknown>): boolean {
  const hooks = data?.hooks as Record<string, unknown> | undefined
  const stops = hooks?.Stop as ClaudeHookEntry[] | undefined
  if (!Array.isArray(stops)) return false
  return stops.some((s) =>
    Array.isArray(s.hooks) && s.hooks.some((h) => h.command === CLAUDE_HOOK_COMMAND)
  )
}

ipcMain.handle('claude:check-hooks', async () => {
  const data = await readClaudeSettings()
  return hasClaudeHook(data)
})

ipcMain.handle('claude:install-hooks', async () => {
  try {
    const data = await readClaudeSettings()
    const hooks = (data.hooks ?? {}) as Record<string, unknown>
    const stops = (Array.isArray(hooks.Stop) ? hooks.Stop : []) as ClaudeHookEntry[]
    // Remove any existing clau-tamina hook entry
    const filtered = stops.filter(
      (s) => !Array.isArray(s.hooks) || !s.hooks.some((h) => h.command === CLAUDE_HOOK_COMMAND)
    )
    filtered.push({ matcher: '', hooks: [{ type: 'command', command: CLAUDE_HOOK_COMMAND }] })
    hooks.Stop = filtered
    data.hooks = hooks
    const dir = join(CLAUDE_SETTINGS_PATH, '..')
    await mkdir(dir, { recursive: true })
    await writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('claude:remove-hooks', async () => {
  try {
    const data = await readClaudeSettings()
    const hooks = data.hooks as Record<string, unknown> | undefined
    if (!hooks || !Array.isArray(hooks.Stop)) return true
    hooks.Stop = (hooks.Stop as ClaudeHookEntry[]).filter(
      (s) => !Array.isArray(s.hooks) || !s.hooks.some((h) => h.command === CLAUDE_HOOK_COMMAND)
    )
    await writeFile(CLAUDE_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
})

// IPC handler — Terminal scrollback save (A-5)
ipcMain.handle('pty:save-scrollback', async (_, text: string) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: 'terminal-log.txt',
    filters: [{ name: 'Text', extensions: ['txt'] }]
  })
  if (filePath) {
    await writeFile(filePath, text, 'utf8')
    return filePath
  }
  return null
})

// IPC handler — Process Viewer (A-1)
// Uses async exec (non-blocking main process) with structured PowerShell output
ipcMain.handle('process:list', async () => {
  try {
    const cmd =
      'powershell.exe -NoProfile -NonInteractive -Command ' +
      '"Get-Process | Select-Object ' +
      "@{n='name';e={$_.Name}}," +
      "@{n='cpu';e={[Math]::Round($_.CPU,2)}}," +
      "@{n='memMb';e={[Math]::Round($_.WorkingSet64/1MB,1)}} " +
      '| Sort-Object memMb -Descending | Select-Object -First 60 ' +
      '| ConvertTo-Json -Compress -AsArray"'
    const { stdout } = await execAsync(cmd, { timeout: 8000 })
    const parsed = JSON.parse(stdout.trim()) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (p): p is { name: string; cpu: number; memMb: number } =>
        typeof p === 'object' && p !== null
    )
  } catch {
    return []
  }
})

app.whenReady().then(() => {
  mainWindow = createWindow()
  startPtyHost()
  startSdkHost()
  registerChatToggleShortcut()
  registerQuakeHotkey(settings.globalHotkey)
  registerPaneShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  ptyProcess?.kill()
  sdkProcess?.kill()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
