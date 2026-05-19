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

interface ClauTaminaApi {
  ptyInput(data: string): void
  ptyResize(cols: number, rows: number): void
  ptySpawn(cwd: string): void
  onPtyData(cb: (data: string) => void): () => void
  onPtyExit(cb: (code: number) => void): () => void
  onPtyBadgeUpdate(cb: (text: string) => void): () => void

  sdkQuery(prompt: string, options: Record<string, unknown>): void
  sdkAbort(): void
  sdkToolResponse(approve: boolean): void
  onSdkMessage(cb: (msg: SdkMessage) => void): () => void
  onSdkToolRequest(cb: (tool: { name: string; input: unknown }) => void): () => void
  sdkAgentQuery(agentId: string, prompt: string, options: Record<string, unknown>): void
  onSdkAgentMessage(cb: (msg: SdkMessage & { agentId: string }) => void): () => void

  getSettings(): Promise<ApiSettings>
  setSetting(key: string, value: unknown): Promise<ApiSettings>

  saveSession(data: SessionData): Promise<void>
  loadSession(id: string): Promise<SessionData | null>
  listSessions(): Promise<SessionSummary[]>
  deleteSession(id: string): Promise<void>

  listDirectory(dirPath: string): Promise<FileEntry[]>

  listProcesses(): Promise<ProcessInfo[]>

  onChatToggle(cb: () => void): () => void
}

declare global {
  interface Window {
    api: ClauTaminaApi
  }
}
