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
}

export interface SdkMessage {
  type: 'stream' | 'result' | 'tool-request' | 'error'
  id?: number
  agentId?: string
  content?: string
  role?: string
  totalCostUsd?: number
  inputTokens?: number
  outputTokens?: number
  tool?: { name: string; input: unknown }
  error?: string
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
  listProcesses: (): Promise<ProcessInfo[]> => ipcRenderer.invoke('process:list')
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
