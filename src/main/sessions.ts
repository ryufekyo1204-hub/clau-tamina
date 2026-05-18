import { app } from 'electron'
import { join } from 'path'
import { writeFile, readFile, readdir, unlink, access, mkdir } from 'fs/promises'

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

async function getSessionsDir(): Promise<string> {
  const dir = join(app.getPath('userData'), 'sessions')
  // Create on first access so callers never have to check
  await mkdir(dir, { recursive: true })
  return dir
}

async function sessionPath(id: string): Promise<string> {
  return join(await getSessionsDir(), `${id}.json`)
}

export async function saveSession(data: SessionData): Promise<void> {
  await writeFile(await sessionPath(data.id), JSON.stringify(data, null, 2), 'utf-8')
}

export async function loadSession(id: string): Promise<SessionData | null> {
  const path = await sessionPath(id)
  try {
    await access(path)
    return JSON.parse(await readFile(path, 'utf-8')) as SessionData
  } catch {
    return null
  }
}

export async function listSessions(): Promise<SessionSummary[]> {
  const dir = await getSessionsDir()
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))

  const summaries = await Promise.all(
    files.map(async (file) => {
      try {
        const raw = JSON.parse(await readFile(join(dir, file), 'utf-8')) as SessionData
        return {
          id: raw.id,
          title: raw.title,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt
        } as SessionSummary
      } catch {
        // Skip corrupt files silently
        return null
      }
    })
  )

  // Filter out nulls (corrupt files) and sort newest first
  return (summaries.filter(Boolean) as SessionSummary[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteSession(id: string): Promise<void> {
  const path = await sessionPath(id)
  try {
    await access(path)
    await unlink(path)
  } catch {
    // File does not exist — nothing to delete
  }
}
