import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

function Nav() {
  const base = 'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors'
  const active = `${base} bg-slate-800 text-white`
  const inactive = `${base} text-slate-500 hover:text-slate-800`
  return (
    <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-2">
        <span className="text-slate-800 font-bold mr-3">MTG Scanner</span>
        <Link to="/" className={({ isActive }) => isActive ? active : inactive}>
          Scanner
        </Link>
        <Link to="/inventory" className={({ isActive }) => isActive ? active : inactive}>
          Inventory
        </Link>
        <Link to="/cards" className={({ isActive }) => isActive ? active : inactive}>
          Cards
        </Link>
        <Link to="/finance" className={({ isActive }) => isActive ? active : inactive}>
          Finance
        </Link>
        <Link to="/decks" className={({ isActive }) => isActive ? active : inactive}>
          Decks
        </Link>
      </div>
    </nav>
  )
}

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <Outlet />
    </div>
  ),
})
