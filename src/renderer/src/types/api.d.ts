export interface ApiSettings {
  bypassPermissions: boolean
  windowBounds: { width: number; height: number; x?: number; y?: number }
  splitRatio: number
  currentWorkingDir: string
}

export interface SdkMessage {
  type: 'stream' | 'result' | 'tool-request' | 'error'
  id?: number
  content?: string
  role?: string
  totalCostUsd?: number
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

interface ClauTaminaApi {
  ptyInput(data: string): void
  ptyResize(cols: number, rows: number): void
  ptySpawn(cwd: string): void
  onPtyData(cb: (data: string) => void): () => void
  onPtyExit(cb: (code: number) => void): () => void

  sdkQuery(prompt: string, options: Record<string, unknown>): void
  sdkAbort(): void
  sdkToolResponse(approve: boolean): void
  onSdkMessage(cb: (msg: SdkMessage) => void): () => void
  onSdkToolRequest(cb: (tool: { name: string; input: unknown }) => void): () => void

  getSettings(): Promise<ApiSettings>
  setSetting(key: string, value: unknown): Promise<ApiSettings>

  saveSession(data: SessionData): Promise<void>
  loadSession(id: string): Promise<SessionData | null>
  listSessions(): Promise<SessionSummary[]>
  deleteSession(id: string): Promise<void>
}

declare global {
  interface Window {
    api: ClauTaminaApi
  }
}
