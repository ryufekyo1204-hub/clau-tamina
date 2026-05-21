export interface ProcessInfo {
  name: string
  pid?: number
  cpu: number
  memMb: number
}

export interface ProcessEntry {
  name: string
  pid?: number
  cpu: number
  mem: number
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
  fontSizeTerminal?: number
  fontFamilyTerminal?: string
  maxBudgetUsd?: number
  cwdColorMap?: Record<string, string>
  systemPrompt?: string
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

interface ClauTaminaApi {
  ptyInput(data: string): void
  ptyResize(cols: number, rows: number): void
  ptySpawn(cwd: string): void
  onPtyData(cb: (data: string) => void): () => void
  onPtyExit(cb: (code: number) => void): () => void
  onPtyBadgeUpdate(cb: (text: string, color?: string) => void): () => void
  onPtyBgUpdate(cb: (color: string) => void): () => void
  onPtyTabBell(cb: () => void): () => void

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
  killProcess(pid: number): Promise<boolean>

  onChatToggle(cb: () => void): () => void

  // Pane focus navigation (A-1 Vim style)
  onFocusTerminal(cb: () => void): () => void
  onFocusChat(cb: () => void): () => void

  // PTY CWD update (A-3)
  onPtyCwdUpdate(cb: (cwd: string) => void): () => void

  // Bell visual indicator (A-2)
  onPtyBell(cb: () => void): () => void

  // A-1: OSC 9;4 ConEmu progress bar
  onPtyProgress(cb: (state: number, value: number) => void): () => void

  // Terminal scrollback save (A-5)
  saveScrollback(text: string): Promise<string | null>

  // A-2 (Phase 10): OSC 9997 setmeta — tab title/icon from terminal
  onPtySetMeta(cb: (title: string, icon?: string) => void): () => void

  // A-5 (Phase 10): error context (Active AI style)
  onPtyErrorContext(cb: (output: string) => void): () => void

  // A-1 (Phase 10): Claude Code hooks
  checkClaudeHooks(): Promise<boolean>
  installClaudeHooks(): Promise<boolean>
  removeClaudeHooks(): Promise<boolean>

  // A-4 (Phase 13): Chat export to Markdown
  exportChat(content: string): Promise<string | null>
}

declare global {
  interface Window {
    api: ClauTaminaApi
  }
}
