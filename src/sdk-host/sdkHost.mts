// ESM utility process — Claude API via @anthropic-ai/sdk
// API key: ANTHROPIC_API_KEY environment variable
import Anthropic from '@anthropic-ai/sdk'

interface QueryMsg        { type: 'query'; id: number; prompt: string; options: Record<string, unknown> }
interface ToolResponseMsg { type: 'tool-response'; approve: boolean }
interface AbortMsg        { type: 'abort' }
type IncomingMsg = QueryMsg | ToolResponseMsg | AbortMsg

interface HistoryEntry { role: 'user' | 'assistant'; content: string }

// Override via .env: CLAUDE_MODEL=claude-opus-4-5
const MODEL = process.env['CLAUDE_MODEL'] ?? 'claude-sonnet-4-5'

let abortController: AbortController | null = null

function getClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY が未設定です。\n' +
      'プロジェクトルートの .env に ANTHROPIC_API_KEY=sk-ant-... を追加してアプリを再起動してください。\n' +
      'キーの取得: https://console.anthropic.com/settings/keys'
    )
  }
  return new Anthropic({ apiKey })
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)

  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    const status = (obj['status'] as number) ?? 0
    const msg = ((obj['error'] as Record<string, unknown>)?.['message'] as string) ?? raw

    if (status === 401) return 'API キーが無効です。.env の ANTHROPIC_API_KEY を確認してください。'
    if (status === 429) return 'レート制限に達しました。しばらく待ってから再試行してください。'
    if (status === 400) return `リクエストエラー: ${msg}`
    if (status >= 500) return `Anthropic サーバーエラー (${status})。しばらく待ってから再試行してください。`
    if (msg) return msg
  } catch {
    // not JSON
  }

  return raw
}

async function runQuery(id: number, prompt: string, options: Record<string, unknown>): Promise<void> {
  abortController = new AbortController()

  const agentId = options['agentId'] as string | undefined

  try {
    const client = getClient()
    const cwd = (options['cwd'] as string | undefined) ?? process.env['USERPROFILE'] ?? 'unknown'
    const history = (options['history'] as HistoryEntry[] | undefined) ?? []

    const systemPrompt =
      `あなたは優秀なソフトウェアエンジニアです。ユーザーのコーディング作業を助けてください。\n` +
      `現在の作業ディレクトリ: ${cwd}\n` +
      `エラーの解析、設計の相談、コードレビューなど幅広く対応してください。\n` +
      `回答は日本語か英語、文脈に合わせて使い分けてください。`

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt }
    ]

    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        messages
      },
      { signal: abortController.signal }
    )

    let accumulated = ''

    for await (const event of stream) {
      if (abortController.signal.aborted) break
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        accumulated += event.delta.text
        process.parentPort.postMessage({ type: 'stream', id, agentId, content: accumulated })
      }
    }

    const final = await stream.finalMessage()
    const costUsd = estimateCost(final.usage.input_tokens, final.usage.output_tokens)
    process.parentPort.postMessage({ type: 'result', id, agentId, totalCostUsd: costUsd, inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens })
  } catch (err) {
    if (abortController?.signal.aborted) {
      process.parentPort.postMessage({ type: 'result', id, agentId, totalCostUsd: 0, inputTokens: 0, outputTokens: 0 })
      return
    }
    const error = friendlyError(err)
    process.stderr.write(`[sdk-host] ERROR: ${error}\n`)
    process.parentPort.postMessage({ type: 'error', id, agentId, error })
  } finally {
    abortController = null
  }
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // claude-sonnet-4-5: $3/MTok in, $15/MTok out
  return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
}

const hasKey = !!process.env['ANTHROPIC_API_KEY']
process.stderr.write(`[sdk-host] started — ANTHROPIC_API_KEY: ${hasKey ? 'OK' : 'MISSING'} / model: ${MODEL}\n`)

process.parentPort.on('message', (event: { data: unknown }) => {
  const msg = event.data as IncomingMsg
  switch (msg.type) {
    case 'query':
      runQuery(msg.id, msg.prompt, msg.options)
      break
    case 'tool-response':
      break
    case 'abort':
      abortController?.abort()
      break
  }
})
