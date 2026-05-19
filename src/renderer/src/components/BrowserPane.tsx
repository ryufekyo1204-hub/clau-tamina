import React, { useRef, useState, useEffect, useCallback } from 'react'

// webview JSX augmentation — defers to Electron's built-in WebViewHTMLAttributes
declare module 'react' {
  // intentionally empty — suppress duplicate webview declaration by deferring to Electron
}

interface Favorite {
  title: string
  url: string
}

const FAVORITES_KEY = 'clau-tamina:browser-favorites'

function loadFavorites(): Favorite[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as Favorite[]
  } catch {
    return []
  }
}

function saveFavorites(favs: Favorite[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs))
}

const GOOGLE_URL = 'https://www.google.com'

export function BrowserPane(): React.ReactElement {
  const [url, setUrl] = useState(GOOGLE_URL)
  const [inputUrl, setInputUrl] = useState(GOOGLE_URL)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Favorite[]>(loadFavorites)
  const [showFavMenu, setShowFavMenu] = useState(false)
  const [pageTitle, setPageTitle] = useState('')
  const webviewRef = useRef<HTMLElement>(null)
  const favMenuRef = useRef<HTMLDivElement>(null)

  const navigate = useCallback((target: string): void => {
    let href = target.trim()
    if (!href) return
    if (href.includes('://')) {
      // already has protocol — use as-is
    } else if (/^[a-zA-Z0-9]([a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}/.test(href)) {
      // looks like a domain (example.com, www.google.com)
      href = 'https://' + href
    } else {
      // treat as Google search query
      href = `https://www.google.com/search?q=${encodeURIComponent(href)}`
    }
    setUrl(href)
    setInputUrl(href)
    const wv = webviewRef.current as any
    if (wv) wv.src = href
  }, [])

  const goBack = (): void => {
    const wv = webviewRef.current as any
    if (wv?.canGoBack()) wv.goBack()
  }

  const goForward = (): void => {
    const wv = webviewRef.current as any
    if (wv?.canGoForward()) wv.goForward()
  }

  const refresh = (): void => {
    const wv = webviewRef.current as any
    wv?.reload()
  }

  const addFavorite = (): void => {
    if (!url || url === 'about:blank') return
    const title = pageTitle || url
    const exists = favorites.some((f) => f.url === url)
    if (exists) return
    const next = [{ title, url }, ...favorites]
    setFavorites(next)
    saveFavorites(next)
  }

  const removeFavorite = (favUrl: string): void => {
    const next = favorites.filter((f) => f.url !== favUrl)
    setFavorites(next)
    saveFavorites(next)
  }

  const isCurrentFavorited = favorites.some((f) => f.url === url)

  // Close favorites menu when clicking outside
  useEffect(() => {
    if (!showFavMenu) return
    const handler = (e: MouseEvent) => {
      if (favMenuRef.current && !favMenuRef.current.contains(e.target as Node)) {
        setShowFavMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFavMenu])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const handleNavigate = (e: Event): void => {
      const navEvent = e as CustomEvent & { url: string }
      if (navEvent.url) {
        setUrl(navEvent.url)
        setInputUrl(navEvent.url)
      }
    }
    const handleLoadStart = (): void => { setIsLoading(true); setLoadError(null) }
    const handleLoadStop = (): void => setIsLoading(false)
    const handleLoadFail = (e: Event): void => {
      const err = e as CustomEvent & { errorDescription?: string; errorCode?: number }
      // ERR_ABORTED (-3) is often a redirect or user-cancelled — ignore silently
      if (err.errorCode === -3) return
      setLoadError(err.errorDescription ?? 'ページを読み込めませんでした')
      setIsLoading(false)
    }
    const handleTitleUpdate = (e: Event): void => {
      const titleEvent = e as CustomEvent & { title?: string }
      if (titleEvent.title) setPageTitle(titleEvent.title)
    }

    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', handleLoadStart)
    wv.addEventListener('did-stop-loading', handleLoadStop)
    wv.addEventListener('did-fail-load', handleLoadFail)
    wv.addEventListener('page-title-updated', handleTitleUpdate)

    return () => {
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', handleLoadStart)
      wv.removeEventListener('did-stop-loading', handleLoadStop)
      wv.removeEventListener('did-fail-load', handleLoadFail)
      wv.removeEventListener('page-title-updated', handleTitleUpdate)
    }
  }, [])

  const handleUrlFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
    e.target.select()
    e.target.style.borderColor = 'var(--border-accent)'
  }

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>): void => {
    e.target.style.borderColor = 'var(--border-default)'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        background: 'var(--app-bg)',
        borderLeft: '1px solid var(--border-subtle)',
      }}
    >
      {/* Navigation bar */}
      <div
        style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '0 8px',
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'var(--app-bg-surface)',
        }}
      >
        <button onClick={goBack} style={navBtnStyle} title="戻る">
          ‹
        </button>
        <button onClick={goForward} style={navBtnStyle} title="進む">
          ›
        </button>
        <button onClick={refresh} style={navBtnStyle} title="再読み込み">
          {isLoading ? '✕' : '↺'}
        </button>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(inputUrl)
          }}
          onFocus={handleUrlFocus}
          onBlur={handleUrlBlur}
          style={{
            flex: 1,
            padding: '3px 8px',
            background: 'var(--app-bg)',
            border: '1px solid var(--border-default)',
            borderRadius: '5px',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            outline: 'none',
          }}
        />
        {/* Favorite toggle star */}
        <button
          onClick={addFavorite}
          style={{
            ...navBtnStyle,
            color: isCurrentFavorited ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: '14px'
          }}
          title={isCurrentFavorited ? 'お気に入り済み' : 'お気に入りに追加'}
          disabled={url === 'about:blank'}
        >
          {isCurrentFavorited ? '★' : '☆'}
        </button>
        {/* Favorites dropdown */}
        <div ref={favMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFavMenu((v) => !v)}
            style={{ ...navBtnStyle, fontSize: '11px' }}
            title="お気に入り一覧"
          >
            ≡
          </button>
          {showFavMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '240px',
                background: 'var(--app-bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 1000,
                overflow: 'hidden'
              }}
            >
              {favorites.length === 0 ? (
                <div style={{ padding: '12px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
                  お気に入りはありません
                </div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {favorites.map((fav) => (
                    <div
                      key={fav.url}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '7px 10px',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => { navigate(fav.url); setShowFavMenu(false) }}
                    >
                      <span
                        style={{
                          flex: 1,
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}
                        title={fav.url}
                      >
                        {fav.title}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFavorite(fav.url) }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          flexShrink: 0
                        }}
                        title="削除"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => navigate(GOOGLE_URL)}
          style={navBtnStyle}
          title="Google ホーム"
        >
          ⌂
        </button>
      </div>

      {/* Webview area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <webview
          ref={webviewRef as any}
          src={url}
          style={{ width: '100%', height: '100%' } as React.CSSProperties}
          allowpopups={true}
          webpreferences="contextIsolation=false"
        />

        {/* Empty state — only when truly blank */}
        {url === 'about:blank' && !isLoading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
            gap: '10px', background: 'var(--app-bg)',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: '28px' }}>🌐</span>
            <span>URL またはキーワードを入力して Enter</span>
          </div>
        )}

        {/* Load error overlay */}
        {loadError && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--status-error)', fontSize: 'var(--text-sm)',
            gap: '8px', background: 'var(--app-bg)',
          }}>
            <span style={{ fontSize: '24px' }}>⚠</span>
            <span>{loadError}</span>
            <button onClick={refresh} style={{
              marginTop: '8px', padding: '4px 14px',
              background: 'var(--app-bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: '6px', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 'var(--text-sm)'
            }}>再読み込み</button>
          </div>
        )}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: '26px',
  height: '26px',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}
