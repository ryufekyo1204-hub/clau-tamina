import React, { useRef, useState, useEffect } from 'react'

// Extend JSX to allow webview element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          allowpopups?: string
          webpreferences?: string
        },
        HTMLElement
      >
    }
  }
}

export function BrowserPane(): React.ReactElement {
  // Start blank — avoid auto-loading URLs that require auth
  const [url, setUrl] = useState('about:blank')
  const [inputUrl, setInputUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const webviewRef = useRef<HTMLElement>(null)

  const navigate = (target: string): void => {
    let href = target.trim()
    if (!href) return
    if (!href.startsWith('http://') && !href.startsWith('https://') && !href.includes('://')) {
      href = 'https://' + href
    }
    setUrl(href)
    setInputUrl(href)
    const wv = webviewRef.current as any
    if (wv) wv.src = href
  }

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

    wv.addEventListener('did-navigate', handleNavigate)
    wv.addEventListener('did-navigate-in-page', handleNavigate)
    wv.addEventListener('did-start-loading', handleLoadStart)
    wv.addEventListener('did-stop-loading', handleLoadStop)
    wv.addEventListener('did-fail-load', handleLoadFail)

    return () => {
      wv.removeEventListener('did-navigate', handleNavigate)
      wv.removeEventListener('did-navigate-in-page', handleNavigate)
      wv.removeEventListener('did-start-loading', handleLoadStart)
      wv.removeEventListener('did-stop-loading', handleLoadStop)
      wv.removeEventListener('did-fail-load', handleLoadFail)
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
        <button
          onClick={() => navigate('https://claude.ai')}
          style={navBtnStyle}
          title="ホーム"
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
          allowpopups="true"
          webpreferences="contextIsolation=false"
        />

        {/* Empty state — shown when no URL is loaded */}
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
            <span>URL を入力して Enter で開く</span>
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
