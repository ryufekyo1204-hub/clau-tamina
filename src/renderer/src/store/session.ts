import { create } from 'zustand'
import type { SdkMessage, SessionSummary } from '../types/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ParallelAgent {
  id: string
  status: 'running' | 'done' | 'error'
  messages: ChatMessage[]
  costUsd: number
  prompt: string  // first user message (shown as card summary)
}

interface SessionStore {
  bypassPermissions: boolean
  splitRatio: number
  currentWorkingDir: string
  messages: ChatMessage[]
  isQuerying: boolean
  totalCostUsd: number
  pendingTool: { name: string; input: unknown } | null

  // Token tracking
  totalInputTokens: number
  totalOutputTokens: number

  // Terminal appearance (for Settings modal)
  fontSizeTerminal: number       // 12-20, default 14
  fontFamilyTerminal: string     // CSS font-family string

  // Parallel agents
  parallelAgents: Record<string, ParallelAgent>
  focusedAgentId: string | null

  // Persisted session management
  savedSessions: SessionSummary[]
  currentSessionId: string | null

  // A-3: prompt suggestion from SDK
  promptSuggestion: string

  setBypassPermissions: (v: boolean) => void
  setSplitRatio: (v: number) => void
  setCwd: (v: string) => void
  addUserMessage: (content: string) => string
  handleSdkMessage: (msg: SdkMessage) => void
  setPendingTool: (tool: { name: string; input: unknown } | null) => void
  clearMessages: () => void
  setPromptSuggestion: (s: string) => void

  setFontSizeTerminal: (size: number) => void
  setFontFamilyTerminal: (family: string) => void
  loadFontSettings: (size: number, family: string) => void
  spawnParallelAgent: (prompt: string, cwd: string, bypass: boolean) => void
  handleAgentSdkMessage: (msg: SdkMessage) => void
  setFocusedAgentId: (id: string | null) => void
  removeParallelAgent: (id: string) => void

  loadSavedSessions: () => Promise<void>
  saveCurrentSession: () => Promise<void>
  restoreSession: (id: string) => Promise<void>
  deleteSession: (id: string) => Promise<void>
}

// Tracks the in-progress assistant message id (outside of Zustand for perf)
let currentAssistantId = ''

export const useSessionStore = create<SessionStore>((set, get) => ({
  bypassPermissions: true,
  splitRatio: 0.55,
  currentWorkingDir: '',
  messages: [],
  isQuerying: false,
  totalCostUsd: 0,
  pendingTool: null,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  fontSizeTerminal: 14,
  fontFamilyTerminal: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
  parallelAgents: {},
  focusedAgentId: null,
  savedSessions: [],
  currentSessionId: null,
  promptSuggestion: '',

  setBypassPermissions: (v) => {
    set({ bypassPermissions: v })
    window.api.setSetting('bypassPermissions', v)
  },
  setSplitRatio: (v) => {
    set({ splitRatio: v })
    window.api.setSetting('splitRatio', v)
  },
  setCwd: (v) => set({ currentWorkingDir: v }),

  addUserMessage: (content) => {
    const id = crypto.randomUUID()
    currentAssistantId = crypto.randomUUID()
    set((s) => ({
      messages: [...s.messages, { id, role: 'user', content, timestamp: Date.now() }],
      isQuerying: true
    }))
    return id
  },

  handleSdkMessage: (msg) => {
    if (msg.type === 'stream' && msg.content !== undefined) {
      // sdk-host sends accumulated text — set content directly (no +=)
      const { messages } = get()
      const exists = messages.some((m) => m.id === currentAssistantId)
      if (exists) {
        set({
          messages: messages.map((m) =>
            m.id === currentAssistantId ? { ...m, content: msg.content! } : m
          )
        })
      } else {
        set({
          messages: [
            ...messages,
            {
              id: currentAssistantId,
              role: 'assistant',
              content: msg.content,
              timestamp: Date.now()
            }
          ]
        })
      }
    } else if (msg.type === 'result') {
      set({
        isQuerying: false,
        totalCostUsd: get().totalCostUsd + (msg.totalCostUsd ?? 0),
        totalInputTokens: get().totalInputTokens + (msg.inputTokens ?? 0),
        totalOutputTokens: get().totalOutputTokens + (msg.outputTokens ?? 0),
      })
      currentAssistantId = ''
    } else if (msg.type === 'error') {
      const errMsg = msg.error ?? '不明なエラー'
      set((s) => ({
        isQuerying: false,
        messages: [
          ...s.messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `⚠ エラー: ${errMsg}`,
            timestamp: Date.now()
          }
        ]
      }))
      currentAssistantId = ''
    } else if (msg.type === 'prompt_suggestion' && msg.suggestion) {
      // A-3: store prompt suggestion for display in ChatPane
      set({ promptSuggestion: msg.suggestion })
    }
  },

  setPendingTool: (tool) => set({ pendingTool: tool }),
  clearMessages: () => set({ messages: [], totalCostUsd: 0, currentSessionId: null, promptSuggestion: '' }),
  setPromptSuggestion: (s) => set({ promptSuggestion: s }),

  setFontSizeTerminal: (size) => {
    set({ fontSizeTerminal: size })
    window.api.setSetting('fontSizeTerminal', size)
  },

  setFontFamilyTerminal: (family) => {
    set({ fontFamilyTerminal: family })
    window.api.setSetting('fontFamilyTerminal', family)
  },

  loadFontSettings: (size, family) => set({ fontSizeTerminal: size, fontFamilyTerminal: family }),

  spawnParallelAgent: (prompt, cwd, bypass) => {
    const id = crypto.randomUUID()
    const agentMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: Date.now() }
    set((s) => ({
      parallelAgents: {
        ...s.parallelAgents,
        [id]: { id, status: 'running', messages: [agentMessage], costUsd: 0, prompt }
      }
    }))
    window.api.sdkAgentQuery(id, prompt, { cwd, bypassPermissions: bypass })
  },

  handleAgentSdkMessage: (msg) => {
    const agentId = msg.agentId
    if (!agentId) return
    const { parallelAgents } = get()
    const agent = parallelAgents[agentId]
    if (!agent) return

    if (msg.type === 'stream' && msg.content !== undefined) {
      // Find or create assistant message
      const exists = agent.messages.some((m) => m.role === 'assistant')
      const updated = exists
        ? agent.messages.map((m) => m.role === 'assistant' ? { ...m, content: msg.content! } : m)
        : [...agent.messages, { id: crypto.randomUUID(), role: 'assistant' as const, content: msg.content!, timestamp: Date.now() }]
      set((s) => ({
        parallelAgents: { ...s.parallelAgents, [agentId]: { ...s.parallelAgents[agentId], messages: updated } }
      }))
    } else if (msg.type === 'result') {
      set((s) => ({
        parallelAgents: {
          ...s.parallelAgents,
          [agentId]: { ...s.parallelAgents[agentId], status: 'done', costUsd: msg.totalCostUsd ?? 0 }
        },
        totalCostUsd: s.totalCostUsd + (msg.totalCostUsd ?? 0)
      }))
    } else if (msg.type === 'error') {
      set((s) => ({
        parallelAgents: {
          ...s.parallelAgents,
          [agentId]: { ...s.parallelAgents[agentId], status: 'error' }
        }
      }))
    }
  },

  setFocusedAgentId: (id) => set({ focusedAgentId: id }),

  removeParallelAgent: (id) => {
    set((s) => {
      const next = { ...s.parallelAgents }
      delete next[id]
      return { parallelAgents: next, focusedAgentId: s.focusedAgentId === id ? null : s.focusedAgentId }
    })
  },

  loadSavedSessions: async () => {
    const summaries = await window.api.listSessions()
    set({ savedSessions: summaries })
  },

  saveCurrentSession: async () => {
    const { messages, currentSessionId, totalCostUsd } = get()
    if (messages.length === 0) return

    const id = currentSessionId ?? crypto.randomUUID()
    // Title derived from the first user message (truncated to 40 chars)
    const firstUser = messages.find((m) => m.role === 'user')
    const title = firstUser ? firstUser.content.slice(0, 40) : '無題のセッション'

    // Preserve the original createdAt when updating an existing session
    let createdAt = Date.now()
    if (currentSessionId) {
      const existing = await window.api.loadSession(currentSessionId)
      if (existing) createdAt = existing.createdAt
    }

    const now = Date.now()
    const data = {
      id,
      title,
      createdAt,
      updatedAt: now,
      totalCostUsd,
      messages: messages.map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp }))
    }

    await window.api.saveSession(data)
    set({ currentSessionId: id })

    // Refresh the list after saving
    const summaries = await window.api.listSessions()
    set({ savedSessions: summaries })
  },

  restoreSession: async (id) => {
    const data = await window.api.loadSession(id)
    if (!data) return

    const restored: ChatMessage[] = data.messages.map((m) => ({
      id: crypto.randomUUID(),
      role: m.role,
      content: m.content,
      timestamp: m.timestamp
    }))

    // Restore totalCostUsd from saved data when available; fall back to 0
    set({ messages: restored, totalCostUsd: data.totalCostUsd ?? 0, currentSessionId: id })
  },

  deleteSession: async (id) => {
    await window.api.deleteSession(id)
    const summaries = await window.api.listSessions()
    // If the deleted session was active, clear it
    set((s) => ({
      savedSessions: summaries,
      currentSessionId: s.currentSessionId === id ? null : s.currentSessionId
    }))
  }
}))
