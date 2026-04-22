import { useState, useEffect, useRef, createContext, useContext } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { api, Card, InventoryEntry } from '../api'
import OracleText from '../components/OracleText'

// --- Context ---

interface CardLookupCtx {
  query: string
  setQuery: (q: string) => void
  results: Card[]
  searching: boolean
  selected: Card | null
  inventoryByCardId: Map<string, InventoryEntry>
  select: (card: Card) => void
}

const CardLookupContext = createContext<CardLookupCtx | null>(null)

function useCardLookup() {
  const ctx = useContext(CardLookupContext)
  if (!ctx) throw new Error('Must be used inside <CardLookup>')
  return ctx
}

// --- Compound component ---

interface CardLocationState {
  card?: Card
}

function CardLookup({ children }: { children: React.ReactNode }) {
  const { state } = useLocation()
  const locationState = state as CardLocationState | null
  const navigate = useNavigate()
  const [query, setQuery] = useState(() => locationState?.card?.name ?? '')
  const [results, setResults] = useState<Card[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Card | null>(() => locationState?.card ?? null)
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { api.inventory.list().then(setInventory) }, [])

  useEffect(() => {
    const card = locationState?.card ?? null
    setSelected(card)
    setQuery(card?.name ?? '')
  }, [state])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setSelected(null); setResults([]); return }
    if (selected && selected.name === query) return
    setSelected(null)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await api.cards.search(query)) }
      finally { setSearching(false) }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  function select(card: Card) {
    setResults([])
    setQuery(card.name)
    navigate({ to: '/cards', state: { card } })
  }

  const inventoryByCardId = new Map(inventory.map((e) => [e.card.id, e]))

  return (
    <CardLookupContext.Provider value={{ query, setQuery, results, searching, selected, inventoryByCardId, select }}>
      {children}
    </CardLookupContext.Provider>
  )
}

CardLookup.Search = function Search() {
  const { query, setQuery, searching, results, inventoryByCardId, select } = useCardLookup()
  return (
    <div className="relative mb-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a card…"
        className="w-full px-3 py-2 border border-outline-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-focus"
      />
      {searching && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-faint">Searching…</span>
      )}
      {results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-outline rounded-lg shadow-lg overflow-hidden">
          {results.map((card) => (
            <li key={card.id}>
              <button
                onClick={() => select(card)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface text-left cursor-pointer"
              >
                {card.imageUri && <img src={card.imageUri} alt={card.name} className="w-7 rounded shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg truncate">{card.name}</p>
                  <p className="text-xs text-fg-faint">{card.setName}</p>
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
  )
}

CardLookup.Detail = function Detail() {
  const { selected, inventoryByCardId } = useCardLookup()
  if (!selected) return null
  const entry = inventoryByCardId.get(selected.id)
  return (
    <div className="bg-white border border-outline rounded-xl overflow-hidden">
      <div className="flex gap-4 p-4">
        {selected.imageUri && (
          <img src={selected.imageUri} alt={selected.name} className="w-32 rounded-lg shrink-0 self-start" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-fg">{selected.name}</h2>
          <p className="text-sm text-fg-muted mt-0.5">{selected.typeLine}</p>
          {selected.manaCost && <p className="text-xs text-fg-faint mt-1">{selected.manaCost}</p>}
          {selected.oracleText && <div className="mt-2"><OracleText text={selected.oracleText} /></div>}
          <p className="text-xs text-fg-faint mt-2">{selected.setName} · {selected.rarity}</p>
          {selected.prices && <CardLookup.Prices prices={selected.prices} />}
        </div>
      </div>
      <CardLookup.Ownership entry={entry} />
    </div>
  )
}

CardLookup.Prices = function Prices({ prices }: { prices: Record<string, string | null> }) {
  const usd = prices.usd
  const foil = prices.usd_foil
  if (!usd && !foil) return null
  return (
    <div className="flex gap-3 mt-2">
      {usd && <span className="text-xs text-fg-soft">${usd} <span className="text-fg-faint">non-foil</span></span>}
      {foil && <span className="text-xs text-fg-soft">${foil} <span className="text-fg-faint">foil</span></span>}
    </div>
  )
}

CardLookup.Ownership = function Ownership({ entry }: { entry: InventoryEntry | undefined }) {
  return (
    <div className="border-t border-outline-subtle px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-fg-muted">In your collection</span>
        {entry
          ? <span className="text-sm font-semibold text-emerald-700">×{entry.quantity}</span>
          : <span className="text-sm text-fg-faint">Not owned</span>
        }
      </div>
      {entry && entry.inDecks.length > 0 && (
        <div>
          <p className="text-sm text-fg-muted mb-1.5">Used in decks</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.inDecks.map((d) => (
              <Link
                key={d.id}
                to="/decks/$id"
                params={{ id: d.id }}
                className="text-xs bg-surface-muted hover:bg-surface-strong text-fg-soft rounded-lg px-2.5 py-1 transition-colors"
              >
                {d.name} <span className="text-fg-faint">×{d.quantity}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {entry && entry.inDecks.length === 0 && (
        <p className="text-sm text-fg-faint">Not in any decks</p>
      )}
    </div>
  )
}

// --- Page ---

export default function CardPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-fg mb-6">Card Lookup</h1>
      <CardLookup>
        <CardLookup.Search />
        <CardLookup.Detail />
      </CardLookup>
    </div>
  )
}
