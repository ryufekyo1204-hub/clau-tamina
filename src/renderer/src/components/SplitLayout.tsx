import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/session'

interface SplitLayoutProps {
  left: React.ReactNode
  right: React.ReactNode
}

export function SplitLayout({ left, right }: SplitLayoutProps): React.ReactElement {
  const { splitRatio, setSplitRatio } = useSessionStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const onMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const ratio = Math.min(0.85, Math.max(0.15, (e.clientX - rect.left) / rect.width))
      setSplitRatio(ratio)
    }

    const onUp = () => setIsDragging(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging, setSplitRatio])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        cursor: isDragging ? 'col-resize' : undefined
      }}
    >
      {/* Left pane */}
      <div style={{ flex: `0 0 ${splitRatio * 100}%`, overflow: 'hidden', display: 'flex' }}>
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '4px',
          flexShrink: 0,
          background: isDragging ? 'var(--accent)' : 'var(--border-subtle)',
          cursor: 'col-resize',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'var(--border-default)'
        }}
        onMouseLeave={(e) => {
          if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = 'var(--border-subtle)'
        }}
      />

      {/* Right pane */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {right}
      </div>
    </div>
  )
}
