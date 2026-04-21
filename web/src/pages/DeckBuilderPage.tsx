import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, DeckDetail, InventoryEntry } from '../api'

export default function DeckBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [inventory, setInventory] = useState<InventoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [adjustingCardId, setAdjustingCardId] = useState<string | null>(null)
  const [skipAllocationWarning, setSkipAllocationWarning] = useState(
    () => localStorage.getItem('skipAllocationWarning') === 'true'
  )

  function toggleSkipWarning() {
    const next = !skipAllocationWarning
    setSkipAllocationWarning(next)
    localStorage.setItem('skipAllocationWarning', String(next))
  }

  const load = useCallback(async () => {
    const [d, inv] = await Promise.all([
      api.decks.get(id!),
      api.inventory.list(),
    ])
    setDeck(d)
    setInventory(inv)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const deckCardIds = new Set(deck?.cards.map((dc) => dc.card.id) ?? [])
  const totalCards = deck?.cards.reduce((sum, dc) => sum + dc.quantity, 0) ?? 0
  const inventoryQtyById = new Map(inventory.map((e) => [e.card.id, e.quantity]))

  const filtered = inventory.filter((entry) =>
    !search || entry.card.name.toLowerCase().includes(search.toLowerCase()),
  )

  async function addCard(cardId: string) {
    if (!deck) return
    setPendingCardId(cardId)
    try {
      const deckCard = await api.decks.addCard(deck.id, cardId)
      setDeck((prev) => {
        if (!prev) return prev
        const existing = prev.cards.find((c) => c.card.id === cardId)
        const cards = existing
          ? prev.cards.map((c) => c.card.id === cardId ? { ...c, quantity: deckCard.quantity } : c)
          : [...prev.cards, deckCard]
        return { ...prev, cards }
      })
    } finally {
      setPendingCardId(null)
    }
  }

  async function adjustCardQuantity(cardId: string, delta: number) {
    if (!deck) return
    const dc = deck.cards.find((c) => c.card.id === cardId)
    if (!dc) return
    const newQty = dc.quantity + delta
    setAdjustingCardId(cardId)
    try {
      const updated = await api.decks.setCardQuantity(deck.id, cardId, newQty)
      setDeck((prev) => {
        if (!prev) return prev
        const cards = updated
          ? prev.cards.map((c) => c.card.id === cardId ? { ...c, quantity: updated.quantity } : c)
          : prev.cards.filter((c) => c.card.id !== cardId)
        return { ...prev, cards }
      })
    } finally {
      setAdjustingCardId(null)
    }
  }

  async function removeCard(cardId: string) {
    if (!deck) return
    setPendingCardId(cardId)
    try {
      await api.decks.removeCard(deck.id, cardId)
      setDeck((prev) => prev ? { ...prev, cards: prev.cards.filter((c) => c.card.id !== cardId) } : prev)
    } finally {
      setPendingCardId(null)
    }
  }

  if (loading) return <p className="text-slate-400 text-sm text-center py-24">Loading…</p>
  if (!deck) return <p className="text-slate-400 text-sm text-center py-24">Deck not found.</p>

  const formatLimit = deck.format === 'commander' ? 100 : 60
  const progress = Math.min((totalCards / formatLimit) * 100, 100)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="mb-6">
        <Link to="/decks" className="text-sm text-slate-400 hover:text-slate-600 transition-colors">← Decks</Link>
        <div className="flex items-baseline gap-3 mt-1">
          <h1 className="text-3xl font-bold text-slate-800">{deck.name}</h1>
          <span className="text-sm text-slate-400 capitalize">{deck.format}</span>
        </div>

        {/* Card count progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>{totalCards} cards</span>
            <span>{formatLimit} required</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${totalCards >= formatLimit ? 'bg-emerald-500' : 'bg-slate-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Cards in deck */}
      {deck.cards.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">In this deck</h2>
          <ul className="flex flex-col gap-1.5">
            {deck.cards.map((dc) => {
              const maxCopies = deck.format === 'commander' ? 1 : 4
              const atMax = !dc.card.isBasicLand && dc.quantity >= maxCopies
              return (
              <li key={dc.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                {dc.card.imageUri && (
                  <img src={dc.card.imageUri} alt={dc.card.name} className="w-8 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{dc.card.name}</p>
                  <p className="text-xs text-slate-400">{dc.card.typeLine}</p>
                </div>
                {(() => {
                  const owned = inventoryQtyById.get(dc.card.id) ?? 0
                  const missing = dc.quantity - owned
                  return missing > 0 ? (
                    <span className="text-xs text-red-500 shrink-0">{missing} missing</span>
                  ) : null
                })()}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => adjustCardQuantity(dc.card.id, -1)}
                    disabled={adjustingCardId === dc.card.id}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 cursor-pointer text-base leading-none"
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={dc.card.isBasicLand ? undefined : maxCopies}
                    defaultValue={dc.quantity}
                    key={dc.quantity}
                    disabled={adjustingCardId === dc.card.id}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10)
                      if (!isNaN(val) && val !== dc.quantity) adjustCardQuantity(dc.card.id, val - dc.quantity)
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-10 text-center text-sm text-slate-600 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => adjustCardQuantity(dc.card.id, +1)}
                    disabled={adjustingCardId === dc.card.id || atMax}
                    title={atMax ? `Max ${maxCopies} cop${maxCopies === 1 ? 'y' : 'ies'} allowed` : undefined}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 cursor-pointer text-base leading-none"
                  >+</button>
                </div>
                <button
                  onClick={() => removeCard(dc.card.id)}
                  disabled={pendingCardId === dc.card.id || adjustingCardId === dc.card.id}
                  className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none disabled:opacity-40 cursor-pointer"
                >
                  ×
                </button>
              </li>
            )})}
          </ul>
        </section>
      )}

      {/* Add from inventory */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Add from inventory</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />

        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">
            {inventory.length === 0 ? 'Your inventory is empty.' : 'No cards match your search.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {filtered.map((entry) => {
              const inDeck = deckCardIds.has(entry.card.id)
              // Copies allocated to OTHER decks
              const copiesElsewhere = entry.inDecks
                .filter((d) => d.id !== deck.id)
                .reduce((sum, d) => sum + d.quantity, 0)
              const allCopiesAllocated = !inDeck && copiesElsewhere >= entry.quantity
              const showWarning = allCopiesAllocated && !skipAllocationWarning
              return (
                <li key={entry.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 ${inDeck ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  {entry.card.imageUri && (
                    <img src={entry.card.imageUri} alt={entry.card.name} className="w-8 rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{entry.card.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-slate-400">{entry.card.typeLine}</span>
                      {entry.inDecks.map((d) => (
                        <Link
                          key={d.id}
                          to={`/decks/${d.id}`}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 rounded px-1.5 py-0.5 transition-colors"
                        >
                          {d.name} ×{d.quantity}
                        </Link>
                      ))}
                    </div>
                    {showWarning && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        All copies allocated to other decks ·{' '}
                        <button onClick={toggleSkipWarning} className="underline hover:text-amber-800 cursor-pointer">
                          Don't warn me again
                        </button>
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">×{entry.quantity}</span>
                  <button
                    onClick={() => inDeck ? removeCard(entry.card.id) : addCard(entry.card.id)}
                    disabled={pendingCardId === entry.card.id}
                    className={`text-sm px-2.5 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                      inDeck
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-600'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {pendingCardId === entry.card.id ? '…' : inDeck ? 'In deck' : 'Add'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
