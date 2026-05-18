import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <header className="header">
        <a className="brand" href="/">vike-islands demo</a>
        <nav className="nav">
          <a href="/">Home</a>
          <a href="/ssr-only">SSR-only page</a>
        </nav>
      </header>

      <main className="content">
        {children}
      </main>

      <footer className="footer">
        <small>vike-islands MVP — islands architecture for Vike + React</small>
      </footer>
    </div>
  )
}
