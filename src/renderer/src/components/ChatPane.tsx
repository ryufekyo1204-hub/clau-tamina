import React, { useEffect, useRef, useState } from 'react'
import { useSessionStore, type ChatMessage } from '../store/session'

function MessageBubble({ msg }: { msg: ChatMessage }): React.ReactElement {
  const isUser = msg.role === 'user'
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        padding: '0 8px'
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          padding: isUser ? '8px 12px' : '0',
          background: isUser ? 'var(--app-bg-elevated)' : 'transparent',
          border: isUser ? '1px solid var(--border-subtle)' : 'none',
          borderRadius: isUser ? '12px 12px 2px 12px' : '0',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-md)',
          lineHeight: '1.65',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {msg.content}
      </div>
    </div>
  )
}

function ToolApprovalDialog(): React.ReactElement | null {
  const { pendingTool, setPendingTool } = useSessionStore()

  if (!pendingTool) return null

  const approve = () => {
    window.api.sdkToolResponse(true)
    setPendingTool(null)
  }
  const deny = () => {
    window.api.sdkToolResponse(false)
    setPendingTool(null)
  }

  return (
    <div
      style={{
        margin: '8px',
        padding: '12px',
        background: 'var(--app-bg-elevated)',
        border: '1px solid var(--border-accent)',
        borderRadius: '8px',
        fontSize: 'var(--text-sm)'
      }}
    >
      <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '6px' }}>
        ツール実行の承認
      </div>
      <div style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
        <strong>{pendingTool.name}</strong>
        <pre
          style={{
            marginTop: '6px',
            padding: '8px',
            background: 'var(--app-bg)',
            borderRadius: '4px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            overflow: 'auto',
            maxHeight: '80px'
          }}
        >
          {JSON.stringify(pendingTool.input, null, 2)}
        </pre>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={approve}
          style={{
            padding: '5px 14px',
            background: 'var(--accent)',
            color: '#000',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer'
          }}
        >
          承認
        </button>
        <button
          onClick={deny}
          style={{
            padding: '5px 14px',
            background: 'var(--app-bg)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
            borderRadius: '6px',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer'
          }}
        >
          拒否
        </button>
      </div>
    </div>
  )
}

export function ChatPane(): React.ReactElement {
  const {
    messages,
    isQuerying,
    bypassPermissions,
    currentWorkingDir,
    addUserMessage,
    handleSdkMessage,
    setPendingTool,
    spawnParallelAgent,
    handleAgentSdkMessage,
    promptSuggestion,
    setPromptSuggestion
  } = useSessionStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Wire up SDK message listeners
  useEffect(() => {
    const offMsg = window.api.onSdkMessage(handleSdkMessage)
    const offTool = window.api.onSdkToolRequest(setPendingTool)
    const offAgent = window.api.onSdkAgentMessage(handleAgentSdkMessage)
    return () => {
      offMsg()
      offTool()
      offAgent()
    }
  }, [handleSdkMessage, setPendingTool, handleAgentSdkMessage])

  // A-1: Vim pane navigation — focus chat input on Ctrl+Shift+L
  useEffect(() => {
    const offFocusChat = window.api.onFocusChat(() => {
      textareaRef.current?.focus()
    })
    return offFocusChat
  }, [])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  const submit = () => {
    const prompt = input.trim()
    if (!prompt || isQuerying) return

    // A-3: `!<prompt>` starts a parallel agent instead of normal query
    if (prompt.startsWith('!')) {
      const agentPrompt = prompt.slice(1).trim()
      if (!agentPrompt) return
      const agentId = 'agent-' + Date.now()
      setInput('')
      window.api.sdkAgentQuery(agentId, agentPrompt, { cwd: currentWorkingDir, bypassPermissions })
      // Show system message in main chat
      addUserMessage(`[並列エージェント起動: ${agentPrompt.slice(0, 30)}${agentPrompt.length > 30 ? '...' : ''}]`)
      return
    }

    // A-3: clear suggestion when sending new message
    setPromptSuggestion('')
    // Capture history BEFORE adding user message
    const history = messages.map((m) => ({ role: m.role, content: m.content }))
    addUserMessage(prompt)
    setInput('')
    window.api.sdkQuery(prompt, {
      cwd: currentWorkingDir,
      bypassPermissions,
      history
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: 'var(--app-bg)',
        borderLeft: '1px solid var(--border-subtle)'
      }}
    >
      {/* Panel header */}
      <div
        style={{
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Claude AI
          </span>
          {isQuerying && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--status-running)',
                display: 'inline-block',
                animation: 'pulse 1s infinite'
              }}
            />
          )}
        </div>
        <button
          onClick={() => {
            const prompt = input.trim()
            if (!prompt) return
            spawnParallelAgent(prompt, currentWorkingDir, bypassPermissions)
            setInput('')
          }}
          disabled={!input.trim() || isQuerying}
          title="現在の入力を新しいエージェントで並列実行"
          style={{
            fontSize: 'var(--text-xs)',
            color: input.trim() && !isQuerying ? 'var(--accent)' : 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid ' + (input.trim() && !isQuerying ? 'var(--border-accent)' : 'var(--border-subtle)'),
            borderRadius: '5px',
            padding: '2px 7px',
            cursor: input.trim() && !isQuerying ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)',
            transition: 'color 0.15s, border-color 0.15s'
          }}
        >
          ＋エージェント
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 0',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
              padding: '24px'
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
            <div>Claude にエラー・設計を相談できます</div>
            <div style={{ marginTop: '6px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Shift+Enter で改行 / Enter で送信
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <ToolApprovalDialog />
        <div ref={messagesEndRef} />
      </div>

      {/* A-3: Prompt suggestion chip */}
      {promptSuggestion && !isQuerying && (
        <div style={{ padding: '0 8px 4px 8px', flexShrink: 0 }}>
          <button
            onClick={() => {
              setInput(promptSuggestion)
              setPromptSuggestion('')
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              background: 'var(--app-bg-elevated)',
              border: '1px solid var(--border-accent)',
              borderRadius: '12px',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s, border-color 0.15s'
            }}
            title="クリックで入力欄にセット"
          >
            <span style={{ color: 'var(--accent)', flexShrink: 0 }}>↩</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{promptSuggestion}</span>
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid var(--border-subtle)',
          flexShrink: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            padding: '8px 10px',
            background: 'var(--app-bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            transition: 'border-color 0.15s ease'
          }}
          onFocusCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'
          }}
          onBlurCapture={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-default)'
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Claude に質問・相談する... (! で並列エージェント起動)"
            disabled={isQuerying}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-md)',
              lineHeight: '1.5',
              minHeight: '20px',
              maxHeight: '160px',
              overflow: 'auto',
              fontFamily: 'var(--font-ui)',
              opacity: isQuerying ? 0.5 : 1
            }}
          />
          <button
            onClick={submit}
            disabled={!input.trim() || isQuerying}
            style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: input.trim() && !isQuerying ? 'var(--accent)' : 'var(--app-bg)',
              color: input.trim() && !isQuerying ? '#000' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              cursor: input.trim() && !isQuerying ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'background 0.15s ease'
            }}
          >
            ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
