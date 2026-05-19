import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

export interface ProcessInfo {
  name: string
  cpu: number
  memMb: number
}

export interface ApiSettings {
  bypassPermissions: boolean
  windowBounds: { width: number; height: number; x?: number; y?: number }
  splitRatio: number
  currentWorkingDir: string
  globalHotkey: string
  tabBarOrientation: 'horizontal' | 'vertical'
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  tabLabels?: Record<string, string>
  headerBackground?: string
  maxBudgetUsd?: number
  cwdColorMap?: Record<string, string>
}

export interface SdkMessage {
  type: 'stream' | 'result' | 'tool-request' | 'error' | 'prompt_suggestion'
  id?: number
  agentId?: string
  content?: string
  role?: string
  totalCostUsd?: number
  inputTokens?: number
  outputTokens?: number
  tool?: { name: string; input: unknown }
  error?: string
  suggestion?: string
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface SessionData {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  totalCostUsd?: number
  messages: SessionMessage[]
}

export interface SessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface FileEntry {
  name: string
  isDir: boolean
  path: string
}

const api = {
  // PTY
  ptyInput: (data: string) => ipcRenderer.send('pty:input', data),
  ptyResize: (cols: number, rows: number) => ipcRenderer.send('pty:resize', cols, rows),
  ptySpawn: (cwd: string) => ipcRenderer.send('pty:spawn', cwd),
  onPtyData: (cb: (data: string) => void) => {
    const handler = (_: IpcRendererEvent, data: string) => cb(data)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },
  onPtyExit: (cb: (code: number) => void) => {
    const handler = (_: IpcRendererEvent, code: number) => cb(code)
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  },
  onPtyBadgeUpdate: (cb: (text: string, color?: string) => void) => {
    const handler = (_: IpcRendererEvent, text: string, color?: string) => cb(text, color)
    ipcRenderer.on('pty:badge-update', handler)
    return () => ipcRenderer.removeListener('pty:badge-update', handler)
  },

  // A-2: OSC 9998 terminal background color change
  onPtyBgUpdate: (cb: (color: string) => void) => {
    const handler = (_: IpcRendererEvent, color: string) => cb(color)
    ipcRenderer.on('pty:bg-update', handler)
    return () => ipcRenderer.removeListener('pty:bg-update', handler)
  },

  // A-1: tab bell notification
  onPtyTabBell: (cb: () => void) => {
    const handler = (_: IpcRendererEvent) => { cb(); return _ }
    ipcRenderer.on('pty:tab-bell', handler)
    return () => ipcRenderer.removeListener('pty:tab-bell', handler)
  },

  // SDK
  sdkQuery: (prompt: string, options: Record<string, unknown>) =>
    ipcRenderer.send('sdk:query', prompt, options),
  sdkAbort: () => ipcRenderer.send('sdk:abort'),
  sdkToolResponse: (approve: boolean) => ipcRenderer.send('sdk:tool-response', approve),
  onSdkMessage: (cb: (msg: SdkMessage) => void) => {
    const handler = (_: IpcRendererEvent, msg: SdkMessage) => cb(msg)
    ipcRenderer.on('sdk:message', handler)
    return () => ipcRenderer.removeListener('sdk:message', handler)
  },
  onSdkToolRequest: (cb: (tool: { name: string; input: unknown }) => void) => {
    const handler = (_: IpcRendererEvent, req: { tool: { name: string; input: unknown } }) =>
      cb(req.tool)
    ipcRenderer.on('sdk:tool-request', handler)
    return () => ipcRenderer.removeListener('sdk:tool-request', handler)
  },
  sdkAgentQuery: (agentId: string, prompt: string, options: Record<string, unknown>) =>
    ipcRenderer.send('sdk:agent-query', agentId, prompt, options),
  onSdkAgentMessage: (cb: (msg: SdkMessage & { agentId: string }) => void) => {
    const handler = (_: IpcRendererEvent, msg: SdkMessage & { agentId: string }) => cb(msg)
    ipcRenderer.on('sdk:agent-message', handler)
    return () => ipcRenderer.removeListener('sdk:agent-message', handler)
  },

  // Settings
  getSettings: (): Promise<ApiSettings> => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown): Promise<ApiSettings> =>
    ipcRenderer.invoke('settings:set', key, value),

  // Sessions
  saveSession: (data: SessionData): Promise<void> => ipcRenderer.invoke('session:save', data),
  loadSession: (id: string): Promise<SessionData | null> => ipcRenderer.invoke('session:load', id),
  listSessions: (): Promise<SessionSummary[]> => ipcRenderer.invoke('session:list'),
  deleteSession: (id: string): Promise<void> => ipcRenderer.invoke('session:delete', id),

  // File system
  listDirectory: (dirPath: string): Promise<FileEntry[]> => ipcRenderer.invoke('fs:list-dir', dirPath),

  // Process viewer (A-1)
  listProcesses: (): Promise<ProcessInfo[]> => ipcRenderer.invoke('process:list'),

  // Chat toggle (A-1 slide-out panel)
  onChatToggle: (cb: () => void) => {
    const handler = (_: IpcRendererEvent) => { cb(); return _ }
    ipcRenderer.on('chat:toggle', handler)
    return () => ipcRenderer.removeListener('chat:toggle', handler)
  },

  // Pane focus navigation (A-1 Vim style)
  onFocusTerminal: (cb: () => void) => {
    const handler = (_: IpcRendererEvent) => { cb(); return _ }
    ipcRenderer.on('focus:terminal', handler)
    return () => ipcRenderer.removeListener('focus:terminal', handler)
  },
  onFocusChat: (cb: () => void) => {
    const handler = (_: IpcRendererEvent) => { cb(); return _ }
    ipcRenderer.on('focus:chat', handler)
    return () => ipcRenderer.removeListener('focus:chat', handler)
  },

  // PTY CWD update (A-3)
  onPtyCwdUpdate: (cb: (cwd: string) => void) => {
    const handler = (_: IpcRendererEvent, cwd: string) => cb(cwd)
    ipcRenderer.on('pty:cwd-update', handler)
    return () => ipcRenderer.removeListener('pty:cwd-update', handler)
  },

  // Bell visual indicator (A-2)
  onPtyBell: (cb: () => void) => {
    const handler = (_: IpcRendererEvent) => { cb(); return _ }
    ipcRenderer.on('pty:bell', handler)
    return () => ipcRenderer.removeListener('pty:bell', handler)
  },

  // A-1: OSC 9;4 ConEmu progress bar
  onPtyProgress: (cb: (state: number, value: number) => void) => {
    const handler = (_: IpcRendererEvent, state: number, value: number) => cb(state, value)
    ipcRenderer.on('pty:progress', handler)
    return () => ipcRenderer.removeListener('pty:progress', handler)
  },

  // Terminal scrollback save (A-5)
  saveScrollback: (text: string): Promise<string | null> =>
    ipcRenderer.invoke('pty:save-scrollback', text),

  // A-2 (Phase 10): OSC 9997 setmeta — tab title/icon from terminal
  onPtySetMeta: (cb: (title: string, icon?: string) => void) => {
    const handler = (_: IpcRendererEvent, title: string, icon?: string) => cb(title, icon)
    ipcRenderer.on('pty:setmeta', handler)
    return () => ipcRenderer.removeListener('pty:setmeta', handler)
  },

  // A-5 (Phase 10): error context from ConEmu progress state 2
  onPtyErrorContext: (cb: (output: string) => void) => {
    const handler = (_: IpcRendererEvent, output: string) => cb(output)
    ipcRenderer.on('pty:error-context', handler)
    return () => ipcRenderer.removeListener('pty:error-context', handler)
  },

  // A-1 (Phase 10): Claude Code hooks
  checkClaudeHooks: (): Promise<boolean> => ipcRenderer.invoke('claude:check-hooks'),
  installClaudeHooks: (): Promise<boolean> => ipcRenderer.invoke('claude:install-hooks'),
  removeClaudeHooks: (): Promise<boolean> => ipcRenderer.invoke('claude:remove-hooks')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
