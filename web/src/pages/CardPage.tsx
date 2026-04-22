import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, Card, InventoryEntry } from '../api'
import OracleText from '../components/OracleText'

export default function CardPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState(() => (state as any)?.card?.name ?? '')
  const [results, setResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Card | null>(() => (state as any)?.card ?? null)
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.inventory.list().then(setInventory)
  }, [])

  useEffect(() => {
    const card = (state as any)?.card ?? null
    setSelected(card)
    setQuery(card?.name ?? '')
  }, [state])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setSelected(null); setResults([]); return }
    // Query was set from router state — card is already displayed, don't search
    if (selected && selected.name === query) return
    setSelected(null)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await api.cards.search(query))
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const inventoryByCardId = new Map(inventory.map((e) => [e.card.id, e]))

  function select(card: Card) {
    setResults([])
    setQuery(card.name)
    navigate('/cards', { state: { card } })
  }

  const entry = selected ? inventoryByCardId.get(selected.id) : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-800 mb-6">Card Lookup</h1>

      {/* Search */}
      <div className="relative mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a card…"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching…</span>
        )}

        {results.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {results.map((card) => (
              <li key={card.id}>
                <button
                  onClick={() => select(card)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left cursor-pointer"
                >
                  {card.imageUri && (
                    <img src={card.imageUri} alt={card.name} className="w-7 rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{card.name}</p>
                    <p className="text-xs text-slate-400">{card.setName}</p>
                  </div>
                  {inventoryByCardId.has(card.id) && (
                    <span className="text-xs text-emerald-600 shrink-0">
                      ×{inventoryByCardId.get(card.id)!.quantity} owned
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Card detail */}
      {selected && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex gap-4 p-4">
            {selected.imageUri && (
              <img src={selected.imageUri} alt={selected.name} className="w-32 rounded-lg shrink-0 self-start" />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-800">{selected.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{selected.typeLine}</p>
              {selected.manaCost && (
                <p className="text-xs text-slate-400 mt-1">{selected.manaCost}</p>
              )}
              {selected.oracleText && (
                <div className="mt-2">
                  <OracleText text={selected.oracleText} />
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2">{selected.setName} · {selected.rarity}</p>

              {/* Prices */}
              {selected.prices && (
                <div className="flex gap-3 mt-2">
                  {selected.prices.usd && (
                    <span className="text-xs text-slate-600">${selected.prices.usd} <span className="text-slate-400">non-foil</span></span>
                  )}
                  {selected.prices.usd_foil && (
                    <span className="text-xs text-slate-600">${selected.prices.usd_foil} <span className="text-slate-400">foil</span></span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 px-4 py-3 flex flex-col gap-3">
            {/* Inventory count */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">In your collection</span>
              {entry ? (
                <span className="text-sm font-semibold text-emerald-700">×{entry.quantity}</span>
              ) : (
                <span className="text-sm text-slate-400">Not owned</span>
              )}
            </div>

            {/* Decks */}
            {entry && entry.inDecks.length > 0 && (
              <div>
                <p className="text-sm text-slate-500 mb-1.5">Used in decks</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.inDecks.map((d) => (
                    <Link
                      key={d.id}
                      to={`/decks/${d.id}`}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      {d.name} <span className="text-slate-400">×{d.quantity}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {entry && entry.inDecks.length === 0 && (
              <p className="text-sm text-slate-400">Not in any decks</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
