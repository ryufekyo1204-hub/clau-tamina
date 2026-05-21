import React, { useEffect, useRef, useState, useId } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import { useSessionStore, type ChatMessage } from '../store/session'

const COLLAPSE_THRESHOLD = 300

// A-3 (Phase 14): Mermaid diagram renderer (Warp/Wave Terminal inspired)
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    background: '#1c1c1a',
    primaryColor: '#d97757',
    primaryTextColor: '#f2ede4',
    primaryBorderColor: '#3a3a37',
    lineColor: '#a09b95',
    secondaryColor: '#1c1c1a',
    tertiaryColor: '#111110',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontSize: '13px',
    nodeBorder: '#d97757',
    clusterBkg: '#1c1c1a',
    titleColor: '#f2ede4',
    edgeLabelBackground: '#111110',
    activeTaskBkgColor: '#d97757',
    activeTaskBorderColor: '#e8895a'
  },
  securityLevel: 'loose'
})

function MermaidBlock({ code }: { code: string }): React.ReactElement {
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      try {
        const { svg: rendered } = await mermaid.render(`mermaid-${id}`, code)
        if (!cancelled) setSvg(rendered)
      } catch (err) {
        if (!cancelled) setError(String(err))
      }
    }
    void render()
    return () => { cancelled = true }
  }, [code, id])

  if (error) {
    return (
      <div
        style={{
          padding: '8px 12px',
          background: 'rgba(229,77,46,0.08)',
          border: '1px solid rgba(229,77,46,0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-error)',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)',
          marginBottom: '8px'
        }}
      >
        Mermaid エラー: {error}
      </div>
    )
  }

  if (!svg) {
    return (
      <div
        style={{
          padding: '12px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-xs)',
          fontFamily: 'var(--font-mono)'
        }}
      >
        ...
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--app-bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '8px',
        overflowX: 'auto',
        textAlign: 'center'
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function CopyButton({ text }: { text: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => undefined)
  }
  return (
    <button
      onClick={copy}
      style={{
        position: 'absolute',
        top: '6px',
        right: '6px',
        padding: '2px 7px',
        background: copied ? 'var(--accent-subtle)' : 'var(--app-bg)',
        border: '1px solid ' + (copied ? 'var(--border-accent)' : 'var(--border-subtle)'),
        borderRadius: 'var(--radius-sm)',
        color: copied ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: 'var(--text-xs)',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        letterSpacing: 'var(--ls-label)',
        textTransform: 'uppercase',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        zIndex: 1
      }}
    >
      {copied ? 'COPIED' : 'COPY'}
    </button>
  )
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  code({ className, children, ...props }) {
    const isBlock = className?.startsWith('language-') || String(children).includes('\n')
    const text = String(children).replace(/\n$/, '')
    // A-3 (Phase 14): Mermaid diagram rendering
    if (className === 'language-mermaid') {
      return <MermaidBlock code={text} />
    }
    if (isBlock) {
      return (
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <CopyButton text={text} />
          <pre
            style={{
              padding: '10px 12px',
              paddingRight: '52px',
              background: 'var(--app-bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflowX: 'auto',
              fontSize: 'var(--text-sm)',
              lineHeight: '1.55',
              color: 'var(--term-bright-green)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre'
            }}
          >
            <code {...props} className={className}>{text}</code>
          </pre>
        </div>
      )
    }
    return (
      <code
        {...props}
        style={{
          padding: '1px 5px',
          background: 'var(--app-bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.92em',
          fontFamily: 'var(--font-mono)',
          color: 'var(--status-waiting)'
        }}
      >
        {children}
      </code>
    )
  },
  pre({ children }) {
    return <>{children}</>
  },
  table({ children }) {
    return (
      <div style={{ overflowX: 'auto', marginBottom: '8px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 'var(--text-sm)', width: '100%' }}>
          {children}
        </table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-default)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', textAlign: 'left', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--ls-label)', fontSize: 'var(--text-xs)' }}>
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
        {children}
      </td>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote style={{ margin: '6px 0', paddingLeft: '10px', borderLeft: '2px solid var(--border-accent)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        {children}
      </blockquote>
    )
  },
  a({ href, children }) {
    return (
      <span
        style={{ color: 'var(--status-waiting)', textDecoration: 'underline', cursor: 'pointer' }}
        title={href}
      >
        {children}
      </span>
    )
  },
  p({ children }) {
    return <p style={{ marginBottom: '6px', lineHeight: '1.65' }}>{children}</p>
  },
  ul({ children }) {
    return <ul style={{ paddingLeft: '16px', marginBottom: '6px' }}>{children}</ul>
  },
  ol({ children }) {
    return <ol style={{ paddingLeft: '16px', marginBottom: '6px' }}>{children}</ol>
  },
  li({ children }) {
    return <li style={{ marginBottom: '3px' }}>{children}</li>
  },
  h1({ children }) {
    return <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{children}</h1>
  },
  h2({ children }) {
    return <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{children}</h2>
  },
  h3({ children }) {
    return <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '4px', color: 'var(--accent)' }}>{children}</h3>
  },
  hr() {
    return <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '10px 0' }} />
  }
}

function MessageBubble({ msg }: { msg: ChatMessage }): React.ReactElement {
  const isUser = msg.role === 'user'
  const isLong = !isUser && msg.content.length > COLLAPSE_THRESHOLD
  const [collapsed, setCollapsed] = React.useState(isLong)
  const lineCount = msg.content.split('\n').length

  const displayContent = collapsed
    ? msg.content.split('\n').slice(0, 3).join('\n')
    : msg.content

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
          borderRadius: isUser ? 'var(--radius-md)' : '0',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-md)',
          lineHeight: '1.65',
          wordBreak: 'break-word'
        }}
      >
        <div
          style={{
            position: 'relative',
            ...(collapsed && isLong
              ? { WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }
              : {})
          }}
        >
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {displayContent}
            </ReactMarkdown>
          )}
        </div>
        {isLong && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              display: 'block',
              marginTop: collapsed ? '2px' : '6px',
              padding: '2px 8px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              letterSpacing: 'var(--ls-label)',
              textTransform: 'uppercase',
              transition: 'border-color 0.15s, color 0.15s'
            }}
          >
            {collapsed ? `…続き (${lineCount}行) ▾` : '▴ 折りたたむ'}
          </button>
        )}
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
        borderRadius: 'var(--radius-lg)',
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
    setPromptSuggestion,
    lastCheckpointUuid,
    rewindLastExchange
  } = useSessionStore()
  const [input, setInput] = useState('')
  const [systemPrompt, setSystemPromptLocal] = useState('')
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

  // Load system prompt from settings
  useEffect(() => {
    window.api.getSettings().then((s) => {
      setSystemPromptLocal(s.systemPrompt ?? '')
    }).catch(() => undefined)
  }, [])

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
      history,
      ...(systemPrompt.trim() ? { systemPrompt: systemPrompt.trim() } : {})
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
              letterSpacing: 'var(--ls-label)'
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
            if (messages.length === 0) return
            const lines: string[] = [
              `# clau-tamina チャット履歴`,
              `エクスポート日時: ${new Date().toLocaleString('ja-JP')}`,
              ''
            ]
            for (const m of messages) {
              lines.push(m.role === 'user' ? '## ユーザー' : '## Claude')
              lines.push(m.content)
              lines.push('')
            }
            void window.api.exportChat(lines.join('\n'))
          }}
          disabled={messages.length === 0}
          title="会話を Markdown ファイルにエクスポート"
          style={{
            fontSize: 'var(--text-xs)',
            color: messages.length > 0 ? 'var(--text-muted)' : 'var(--text-muted)',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 7px',
            cursor: messages.length > 0 ? 'pointer' : 'default',
            fontFamily: 'var(--font-mono)',
            opacity: messages.length > 0 ? 1 : 0.4,
            transition: 'color 0.15s, border-color 0.15s',
            marginRight: '4px'
          }}
        >
          MD
        </button>
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

      {/* A-3 (Phase 12): Conversation rewind button */}
      {lastCheckpointUuid && !isQuerying && messages.length >= 2 && (
        <div style={{ padding: '0 8px 4px 8px', flexShrink: 0 }}>
          <button
            onClick={rewindLastExchange}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              letterSpacing: 'var(--ls-label)',
              textTransform: 'uppercase',
              transition: 'border-color 0.15s, color 0.15s'
            }}
            title="最後のユーザー発言と応答を会話から取り除く"
          >
            <span style={{ color: 'var(--accent)' }}>↩</span>
            最後の応答を取り消す
          </button>
        </div>
      )}

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
              borderRadius: 'var(--radius-sm)',
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
            borderRadius: 'var(--radius-lg)',
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
