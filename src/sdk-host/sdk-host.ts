// Utility process: manages Claude Code SDK interactions.
// @anthropic-ai/claude-code is ESM-only, so we use a real import() here.
// dynamicImportInCjs: false in rollup config keeps this as import() in CJS output,
// which Node.js CJS modules support natively for loading ESM packages.

interface QueryMsg        { type: 'query'; id: number; prompt: string; options: Record<string, unknown> }
interface ToolResponseMsg { type: 'tool-response'; approve: boolean }
interface AbortMsg        { type: 'abort' }
type IncomingMsg = QueryMsg | ToolResponseMsg | AbortMsg

let pendingToolResolve: ((approve: boolean) => void) | null = null
let abortController: AbortController | null = null

async function runQuery(id: number, prompt: string, options: Record<string, unknown>): Promise<void> {
  abortController = new AbortController()

  try {
    const { query } = await import('@anthropic-ai/claude-code')

    const cwd = (options['cwd'] as string | undefined) ?? process.env['USERPROFILE'] ?? 'C:\\Users'
    const bypass = (options['bypassPermissions'] as boolean | undefined) ?? true

    for await (const message of query({
      prompt,
      options: {
        cwd,
        bypassPermissions: bypass,
        canUseTool: async (tool: unknown) => {
          if (bypass) return true
          process.parentPort.postMessage({ type: 'tool-request', id, tool })
          return await new Promise<boolean>((resolve) => {
            pendingToolResolve = resolve
          })
        }
      },
      abortController
    })) {
      const m = message as Record<string, unknown>

      if (m['type'] === 'assistant') {
        const inner = m['message'] as Record<string, unknown>
        const content = inner['content'] as Array<Record<string, unknown>>
        if (Array.isArray(content)) {
          let text = ''
          for (const block of content) {
            if (block['type'] === 'text') {
              text += block['text'] as string
            }
          }
          if (text) {
            process.parentPort.postMessage({ type: 'stream', id, content: text })
          }
        }
      } else if (m['type'] === 'result') {
        process.parentPort.postMessage({
          type: 'result',
          id,
          totalCostUsd: m['total_cost_usd'] ?? 0
        })
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    process.parentPort.postMessage({ type: 'error', id, error })
  } finally {
    abortController = null
  }
}

process.parentPort.on('message', (event: { data: IncomingMsg }) => {
  const msg = event.data
  switch (msg.type) {
    case 'query':
      runQuery(msg.id, msg.prompt, msg.options)
      break
    case 'tool-response':
      pendingToolResolve?.(msg.approve)
      pendingToolResolve = null
      break
    case 'abort':
      abortController?.abort()
      break
  }
})
