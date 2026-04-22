import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

const navBase = 'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors text-white'
const navActive = { className: `${navBase} bg-accent` }
const navInactive = { className: `${navBase} hover:bg-surface-strong` }

function Nav() {
  return (
    <nav className="sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-outline">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-2">
        <span className="text-white font-bold mr-3">MTG Scanner</span>
        <Link to="/" className={navInactive.className} activeProps={navActive} inactiveProps={navInactive}>Scanner</Link>
        <Link to="/inventory" className={navInactive.className} activeProps={navActive} inactiveProps={navInactive}>Inventory</Link>
        <Link to="/cards" className={navInactive.className} activeProps={navActive} inactiveProps={navInactive}>Cards</Link>
        <Link to="/finance" className={navInactive.className} activeProps={navActive} inactiveProps={navInactive}>Finance</Link>
        <Link to="/decks" className={navInactive.className} activeProps={navActive} inactiveProps={navInactive}>Decks</Link>
      </div>
    </nav>
  )
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-surface">
      <Nav />
      <Outlet />
    </div>
  ),
})
