import { app, BrowserWindow, ipcMain, shell, utilityProcess } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { config as loadDotenv } from 'dotenv'
import { saveSession, loadSession, listSessions, deleteSession } from './sessions'

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
}

const DEFAULT_SETTINGS: Settings = {
  bypassPermissions: true,
  windowBounds: { width: 1280, height: 800 },
  splitRatio: 0.55,
  currentWorkingDir: process.env.USERPROFILE ?? 'C:\\Users'
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
  sdkProcess?.postMessage({ type: 'query', id, prompt, options })
})

// Agent-specific query: sends sdk:agent-message back (not sdk:message)
ipcMain.on('sdk:agent-query', (_, agentId: string, prompt: string, options: Record<string, unknown>) => {
  const id = ++sdkQueryId
  sdkProcess?.postMessage({ type: 'query', id, prompt, options: { ...options, agentId } })
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

// IPC handlers — Settings
ipcMain.handle('settings:get', () => settings)

ipcMain.handle('settings:set', (_, key: string, value: unknown) => {
  (settings as Record<string, unknown>)[key] = value
  saveSettings(settings)
  return settings
})

app.whenReady().then(() => {
  mainWindow = createWindow()
  startPtyHost()
  startSdkHost()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  ptyProcess?.kill()
  sdkProcess?.kill()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
