import { useEffect, useState, type ReactNode } from 'react'

export type Layout = 'sidebar' | 'sheet'
export const SIDEBAR_MIN_WIDTH = 900

/** Sidebar on wide screens, bottom sheet under 900 px; re-evaluated on resize. */
export function useLayout(): Layout {
  const read = (): Layout => (typeof window !== 'undefined' && window.innerWidth >= SIDEBAR_MIN_WIDTH ? 'sidebar' : 'sheet')
  const [layout, setLayout] = useState<Layout>(read)
  useEffect(() => {
    const onResize = () => setLayout(read())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return layout
}

/** The page frame: header, the pixel canvas, and the panel area whose placement follows the layout. */
export function Shell({ header, canvas, side }: { header: ReactNode; canvas: ReactNode; side: ReactNode }) {
  const layout = useLayout()
  return (
    <div className="shell" data-layout={layout} data-testid="shell">
      <header className="shell__header">{header}</header>
      <main className="shell__main">
        <section className="shell__canvas">{canvas}</section>
        <aside className="shell__side">{side}</aside>
      </main>
    </div>
  )
}
