import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import CardScanner from './components/CardScanner'
import InventoryPage from './pages/InventoryPage'
import FinancePage from './pages/FinancePage'
import CardPage from './pages/CardPage'
import DecksPage from './pages/DecksPage'
import DeckBuilderPage from './pages/DeckBuilderPage'

function Nav() {
  const base = 'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors'
  const active = `${base} bg-slate-800 text-white`
  const inactive = `${base} text-slate-500 hover:text-slate-800`
  return (
    <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-2">
        <span className="text-slate-800 font-bold mr-3">MTG Scanner</span>
        <NavLink to="/" end className={({ isActive }) => isActive ? active : inactive}>
          Scanner
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => isActive ? active : inactive}>
          Inventory
        </NavLink>
        <NavLink to="/cards" className={({ isActive }) => isActive ? active : inactive}>
          Cards
        </NavLink>
        <NavLink to="/finance" className={({ isActive }) => isActive ? active : inactive}>
          Finance
        </NavLink>
        <NavLink to="/decks" className={({ isActive }) => isActive ? active : inactive}>
          Decks
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Nav />
        <Routes>
          <Route path="/" element={<CardScanner />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/cards" element={<CardPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/decks" element={<DecksPage />} />
          <Route path="/decks/:id" element={<DeckBuilderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
